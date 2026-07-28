import { paymentReducer, type PaymentState } from './payment-machine';

describe('paymentReducer', () => {
  it('moves a waiting payment through read, submit and paid', () => {
    let state: PaymentState = { status: 'WAITING' };
    state = paymentReducer(state, {
      type: 'TAG',
      userId: '7d4d82a1-0000-4000-8000-000000000000',
    });
    expect(state.status).toBe('TAG_READ');
    state = paymentReducer(state, { type: 'SUBMIT' });
    expect(state.status).toBe('SUBMITTING');
    state = paymentReducer(state, { type: 'PAID', transactionId: 'tx' });
    expect(state).toEqual({ status: 'PAID', transactionId: 'tx' });
  });

  it('preserves a network-unknown terminal until an explicit retry', () => {
    const state = paymentReducer(
      { status: 'SUBMITTING' },
      { type: 'NETWORK_UNKNOWN', message: 'timeout' },
    );
    expect(state).toEqual({ status: 'NETWORK_UNKNOWN', message: 'timeout' });
    expect(paymentReducer(state, { type: 'WAIT' })).toEqual({ status: 'WAITING' });
  });

  it.each<PaymentState>([
    { status: 'PAID', transactionId: 'tx' },
    { status: 'EXPIRED' },
    { status: 'CANCELLED' },
  ])('does not leave terminal state $status on late events', (terminal) => {
    expect(paymentReducer(terminal, { type: 'WAIT' })).toBe(terminal);
    expect(paymentReducer(terminal, { type: 'EXPIRE' })).toBe(terminal);
  });
});
