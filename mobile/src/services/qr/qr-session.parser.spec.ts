import { parseQrSessionId } from './qr-session.parser';

describe('parseQrSessionId', () => {
  const id = '7d4d82a1-0000-4000-8000-000000000000';

  it('accepts only a canonical payment session UUID', () => {
    expect(parseQrSessionId(id)).toBe(id);
  });

  it.each([`https://example.com/${id}`, JSON.stringify({ id }), `Bearer ${id}`, '7d4d82a1'])(
    'rejects non-UUID payload %s',
    (payload) => {
      expect(() => parseQrSessionId(payload)).toThrow();
    },
  );
});
