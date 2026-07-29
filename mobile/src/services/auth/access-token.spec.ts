import { accessTokenExpiresWithin } from './access-token';

const tokenWithExpiry = (payload: string) => `header.${payload}.signature`;

describe('access token expiry', () => {
  it('keeps a token that remains valid beyond the refresh window', () => {
    const token = tokenWithExpiry('eyJleHAiOjIwMDB9');

    expect(accessTokenExpiresWithin(token, 30, 1_000_000)).toBe(false);
  });

  it('refreshes a token before it expires', () => {
    const token = tokenWithExpiry('eyJleHAiOjIwMDB9');

    expect(accessTokenExpiresWithin(token, 30, 1_980_000)).toBe(true);
  });

  it('treats an expired token as requiring refresh', () => {
    const token = tokenWithExpiry('eyJleHAiOjIwMDB9');

    expect(accessTokenExpiresWithin(token, 30, 2_001_000)).toBe(true);
  });

  it('treats malformed or expiry-free tokens as requiring refresh', () => {
    expect(accessTokenExpiresWithin('malformed-token', 30)).toBe(true);
    expect(accessTokenExpiresWithin(tokenWithExpiry('e30'), 30)).toBe(true);
  });
});
