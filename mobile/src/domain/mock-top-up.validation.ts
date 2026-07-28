export type MockTopUpInput = {
  cardholderName: string;
  cardNumber: string;
  expiry: string;
  cvv: string;
  amount: string;
};

export type MockTopUpField = 'cardholderName' | 'cardNumber' | 'expiry' | 'cvv' | 'amount';

export function validateMockTopUp(input: MockTopUpInput): Partial<Record<MockTopUpField, string>> {
  const errors: Partial<Record<MockTopUpField, string>> = {};
  const holder = input.cardholderName.trim();
  const cardDigits = input.cardNumber.replace(/[ -]/g, '');

  if (holder.length < 2 || !/^[\p{L}\p{M} .'-]+$/u.test(holder)) {
    errors.cardholderName = 'topup.invalidCardholder';
  }
  if (!/^\d{13,19}$/.test(cardDigits)) {
    errors.cardNumber = 'topup.invalidCardNumber';
  }
  if (!/^(0[1-9]|1[0-2])\/(\d{2}|\d{4})$/.test(input.expiry)) {
    errors.expiry = 'topup.invalidExpiry';
  }
  if (!/^\d{3,4}$/.test(input.cvv)) {
    errors.cvv = 'topup.invalidCvv';
  }
  if (!/^(?:0|[1-9]\d{0,5})(?:\.\d{1,2})?$/.test(input.amount)) {
    errors.amount = 'topup.invalidAmount';
  } else {
    const amount = Number(input.amount);
    if (!Number.isFinite(amount) || amount < 0.01 || amount > 999999.99) {
      errors.amount = 'topup.invalidAmount';
    }
  }

  return errors;
}
