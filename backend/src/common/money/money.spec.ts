import { DomainException } from '../errors/domain.exception.js';
import { canonicalMoney, parseMoney, serializeMoney } from './money.js';

describe('money', () => {
  it.each([
    [50, '50.00'],
    [50.25, '50.25'],
    [0.01, '0.01'],
    [999999.99, '999999.99'],
  ])('accepts %p as %s', (input, expected) => {
    const decimal = parseMoney(input);
    expect(canonicalMoney(decimal)).toBe(expected);
    expect(serializeMoney(decimal)).toBe(input);
  });

  it.each([0, -1, 0.001, 1_000_000, '50.00', Number.NaN, Number.POSITIVE_INFINITY])(
    'rejects invalid amount %p',
    (input) => {
      expect(() => parseMoney(input)).toThrow(DomainException);
    },
  );
});
