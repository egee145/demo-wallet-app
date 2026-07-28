import { IsNumber } from 'class-validator';

export class CreateSessionDto {
  @IsNumber({ allowInfinity: false, allowNaN: false, maxDecimalPlaces: 2 })
  amount!: number;
}
