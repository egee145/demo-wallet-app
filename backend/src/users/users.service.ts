import { HttpStatus, Injectable } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service.js';
import { serializeMoney } from '../common/money/money.js';
import { DomainException } from '../common/errors/domain.exception.js';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async me(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        role: true,
        isActive: true,
        createdAt: true,
      },
    });
    if (!user) {
      throw new DomainException('USER_NOT_FOUND', 'Kullanıcı bulunamadı.', HttpStatus.NOT_FOUND);
    }
    return user;
  }

  async cardUser(merchantUserId: string, cardUserId: string) {
    const merchant = await this.prisma.merchant.findUnique({
      where: { userId: merchantUserId },
      select: { isActive: true },
    });
    if (!merchant?.isActive) {
      throw new DomainException(
        'MERCHANT_INACTIVE',
        'Merchant hesabı bulunamadı veya pasif.',
        HttpStatus.FORBIDDEN,
      );
    }

    const user = await this.prisma.user.findUnique({
      where: { id: cardUserId },
      include: { wallet: true },
    });
    if (!user || !user.isActive) {
      throw new DomainException('USER_NOT_FOUND', 'Kullanıcı bulunamadı.', HttpStatus.NOT_FOUND);
    }
    if (!user.wallet) {
      throw new DomainException('WALLET_NOT_FOUND', 'Kullanıcı cüzdanı bulunamadı.', 404);
    }

    return {
      id: user.id,
      name: user.name,
      walletBalance: serializeMoney(user.wallet.balance),
    };
  }
}
