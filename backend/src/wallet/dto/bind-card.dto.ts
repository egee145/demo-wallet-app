import { IsString, Matches, MaxLength, MinLength } from 'class-validator';

export class BindCardDto {
  @IsString()
  @MinLength(4)
  @MaxLength(95)
  @Matches(/^[0-9a-fA-F:\-\s]+$/)
  tagUid!: string;

  @IsString()
  @MinLength(2)
  @MaxLength(80)
  label!: string;
}
