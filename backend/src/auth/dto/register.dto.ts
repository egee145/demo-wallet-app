import {
  IsEmail,
  IsIn,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
  ValidateIf,
} from 'class-validator';

export const ACCOUNT_TYPES = ['PERSONAL', 'BUSINESS'] as const;
export type AccountType = (typeof ACCOUNT_TYPES)[number];

export class RegisterDto {
  @IsOptional()
  @IsIn(ACCOUNT_TYPES)
  accountType?: AccountType;

  @IsString()
  @MinLength(2)
  @MaxLength(100)
  name!: string;

  @ValidateIf((dto: RegisterDto) => dto.accountType === 'BUSINESS')
  @IsString()
  @MinLength(2)
  @MaxLength(150)
  businessName?: string;

  @IsEmail()
  @MaxLength(254)
  email!: string;

  @IsOptional()
  @Matches(/^\+[1-9]\d{7,14}$/)
  phone?: string;

  @IsString()
  @MinLength(12)
  @MaxLength(128)
  password!: string;
}
