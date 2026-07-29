import { HttpStatus, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NotificationType, Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../database/prisma.service.js';
import { DomainException } from '../common/errors/domain.exception.js';
import type {
  DeactivatePushDeviceDto,
  RegisterPushDeviceDto,
} from './dto/register-push-device.dto.js';
import { buildPushContent, type NotificationLanguage } from './notification-content.js';

type ExpoTicket = {
  status?: 'ok' | 'error';
  details?: { error?: string };
};

@Injectable()
export class NotificationService {
  private readonly logger = new Logger(NotificationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  async registerDevice(userId: string, dto: RegisterPushDeviceDto) {
    await this.prisma.pushDevice.upsert({
      where: { expoPushToken: dto.expoPushToken },
      create: {
        userId,
        expoPushToken: dto.expoPushToken,
        platform: dto.platform,
        language: dto.language,
      },
      update: {
        userId,
        platform: dto.platform,
        language: dto.language,
        isActive: true,
        lastSeenAt: new Date(),
      },
    });

    const pending = await this.prisma.userNotification.findMany({
      where: { userId, readAt: null, pushSentAt: null },
      select: { id: true },
      orderBy: { createdAt: 'asc' },
      take: 20,
    });
    await Promise.allSettled(pending.map(({ id }) => this.deliver(id)));
    return { registered: true };
  }

  async deactivateDevice(userId: string, dto: DeactivatePushDeviceDto) {
    await this.prisma.pushDevice.updateMany({
      where: { userId, expoPushToken: dto.expoPushToken },
      data: { isActive: false },
    });
  }

  async unread(userId: string) {
    const items = await this.prisma.userNotification.findMany({
      where: { userId, readAt: null },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      take: 20,
    });
    return {
      items: items.map((item) => ({
        id: item.id,
        type: item.type,
        data: item.data,
        createdAt: item.createdAt.toISOString(),
      })),
    };
  }

  async dismiss(userId: string, notificationId: string) {
    const result = await this.prisma.userNotification.updateMany({
      where: { id: notificationId, userId },
      data: { readAt: new Date() },
    });
    if (result.count !== 1) {
      throw new DomainException(
        'NOTIFICATION_NOT_FOUND',
        'Bildirim bulunamadı.',
        HttpStatus.NOT_FOUND,
      );
    }
  }

  createCardTransfer(tx: Prisma.TransactionClient, previousUserId: string) {
    return tx.userNotification.create({
      data: {
        userId: previousUserId,
        type: NotificationType.NFC_CARD_TRANSFERRED,
        data: { route: 'CardManagement' },
      },
      select: { id: true },
    });
  }

  createNfcPayment(
    tx: Prisma.TransactionClient,
    userId: string,
    transactionId: string,
    amount: Prisma.Decimal,
  ) {
    return tx.userNotification.create({
      data: {
        userId,
        type: NotificationType.NFC_PAYMENT_COMPLETED,
        transactionId,
        data: {
          route: 'UserHistory',
          transactionId,
          amount: amount.toFixed(2),
          currency: 'TRY',
        },
      },
      select: { id: true },
    });
  }

  async deliver(notificationId: string): Promise<void> {
    if (!this.config.get<boolean>('EXPO_PUSH_ENABLED', false)) {
      return;
    }

    const claimed = await this.prisma.userNotification.updateMany({
      where: { id: notificationId, pushSentAt: null, readAt: null },
      data: { pushSentAt: new Date() },
    });
    if (claimed.count !== 1) {
      return;
    }

    const notification = await this.prisma.userNotification.findUnique({
      where: { id: notificationId },
      include: {
        user: {
          select: {
            pushDevices: {
              where: { isActive: true },
              select: { id: true, expoPushToken: true, language: true },
            },
          },
        },
      },
    });
    if (!notification || notification.user.pushDevices.length === 0) {
      await this.releaseDeliveryClaim(notificationId);
      return;
    }

    try {
      const messages = notification.user.pushDevices.map((device) => {
        const language: NotificationLanguage = device.language === 'en' ? 'en' : 'tr';
        const content = buildPushContent(notification.type, notification.data, language);
        return {
          to: device.expoPushToken,
          sound: 'default',
          channelId: 'wallet-events',
          title: content.title,
          body: content.body,
          data: {
            notificationId: notification.id,
            type: notification.type,
            route: content.route,
            ...content.data,
          },
        };
      });
      const accessToken = this.config.get<string>('EXPO_PUSH_ACCESS_TOKEN');
      const response = await fetch('https://exp.host/--/api/v2/push/send', {
        method: 'POST',
        headers: {
          accept: 'application/json',
          'accept-encoding': 'gzip, deflate',
          'content-type': 'application/json',
          ...(accessToken ? { authorization: `Bearer ${accessToken}` } : {}),
        },
        body: JSON.stringify(messages),
        signal: AbortSignal.timeout(5000),
      });
      if (!response.ok) {
        throw new Error(`Expo push service returned HTTP ${response.status}`);
      }
      const payload = (await response.json()) as { data?: ExpoTicket | ExpoTicket[] };
      const tickets = Array.isArray(payload.data) ? payload.data : [payload.data];
      const invalidDeviceIds = tickets.flatMap((ticket, index) =>
        ticket?.status === 'error' && ticket.details?.error === 'DeviceNotRegistered'
          ? [notification.user.pushDevices[index]?.id]
          : [],
      );
      if (invalidDeviceIds.length > 0) {
        await this.prisma.pushDevice.updateMany({
          where: { id: { in: invalidDeviceIds.filter((id): id is string => Boolean(id)) } },
          data: { isActive: false },
        });
      }
    } catch (error) {
      await this.releaseDeliveryClaim(notificationId);
      this.logger.warn(
        `Push delivery deferred; notificationId=${notificationId}; reason=${
          error instanceof Error ? error.message : 'unknown'
        }`,
      );
    }
  }

  private async releaseDeliveryClaim(notificationId: string) {
    await this.prisma.userNotification.updateMany({
      where: { id: notificationId, readAt: null },
      data: { pushSentAt: null },
    });
  }
}
