import { randomBytes, randomUUID, createHash } from 'node:crypto';
import { HttpStatus, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { argon2id, hash, verify } from 'argon2';
import { Prisma, Role, WalletOwnerType } from '../generated/prisma/client.js';
import { PrismaService } from '../database/prisma.service.js';
import { DomainException } from '../common/errors/domain.exception.js';
import type { RegisterDto } from './dto/register.dto.js';
import type { LoginDto } from './dto/login.dto.js';

type PublicUser = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  role: Role;
  isActive: boolean;
};

type TokenResponse = {
  user: PublicUser;
  accessToken: string;
  refreshToken: string;
};

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  async register(dto: RegisterDto): Promise<TokenResponse> {
    const passwordHash = await hash(dto.password, { type: argon2id });
    const business = dto.accountType === 'BUSINESS';

    try {
      const user = await this.prisma.$transaction(
        async (tx) => {
          const created = await tx.user.create({
            data: {
              name: dto.name.trim(),
              email: dto.email.trim().toLowerCase(),
              phone: dto.phone?.trim() ?? null,
              passwordHash,
              role: business ? Role.MERCHANT : Role.USER,
            },
          });
          if (business) {
            const wallet = await tx.wallet.create({
              data: {
                ownerType: WalletOwnerType.MERCHANT,
                balance: new Prisma.Decimal(0),
              },
            });
            await tx.merchant.create({
              data: {
                userId: created.id,
                name: dto.businessName!.trim(),
                walletId: wallet.id,
                walletOwnerType: WalletOwnerType.MERCHANT,
              },
            });
          } else {
            await tx.wallet.create({
              data: {
                ownerType: WalletOwnerType.USER,
                userId: created.id,
                balance: new Prisma.Decimal(0),
              },
            });
          }
          return created;
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );

      return this.issueTokens(this.toPublicUser(user));
    } catch (error) {
      if (this.isUniqueViolation(error)) {
        throw new DomainException(
          'USER_ALREADY_EXISTS',
          'Email veya telefon zaten kullanılıyor.',
          HttpStatus.CONFLICT,
        );
      }
      throw error;
    }
  }

  async login(dto: LoginDto): Promise<TokenResponse> {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email.trim().toLowerCase() },
    });

    if (!user || !(await verify(user.passwordHash, dto.password))) {
      throw new DomainException(
        'AUTH_INVALID_CREDENTIALS',
        'Email veya şifre hatalı.',
        HttpStatus.UNAUTHORIZED,
      );
    }

    if (!user.isActive) {
      throw new DomainException('USER_INACTIVE', 'Kullanıcı hesabı pasif.', HttpStatus.FORBIDDEN);
    }

    const requestedRole =
      dto.accountType === 'BUSINESS'
        ? Role.MERCHANT
        : dto.accountType === 'PERSONAL'
          ? Role.USER
          : undefined;
    if (requestedRole && user.role !== requestedRole) {
      throw new DomainException(
        'AUTH_ACCOUNT_TYPE_MISMATCH',
        'Bu hesap seçilen hesap türüne ait değil.',
        HttpStatus.FORBIDDEN,
      );
    }

    return this.issueTokens(this.toPublicUser(user));
  }

  async refresh(rawToken: string): Promise<TokenResponse> {
    const tokenHash = this.hashToken(rawToken);
    const existing = await this.prisma.refreshSession.findUnique({
      where: { tokenHash },
      include: { user: true },
    });

    if (!existing) {
      throw new DomainException(
        'AUTH_INVALID_REFRESH_TOKEN',
        'Refresh token geçersiz.',
        HttpStatus.UNAUTHORIZED,
      );
    }

    if (existing.revokedAt) {
      await this.prisma.refreshSession.updateMany({
        where: { familyId: existing.familyId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      throw new DomainException(
        'AUTH_REFRESH_TOKEN_REUSED',
        'Refresh token yeniden kullanıldı; token ailesi iptal edildi.',
        HttpStatus.UNAUTHORIZED,
      );
    }

    if (existing.expiresAt <= new Date() || !existing.user.isActive) {
      throw new DomainException(
        'AUTH_INVALID_REFRESH_TOKEN',
        'Refresh token geçersiz veya süresi dolmuş.',
        HttpStatus.UNAUTHORIZED,
      );
    }

    const nextId = randomUUID();
    const nextRaw = randomBytes(32).toString('base64url');
    const nextHash = this.hashToken(nextRaw);
    const expiresAt = this.refreshExpiry();

    const rotated = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.refreshSession.updateMany({
        where: { id: existing.id, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      if (updated.count !== 1) {
        return false;
      }
      await tx.refreshSession.create({
        data: {
          id: nextId,
          userId: existing.userId,
          familyId: existing.familyId,
          tokenHash: nextHash,
          expiresAt,
        },
      });
      await tx.refreshSession.update({
        where: { id: existing.id },
        data: { replacedById: nextId },
      });
      return true;
    });

    if (!rotated) {
      await this.prisma.refreshSession.updateMany({
        where: { familyId: existing.familyId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      throw new DomainException(
        'AUTH_REFRESH_TOKEN_REUSED',
        'Refresh token daha önce kullanılmış; token ailesi iptal edildi.',
        HttpStatus.UNAUTHORIZED,
      );
    }

    return {
      user: this.toPublicUser(existing.user),
      accessToken: await this.signAccess(existing.user.id),
      refreshToken: nextRaw,
    };
  }

  async logout(rawToken: string): Promise<void> {
    await this.prisma.refreshSession.updateMany({
      where: { tokenHash: this.hashToken(rawToken), revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  private async issueTokens(user: PublicUser): Promise<TokenResponse> {
    const refreshToken = randomBytes(32).toString('base64url');
    await this.prisma.refreshSession.create({
      data: {
        userId: user.id,
        familyId: randomUUID(),
        tokenHash: this.hashToken(refreshToken),
        expiresAt: this.refreshExpiry(),
      },
    });

    return {
      user,
      accessToken: await this.signAccess(user.id),
      refreshToken,
    };
  }

  private async signAccess(userId: string): Promise<string> {
    return this.jwt.signAsync(
      {},
      {
        subject: userId,
        jwtid: randomUUID(),
        expiresIn: this.config.get<string>('ACCESS_TOKEN_TTL', '15m') as never,
      },
    );
  }

  private refreshExpiry(): Date {
    const days = this.config.get<number>('REFRESH_TOKEN_TTL_DAYS', 30);
    return new Date(Date.now() + days * 24 * 60 * 60 * 1000);
  }

  private hashToken(value: string): string {
    return createHash('sha256').update(value).digest('hex');
  }

  private toPublicUser(user: {
    id: string;
    name: string;
    email: string;
    phone: string | null;
    role: Role;
    isActive: boolean;
  }): PublicUser {
    return {
      id: user.id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      role: user.role,
      isActive: user.isActive,
    };
  }

  private isUniqueViolation(error: unknown): boolean {
    return typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2002';
  }
}
