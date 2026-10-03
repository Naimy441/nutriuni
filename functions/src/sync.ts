// Publishes the menus built by duke_halal (nutriuni/menus on GitHub) to
// Firestore. Pure logic with injected I/O so it can be tested locally.
//
// Firestore layout (read by the app, see services/MenuDatabase.ts):
//   menu_meta/current           { schema_version, generated_at, index, index_hash, versions, published_at }
//   menu_restaurants/{id}       { data, version, hash, icon, icon_hash, updated_at }
// `index` and `data` hold the published JSON files verbatim; `versions` maps
// restaurant id -> "<file hash>:<icon hash>" so the app downloads only what changed.
import { createHash } from 'node:crypto';

export const SUPPORTED_SCHEMA_VERSION = 1;
const ID_PATTERN = /^[a-z0-9-]{1,80}$/;
const HASH_PATTERN = /^[0-9a-f]{20}$/;
const MAX_RESTAURANT_BYTES = 900_000; // Firestore documents max out at 1 MiB.
const MAX_ICON_BYTES = 150_000;
const MAX_INDEX_BYTES = 500_000;
// A scrape that suddenly loses most restaurants is far more likely a broken
// run than a real change; refuse it and keep serving the last good data.
const MIN_KEPT_FRACTION = 0.6;
const MIN_RESTAURANTS = 5;

export interface IndexRow {
  id: string;
  name: string;
  file: string;
  hash: string;
  icon: string | null;
  icon_hash: string | null;
}

export interface MenuIndexFile {
  schema_version: number;
  generated_at: string;
  restaurants: IndexRow[];
}

export interface PublishedMeta {
  index_hash?: string;
  versions?: Record<string, string>;
}

export interface RestaurantWrite {
  id: string;
  data: string;
  version: string;
  hash: string;
  icon: string | null;
  icon_hash: string | null;
}

export interface MetaWrite {
  schema_version: number;
  generated_at: string;
  index: string;
  index_hash: string;
  versions: Record<string, string>;
}

export interface SyncDeps {
  // Fetch a file under nutriuni/menus ("index.json", "restaurants/x.json", "icons/x.jpg").
  fetchBytes(path: string): Promise<Buffer>;
  readMeta(): Promise<PublishedMeta | null>;
  // Must apply every write atomically.
  commit(change: { meta: MetaWrite; upserts: RestaurantWrite[]; deletes: string[] }): Promise<void>;
  log(message: string, data?: Record<string, unknown>): void;
}

export type SyncResult =
  | { status: 'unchanged'; generated_at: string }
  | { status: 'published'; generated_at: string; upserted: string[]; deleted: string[] };

export function contentHash(bytes: Buffer): string {
  return createHash('sha256').update(bytes).digest('hex').slice(0, 20);
}

export function versionOf(row: Pick<IndexRow, 'hash' | 'icon_hash'>): string {
  return `${row.hash}:${row.icon_hash ?? ''}`;
}

export function parseIndex(bytes: Buffer): MenuIndexFile {
  if (bytes.length > MAX_INDEX_BYTES) throw new Error(`index.json is ${bytes.length} bytes`);
  const index = JSON.parse(bytes.toString('utf8')) as MenuIndexFile;
  if (index.schema_version !== SUPPORTED_SCHEMA_VERSION) {
    throw new Error(`unsupported schema_version ${index.schema_version}`);
  }
  if (typeof index.generated_at !== 'string' || Number.isNaN(Date.parse(index.generated_at))) {
    throw new Error('index.json has no valid generated_at');
  }
  if (!Array.isArray(index.restaurants) || index.restaurants.length < MIN_RESTAURANTS) {
    throw new Error(`index.json lists ${index.restaurants?.length ?? 0} restaurants`);
  }
  const seen = new Set<string>();
  for (const row of index.restaurants) {
    if (!ID_PATTERN.test(row.id) || seen.has(row.id)) throw new Error(`bad or duplicate restaurant id ${row.id}`);
    seen.add(row.id);
    if (row.file !== `${row.id}.json`) throw new Error(`${row.id}: unexpected file ${row.file}`);
    if (!HASH_PATTERN.test(row.hash)) throw new Error(`${row.id}: bad hash`);
    if (row.icon !== null && (row.icon !== `${row.id}.jpg` || !HASH_PATTERN.test(row.icon_hash ?? ''))) {
      throw new Error(`${row.id}: bad icon reference`);
    }
  }
  return index;
}

function checkRestaurant(row: IndexRow, bytes: Buffer): string {
  if (bytes.length > MAX_RESTAURANT_BYTES) throw new Error(`${row.id}: ${bytes.length} bytes is too large`);
  const actual = contentHash(bytes);
  if (actual !== row.hash) {
    // Usually GitHub's CDN serving the index and a file from different commits.
    throw new Error(`${row.id}: hash ${actual} does not match index ${row.hash}`);
  }
  const text = bytes.toString('utf8');
  const menu = JSON.parse(text);
  if (menu.id !== row.id || menu.schema_version !== SUPPORTED_SCHEMA_VERSION
    || !Array.isArray(menu.sections) || typeof menu.foods !== 'object') {
    throw new Error(`${row.id}: unexpected restaurant shape`);
  }
  return text;
}

export async function syncOnce(deps: SyncDeps): Promise<SyncResult> {
  const indexBytes = await deps.fetchBytes('index.json');
  const index = parseIndex(indexBytes);
  const indexHash = contentHash(indexBytes);
  const current = await deps.readMeta();
  if (current?.index_hash === indexHash) {
    deps.log('Menus unchanged', { generated_at: index.generated_at });
    return { status: 'unchanged', generated_at: index.generated_at };
  }

  const previous = current?.versions ?? {};
  const previousCount = Object.keys(previous).length;
  if (previousCount && index.restaurants.length < previousCount * MIN_KEPT_FRACTION) {
    throw new Error(
      `refusing to publish ${index.restaurants.length} restaurants over ${previousCount}; looks like a broken scrape`,
    );
  }

  const versions: Record<string, string> = {};
  const changed = index.restaurants.filter(row => {
    versions[row.id] = versionOf(row);
    return previous[row.id] !== versions[row.id];
  });
  const upserts = await Promise.all(changed.map(async (row): Promise<RestaurantWrite> => {
    const data = checkRestaurant(row, await deps.fetchBytes(`restaurants/${row.file}`));
    let icon: string | null = null;
    if (row.icon) {
      const iconBytes = await deps.fetchBytes(`icons/${row.icon}`);
      if (iconBytes.length > MAX_ICON_BYTES) throw new Error(`${row.id}: icon is too large`);
      if (contentHash(iconBytes) !== row.icon_hash) throw new Error(`${row.id}: icon hash mismatch`);
      icon = iconBytes.toString('base64');
    }
    return { id: row.id, data, version: versions[row.id], hash: row.hash, icon, icon_hash: row.icon_hash };
  }));
  const deletes = Object.keys(previous).filter(id => !(id in versions));

  await deps.commit({
    meta: {
      schema_version: index.schema_version,
      generated_at: index.generated_at,
      index: indexBytes.toString('utf8'),
      index_hash: indexHash,
      versions,
    },
    upserts,
    deletes,
  });
  const result: SyncResult = {
    status: 'published',
    generated_at: index.generated_at,
    upserted: upserts.map(u => u.id),
    deleted: deletes,
  };
  deps.log('Menus published', result);
  return result;
}
