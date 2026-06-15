import * as SecureStore from 'expo-secure-store';
import * as Crypto from 'expo-crypto';
import CryptoJS from 'crypto-js';

/**
 * At-rest encryption for cached content (e.g. downloaded hadith books) so the
 * files are unreadable if extracted from the device. The AES key is generated
 * once per install and kept in the OS secure store (iOS Keychain / Android
 * Keystore) — it never ships in the app bundle and never leaves the device.
 *
 * Note: this protects against casual extraction (backups, adb pull, file
 * managers). It is not a defence against a determined attacker who fully
 * controls the unlocked device, since the app itself must be able to decrypt.
 */

const KEY_STORE_ID = 'wedeen_content_key_v1';

let keyPromise: Promise<CryptoJS.lib.WordArray> | null = null;

function toHex(bytes: Uint8Array) {
  let out = '';
  for (let i = 0; i < bytes.length; i += 1) out += bytes[i].toString(16).padStart(2, '0');
  return out;
}

async function loadKey(): Promise<CryptoJS.lib.WordArray> {
  let hex = await SecureStore.getItemAsync(KEY_STORE_ID);
  if (!hex) {
    // 256-bit key from a cryptographically secure RNG.
    hex = toHex(await Crypto.getRandomBytesAsync(32));
    await SecureStore.setItemAsync(KEY_STORE_ID, hex);
  }
  return CryptoJS.enc.Hex.parse(hex);
}

function getKey() {
  if (!keyPromise) {
    keyPromise = loadKey().catch((e) => {
      keyPromise = null; // allow retry on next call
      throw e;
    });
  }
  return keyPromise;
}

/** Encrypt a UTF-8 string. Output is `ivHex:ciphertextBase64`. */
export async function encryptString(plain: string): Promise<string> {
  const key = await getKey();
  const ivHex = toHex(await Crypto.getRandomBytesAsync(16));
  const iv = CryptoJS.enc.Hex.parse(ivHex);
  const cipher = CryptoJS.AES.encrypt(plain, key, { iv });
  return `${ivHex}:${cipher.toString()}`;
}

/** Decrypt a value produced by encryptString. Returns null if it can't be read. */
export async function decryptString(payload: string): Promise<string | null> {
  try {
    const sep = payload.indexOf(':');
    if (sep <= 0) return null;
    const iv = CryptoJS.enc.Hex.parse(payload.slice(0, sep));
    const ciphertext = payload.slice(sep + 1);
    const key = await getKey();
    const bytes = CryptoJS.AES.decrypt(ciphertext, key, { iv });
    const text = bytes.toString(CryptoJS.enc.Utf8);
    return text || null;
  } catch {
    return null;
  }
}
