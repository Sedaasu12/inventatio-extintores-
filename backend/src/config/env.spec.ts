import { loadEnv } from './env';

describe('loadEnv', () => {
  it('applies development defaults when variables are absent', () => {
    const env = loadEnv({});

    expect(env.nodeEnv).toBe('development');
    expect(env.port).toBe(3000);
    expect(env.timezone).toBe('America/Lima');
    expect(env.databaseUrl).toMatch(/^mysql:\/\//);
  });

  it('reads explicit values', () => {
    const env = loadEnv({
      NODE_ENV: 'test',
      PORT: '4000',
      DATABASE_URL: 'mysql://user:pass@db:3306/site_test',
      TZ: 'America/Lima',
    });

    expect(env).toEqual({
      nodeEnv: 'test',
      port: 4000,
      databaseUrl: 'mysql://user:pass@db:3306/site_test',
      timezone: 'America/Lima',
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
});
