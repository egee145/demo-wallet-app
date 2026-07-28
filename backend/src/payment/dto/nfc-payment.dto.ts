import { IsString, IsUUID, Matches, MaxLength, MinLength } from 'class-validator';

export class NfcPaymentDto {
  @IsUUID('4')
  paymentSessionId!: string;

  @IsUUID('4')
  userId!: string;

  @IsString()
  @MinLength(4)
  @MaxLength(95)
  @Matches(/^[0-9a-fA-F:\-\s]+$/)
  tagUid!: string;
}
