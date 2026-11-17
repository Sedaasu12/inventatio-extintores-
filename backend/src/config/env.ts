export type NodeEnv = 'development' | 'test' | 'production';

export interface AppEnv {
  nodeEnv: NodeEnv;
  port: number;
  databaseUrl: string;
  timezone: string;
  jwtAccessSecret: string;
  accessTokenTtlSeconds: number;
  refreshTokenTtlSeconds: number;
  cookieSecure: boolean;
  corsOrigins: string[];
  loginRateLimit: number;
  loginRateWindowSeconds: number;
}

const DEFAULT_PORT = 3000;
const DEFAULT_TIMEZONE = 'America/Lima';
const DEVELOPMENT_DATABASE_URL = 'mysql://site:site@localhost:3306/site';
const DEVELOPMENT_JWT_SECRET = 'development-only-secret-change-me-please';
const DEFAULT_ACCESS_TOKEN_TTL_SECONDS = 15 * 60;
const DEFAULT_REFRESH_TOKEN_TTL_SECONDS = 7 * 24 * 60 * 60;
const DEFAULT_CORS_ORIGINS = ['http://localhost:4200'];
const DEFAULT_LOGIN_RATE_LIMIT = 5;
const DEFAULT_LOGIN_RATE_WINDOW_SECONDS = 60;
const MIN_PRODUCTION_SECRET_LENGTH = 32;

function fail(message: string): never {
  throw new Error(`Invalid environment configuration: ${message}`);
}

function parseNodeEnv(value: string | undefined): NodeEnv {
  if (value === undefined || value.trim() === '') {
    return 'development';
  }
  if (value === 'development' || value === 'test' || value === 'production') {
    return value;
  }
  return fail(
    `NODE_ENV must be development, test or production (received "${value}")`,
  );
}

function parsePort(value: string | undefined): number {
  if (value === undefined || value.trim() === '') {
    return DEFAULT_PORT;
  }
  const port = Number(value);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    return fail(
      `PORT must be an integer between 1 and 65535 (received "${value}")`,
    );
  }
  return port;
}

function parseDatabaseUrl(value: string | undefined, nodeEnv: NodeEnv): string {
  const candidate = value?.trim() ?? '';
  if (candidate === '') {
    if (nodeEnv === 'production') {
      return fail('DATABASE_URL is required in production');
    }
    return DEVELOPMENT_DATABASE_URL;
  }
  if (!candidate.startsWith('mysql://')) {
    return fail('DATABASE_URL must use the mysql:// scheme');
  }
  return candidate;
}

function parseTimezone(value: string | undefined): string {
  const timezone = value?.trim() ?? '';
  return timezone === '' ? DEFAULT_TIMEZONE : timezone;
}

/**
 * Acepta segundos o un sufijo s/m/h/d, por ejemplo `900`, `15m` o `7d`.
 */
export function parseDurationSeconds(
  value: string | undefined,
  fallback: number,
  name: string,
): number {
  const candidate = value?.trim() ?? '';
  if (candidate === '') {
    return fallback;
  }

  const match = /^(\d+)([smhd])?$/.exec(candidate);
  if (match === null) {
    return fail(
      `${name} must be a positive integer with optional s/m/h/d suffix (received "${value}")`,
    );
  }

  const amount = Number(match[1]);
  if (!Number.isInteger(amount) || amount <= 0) {
    return fail(`${name} must be greater than zero`);
  }

  const unit = match[2] ?? 's';
  const factor =
    unit === 's' ? 1 : unit === 'm' ? 60 : unit === 'h' ? 3600 : 86400;
  return amount * factor;
}

function parseBoolean(
  value: string | undefined,
  fallback: boolean,
  name: string,
): boolean {
  const candidate = value?.trim().toLowerCase() ?? '';
  if (candidate === '') {
    return fallback;
  }
  if (candidate === 'true' || candidate === '1') {
    return true;
  }
  if (candidate === 'false' || candidate === '0') {
    return false;
  }
  return fail(`${name} must be true or false (received "${value}")`);
}

function parseCorsOrigins(value: string | undefined): string[] {
  const candidate = value?.trim() ?? '';
  if (candidate === '') {
    return DEFAULT_CORS_ORIGINS;
  }
  const origins = candidate
    .split(',')
    .map((origin) => origin.trim())
    .filter((origin) => origin.length > 0);
  if (origins.length === 0) {
    return fail('CORS_ORIGINS must contain at least one origin');
  }
  return origins;
}

function parsePositiveInteger(
  value: string | undefined,
  fallback: number,
  name: string,
): number {
  const candidate = value?.trim() ?? '';
  if (candidate === '') {
    return fallback;
  }
  const parsed = Number(candidate);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    return fail(`${name} must be a positive integer (received "${value}")`);
  }
  return parsed;
}

function parseJwtSecret(value: string | undefined, nodeEnv: NodeEnv): string {
  const candidate = value?.trim() ?? '';
  if (candidate === '') {
    if (nodeEnv === 'production') {
      return fail('JWT_ACCESS_SECRET is required in production');
    }
    return DEVELOPMENT_JWT_SECRET;
  }
  if (
    nodeEnv === 'production' &&
    candidate.length < MIN_PRODUCTION_SECRET_LENGTH
  ) {
    return fail(
      `JWT_ACCESS_SECRET must have at least ${MIN_PRODUCTION_SECRET_LENGTH} characters in production`,
    );
  }
  return candidate;
}

/**
 * Reads and validates the process environment.
 * Never logs or returns secrets; only validates their shape.
 */
export function loadEnv(source: NodeJS.ProcessEnv = process.env): AppEnv {
  const nodeEnv = parseNodeEnv(source.NODE_ENV);
  return {
    nodeEnv,
    port: parsePort(source.PORT),
    databaseUrl: parseDatabaseUrl(source.DATABASE_URL, nodeEnv),
    timezone: parseTimezone(source.TZ),
    jwtAccessSecret: parseJwtSecret(source.JWT_ACCESS_SECRET, nodeEnv),
    accessTokenTtlSeconds: parseDurationSeconds(
      source.ACCESS_TOKEN_TTL,
      DEFAULT_ACCESS_TOKEN_TTL_SECONDS,
      'ACCESS_TOKEN_TTL',
    ),
    refreshTokenTtlSeconds: parseDurationSeconds(
      source.REFRESH_TOKEN_TTL,
      DEFAULT_REFRESH_TOKEN_TTL_SECONDS,
      'REFRESH_TOKEN_TTL',
    ),
    cookieSecure: parseBoolean(
      source.COOKIE_SECURE,
      nodeEnv === 'production',
      'COOKIE_SECURE',
    ),
    corsOrigins: parseCorsOrigins(source.CORS_ORIGINS),
    loginRateLimit: parsePositiveInteger(
      source.RATE_LIMIT_LOGIN,
      DEFAULT_LOGIN_RATE_LIMIT,
      'RATE_LIMIT_LOGIN',
    ),
    loginRateWindowSeconds: parsePositiveInteger(
      source.RATE_LIMIT_LOGIN_WINDOW_SECONDS,
      DEFAULT_LOGIN_RATE_WINDOW_SECONDS,
      'RATE_LIMIT_LOGIN_WINDOW_SECONDS',
    ),
  };
}
