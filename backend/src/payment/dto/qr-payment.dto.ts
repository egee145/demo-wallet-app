import { IsUUID } from 'class-validator';

export class QrPaymentDto {
  @IsUUID('4')
  paymentSessionId!: string;
}
