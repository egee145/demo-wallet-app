import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { Role } from '../generated/prisma/client.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import type { JwtUser } from '../auth/types/jwt-user.js';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import { Roles } from '../common/decorators/roles.decorator.js';
import { RolesGuard } from '../common/guards/roles.guard.js';
import { PaginationDto } from '../common/dto/pagination.dto.js';
import { MerchantService } from './merchant.service.js';

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.MERCHANT)
@Controller('merchant')
export class MerchantController {
  constructor(private readonly merchants: MerchantService) {}

  @Get('me')
  me(@CurrentUser() user: JwtUser) {
    return this.merchants.me(user.id);
  }

  @Get('transactions')
  history(@CurrentUser() user: JwtUser, @Query() pagination: PaginationDto) {
    return this.merchants.history(user.id, pagination.cursor, pagination.limit);
  }
}
