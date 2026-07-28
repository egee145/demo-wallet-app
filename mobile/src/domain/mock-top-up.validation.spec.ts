import { validateMockTopUp } from './mock-top-up.validation';

const valid = {
  cardholderName: 'Ege XXX',
  cardNumber: '1111 1111 1111 1111',
  expiry: '01/11',
  cvv: '111',
  amount: '50.25',
};

describe('mock top-up validation', () => {
  it('accepts syntactically valid mock card data without a Luhn or expiry-date check', () => {
    expect(validateMockTopUp(valid)).toEqual({});
  });

  it.each([
    [{ ...valid, amount: '-1' }, 'amount'],
    [{ ...valid, amount: 'on lira' }, 'amount'],
    [{ ...valid, amount: '10.999' }, 'amount'],
    [{ ...valid, cardNumber: 'kart numarası' }, 'cardNumber'],
    [{ ...valid, cvv: 'abc' }, 'cvv'],
    [{ ...valid, expiry: '19/11' }, 'expiry'],
  ])('rejects invalid typed values', (input, field) => {
    expect(validateMockTopUp(input)).toHaveProperty(field);
  });
});
