import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { NotificationModule } from '../notification/notification.module.js';
import { IdempotencyModule } from './idempotency/idempotency.module.js';
import { PaymentExecutionService } from './execution/payment-execution.service.js';
import { PaymentGateway } from './gateway/payment.gateway.js';
import { PaymentController } from './payment.controller.js';
import { PaymentSessionService } from './session/payment-session.service.js';

@Module({
  imports: [AuthModule, IdempotencyModule, NotificationModule],
  controllers: [PaymentController],
  providers: [PaymentSessionService, PaymentExecutionService, PaymentGateway],
  exports: [PaymentSessionService, PaymentExecutionService],
})
export class PaymentModule {}
