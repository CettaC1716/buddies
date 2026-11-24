/**
 * Local device PIN lock for the in-phone Wallet privacy screen.
 *
 * Security model:
 * - This is a screen-privacy lock stored only on this device.
 * - The PIN is never transmitted over any network and never stored in plaintext.
 * - Stored as a salted PBKDF2-SHA256 hash in localStorage.
 */

export const WALLET_PIN_STORAGE_KEY = 'bb_wallet_pin_hash_v1';
export const WALLET_PIN_MIN_LENGTH = 4;
export const WALLET_PIN_MAX_LENGTH = 6;
const PBKDF2_ITERATIONS = 100_000;
const SALT_BYTE_LENGTH = 16;

export interface StoredWalletPinRecord {
  version: 1;
  algorithm: 'pbkdf2-sha256';
  iterations: number;
  saltHex: string;
  hashHex: string;
}

export interface PinStorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

function getDefaultStorage(): PinStorageLike | null {
  if (typeof window === 'undefined') return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

export function isValidWalletPinFormat(pin: string): boolean {
  return /^\d{4,6}$/.test(pin);
}

function bytesToHex(bytes: Uint8Array): string {
  let out = '';
  for (let i = 0; i < bytes.length; i += 1) {
    out += bytes[i].toString(16).padStart(2, '0');
  }
  return out;
}

function hexToBytes(hex: string): Uint8Array {
  const clean = hex.trim();
  const out = new Uint8Array(Math.floor(clean.length / 2));
  for (let i = 0; i < out.length; i += 1) {
    out[i] = Number.parseInt(clean.slice(i * 2, i * 2 + 2), 16);
  }
  return out;
}

function timingSafeEqualHex(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

function getWebCrypto(): Crypto {
  if (typeof globalThis !== 'undefined' && globalThis.crypto?.subtle) {
    return globalThis.crypto;
  }
  throw new Error('Web Crypto API is unavailable in this environment.');
}

async function derivePinHashHex(
  pin: string,
  saltBytes: Uint8Array,
  iterations: number,
): Promise<string> {
  const webCrypto = getWebCrypto();
  const encoder = new TextEncoder();
  const keyMaterial = await webCrypto.subtle.importKey(
    'raw',
    encoder.encode(pin),
    { name: 'PBKDF2' },
    false,
    ['deriveBits'],
  );
  const derivedBits = await webCrypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt: saltBytes.buffer.slice(
        saltBytes.byteOffset,
        saltBytes.byteOffset + saltBytes.byteLength,
      ) as ArrayBuffer,
      iterations,
      hash: 'SHA-256',
    },
    keyMaterial,
    256,
  );
  return bytesToHex(new Uint8Array(derivedBits));
}

export function readStoredWalletPinRecord(
  storage: PinStorageLike | null = getDefaultStorage(),
): StoredWalletPinRecord | null {
  if (!storage) return null;
  try {
    const raw = storage.getItem(WALLET_PIN_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<StoredWalletPinRecord>;
    if (
      parsed &&
      parsed.version === 1 &&
      parsed.algorithm === 'pbkdf2-sha256' &&
      typeof parsed.iterations === 'number' &&
      parsed.iterations >= 10_000 &&
      typeof parsed.saltHex === 'string' &&
      parsed.saltHex.length >= 16 &&
      typeof parsed.hashHex === 'string' &&
      parsed.hashHex.length === 64
    ) {
      return parsed as StoredWalletPinRecord;
    }
    return null;
  } catch {
    return null;
  }
}

export function hasWalletPinConfigured(
  storage: PinStorageLike | null = getDefaultStorage(),
): boolean {
  return readStoredWalletPinRecord(storage) !== null;
}

export async function createWalletPinRecord(pin: string): Promise<StoredWalletPinRecord> {
  if (!isValidWalletPinFormat(pin)) {
    throw new Error('PIN must be 4 to 6 digits.');
  }
  const webCrypto = getWebCrypto();
  const saltBytes = new Uint8Array(SALT_BYTE_LENGTH);
  webCrypto.getRandomValues(saltBytes);
  const hashHex = await derivePinHashHex(pin, saltBytes, PBKDF2_ITERATIONS);
  return {
    version: 1,
    algorithm: 'pbkdf2-sha256',
    iterations: PBKDF2_ITERATIONS,
    saltHex: bytesToHex(saltBytes),
    hashHex,
  };
}

export async function saveWalletPin(
  pin: string,
  storage: PinStorageLike | null = getDefaultStorage(),
): Promise<StoredWalletPinRecord> {
  const record = await createWalletPinRecord(pin);
  if (storage) {
    try {
      storage.setItem(WALLET_PIN_STORAGE_KEY, JSON.stringify(record));
    } catch {
      // ignore storage quota errors
    }
  }
  return record;
}

export async function verifyWalletPin(
  pin: string,
  storage: PinStorageLike | null = getDefaultStorage(),
): Promise<boolean> {
  if (!isValidWalletPinFormat(pin)) return false;
  const record = readStoredWalletPinRecord(storage);
  if (!record) return false;
  try {
    const saltBytes = hexToBytes(record.saltHex);
    const derivedHex = await derivePinHashHex(pin, saltBytes, record.iterations);
    return timingSafeEqualHex(derivedHex, record.hashHex);
  } catch {
    return false;
  }
}

export function clearWalletPin(
  storage: PinStorageLike | null = getDefaultStorage(),
): void {
  if (!storage) return;
  try {
    storage.removeItem(WALLET_PIN_STORAGE_KEY);
  } catch {
    // ignore
  }
}
