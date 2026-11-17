import { ApiError } from '../../common/errors/api-error';
import type { AppEnv } from '../../config/env';
import { QrRateLimiter } from './qr-rate-limiter';

function env(overrides: Partial<AppEnv> = {}): AppEnv {
  return {
    nodeEnv: 'test',
    port: 3000,
    databaseUrl: 'mysql://site:site@localhost:3307/site_test',
    timezone: 'America/Lima',
    jwtAccessSecret: 'test-secret',
    accessTokenTtlSeconds: 900,
    refreshTokenTtlSeconds: 604800,
    cookieSecure: false,
    corsOrigins: ['http://localhost:4200'],
    loginRateLimit: 5,
    loginRateWindowSeconds: 60,
    qrRateLimitUser: 2,
    qrRateLimitIp: 300,
    qrRateLimitWindowSeconds: 60,
    ...overrides,
  };
}

describe('QrRateLimiter (T-QR-05)', () => {
  it('permite hasta el límite por usuario y luego responde 429', () => {
    const limiter = new QrRateLimiter(env());

    expect(() => limiter.assertAllowed('user-1', '127.0.0.1')).not.toThrow();
    expect(() => limiter.assertAllowed('user-1', '127.0.0.1')).not.toThrow();

    let thrown: unknown;
    try {
      limiter.assertAllowed('user-1', '127.0.0.1');
    } catch (error) {
      thrown = error;
    }

    expect(thrown).toBeInstanceOf(ApiError);
    const apiError = thrown as ApiError;
    expect(apiError.status).toBe(429);
    expect(apiError.code).toBe('RATE_LIMITED');
    const details = apiError.details as { retryAfterSeconds: number };
    expect(details.retryAfterSeconds).toBeGreaterThan(0);
  });

  it('separa los contadores por usuario', () => {
    const limiter = new QrRateLimiter(env());

    limiter.assertAllowed('user-1', '127.0.0.1');
    limiter.assertAllowed('user-1', '127.0.0.1');
    expect(() => limiter.assertAllowed('user-2', '127.0.0.1')).not.toThrow();
  });

  it('aplica también el límite por IP', () => {
    const limiter = new QrRateLimiter(env({ qrRateLimitIp: 1 }));

    limiter.assertAllowed('user-1', '10.0.0.1');
    expect(() => limiter.assertAllowed('user-2', '10.0.0.1')).toThrow(ApiError);
    expect(() => limiter.assertAllowed('user-3', '10.0.0.2')).not.toThrow();
  });
});
