// src/utils/audioCache.ts

import { encryptBytes, decryptBytes } from "./audioCrypto";

/* -------------------------------------------------------------------------- */
/* ⚙️ Config                                                                   */
/* -------------------------------------------------------------------------- */

const DB_NAME = "qr-audio-db";
const STORE_NAME = "audio";
const CACHE_TTL_MS = 5 * 60 * 1000; // ⏱ 5 minutes

/* -------------------------------------------------------------------------- */
/* 🧠 Console Logger                                                           */
/* -------------------------------------------------------------------------- */

function audioLog(msg: string, extra?: any) {
  console.log(`%c[AUDIO] ${msg}`, "color:#0ea5e9;font-weight:700", extra ?? "");
}

/* -------------------------------------------------------------------------- */
/* 📦 IndexedDB                                                                */
/* -------------------------------------------------------------------------- */

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);

    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };

    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

/* -------------------------------------------------------------------------- */
/* 🔊 Load Audio with Cache + Encryption                                       */
/* -------------------------------------------------------------------------- */

export async function loadAudioWithCache(url: string): Promise<Blob> {
  const db = await openDB();
  const now = Date.now();

  /* ---------------------------------------------------------------------- */
  /* 1️⃣ Try LOCAL CACHE                                                     */
  /* ---------------------------------------------------------------------- */

  const cached = await new Promise<any>((resolve) => {
    const tx = db.transaction(STORE_NAME, "readonly");
    const store = tx.objectStore(STORE_NAME);
    const req = store.get(url);

    req.onsuccess = () => resolve(req.result);
    req.onerror = () => resolve(null);
  });

  if (cached) {
    const age = now - cached.time;

    if (age < CACHE_TTL_MS) {
      audioLog("source=LOCAL_CACHE", { ageMs: age });

      const decrypted = await decryptBytes(cached.data);
      return new Blob([decrypted], { type: "audio/mpeg" });
    } else {
      audioLog("cache=EXPIRED");
    }
  }

  /* ---------------------------------------------------------------------- */
  /* 2️⃣ FETCH FROM SERVER                                                   */
  /* ---------------------------------------------------------------------- */

  audioLog("source=SERVER_FETCH", url);

  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error("Audio fetch failed");

  const buf = await res.arrayBuffer();

  /* ---------------------------------------------------------------------- */
  /* 3️⃣ Encrypt + Save                                                      */
  /* ---------------------------------------------------------------------- */

  const encrypted = await encryptBytes(buf);

  await new Promise<void>((resolve) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);

    store.put(
      {
        data: encrypted,
        time: now,
      },
      url
    );

    tx.oncomplete = () => resolve();
  });

  return new Blob([buf], { type: "audio/mpeg" });
}

/* -------------------------------------------------------------------------- */
/* 🧹 Optional: Clear All Cached Audio                                         */
/* -------------------------------------------------------------------------- */

export async function clearAudioCache() {
  const db = await openDB();
  const tx = db.transaction(STORE_NAME, "readwrite");
  tx.objectStore(STORE_NAME).clear();
  audioLog("cache=CLEARED");
}
