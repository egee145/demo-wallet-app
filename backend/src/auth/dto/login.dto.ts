import { IsEmail, IsIn, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { ACCOUNT_TYPES, type AccountType } from './register.dto.js';

export class LoginDto {
  @IsOptional()
  @IsIn(ACCOUNT_TYPES)
  accountType?: AccountType;

  @IsEmail()
  @MaxLength(254)
  email!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(128)
  password!: string;
}
