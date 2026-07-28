import { createHash } from 'node:crypto';
import { HttpStatus } from '@nestjs/common';
import { DomainException } from '../errors/domain.exception.js';

export function normalizeTagUid(value: string): string {
  const normalized = value.replace(/[\s:-]/g, '').toLowerCase();
  if (!/^[0-9a-f]{4,64}$/.test(normalized)) {
    throw new DomainException(
      'INVALID_NFC_TAG_UID',
      'NFC kart kimliği geçersiz.',
      HttpStatus.UNPROCESSABLE_ENTITY,
    );
  }
  return normalized;
}

export function hashTagUid(value: string): string {
  return createHash('sha256').update(normalizeTagUid(value)).digest('hex');
}
