import { IsNumber, IsString, IsUUID, MaxLength, MinLength } from 'class-validator';

export class DepositDto {
  @IsUUID('4')
  userId!: string;

  @IsNumber({ allowInfinity: false, allowNaN: false, maxDecimalPlaces: 2 })
  amount!: number;

  @IsString()
  @MinLength(3)
  @MaxLength(250)
  reason!: string;
}
