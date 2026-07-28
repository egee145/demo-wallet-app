import { Injectable } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service.js';
import { serializeMoney } from '../common/money/money.js';
import { decodeCursor, encodeCursor } from '../common/utils/cursor.js';

@Injectable()
export class TransactionService {
  constructor(private readonly prisma: PrismaService) {}

  async historyForWallet(walletId: string, cursorValue?: string, requestedLimit = 20) {
    const limit = Math.min(Math.max(requestedLimit, 1), 100);
    const cursor = decodeCursor(cursorValue);
    const rows = await this.prisma.transaction.findMany({
      where: {
        OR: [{ fromWalletId: walletId }, { toWalletId: walletId }],
        ...(cursor
          ? {
              AND: [
                {
                  OR: [
                    { createdAt: { lt: cursor.createdAt } },
                    { createdAt: cursor.createdAt, id: { lt: cursor.id } },
                  ],
                },
              ],
            }
          : {}),
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: limit + 1,
    });
    const hasMore = rows.length > limit;
    const page = rows.slice(0, limit);
    const last = page.at(-1);

    return {
      items: page.map((row) => ({
        id: row.id,
        paymentSessionId: row.paymentSessionId,
        direction: row.fromWalletId === walletId ? 'OUT' : 'IN',
        amount: serializeMoney(row.amount),
        currency: row.currency,
        paymentMethod: row.paymentMethod,
        status: row.status,
        createdAt: row.createdAt.toISOString(),
      })),
      nextCursor: hasMore && last ? encodeCursor({ createdAt: last.createdAt, id: last.id }) : null,
    };
  }
}
