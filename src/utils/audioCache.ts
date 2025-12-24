/* -------------------------------------------------------------------------- */
/* 🔐 Audio Cache (IndexedDB)                                                 */
/* -------------------------------------------------------------------------- */

const DB_NAME = "qr-audio-cache";
const STORE_NAME = "audio";
const VERSION = 1;
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

type CachedAudio = {
  key: string;
  data: ArrayBuffer;
  createdAt: number;
};

/* -------------------------------------------------------------------------- */
/* 🧠 DB Open                                                                 */
/* -------------------------------------------------------------------------- */

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

/* -------------------------------------------------------------------------- */
/* 📦 Core Cache Logic                                                        */
/* -------------------------------------------------------------------------- */

export async function getCachedAudioUrlOrFetch(
  url: string
): Promise<{ blob: Blob; source: "cache" | "network" }> {
  const db = await openDB();

  /* ------------------ READ PHASE ------------------ */
  const cached = await new Promise<CachedAudio | undefined>((resolve) => {
    const tx = db.transaction(STORE_NAME, "readonly");
    const store = tx.objectStore(STORE_NAME);
    const req = store.get(url);

    req.onsuccess = () => resolve(req.result as CachedAudio | undefined);
    req.onerror = () => resolve(undefined);
  });

  if (cached && Date.now() - cached.createdAt < CACHE_TTL) {
    console.log("🎧 Audio loaded from CACHE");
    return {
      blob: new Blob([cached.data], { type: "audio/mpeg" }),
      source: "cache",
    };
  }

  /* ------------------ NETWORK PHASE ------------------ */
  console.log("🌐 Audio fetched from NETWORK");
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error("Audio fetch failed");

  const buf = await res.arrayBuffer();

  /* ------------------ WRITE PHASE ------------------ */
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);

    store.put({
      key: url,
      data: buf,
      createdAt: Date.now(),
    } satisfies CachedAudio);

    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });

  return {
    blob: new Blob([buf], { type: "audio/mpeg" }),
    source: "network",
  };
}

/* -------------------------------------------------------------------------- */
/* ▶ Used by CustomAudioPlayer                                                */
/* -------------------------------------------------------------------------- */

export async function loadAudioWithCache(
  url: string
): Promise<{ url: string; source: "cache" | "network" }> {
  const { blob, source } = await getCachedAudioUrlOrFetch(url);
  const objectUrl = URL.createObjectURL(blob);

  console.log(
    source === "cache"
      ? "✅ Playing audio from LOCAL CACHE"
      : "⬇️ Playing audio from SERVER"
  );

  return { url: objectUrl, source };
}

/* -------------------------------------------------------------------------- */
/* 🧹 Cleanup Utilities                                                       */
/* -------------------------------------------------------------------------- */

export async function clearExpiredAudioCache(): Promise<void> {
  const now = Date.now();
  const db = await openDB();

  const tx = db.transaction(STORE_NAME, "readwrite");
  const store = tx.objectStore(STORE_NAME);

  store.openCursor().onsuccess = (e) => {
    const cursor = (e.target as IDBRequest).result as IDBCursorWithValue | null;

    if (!cursor) return;

    const value = cursor.value as CachedAudio;
    if (now - value.createdAt > CACHE_TTL) {
      cursor.delete();
    }
    cursor.continue();
  };
}

export async function clearAllAudioCache(): Promise<void> {
  const db = await openDB();
  const tx = db.transaction(STORE_NAME, "readwrite");
  tx.objectStore(STORE_NAME).clear();
  console.log("🧹 All audio cache cleared");
}
