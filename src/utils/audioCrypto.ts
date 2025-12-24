// src/utils/audioCrypto.ts
// NOTE: This is obfuscation (not true DRM). It prevents easy casual reuse,
// but cannot stop a determined attacker (client-side keys can be extracted).

const SECRET = "bfouru-qr-audio-secret-v1"; // change this

function xor(data: Uint8Array, key: Uint8Array) {
  const out = new Uint8Array(data.length);
  for (let i = 0; i < data.length; i++) out[i] = data[i] ^ key[i % key.length];
  return out;
}

function keyBytes() {
  return new TextEncoder().encode(SECRET);
}

export async function encryptBytes(buf: ArrayBuffer): Promise<ArrayBuffer> {
  const data = new Uint8Array(buf);
  const out = xor(data, keyBytes());
  return out.buffer;
}

export async function decryptBytes(buf: ArrayBuffer): Promise<ArrayBuffer> {
  const data = new Uint8Array(buf);
  const out = xor(data, keyBytes());
  return out.buffer;
}
