import {
  Body,
  Controller,
  Get,
  Headers,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { Role } from '../generated/prisma/client.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import type { JwtUser } from '../auth/types/jwt-user.js';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import { Roles } from '../common/decorators/roles.decorator.js';
import { RolesGuard } from '../common/guards/roles.guard.js';
import { requireIdempotencyKey } from '../common/utils/idempotency-key.js';
import { CreateSessionDto } from './dto/create-session.dto.js';
import { NfcPaymentDto } from './dto/nfc-payment.dto.js';
import { QrPaymentDto } from './dto/qr-payment.dto.js';
import { PaymentExecutionService } from './execution/payment-execution.service.js';
import { PaymentSessionService } from './session/payment-session.service.js';

@UseGuards(JwtAuthGuard, RolesGuard)
@Throttle({ default: { limit: 30, ttl: 60_000 } })
@Controller('payments')
export class PaymentController {
  constructor(
    private readonly sessions: PaymentSessionService,
    private readonly execution: PaymentExecutionService,
  ) {}

  @Roles(Role.MERCHANT)
  @Post('session')
  createSession(
    @CurrentUser() user: JwtUser,
    @Headers('idempotency-key') rawKey: string | undefined,
    @Body() dto: CreateSessionDto,
  ) {
    return this.sessions.create(user.id, requireIdempotencyKey(rawKey), dto.amount);
  }

  @Roles(Role.USER, Role.MERCHANT)
  @Get('session/:id')
  detail(
    @CurrentUser() user: JwtUser,
    @Param('id', new ParseUUIDPipe({ version: '4' })) sessionId: string,
  ) {
    return this.sessions.detail(user, sessionId);
  }

  @Roles(Role.MERCHANT)
  @Post('session/:id/cancel')
  cancel(
    @CurrentUser() user: JwtUser,
    @Param('id', new ParseUUIDPipe({ version: '4' })) sessionId: string,
  ) {
    return this.sessions.cancel(user.id, sessionId);
  }

  @Roles(Role.MERCHANT)
  @Post('nfc')
  nfc(
    @CurrentUser() user: JwtUser,
    @Headers('idempotency-key') rawKey: string | undefined,
    @Body() dto: NfcPaymentDto,
  ) {
    return this.execution.executeNfc(
      user.id,
      dto.paymentSessionId,
      dto.userId,
      dto.tagUid,
      requireIdempotencyKey(rawKey),
    );
  }

  @Roles(Role.USER)
  @Post('qr')
  qr(
    @CurrentUser() user: JwtUser,
    @Headers('idempotency-key') rawKey: string | undefined,
    @Body() dto: QrPaymentDto,
  ) {
    return this.execution.executeQr(user.id, dto.paymentSessionId, requireIdempotencyKey(rawKey));
  }
}
