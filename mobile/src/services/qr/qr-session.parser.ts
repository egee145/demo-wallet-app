const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function parseQrSessionId(payload: string): string {
  const value = payload.trim();
  if (!UUID_V4.test(value)) {
    throw new Error('QR payload geçerli bir Payment Session UUID değildir.');
  }
  return value.toLowerCase();
}
