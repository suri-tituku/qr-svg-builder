// src/utils/audioCrypto.ts

const SECRET = "bfouru-qr-audio-secret-v1";

/* -------------------------------------------------------------------------- */
/* 🔐 Simple XOR Encryption (obfuscation, not DRM)                             */
/* -------------------------------------------------------------------------- */

function keyBytes() {
  return new TextEncoder().encode(SECRET);
}

function xor(data: Uint8Array, key: Uint8Array) {
  const out = new Uint8Array(data.length);
  for (let i = 0; i < data.length; i++) {
    out[i] = data[i] ^ key[i % key.length];
  }
  return out;
}

export async function encryptBytes(buf: ArrayBuffer): Promise<ArrayBuffer> {
  const data = new Uint8Array(buf);
  return xor(data, keyBytes()).buffer;
}

export async function decryptBytes(buf: ArrayBuffer): Promise<ArrayBuffer> {
  // XOR decrypt = XOR encrypt
  const data = new Uint8Array(buf);
  return xor(data, keyBytes()).buffer;
}
