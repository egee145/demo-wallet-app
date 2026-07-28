import { Controller, Get, Param, ParseUUIDPipe, UseGuards } from '@nestjs/common';
import { Role } from '../generated/prisma/client.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import type { JwtUser } from '../auth/types/jwt-user.js';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import { Roles } from '../common/decorators/roles.decorator.js';
import { RolesGuard } from '../common/guards/roles.guard.js';
import { UsersService } from './users.service.js';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('users')
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get('me')
  me(@CurrentUser() user: JwtUser) {
    return this.users.me(user.id);
  }

  @Roles(Role.MERCHANT)
  @Get(':id')
  cardUser(
    @CurrentUser() merchant: JwtUser,
    @Param('id', new ParseUUIDPipe({ version: '4' })) userId: string,
  ) {
    return this.users.cardUser(merchant.id, userId);
  }
}
