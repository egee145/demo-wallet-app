import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { PrismaService } from '../../database/prisma.service.js';

type AuthorizedSocket = Socket & { data: { userId?: string } };

@Injectable()
@WebSocketGateway({ namespace: '/payments', cors: { origin: false } })
export class PaymentGateway implements OnGatewayConnection {
  @WebSocketServer()
  server!: Server;

  constructor(
    private readonly jwt: JwtService,
    private readonly prisma: PrismaService,
  ) {}

  async handleConnection(client: AuthorizedSocket): Promise<void> {
    try {
      const token = client.handshake.auth?.token;
      if (typeof token !== 'string') {
        client.disconnect();
        return;
      }
      const payload = await this.jwt.verifyAsync<{ sub: string }>(token);
      const merchant = await this.prisma.merchant.findUnique({
        where: { userId: payload.sub },
        select: {
          isActive: true,
          user: { select: { isActive: true, role: true } },
        },
      });
      if (!merchant?.isActive || !merchant.user.isActive || merchant.user.role !== 'MERCHANT') {
        client.disconnect();
        return;
      }
      client.data.userId = payload.sub;
    } catch {
      client.disconnect();
    }
  }

  @SubscribeMessage('payment.session.subscribe')
  async subscribe(
    @ConnectedSocket() client: AuthorizedSocket,
    @MessageBody() body: { sessionId?: string },
  ) {
    if (!client.data.userId || typeof body.sessionId !== 'string') {
      return { ok: false, code: 'AUTH_FORBIDDEN_ROLE' };
    }
    const session = await this.prisma.paymentSession.findUnique({
      where: { id: body.sessionId },
      include: { merchant: { select: { userId: true } } },
    });
    if (!session || session.merchant.userId !== client.data.userId) {
      return { ok: false, code: 'PAYMENT_SESSION_FORBIDDEN' };
    }
    await client.join(this.room(session.id));
    return { ok: true, status: session.status };
  }

  emitStatus(
    sessionId: string,
    status: 'waiting' | 'paid' | 'expired' | 'cancelled',
    transactionId?: string,
  ): void {
    this.server?.to(this.room(sessionId)).emit(`payment.session.${status}`, {
      sessionId,
      status: status.toUpperCase(),
      ...(transactionId ? { transactionId } : {}),
      occurredAt: new Date().toISOString(),
    });
  }

  private room(sessionId: string): string {
    return `payment-session:${sessionId}`;
  }
}
