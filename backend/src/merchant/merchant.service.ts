import { HttpStatus, Injectable } from '@nestjs/common';
import { argon2id, hash } from 'argon2';
import { Prisma, Role, WalletOwnerType } from '../generated/prisma/client.js';
import { PrismaService } from '../database/prisma.service.js';
import { DomainException } from '../common/errors/domain.exception.js';
import { serializeMoney } from '../common/money/money.js';
import { TransactionService } from '../transaction/transaction.service.js';
import type { ProvisionMerchantDto } from './dto/provision-merchant.dto.js';

@Injectable()
export class MerchantService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly transactions: TransactionService,
  ) {}

  async provision(dto: ProvisionMerchantDto) {
    const passwordHash = await hash(dto.password, { type: argon2id });
    try {
      return await this.prisma.$transaction(
        async (tx) => {
          const user = await tx.user.create({
            data: {
              name: dto.name.trim(),
              email: dto.email.trim().toLowerCase(),
              phone: dto.phone?.trim() ?? null,
              passwordHash,
              role: Role.MERCHANT,
            },
          });
          const wallet = await tx.wallet.create({
            data: {
              ownerType: WalletOwnerType.MERCHANT,
              balance: new Prisma.Decimal(0),
            },
          });
          const merchant = await tx.merchant.create({
            data: {
              userId: user.id,
              name: dto.merchantName.trim(),
              walletId: wallet.id,
              walletOwnerType: WalletOwnerType.MERCHANT,
            },
          });
          return {
            user: {
              id: user.id,
              name: user.name,
              email: user.email,
              phone: user.phone,
              role: user.role,
            },
            merchant: {
              id: merchant.id,
              name: merchant.name,
              walletId: wallet.id,
              isActive: merchant.isActive,
            },
          };
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );
    } catch (error) {
      if (
        typeof error === 'object' &&
        error !== null &&
        'code' in error &&
        error.code === 'P2002'
      ) {
        throw new DomainException(
          'USER_ALREADY_EXISTS',
          'Email veya telefon zaten kullanılıyor.',
          HttpStatus.CONFLICT,
        );
      }
      throw error;
    }
  }

  async requireActiveByUserId(userId: string) {
    const merchant = await this.prisma.merchant.findUnique({
      where: { userId },
      include: { wallet: true },
    });
    if (!merchant) {
      throw new DomainException('MERCHANT_NOT_FOUND', 'Merchant bulunamadı.', 404);
    }
    if (!merchant.isActive) {
      throw new DomainException(
        'MERCHANT_INACTIVE',
        'Merchant hesabı pasif.',
        HttpStatus.FORBIDDEN,
      );
    }
    return merchant;
  }

  async me(userId: string) {
    const merchant = await this.requireActiveByUserId(userId);
    return {
      merchant: {
        id: merchant.id,
        name: merchant.name,
        isActive: merchant.isActive,
      },
      wallet: {
        id: merchant.wallet.id,
        balance: serializeMoney(merchant.wallet.balance),
        currency: merchant.wallet.currency,
      },
    };
  }

  async history(userId: string, cursor?: string, limit?: number) {
    const merchant = await this.requireActiveByUserId(userId);
    return this.transactions.historyForWallet(merchant.walletId, cursor, limit);
  }
}
