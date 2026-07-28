import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { IdempotencyModule } from '../payment/idempotency/idempotency.module.js';
import { TransactionModule } from '../transaction/transaction.module.js';
import { WalletController } from './wallet.controller.js';
import { WalletService } from './wallet.service.js';

@Module({
  imports: [AuthModule, IdempotencyModule, TransactionModule],
  controllers: [WalletController],
  providers: [WalletService],
})
export class WalletModule {}
