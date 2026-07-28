import { apiErrorCode, apiErrorMessage } from '../services/api/api-client';

type Translator = (key: string, params?: Record<string, string | number>) => string;

export function localizedApiError(error: unknown, t: Translator): string {
  const code = apiErrorCode(error);
  if (code === 'TIMEOUT') {
    return t('errors.timeout');
  }
  if (code === 'NETWORK') {
    return t('errors.network');
  }
  if (code) {
    const translated = t(`errors.${code}`);
    if (translated !== `errors.${code}`) {
      return translated;
    }
  }
  return apiErrorMessage(error) || t('errors.generic');
}
