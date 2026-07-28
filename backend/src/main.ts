import 'reflect-metadata';
import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { json } from 'express';
import helmet from 'helmet';
import { Logger } from 'nestjs-pino';
import { AppModule } from './app.module.js';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, {
    bufferLogs: true,
    bodyParser: false,
  });
  const config = app.get(ConfigService);

  app.useLogger(app.get(Logger));
  app.setGlobalPrefix('api');
  app.use(helmet());
  app.use(json({ limit: '100kb' }));
  app.enableCors({
    origin: (
      origin: string | undefined,
      callback: (error: Error | null, allowed?: boolean) => void,
    ) => {
      if (!origin) {
        callback(null, true);
        return;
      }
      const origins = config
        .get<string>('CORS_ORIGINS', '')
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean);
      callback(null, origins.includes(origin));
    },
    credentials: true,
  });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: false },
    }),
  );

  await app.listen(config.get<number>('PORT', 3000), '0.0.0.0');
}

void bootstrap();
