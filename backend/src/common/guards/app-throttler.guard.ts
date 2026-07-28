import { Injectable } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';

@Injectable()
export class AppThrottlerGuard extends ThrottlerGuard {
  protected override getTracker(request: Record<string, unknown>): Promise<string> {
    const ip =
      typeof request.ip === 'string'
        ? request.ip
        : typeof request.socket === 'object' &&
            request.socket !== null &&
            'remoteAddress' in request.socket &&
            typeof request.socket.remoteAddress === 'string'
          ? request.socket.remoteAddress
          : 'unknown';
    const path = typeof request.originalUrl === 'string' ? request.originalUrl : '';
    const body =
      typeof request.body === 'object' && request.body !== null
        ? (request.body as Record<string, unknown>)
        : undefined;
    const email =
      path.endsWith('/auth/login') && typeof body?.email === 'string'
        ? body.email.trim().toLowerCase()
        : undefined;

    return Promise.resolve(email ? `${ip}:${email}` : ip);
  }
}
