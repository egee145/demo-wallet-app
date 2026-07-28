import { Module } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';
import { ThrottlerModule } from '@nestjs/throttler';
import { LoggerModule } from 'nestjs-pino';
import { validateEnvironment } from './config/env.validation.js';
import { DatabaseModule } from './database/database.module.js';
import { HealthModule } from './health/health.module.js';
import { GlobalExceptionFilter } from './common/filters/global-exception.filter.js';
import { AppThrottlerGuard } from './common/guards/app-throttler.guard.js';
import { CommonModule } from './common/common.module.js';
import { AuthModule } from './auth/auth.module.js';
import { UsersModule } from './users/users.module.js';
import { WalletModule } from './wallet/wallet.module.js';
import { MerchantModule } from './merchant/merchant.module.js';
import { PaymentModule } from './payment/payment.module.js';
import { TransactionModule } from './transaction/transaction.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validate: validateEnvironment,
    }),
    LoggerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        pinoHttp: {
          level: config.get<string>('LOG_LEVEL', 'info'),
          genReqId: (request, response) => {
            const incoming = request.headers['x-request-id'];
            const requestId =
              typeof incoming === 'string' && /^[0-9a-f-]{36}$/i.test(incoming)
                ? incoming
                : randomUUID();
            response.setHeader('x-request-id', requestId);
            return requestId;
          },
          redact: {
            paths: [
              'req.headers.authorization',
              'req.body.password',
              'req.body.refreshToken',
              'req.body.cardNumber',
              'req.body.cvv',
              'res.headers["set-cookie"]',
            ],
            censor: '[REDACTED]',
          },
        },
      }),
    }),
    ThrottlerModule.forRoot([
      {
        ttl: 60000,
        limit: 100,
      },
    ]),
    CommonModule,
    DatabaseModule,
    AuthModule,
    UsersModule,
    WalletModule,
    MerchantModule,
    PaymentModule,
    TransactionModule,
    HealthModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: AppThrottlerGuard },
    { provide: APP_FILTER, useClass: GlobalExceptionFilter },
  ],
})
export class AppModule {}
