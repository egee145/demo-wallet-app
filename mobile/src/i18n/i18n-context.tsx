import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type PropsWithChildren,
} from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { translate, type Language } from './translations';

const LANGUAGE_KEY = '@hepantalya/language';

type I18nContextValue = {
  language: Language;
  ready: boolean;
  setLanguage: (language: Language) => Promise<void>;
  t: (key: string, params?: Record<string, string | number>) => string;
};

const I18nContext = createContext<I18nContextValue | undefined>(undefined);

export function I18nProvider({ children }: PropsWithChildren) {
  const [language, setLanguageState] = useState<Language>('tr');
  const [ready, setReady] = useState(false);

  useEffect(() => {
    void AsyncStorage.getItem(LANGUAGE_KEY)
      .then((stored) => {
        if (stored === 'tr' || stored === 'en') {
          setLanguageState(stored);
        }
      })
      .finally(() => setReady(true));
  }, []);

  const setLanguage = useCallback(async (next: Language) => {
    setLanguageState(next);
    await AsyncStorage.setItem(LANGUAGE_KEY, next);
  }, []);

  const t = useCallback(
    (key: string, params?: Record<string, string | number>) => translate(language, key, params),
    [language],
  );

  const value = useMemo(
    () => ({ language, ready, setLanguage, t }),
    [language, ready, setLanguage, t],
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nContextValue {
  const value = useContext(I18nContext);
  if (!value) {
    throw new Error('useI18n must be used within I18nProvider');
  }
  return value;
}
