import { translate } from './translations';

describe('translations', () => {
  it('defaults each defined key to its selected language', () => {
    expect(translate('tr', 'auth.login')).toBe('Giriş yap');
    expect(translate('en', 'auth.login')).toBe('Sign in');
  });

  it('interpolates translated values deterministically', () => {
    expect(translate('en', 'home.hello', { name: 'Ege' })).toBe('Hello, Ege');
  });
});
