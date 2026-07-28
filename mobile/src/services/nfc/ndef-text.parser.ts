const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export type NdefLikeRecord = {
  tnf: number;
  type: number[] | Uint8Array;
  id?: number[] | Uint8Array;
  payload: number[] | Uint8Array;
};

export function decodeStrictUserId(records: NdefLikeRecord[]): string {
  if (records.length !== 1) {
    throw new Error('Kartta tam olarak bir NDEF Text Record bulunmalıdır.');
  }
  const record = records[0];
  if (!record || record.tnf !== 1 || bytesToAscii(record.type) !== 'T') {
    throw new Error('NDEF kaydı NFC Forum well-known Text Record değil.');
  }
  const payload = Uint8Array.from(record.payload);
  if (payload.length < 2) {
    throw new Error('NDEF Text payload boş veya hatalı.');
  }
  const status = payload[0] ?? 0;
  const utf16 = (status & 0x80) !== 0;
  const languageLength = status & 0x3f;
  if (utf16) {
    throw new Error('UTF-16 NDEF Text payload ödeme akışında desteklenmiyor.');
  }
  const start = 1 + languageLength;
  if (start >= payload.length) {
    throw new Error('NDEF dil kodu veya text payload hatalı.');
  }
  const value = new TextDecoder('utf-8', { fatal: true }).decode(payload.slice(start)).trim();
  return normalizeCanonicalUserId(value);
}

export function normalizeCanonicalUserId(value: string): string {
  if (!UUID_V4.test(value)) {
    throw new Error('Kart payload değeri canonical UUID v4 değil.');
  }
  return value.toLowerCase();
}

export function bytesToHex(value?: number[] | Uint8Array): string {
  if (!value) {
    return '';
  }
  return Array.from(value)
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

function bytesToAscii(value: number[] | Uint8Array): string {
  return String.fromCharCode(...Array.from(value));
}
