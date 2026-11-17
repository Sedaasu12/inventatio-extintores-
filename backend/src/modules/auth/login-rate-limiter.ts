import { Inject, Injectable } from '@nestjs/common';
import { APP_ENV } from '../../config/config.module';
import type { AppEnv } from '../../config/env';
import { ApiError } from '../../common/errors/api-error';
import { ErrorCodes } from '../../common/errors/error-codes';

/**
 * Límite de intentos de login por IP y por correo (BR-177, T-AUT-08).
 *
 * Es un contador en memoria: el MVP corre en una sola instancia. Si se
 * despliegan varias, este límite debe moverse a un almacén compartido.
 */
@Injectable()
export class LoginRateLimiter {
  private readonly attempts = new Map<string, number[]>();

  constructor(@Inject(APP_ENV) private readonly env: AppEnv) {}

  assertAllowed(keys: string[]): void {
    const now = Date.now();
    const windowMs = this.env.loginRateWindowSeconds * 1000;
    let retryAfterSeconds = 0;

    for (const key of keys) {
      const timestamps = (this.attempts.get(key) ?? []).filter(
        (timestamp) => now - timestamp < windowMs,
      );
      this.attempts.set(key, timestamps);

      if (timestamps.length >= this.env.loginRateLimit) {
        const oldest = timestamps[0] ?? now;
        retryAfterSeconds = Math.max(
          retryAfterSeconds,
          Math.ceil((oldest + windowMs - now) / 1000),
        );
      }
    }

    if (retryAfterSeconds > 0) {
      throw new ApiError(
        429,
        ErrorCodes.RATE_LIMITED,
        'Demasiados intentos de inicio de sesión. Espera antes de reintentar.',
        { retryAfterSeconds },
      );
    }
  }

  registerFailure(keys: string[]): void {
    const now = Date.now();
    for (const key of keys) {
      const timestamps = this.attempts.get(key) ?? [];
      timestamps.push(now);
      this.attempts.set(key, timestamps);
    }
  }

  clear(keys: string[]): void {
    for (const key of keys) {
      this.attempts.delete(key);
    }
  }

  reset(): void {
    this.attempts.clear();
  }
}
