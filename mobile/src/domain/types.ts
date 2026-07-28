export type Role = 'USER' | 'MERCHANT' | 'ADMIN';
export type AccountType = 'PERSONAL' | 'BUSINESS';

export type AuthUser = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  role: Role;
  isActive: boolean;
};

export type TokenResponse = {
  user: AuthUser;
  accessToken: string;
  refreshToken: string;
};

export type RegisterInput = {
  accountType: AccountType;
  name: string;
  businessName?: string;
  email: string;
  phone?: string;
  password: string;
};

export type WalletSummary = {
  id: string;
  balance: number;
  currency: 'TRY';
};

export type NfcCardSummary = {
  bound: boolean;
  card: {
    id: string;
    label: string;
    status: 'ACTIVE' | 'REVOKED';
    boundAt: string;
  } | null;
};

export type MockTopUpResult = {
  topUpId: string;
  amount: number;
  balance: number;
  currency: 'TRY';
  maskedCard: string;
  provider: 'MOCK';
  status: 'COMPLETED';
  createdAt: string;
};

export type PaymentSession = {
  id: string;
  merchant: { id: string; name: string };
  amount: number;
  currency: 'TRY';
  status: 'WAITING' | 'PAID' | 'EXPIRED' | 'CANCELLED';
  expiresAt: string;
  transactionId?: string | null;
};

export type CreatedPaymentSession = {
  id: string;
  merchantId: string;
  amount: number;
  currency: 'TRY';
  status: 'WAITING';
  expiresAt: string;
  qrPayload: string;
};
