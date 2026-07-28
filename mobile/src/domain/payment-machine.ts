export type PaymentState =
  | { status: 'IDLE' }
  | { status: 'CREATING_SESSION' }
  | { status: 'WAITING' }
  | { status: 'TAG_READ'; userId: string }
  | { status: 'SUBMITTING'; userId?: string }
  | { status: 'RECOVERABLE_ERROR'; message: string }
  | { status: 'NETWORK_UNKNOWN'; message: string }
  | { status: 'PAID'; transactionId: string }
  | { status: 'EXPIRED' }
  | { status: 'CANCELLED' };

export type PaymentAction =
  | { type: 'CREATE' }
  | { type: 'WAIT' }
  | { type: 'TAG'; userId: string }
  | { type: 'SUBMIT'; userId?: string }
  | { type: 'RECOVERABLE_ERROR'; message: string }
  | { type: 'NETWORK_UNKNOWN'; message: string }
  | { type: 'PAID'; transactionId: string }
  | { type: 'EXPIRE' }
  | { type: 'CANCEL' };

export const paymentReducer = (state: PaymentState, action: PaymentAction): PaymentState => {
  if (state.status === 'PAID' || state.status === 'EXPIRED' || state.status === 'CANCELLED') {
    return state;
  }

  switch (action.type) {
    case 'CREATE':
      return { status: 'CREATING_SESSION' };
    case 'WAIT':
      return { status: 'WAITING' };
    case 'TAG':
      return { status: 'TAG_READ', userId: action.userId };
    case 'SUBMIT':
      return { status: 'SUBMITTING', userId: action.userId };
    case 'RECOVERABLE_ERROR':
      return { status: 'RECOVERABLE_ERROR', message: action.message };
    case 'NETWORK_UNKNOWN':
      return { status: 'NETWORK_UNKNOWN', message: action.message };
    case 'PAID':
      return { status: 'PAID', transactionId: action.transactionId };
    case 'EXPIRE':
      return { status: 'EXPIRED' };
    case 'CANCEL':
      return { status: 'CANCELLED' };
    default:
      return state;
  }
};
