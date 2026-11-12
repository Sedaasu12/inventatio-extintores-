export type NodeEnv = 'development' | 'test' | 'production';

export interface AppEnv {
  nodeEnv: NodeEnv;
  port: number;
  databaseUrl: string;
  timezone: string;
}

const DEFAULT_PORT = 3000;
const DEFAULT_TIMEZONE = 'America/Lima';
const DEVELOPMENT_DATABASE_URL = 'mysql://site:site@localhost:3306/site';

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
  };
}
