const BASE64_URL_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';

function decodeBase64Url(value: string): string {
  let buffer = 0;
  let bits = 0;
  let output = '';

  for (const character of value.replace(/=+$/u, '')) {
    const index = BASE64_URL_ALPHABET.indexOf(character);
    if (index < 0) {
      throw new Error('INVALID_BASE64URL');
    }
    buffer = (buffer << 6) | index;
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      output += String.fromCharCode((buffer >> bits) & 0xff);
    }
  }

  return output;
}

export function accessTokenExpiresWithin(
  token: string,
  seconds: number,
  nowMs = Date.now(),
): boolean {
  try {
    const payloadPart = token.split('.')[1];
    if (!payloadPart) {
      return true;
    }
    const payload = JSON.parse(decodeBase64Url(payloadPart)) as { exp?: unknown };
    return (
      typeof payload.exp !== 'number' ||
      !Number.isFinite(payload.exp) ||
      payload.exp * 1000 <= nowMs + seconds * 1000
    );
  } catch {
    return true;
  }
}
