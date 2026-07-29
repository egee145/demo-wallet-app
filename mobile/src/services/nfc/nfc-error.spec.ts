import { getNfcErrorCode, isNfcCancellation, localizedNfcError } from './nfc-error';

const t = (key: string) =>
  (
    ({
      'errors.NFC_DISABLED': 'NFC özelliğiniz kapalı. Açmak için NFC ayarlarına gidin.',
      'errors.NFC_TAG_NOT_WRITABLE': 'Okutulan kart yazılabilir bir NFC kart değil.',
      'errors.generic': 'Beklenmeyen bir hata oluştu.',
    }) as Record<string, string>
  )[key] ?? key;

describe('NFC error mapping', () => {
  it('returns a localized disabled-state message instead of a generic error', () => {
    const error = new Error('NFC_DISABLED');

    expect(getNfcErrorCode(error)).toBe('NFC_DISABLED');
    expect(localizedNfcError(error, t)).toContain('NFC özelliğiniz kapalı');
  });

  it('returns a clear message for a card that cannot be written', () => {
    expect(localizedNfcError(new Error('NFC_TAG_NOT_WRITABLE'), t)).toBe(
      'Okutulan kart yazılabilir bir NFC kart değil.',
    );
  });

  it('does not expose unknown native error details', () => {
    expect(localizedNfcError(new Error('Native stack details'), t)).toBe(
      'Beklenmeyen bir hata oluştu.',
    );
  });

  it('recognizes native cancellation variants', () => {
    expect(isNfcCancellation(new Error('NFC_CANCELLED'))).toBe(true);
    expect(isNfcCancellation(new Error('Tag session invalidated by user'))).toBe(true);
    expect(isNfcCancellation(new Error('Connection lost'))).toBe(false);
  });
});
