import { Inject, Injectable } from '@nestjs/common';
import { ApiError } from '../../common/errors/api-error';
import { ErrorCodes } from '../../common/errors/error-codes';
import { SlidingWindowRateLimiter } from '../../common/rate-limit/sliding-window-rate-limiter';
import { APP_ENV } from '../../config/config.module';
import type { AppEnv } from '../../config/env';

/**
 * Límite de resolución por código (BR-145): por usuario y por IP.
 * En memoria, válido para una sola instancia.
 */
@Injectable()
export class QrRateLimiter {
  private readonly userLimiter: SlidingWindowRateLimiter;
  private readonly ipLimiter: SlidingWindowRateLimiter;

  constructor(@Inject(APP_ENV) env: AppEnv) {
    const windowMs = env.qrRateLimitWindowSeconds * 1000;
    this.userLimiter = new SlidingWindowRateLimiter(
      env.qrRateLimitUser,
      windowMs,
    );
    this.ipLimiter = new SlidingWindowRateLimiter(env.qrRateLimitIp, windowMs);
  }

  assertAllowed(userId: string, ip: string | undefined): void {
    const userDecision = this.userLimiter.consume(`user:${userId}`);
    const ipDecision = this.ipLimiter.consume(`ip:${ip ?? 'unknown'}`);

    if (userDecision.allowed && ipDecision.allowed) {
      return;
    }

    const retryAfterSeconds = Math.max(
      userDecision.retryAfterSeconds,
      ipDecision.retryAfterSeconds,
    );

    throw new ApiError(
      429,
      ErrorCodes.RATE_LIMITED,
      'Demasiadas consultas de códigos. Espera antes de reintentar.',
      { retryAfterSeconds },
    );
  }
}
