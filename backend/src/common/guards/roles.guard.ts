import { CanActivate, type ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Role } from '../../generated/prisma/client.js';
import type { JwtUser } from '../../auth/types/jwt-user.js';
import { DomainException } from '../errors/domain.exception.js';
import { ROLES_KEY } from '../decorators/roles.decorator.js';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const roles = this.reflector.getAllAndOverride<Role[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!roles?.length) {
      return true;
    }

    const request = context.switchToHttp().getRequest<{ user?: JwtUser }>();
    if (!request.user || !roles.includes(request.user.role)) {
      throw new DomainException('AUTH_FORBIDDEN_ROLE', 'Bu işlem için yetkiniz bulunmuyor.', 403);
    }

    return true;
  }
}
