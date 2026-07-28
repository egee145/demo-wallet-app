import { HttpStatus } from '@nestjs/common';
import { DomainException } from '../errors/domain.exception.js';

export type HistoryCursor = { createdAt: Date; id: string };

export function encodeCursor(value: HistoryCursor): string {
  return Buffer.from(
    JSON.stringify({ createdAt: value.createdAt.toISOString(), id: value.id }),
  ).toString('base64url');
}

export function decodeCursor(value?: string): HistoryCursor | undefined {
  if (!value) {
    return undefined;
  }

  try {
    const parsed = JSON.parse(Buffer.from(value, 'base64url').toString('utf8')) as {
      createdAt: string;
      id: string;
    };
    const createdAt = new Date(parsed.createdAt);
    if (Number.isNaN(createdAt.getTime()) || !parsed.id) {
      throw new Error('invalid cursor');
    }
    return { createdAt, id: parsed.id };
  } catch {
    throw new DomainException(
      'VALIDATION_ERROR',
      'Pagination cursor geçersiz.',
      HttpStatus.BAD_REQUEST,
    );
  }
}
