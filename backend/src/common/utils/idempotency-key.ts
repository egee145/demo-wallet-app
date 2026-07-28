import { HttpStatus } from '@nestjs/common';
import { isUUID } from 'class-validator';
import { DomainException } from '../errors/domain.exception.js';

export function requireIdempotencyKey(value: string | undefined): string {
  if (!value || !isUUID(value, '4')) {
    throw new DomainException(
      'INVALID_IDEMPOTENCY_KEY',
      'Idempotency-Key geçerli bir UUID v4 olmalıdır.',
      HttpStatus.BAD_REQUEST,
    );
  }

  return value.toLowerCase();
}
