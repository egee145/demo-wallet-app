import { io, type Socket } from 'socket.io-client';

import { env } from '../../config/env';
import { tokenStore } from '../storage/token-store';

type PaymentEvent = {
  sessionId: string;
  status: 'PAID' | 'EXPIRED' | 'CANCELLED';
  transactionId?: string;
  occurredAt: string;
};

export async function subscribeToPaymentSession(
  sessionId: string,
  onEvent: (event: PaymentEvent) => void,
): Promise<() => void> {
  const tokens = await tokenStore.load();
  if (!tokens) {
    return () => undefined;
  }

  const socket: Socket = io(env.wsBaseUrl, {
    auth: { token: tokens.accessToken },
    transports: ['websocket', 'polling'],
    reconnection: true,
  });
  socket.on('connect', () => {
    socket.emit('payment.session.subscribe', { sessionId });
  });
  socket.on('payment.session.paid', onEvent);
  socket.on('payment.session.expired', onEvent);
  socket.on('payment.session.cancelled', onEvent);

  return () => {
    socket.removeAllListeners();
    socket.disconnect();
  };
}
