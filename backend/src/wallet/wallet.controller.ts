import { Body, Controller, Get, Headers, Post, Query, UseGuards } from '@nestjs/common';
import { Role } from '../generated/prisma/client.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import type { JwtUser } from '../auth/types/jwt-user.js';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import { Roles } from '../common/decorators/roles.decorator.js';
import { RolesGuard } from '../common/guards/roles.guard.js';
import { PaginationDto } from '../common/dto/pagination.dto.js';
import { requireIdempotencyKey } from '../common/utils/idempotency-key.js';
import { BindCardDto } from './dto/bind-card.dto.js';
import { DepositDto } from './dto/deposit.dto.js';
import { InspectCardDto } from './dto/inspect-card.dto.js';
import { MockTopUpDto } from './dto/mock-top-up.dto.js';
import { WalletService } from './wallet.service.js';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('wallet')
export class WalletController {
  constructor(private readonly wallets: WalletService) {}

  @Roles(Role.USER)
  @Get('me')
  me(@CurrentUser() user: JwtUser) {
    return this.wallets.me(user.id);
  }

  @Roles(Role.USER)
  @Get('history')
  history(@CurrentUser() user: JwtUser, @Query() pagination: PaginationDto) {
    return this.wallets.history(user.id, pagination.cursor, pagination.limit);
  }

  @Roles(Role.USER)
  @Get('card')
  card(@CurrentUser() user: JwtUser) {
    return this.wallets.card(user.id);
  }

  @Roles(Role.USER)
  @Post('card/inspect')
  inspectCard(@CurrentUser() user: JwtUser, @Body() dto: InspectCardDto) {
    return this.wallets.inspectCard(user.id, dto);
  }

  @Roles(Role.USER)
  @Post('card')
  bindCard(@CurrentUser() user: JwtUser, @Body() dto: BindCardDto) {
    return this.wallets.bindCard(user.id, dto);
  }

  @Roles(Role.USER)
  @Post('top-up/mock')
  mockTopUp(
    @CurrentUser() user: JwtUser,
    @Headers('idempotency-key') rawKey: string | undefined,
    @Body() dto: MockTopUpDto,
  ) {
    return this.wallets.mockTopUp(user.id, requireIdempotencyKey(rawKey), dto);
  }

  @Roles(Role.USER)
  @Get('top-ups')
  topUps(@CurrentUser() user: JwtUser) {
    return this.wallets.topUps(user.id);
  }

  @Roles(Role.ADMIN)
  @Post('deposit')
  deposit(
    @CurrentUser() user: JwtUser,
    @Headers('idempotency-key') rawKey: string | undefined,
    @Body() dto: DepositDto,
  ) {
    return this.wallets.deposit(user.id, requireIdempotencyKey(rawKey), dto);
  }
}
