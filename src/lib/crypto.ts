// Browser E2EE helpers: RSA-OAEP-2048 for key exchange, AES-GCM-256 for messages.

const enc = new TextEncoder();
const dec = new TextDecoder();

export type PublicKeyJwk = JsonWebKey;
export type PrivateKeyJwk = JsonWebKey;

export async function generateKeyPair() {
  const kp = await crypto.subtle.generateKey(
    { name: "RSA-OAEP", modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: "SHA-256" },
    true,
    ["encrypt", "decrypt"],
  );
  const publicJwk = await crypto.subtle.exportKey("jwk", kp.publicKey);
  const privateJwk = await crypto.subtle.exportKey("jwk", kp.privateKey);
  return { publicJwk, privateJwk };
}

export async function importPublicKey(jwk: PublicKeyJwk) {
  return crypto.subtle.importKey("jwk", jwk, { name: "RSA-OAEP", hash: "SHA-256" }, false, ["encrypt"]);
}

export async function importPrivateKey(jwk: PrivateKeyJwk) {
  return crypto.subtle.importKey("jwk", jwk, { name: "RSA-OAEP", hash: "SHA-256" }, false, ["decrypt"]);
}

function b64(buf: ArrayBuffer) {
  return btoa(String.fromCharCode(...new Uint8Array(buf)));
}
function unb64(s: string) {
  return Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
}

export interface EncryptedPayload {
  ct: string; // base64 ciphertext
  iv: string; // base64 iv
  ek: string; // base64 rsa-encrypted aes key
}

export async function encryptFor(recipientPublicJwk: PublicKeyJwk, plaintext: string): Promise<EncryptedPayload> {
  const aesKey = await crypto.subtle.generateKey({ name: "AES-GCM", length: 256 }, true, ["encrypt", "decrypt"]);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, aesKey, enc.encode(plaintext));
  const rawAes = await crypto.subtle.exportKey("raw", aesKey);
  const pub = await importPublicKey(recipientPublicJwk);
  const ek = await crypto.subtle.encrypt({ name: "RSA-OAEP" }, pub, rawAes);
  return { ct: b64(ct), iv: b64(iv.buffer), ek: b64(ek) };
}

export async function decryptWith(privateJwk: PrivateKeyJwk, payload: EncryptedPayload): Promise<string> {
  const priv = await importPrivateKey(privateJwk);
  const rawAes = await crypto.subtle.decrypt({ name: "RSA-OAEP" }, priv, unb64(payload.ek));
  const aesKey = await crypto.subtle.importKey("raw", rawAes, { name: "AES-GCM" }, false, ["decrypt"]);
  const pt = await crypto.subtle.decrypt({ name: "AES-GCM", iv: unb64(payload.iv) }, aesKey, unb64(payload.ct));
  return dec.decode(pt);
}
