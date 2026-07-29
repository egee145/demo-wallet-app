import { isSameNfcTag, normalizeNfcTagUid } from './nfc-card-transfer';

describe('NFC card transfer guards', () => {
  it('normalizes separators and casing before comparing physical tag identities', () => {
    expect(normalizeNfcTagUid('04:A1-b2 C3')).toBe('04a1b2c3');
    expect(isSameNfcTag('04:A1-b2 C3', '04a1b2c3')).toBe(true);
  });

  it('rejects a missing or different tag during the second transfer tap', () => {
    expect(isSameNfcTag('04a1b2c3', '04a1b2c4')).toBe(false);
    expect(isSameNfcTag('04a1b2c3', undefined)).toBe(false);
  });
});
