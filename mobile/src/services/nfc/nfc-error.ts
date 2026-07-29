export const NFC_ERROR_CODES = [
  'NFC_NOT_SUPPORTED',
  'NFC_DISABLED',
  'NFC_TAG_READ_ONLY',
  'NFC_TAG_NOT_WRITABLE',
  'NFC_TAG_CAPACITY_EXCEEDED',
  'NFC_CARD_VERIFICATION_FAILED',
  'NFC_CARD_CHANGED',
  'NFC_WRITE_FAILED',
  'NFC_CANCELLED',
] as const;

export type NfcErrorCode = (typeof NFC_ERROR_CODES)[number];

const nfcErrorCodes = new Set<string>(NFC_ERROR_CODES);

type Translator = (key: string, params?: Record<string, string | number>) => string;

export function getNfcErrorCode(error: unknown): NfcErrorCode | undefined {
  if (!(error instanceof Error)) {
    return undefined;
  }
  return nfcErrorCodes.has(error.message) ? (error.message as NfcErrorCode) : undefined;
}

export function localizedNfcError(error: unknown, t: Translator): string {
  const code = getNfcErrorCode(error);
  if (!code) {
    return t('errors.generic');
  }
  const translated = t(`errors.${code}`);
  return translated === `errors.${code}` ? t('errors.generic') : translated;
}

export function isNfcCancellation(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }
  if (error.message === 'NFC_CANCELLED') {
    return true;
  }
  const nativeMessage = error.message.toLocaleLowerCase('en-US');
  return nativeMessage.includes('cancel') || nativeMessage.includes('invalidate');
}
