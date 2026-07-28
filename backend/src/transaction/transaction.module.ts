import { Module } from '@nestjs/common';
import { TransactionService } from './transaction.service.js';

@Module({
  providers: [TransactionService],
  exports: [TransactionService],
})
export class TransactionModule {}
