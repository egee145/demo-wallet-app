import { IsIn, IsString, Matches, MaxLength } from 'class-validator';

export const PUSH_PLATFORMS = ['ANDROID', 'IOS'] as const;
export const NOTIFICATION_LANGUAGES = ['tr', 'en'] as const;

export class RegisterPushDeviceDto {
  @IsString()
  @MaxLength(255)
  @Matches(/^(ExponentPushToken|ExpoPushToken)\[[A-Za-z0-9_-]+\]$/)
  expoPushToken!: string;

  @IsIn(PUSH_PLATFORMS)
  platform!: (typeof PUSH_PLATFORMS)[number];

  @IsIn(NOTIFICATION_LANGUAGES)
  language!: (typeof NOTIFICATION_LANGUAGES)[number];
}

export class DeactivatePushDeviceDto {
  @IsString()
  @MaxLength(255)
  @Matches(/^(ExponentPushToken|ExpoPushToken)\[[A-Za-z0-9_-]+\]$/)
  expoPushToken!: string;
}
