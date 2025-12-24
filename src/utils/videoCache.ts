// src/utils/videoCache.ts
import { decryptBytes, encryptBytes } from "./audioCrypto"; // reuse same crypto

const DB_NAME = "qr-media-cache";
const STORE_NAME = "video";
const VERSION = 1;

type CachedVideo = {
  key: string; // absolute URL
  data: ArrayBuffer; // encrypted or raw
  createdAt: number;
  ttlMs: number;
  encrypted: boolean;
  mime: string; // "video/mp4"
};

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, VERSION);

    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: "key" });
      }
    };

    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function txDone(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

function normalizeToAbsoluteUrl(url: string): string {
  const base =
    typeof window !== "undefined"
      ? window.location.origin + (import.meta as any).env.BASE_URL
      : "http://localhost/";
  return new URL(url, base).href;
}

export async function loadVideoWithCache(opts: {
  url: string; // remote video url
  ttlMs: number; // ex: session remaining ms OR 30min
  encrypt?: boolean;
  mime?: string; // default video/mp4
}): Promise<{ url: string; source: "cache" | "network" }> {
  const db = await openDB();
  const absUrl = normalizeToAbsoluteUrl(opts.url);
  const now = Date.now();
  const mime = opts.mime || "video/mp4";
  const useEncrypt = Boolean(opts.encrypt);

  // ---------- READ ----------
  const cached = await new Promise<CachedVideo | undefined>((resolve) => {
    const tx = db.transaction(STORE_NAME, "readonly");
    const store = tx.objectStore(STORE_NAME);
    const req = store.get(absUrl);
    req.onsuccess = () => resolve(req.result as CachedVideo | undefined);
    req.onerror = () => resolve(undefined);
  });

  if (cached && now - cached.createdAt < cached.ttlMs) {
    let buf = cached.data;
    if (cached.encrypted) buf = await decryptBytes(buf);

    console.log("🎬 Video loaded from LOCAL CACHE:", absUrl);
    const objectUrl = URL.createObjectURL(new Blob([buf], { type: cached.mime }));
    return { url: objectUrl, source: "cache" };
  }

  // ---------- NETWORK ----------
  console.log("🌐 Video fetched from NETWORK:", absUrl);
  const res = await fetch(absUrl, { cache: "no-store" });
  if (!res.ok) throw new Error(`Video fetch failed: ${res.status}`);

  const buf = await res.arrayBuffer();
  const writeBuf = useEncrypt ? await encryptBytes(buf) : buf;

  // ---------- WRITE ----------
  const tx = db.transaction(STORE_NAME, "readwrite");
  tx.objectStore(STORE_NAME).put({
    key: absUrl,
    data: writeBuf,
    createdAt: now,
    ttlMs: opts.ttlMs,
    encrypted: useEncrypt,
    mime,
  } satisfies CachedVideo);

  await txDone(tx);

  const objectUrl = URL.createObjectURL(new Blob([buf], { type: mime }));
  return { url: objectUrl, source: "network" };
}

export async function clearExpiredVideoCache(): Promise<void> {
  const db = await openDB();
  const now = Date.now();

  const tx = db.transaction(STORE_NAME, "readwrite");
  const store = tx.objectStore(STORE_NAME);

  await new Promise<void>((resolve, reject) => {
    const req = store.openCursor();
    req.onerror = () => reject(req.error);
    req.onsuccess = () => {
      const cursor = req.result as IDBCursorWithValue | null;
      if (!cursor) return resolve();

      const value = cursor.value as CachedVideo;
      if (now - value.createdAt > value.ttlMs) cursor.delete();
      cursor.continue();
    };
  });

  await txDone(tx);
}

export async function clearAllVideoCache(): Promise<void> {
  const db = await openDB();
  const tx = db.transaction(STORE_NAME, "readwrite");
  tx.objectStore(STORE_NAME).clear();
  await txDone(tx);
  console.log("🧹 All video cache cleared");
}

// ✅ helper for cleanup
export function revokeVideoUrl(url: string) {
  try {
    URL.revokeObjectURL(url);
  } catch {}
}

