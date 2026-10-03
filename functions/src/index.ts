// Cloud Functions for Nutriuni.
//
// syncMenus copies the menus that duke_halal's GitHub Action builds three
// times a day (Mobile Order + NetNutrition, outputs/nutriuni) into Firestore.
// It polls instead of being called by the Action, so no Google credentials
// ever live in GitHub; publishing is a no-op unless index.json changed.
import { initializeApp } from 'firebase-admin/app';
import { FieldValue, getFirestore } from 'firebase-admin/firestore';
import * as logger from 'firebase-functions/logger';
import { defineString } from 'firebase-functions/params';
import { onSchedule } from 'firebase-functions/v2/scheduler';
import { syncOnce } from './sync';

initializeApp();

const MENU_SOURCE_BASE = defineString('MENU_SOURCE_BASE', {
  default: 'https://raw.githubusercontent.com/Naimy441/Naimy441.github.io/main/outputs/nutriuni',
  description: 'Base URL of the published outputs/nutriuni directory',
});

async function fetchBytes(path: string): Promise<Buffer> {
  const response = await fetch(`${MENU_SOURCE_BASE.value()}/${path}`, {
    headers: { 'User-Agent': 'nutriuni-sync' },
    signal: AbortSignal.timeout(20_000),
  });
  if (!response.ok) throw new Error(`GET ${path} returned ${response.status}`);
  return Buffer.from(await response.arrayBuffer());
}

export const syncMenus = onSchedule(
  {
    schedule: 'every 15 minutes',
    region: 'us-central1',
    memory: '256MiB',
    timeoutSeconds: 120,
    retryCount: 0, // the next run 15 minutes later is the retry
    maxInstances: 1,
  },
  async () => {
    const db = getFirestore();
    const metaRef = db.collection('menu_meta').doc('current');
    await syncOnce({
      fetchBytes,
      async readMeta() {
        const snapshot = await metaRef.get();
        return snapshot.exists ? (snapshot.data() as { index_hash?: string; versions?: Record<string, string> }) : null;
      },
      async commit({ meta, upserts, deletes }) {
        // One batch, so the app never sees an index pointing at missing or
        // stale restaurant documents (well under the 500-write limit).
        const batch = db.batch();
        const restaurants = db.collection('menu_restaurants');
        for (const { id, ...doc } of upserts) {
          batch.set(restaurants.doc(id), { ...doc, updated_at: FieldValue.serverTimestamp() });
        }
        for (const id of deletes) batch.delete(restaurants.doc(id));
        batch.set(metaRef, { ...meta, published_at: FieldValue.serverTimestamp() });
        await batch.commit();
      },
      log: (message, data) => logger.info(message, data),
    });
  },
);
