// Runs syncOnce against the real published files in a local duke_halal checkout
// with an in-memory Firestore stand-in.   npm test   (MENU_DIR overrides the path)
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import { contentHash, MetaWrite, PublishedMeta, RestaurantWrite, SyncDeps, syncOnce } from '../sync';

const MENU_DIR = process.env.MENU_DIR ?? join(__dirname, '../../../../../duke_halal/outputs/nutriuni');

interface FakeDb {
  meta: (MetaWrite & PublishedMeta) | null;
  docs: Map<string, RestaurantWrite>;
  commits: number;
}

function deps(db: FakeDb, files: Record<string, Buffer> = {}): SyncDeps {
  return {
    async fetchBytes(path) {
      return files[path] ?? readFileSync(join(MENU_DIR, path));
    },
    async readMeta() {
      return db.meta;
    },
    async commit({ meta, upserts, deletes }) {
      const size = Buffer.byteLength(JSON.stringify({ meta, upserts }));
      assert.ok(size < 10 * 1024 * 1024, `batch is ${size} bytes`);
      for (const doc of upserts) {
        assert.ok(Buffer.byteLength(doc.data) + Buffer.byteLength(doc.icon ?? '') < 1_000_000, `${doc.id} too large`);
        db.docs.set(doc.id, doc);
      }
      for (const id of deletes) db.docs.delete(id);
      db.meta = meta;
      db.commits++;
    },
    log() {},
  };
}

const freshDb = (): FakeDb => ({ meta: null, docs: new Map(), commits: 0 });
const index = () => JSON.parse(readFileSync(join(MENU_DIR, 'index.json'), 'utf8'));

test('first run publishes every restaurant and its icon', async () => {
  const db = freshDb();
  const result = await syncOnce(deps(db));
  assert.equal(result.status, 'published');
  const rows = index().restaurants;
  assert.equal(db.docs.size, rows.length);
  for (const row of rows) {
    const doc = db.docs.get(row.id)!;
    assert.equal(JSON.parse(doc.data).id, row.id);
    assert.equal(doc.version, db.meta!.versions[row.id]);
    assert.equal(Boolean(doc.icon), Boolean(row.icon));
  }
  assert.equal(JSON.parse(db.meta!.index).generated_at, result.generated_at);
});

test('an unchanged index costs no writes', async () => {
  const db = freshDb();
  await syncOnce(deps(db));
  const result = await syncOnce(deps(db));
  assert.equal(result.status, 'unchanged');
  assert.equal(db.commits, 1);
});

test('only changed restaurants are rewritten, removed ones deleted', async () => {
  const db = freshDb();
  await syncOnce(deps(db));
  const data = index();
  const [first, second] = data.restaurants;
  // Pretend the previous publish had an older Bella Union and an extra restaurant.
  db.meta = { ...db.meta!, index_hash: 'stale', versions: { ...db.meta!.versions, [first.id]: 'old:', 'closed-cafe': 'x:' } };
  db.docs.set('closed-cafe', { ...db.docs.get(second.id)!, id: 'closed-cafe' });
  const result = await syncOnce(deps(db));
  assert.equal(result.status, 'published');
  if (result.status === 'published') {
    assert.deepEqual(result.upserted, [first.id]);
    assert.deepEqual(result.deleted, ['closed-cafe']);
  }
  assert.ok(!db.docs.has('closed-cafe'));
});

test('a file from a different commit than the index is rejected', async () => {
  const db = freshDb();
  const row = index().restaurants[0];
  const tampered = Buffer.from(readFileSync(join(MENU_DIR, 'restaurants', row.file), 'utf8').replace('"name"', '"name" '));
  await assert.rejects(syncOnce(deps(db, { [`restaurants/${row.file}`]: tampered })), /does not match index/);
  assert.equal(db.commits, 0);
});

test('a scrape that loses most restaurants is not published', async () => {
  const db = freshDb();
  await syncOnce(deps(db));
  const shrunk = index();
  shrunk.restaurants = shrunk.restaurants.slice(0, 8);
  const bytes = Buffer.from(JSON.stringify(shrunk));
  await assert.rejects(syncOnce(deps(db, { 'index.json': bytes })), /broken scrape/);
  assert.equal(db.commits, 1);
});

test('an unknown schema version is not published', async () => {
  const db = freshDb();
  const future = { ...index(), schema_version: 2 };
  await assert.rejects(syncOnce(deps(db, { 'index.json': Buffer.from(JSON.stringify(future)) })), /schema_version/);
});

test('content hashes match the Python builder', () => {
  const row = index().restaurants[0];
  assert.equal(contentHash(readFileSync(join(MENU_DIR, 'restaurants', row.file))), row.hash);
});
