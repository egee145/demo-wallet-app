import { HttpStatus } from '@nestjs/common';
import { Prisma } from '../../generated/prisma/client.js';
import { DomainException } from '../errors/domain.exception.js';

const DEFAULT_MAX = new Prisma.Decimal('999999.99');

export function parseMoney(value: unknown, max = DEFAULT_MAX): Prisma.Decimal {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new DomainException(
      'INVALID_AMOUNT',
      'Tutar finite bir JSON number olmalıdır.',
      HttpStatus.BAD_REQUEST,
    );
  }

  const decimal = new Prisma.Decimal(String(value));
  if (decimal.decimalPlaces() > 2 || decimal.lessThan('0.01') || decimal.greaterThan(max)) {
    throw new DomainException(
      'INVALID_AMOUNT',
      'Tutar 0.01 ile izin verilen maksimum arasında ve en fazla iki ondalıklı olmalıdır.',
      HttpStatus.BAD_REQUEST,
    );
  }

  return decimal;
}

export function serializeMoney(value: Prisma.Decimal | string): number {
  const decimal = value instanceof Prisma.Decimal ? value : new Prisma.Decimal(value);
  return Number(decimal.toFixed(2));
}

export function canonicalMoney(value: Prisma.Decimal): string {
  return value.toFixed(2);
}
