import type { CreatedPaymentSession } from '../domain/types';

export type AuthStackParams = {
  Login: undefined;
};

export type UserStackParams = {
  UserHome: undefined;
  UserHistory: undefined;
  MockTopUp: undefined;
  CardManagement: undefined;
  Settings: undefined;
  QrScanner: undefined;
  PaymentSessionDetail: { sessionId: string };
  UserPaymentResult: { sessionId: string; transactionId: string };
};

export type MerchantStackParams = {
  MerchantHome: undefined;
  MerchantHistory: undefined;
  Settings: undefined;
  AmountEntry: undefined;
  MerchantPaymentSession: { session: CreatedPaymentSession };
  MerchantPaymentResult: { sessionId: string; transactionId: string };
  NfcDiagnostics: undefined;
};
