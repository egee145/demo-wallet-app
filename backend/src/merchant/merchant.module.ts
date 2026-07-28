import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { TransactionModule } from '../transaction/transaction.module.js';
import { AdminMerchantController } from './admin-merchant.controller.js';
import { MerchantController } from './merchant.controller.js';
import { MerchantService } from './merchant.service.js';

@Module({
  imports: [AuthModule, TransactionModule],
  controllers: [AdminMerchantController, MerchantController],
  providers: [MerchantService],
  exports: [MerchantService],
})
export class MerchantModule {}
