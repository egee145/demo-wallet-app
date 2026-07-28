import { IsNumber, IsString, Matches, MaxLength, MinLength } from 'class-validator';

export class MockTopUpDto {
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  @Matches(/^[\p{L}\p{M} .'-]+$/u)
  cardholderName!: string;

  @IsString()
  @Matches(/^(?:\d[ -]?){12,18}\d$/)
  cardNumber!: string;

  @IsString()
  @Matches(/^(0[1-9]|1[0-2])\/(\d{2}|\d{4})$/)
  expiry!: string;

  @IsString()
  @Matches(/^\d{3,4}$/)
  cvv!: string;

  @IsNumber({ allowInfinity: false, allowNaN: false, maxDecimalPlaces: 2 })
  amount!: number;
}
