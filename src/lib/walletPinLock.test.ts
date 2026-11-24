import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  clearWalletPin,
  hasWalletPinConfigured,
  isValidWalletPinFormat,
  readStoredWalletPinRecord,
  saveWalletPin,
  verifyWalletPin,
  WALLET_PIN_STORAGE_KEY,
  type PinStorageLike,
} from './walletPinLock';

function createMemoryStorage(): PinStorageLike & { dump(): Record<string, string> } {
  const map = new Map<string, string>();
  return {
    getItem: (key) => map.get(key) ?? null,
    setItem: (key, value) => {
      map.set(key, value);
    },
    removeItem: (key) => {
      map.delete(key);
    },
    dump: () => Object.fromEntries(map.entries()),
  };
}

describe('walletPinLock', () => {
  it('validates 4 to 6 digit PIN format', () => {
    assert.equal(isValidWalletPinFormat('1234'), true);
    assert.equal(isValidWalletPinFormat('12345'), true);
    assert.equal(isValidWalletPinFormat('123456'), true);
    assert.equal(isValidWalletPinFormat('123'), false);
    assert.equal(isValidWalletPinFormat('1234567'), false);
    assert.equal(isValidWalletPinFormat('12a4'), false);
    assert.equal(isValidWalletPinFormat(''), false);
  });

  it('stores PIN only as a salted hash and never plaintext', async () => {
    const storage = createMemoryStorage();
    assert.equal(hasWalletPinConfigured(storage), false);

    const record = await saveWalletPin('4829', storage);
    assert.equal(hasWalletPinConfigured(storage), true);
    assert.equal(record.algorithm, 'pbkdf2-sha256');
    assert.ok(record.saltHex.length >= 32);
    assert.equal(record.hashHex.length, 64);

    const rawStored = storage.getItem(WALLET_PIN_STORAGE_KEY);
    assert.ok(rawStored);
    assert.equal(rawStored.includes('4829'), false);

    assert.equal(await verifyWalletPin('4829', storage), true);
    assert.equal(await verifyWalletPin('4820', storage), false);
    assert.equal(await verifyWalletPin('123456', storage), false);
    assert.equal(await verifyWalletPin('abc', storage), false);
  });

  it('uses a fresh random salt for each save', async () => {
    const storageA = createMemoryStorage();
    const storageB = createMemoryStorage();
    const recA = await saveWalletPin('5555', storageA);
    const recB = await saveWalletPin('5555', storageB);
    assert.notEqual(recA.saltHex, recB.saltHex);
    assert.notEqual(recA.hashHex, recB.hashHex);
    assert.equal(await verifyWalletPin('5555', storageA), true);
    assert.equal(await verifyWalletPin('5555', storageB), true);
  });

  it('handles corrupted storage and clearWalletPin cleanly', async () => {
    const storage = createMemoryStorage();
    storage.setItem(WALLET_PIN_STORAGE_KEY, '{not-json');
    assert.equal(readStoredWalletPinRecord(storage), null);
    assert.equal(hasWalletPinConfigured(storage), false);

    await saveWalletPin('123456', storage);
    assert.equal(hasWalletPinConfigured(storage), true);
    clearWalletPin(storage);
    assert.equal(hasWalletPinConfigured(storage), false);
  });
});
