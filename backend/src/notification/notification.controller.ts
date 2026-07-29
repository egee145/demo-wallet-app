import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import { Role } from '../generated/prisma/client.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import type { JwtUser } from '../auth/types/jwt-user.js';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import { Roles } from '../common/decorators/roles.decorator.js';
import { RolesGuard } from '../common/guards/roles.guard.js';
import { DeactivatePushDeviceDto, RegisterPushDeviceDto } from './dto/register-push-device.dto.js';
import { NotificationService } from './notification.service.js';

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.USER)
@Controller('notifications')
export class NotificationController {
  constructor(private readonly notifications: NotificationService) {}

  @Post('devices')
  registerDevice(@CurrentUser() user: JwtUser, @Body() dto: RegisterPushDeviceDto) {
    return this.notifications.registerDevice(user.id, dto);
  }

  @Delete('devices')
  @HttpCode(204)
  async deactivateDevice(@CurrentUser() user: JwtUser, @Body() dto: DeactivatePushDeviceDto) {
    await this.notifications.deactivateDevice(user.id, dto);
  }

  @Get('unread')
  unread(@CurrentUser() user: JwtUser) {
    return this.notifications.unread(user.id);
  }

  @Post(':id/dismiss')
  @HttpCode(204)
  async dismiss(
    @CurrentUser() user: JwtUser,
    @Param('id', new ParseUUIDPipe({ version: '4' })) notificationId: string,
  ) {
    await this.notifications.dismiss(user.id, notificationId);
  }
}
