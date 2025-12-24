// src/utils/audioCache.ts
import { decryptBytes, encryptBytes } from "./audioCrypto";

const DB_NAME = "qr-audio-cache";
const STORE_NAME = "audio";
const VERSION = 1;

type CachedAudio = {
  key: string; // absolute URL
  data: ArrayBuffer; // encrypted or raw bytes
  createdAt: number;
  ttlMs: number;
  encrypted: boolean;
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

function reqToPromise<T>(req: IDBRequest): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result as T);
    req.onerror = () => reject(req.error);
  });
}

function normalizeToAbsoluteUrl(url: string): string {
  // Works for:
  // - https://domain/...
  // - /qr-svg-builder/Raa_Baa_30s.mp3
  // - Raa_Baa_30s.mp3
  const base =
    typeof window !== "undefined"
      ? window.location.origin + (import.meta as any).env.BASE_URL
      : "http://localhost/";
  return new URL(url, base).href;
}

/**
 * Loads audio bytes with IndexedDB caching + optional encryption.
 * Returns an OBJECT URL (blob:) for playback.
 * Also returns the SOURCE so you can log and verify: "cache" vs "network".
 */
export async function loadAudioWithCache(opts: {
  url: string;
  ttlMs: number;
  encrypt?: boolean;
}): Promise<{ objectUrl: string; source: "cache" | "network"; absoluteUrl: string }> {
  const db = await openDB();
  const absUrl = normalizeToAbsoluteUrl(opts.url);
  const now = Date.now();
  const useEncrypt = Boolean(opts.encrypt);

  // ---------- READ ----------
  try {
    const tx = db.transaction(STORE_NAME, "readonly");
    const store = tx.objectStore(STORE_NAME);
    const cached = await reqToPromise<CachedAudio | undefined>(store.get(absUrl));
    await txDone(tx);

    if (cached && now - cached.createdAt < cached.ttlMs) {
      let buf = cached.data;
      if (cached.encrypted) buf = await decryptBytes(buf);

      const objectUrl = URL.createObjectURL(new Blob([buf], { type: "audio/mpeg" }));

      console.log("✅ Audio loaded from LOCAL CACHE:", absUrl);
      return { objectUrl, source: "cache", absoluteUrl: absUrl };
    }
  } catch {
    // ignore read issues; fallback to network
  }

  // ---------- NETWORK ----------
  console.log("🌐 Audio fetched from SERVER:", absUrl);
  const res = await fetch(absUrl, { cache: "no-store" });
  if (!res.ok) throw new Error(`Audio fetch failed: ${res.status}`);

  const rawBuf = await res.arrayBuffer();
  const writeBuf = useEncrypt ? await encryptBytes(rawBuf) : rawBuf;

  // ---------- WRITE ----------
  const txw = db.transaction(STORE_NAME, "readwrite");
  const storew = txw.objectStore(STORE_NAME);
  storew.put({
    key: absUrl,
    data: writeBuf,
    createdAt: now,
    ttlMs: opts.ttlMs,
    encrypted: useEncrypt,
  } satisfies CachedAudio);
  await txDone(txw);

  const objectUrl = URL.createObjectURL(new Blob([rawBuf], { type: "audio/mpeg" }));
  return { objectUrl, source: "network", absoluteUrl: absUrl };
}

export async function clearExpiredAudioCache(): Promise<void> {
  const db = await openDB();
  const now = Date.now();

  const tx = db.transaction(STORE_NAME, "readwrite");
  const store = tx.objectStore(STORE_NAME);

  const cursorReq = store.openCursor();
  await new Promise<void>((resolve, reject) => {
    cursorReq.onerror = () => reject(cursorReq.error);
    cursorReq.onsuccess = () => {
      const cursor = cursorReq.result as IDBCursorWithValue | null;
      if (!cursor) return resolve();

      const value = cursor.value as CachedAudio;
      if (now - value.createdAt > value.ttlMs) {
        cursor.delete();
      }
      cursor.continue();
    };
  });

  await txDone(tx);
}

export async function clearAllAudioCache(): Promise<void> {
  const db = await openDB();
  const tx = db.transaction(STORE_NAME, "readwrite");
  tx.objectStore(STORE_NAME).clear();
  await txDone(tx);
  console.log("🧹 All audio cache cleared");
}
