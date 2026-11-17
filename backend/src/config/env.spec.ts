import { loadEnv, parseDurationSeconds } from './env';

describe('loadEnv', () => {
  it('applies development defaults when variables are absent', () => {
    const env = loadEnv({});

    expect(env.nodeEnv).toBe('development');
    expect(env.port).toBe(3000);
    expect(env.timezone).toBe('America/Lima');
    expect(env.databaseUrl).toMatch(/^mysql:\/\//);
    expect(env.accessTokenTtlSeconds).toBe(900);
    expect(env.refreshTokenTtlSeconds).toBe(604800);
    expect(env.cookieSecure).toBe(false);
    expect(env.corsOrigins).toEqual(['http://localhost:4200']);
    expect(env.loginRateLimit).toBe(5);
    expect(env.loginRateWindowSeconds).toBe(60);
    expect(env.qrRateLimitUser).toBe(60);
    expect(env.qrRateLimitIp).toBe(300);
    expect(env.qrRateLimitWindowSeconds).toBe(60);
  });

  it('reads explicit values', () => {
    const env = loadEnv({
      NODE_ENV: 'test',
      PORT: '4000',
      DATABASE_URL: 'mysql://user:pass@db:3306/site_test',
      TZ: 'America/Lima',
      JWT_ACCESS_SECRET: 'un-secreto-de-pruebas',
      ACCESS_TOKEN_TTL: '10m',
      REFRESH_TOKEN_TTL: '2d',
      COOKIE_SECURE: 'false',
      CORS_ORIGINS: 'http://localhost:4200, https://site.example.test',
      RATE_LIMIT_LOGIN: '8',
      RATE_LIMIT_LOGIN_WINDOW_SECONDS: '120',
      RATE_LIMIT_QR_USER: '15',
      RATE_LIMIT_QR_IP: '90',
      RATE_LIMIT_QR_WINDOW_SECONDS: '30',
    });

    expect(env).toEqual({
      nodeEnv: 'test',
      port: 4000,
      databaseUrl: 'mysql://user:pass@db:3306/site_test',
      timezone: 'America/Lima',
      jwtAccessSecret: 'un-secreto-de-pruebas',
      accessTokenTtlSeconds: 600,
      refreshTokenTtlSeconds: 172800,
      cookieSecure: false,
      corsOrigins: ['http://localhost:4200', 'https://site.example.test'],
      loginRateLimit: 8,
      loginRateWindowSeconds: 120,
      qrRateLimitUser: 15,
      qrRateLimitIp: 90,
      qrRateLimitWindowSeconds: 30,
    });
  });

  it('rejects an invalid port', () => {
    expect(() => loadEnv({ PORT: '70000' })).toThrow(/PORT/);
    expect(() => loadEnv({ PORT: 'abc' })).toThrow(/PORT/);
  });

  it('rejects an unsupported NODE_ENV', () => {
    expect(() => loadEnv({ NODE_ENV: 'staging' })).toThrow(/NODE_ENV/);
  });

  it('requires a mysql DATABASE_URL', () => {
    expect(() => loadEnv({ DATABASE_URL: 'postgres://db/site' })).toThrow(
      /DATABASE_URL/,
    );
  });

  it('requires DATABASE_URL in production', () => {
    expect(() => loadEnv({ NODE_ENV: 'production' })).toThrow(/DATABASE_URL/);
  });

  it('requires a strong JWT secret in production', () => {
    expect(() =>
      loadEnv({
        NODE_ENV: 'production',
        DATABASE_URL: 'mysql://user:pass@db:3306/site',
      }),
    ).toThrow(/JWT_ACCESS_SECRET/);

    expect(() =>
      loadEnv({
        NODE_ENV: 'production',
        DATABASE_URL: 'mysql://user:pass@db:3306/site',
        JWT_ACCESS_SECRET: 'corto',
      }),
    ).toThrow(/JWT_ACCESS_SECRET/);
  });
});

describe('parseDurationSeconds', () => {
  it('parses seconds and suffixed durations', () => {
    expect(parseDurationSeconds('900', 1, 'X')).toBe(900);
    expect(parseDurationSeconds('15m', 1, 'X')).toBe(900);
    expect(parseDurationSeconds('7d', 1, 'X')).toBe(604800);
    expect(parseDurationSeconds('2h', 1, 'X')).toBe(7200);
  });

  it('uses the fallback when the value is empty', () => {
    expect(parseDurationSeconds(undefined, 42, 'X')).toBe(42);
  });

  it('rejects invalid durations', () => {
    expect(() => parseDurationSeconds('0', 1, 'X')).toThrow(/X/);
    expect(() => parseDurationSeconds('15 minutos', 1, 'X')).toThrow(/X/);
  });
});
