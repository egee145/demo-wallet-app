import type { Role } from '../../generated/prisma/client.js';

export type JwtUser = {
  id: string;
  email: string;
  role: Role;
  isActive: boolean;
};

export type AccessTokenPayload = {
  sub: string;
  jti: string;
  iat?: number;
  exp?: number;
};
