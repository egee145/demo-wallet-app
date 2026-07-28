import { createParamDecorator, type ExecutionContext } from '@nestjs/common';
import type { JwtUser } from '../../auth/types/jwt-user.js';

export const CurrentUser = createParamDecorator(
  (_data: unknown, context: ExecutionContext): JwtUser => {
    const request = context.switchToHttp().getRequest<{ user: JwtUser }>();
    return request.user;
  },
);
