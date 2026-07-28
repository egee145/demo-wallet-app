import { HttpStatus, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { PrismaService } from '../database/prisma.service.js';
import { DomainException } from '../common/errors/domain.exception.js';
import type { AccessTokenPayload, JwtUser } from './types/jwt-user.js';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    config: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      secretOrKey: config.getOrThrow<string>('JWT_ACCESS_SECRET'),
      algorithms: ['HS256'],
      ignoreExpiration: false,
    });
  }

  async validate(payload: AccessTokenPayload): Promise<JwtUser> {
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      select: { id: true, email: true, role: true, isActive: true },
    });

    if (!user) {
      throw new DomainException('AUTH_INVALID_TOKEN', 'Token kullanıcısı bulunamadı.', 401);
    }

    if (!user.isActive) {
      throw new DomainException('USER_INACTIVE', 'Kullanıcı hesabı pasif.', HttpStatus.FORBIDDEN);
    }

    return user;
  }
}
