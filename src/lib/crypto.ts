// End-to-end crypto primitives (Web Crypto only, no external deps).
// - RSA-OAEP 3072 SHA-256 for wrapping conversation keys
// - AES-GCM 256 for content encryption
// - PBKDF2-SHA256 600k iterations to derive password wrap-key
// The unwrapped private key never leaves the browser tab memory.

const te = new TextEncoder();
const td = new TextDecoder();

export const b64 = {
  encode(buf: ArrayBuffer | Uint8Array) {
    const b = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
    let s = "";
    const chunk = 0x8000;
    for (let i = 0; i < b.length; i += chunk) {
      s += String.fromCharCode.apply(null, Array.from(b.subarray(i, i + chunk)));
    }
    return btoa(s);
  },
  decode(s: string) {
    const bin = atob(s);
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  },
};

export async function generateKeypair(): Promise<CryptoKeyPair> {
  return (await crypto.subtle.generateKey(
    { name: "RSA-OAEP", modulusLength: 3072, publicExponent: new Uint8Array([1, 0, 1]), hash: "SHA-256" },
    true,
    ["encrypt", "decrypt", "wrapKey", "unwrapKey"],
  )) as CryptoKeyPair;
}

export async function deriveWrapKey(password: string, salt: Uint8Array, iterations: number) {
  const base = await crypto.subtle.importKey("raw", te.encode(password), "PBKDF2", false, ["deriveKey"]);
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", salt, iterations, hash: "SHA-256" },
    base,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}

export async function exportPublicJwk(key: CryptoKey) {
  return crypto.subtle.exportKey("jwk", key);
}

export async function importPublicJwk(jwk: JsonWebKey) {
  return crypto.subtle.importKey("jwk", jwk, { name: "RSA-OAEP", hash: "SHA-256" }, false, ["encrypt"]);
}

export async function wrapPrivateKeyWithPassword(priv: CryptoKey, wrapKey: CryptoKey, iv: Uint8Array) {
  const pkcs8 = await crypto.subtle.exportKey("pkcs8", priv);
  const ct = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, wrapKey, pkcs8);
  return b64.encode(ct);
}

export async function unwrapPrivateKeyWithPassword(cipherB64: string, wrapKey: CryptoKey, iv: Uint8Array) {
  const pkcs8 = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, wrapKey, b64.decode(cipherB64));
  return crypto.subtle.importKey("pkcs8", pkcs8, { name: "RSA-OAEP", hash: "SHA-256" }, false, ["decrypt"]);
}

export async function generateConversationKey() {
  return crypto.subtle.generateKey({ name: "AES-GCM", length: 256 }, true, ["encrypt", "decrypt"]);
}

export async function wrapConversationKey(aesKey: CryptoKey, recipientPub: CryptoKey) {
  const raw = await crypto.subtle.exportKey("raw", aesKey);
  const wrapped = await crypto.subtle.encrypt({ name: "RSA-OAEP" }, recipientPub, raw);
  return b64.encode(wrapped);
}

export async function unwrapConversationKey(wrappedB64: string, priv: CryptoKey) {
  const raw = await crypto.subtle.decrypt({ name: "RSA-OAEP" }, priv, b64.decode(wrappedB64));
  return crypto.subtle.importKey("raw", raw, { name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]);
}

export async function encryptText(text: string, key: CryptoKey) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, te.encode(text));
  return { iv: b64.encode(iv), ciphertext: b64.encode(ct) };
}

export async function decryptText(iv: string, ciphertext: string, key: CryptoKey) {
  const pt = await crypto.subtle.decrypt({ name: "AES-GCM", iv: b64.decode(iv) }, key, b64.decode(ciphertext));
  return td.decode(pt);
}

export async function encryptBytes(bytes: Uint8Array, key: CryptoKey) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, bytes);
  return { iv, ciphertext: new Uint8Array(ct) };
}

export async function decryptBytes(iv: Uint8Array, ct: Uint8Array, key: CryptoKey) {
  const pt = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, ct);
  return new Uint8Array(pt);
}
