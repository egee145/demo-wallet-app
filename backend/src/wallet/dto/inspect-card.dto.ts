import { IsString, Matches, MaxLength, MinLength } from 'class-validator';

export class InspectCardDto {
  @IsString()
  @MinLength(4)
  @MaxLength(95)
  @Matches(/^[0-9a-fA-F:\-\s]+$/)
  tagUid!: string;
}
