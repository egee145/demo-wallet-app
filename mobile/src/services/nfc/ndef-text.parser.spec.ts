import {
  decodeStrictUserId,
  normalizeCanonicalUserId,
  type NdefLikeRecord,
} from './ndef-text.parser';

const USER_ID = '7d4d82a1-0000-4000-8000-000000000000';

const textRecord = (text: string) => ({
  tnf: 1,
  type: [0x54],
  payload: [0x02, 0x65, 0x6e, ...new TextEncoder().encode(text)],
});

describe('decodeStrictUserId', () => {
  it('decodes a single UTF-8 NDEF Text canonical UUID', () => {
    expect(decodeStrictUserId([textRecord(USER_ID)])).toBe(USER_ID);
  });

  const invalidCases: Array<{ records: NdefLikeRecord[] }> = [
    { records: [] },
    { records: [textRecord(USER_ID), textRecord(USER_ID)] },
    { records: [{ ...textRecord(USER_ID), tnf: 2 }] },
    { records: [textRecord('https://example.com')] },
    { records: [textRecord('{"userId":"x"}')] },
  ];

  it.each(invalidCases)('rejects ambiguous or invalid records', ({ records }) => {
    expect(() => decodeStrictUserId(records)).toThrow();
  });
});

describe('normalizeCanonicalUserId', () => {
  it('normalizes a canonical UUID v4 to lowercase', () => {
    expect(normalizeCanonicalUserId(USER_ID.toUpperCase())).toBe(USER_ID);
  });

  it.each(['7d4d82a1', 'not-a-uuid', '00000000-0000-1000-8000-000000000000'])(
    'rejects a non-v4 user identifier',
    (value) => {
      expect(() => normalizeCanonicalUserId(value)).toThrow();
    },
  );
});
