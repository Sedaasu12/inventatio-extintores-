/**
 * Variables de entorno para las pruebas e2e. Se carga antes de importar
 * `AppModule`, de modo que `ConfigModule.forRoot` no tome la base de desarrollo.
 */
process.env.NODE_ENV = 'test';
process.env.DATABASE_URL =
  process.env.TEST_DATABASE_URL?.trim() ||
  'mysql://site:site@localhost:3307/site_test';
process.env.JWT_ACCESS_SECRET = 'e2e-only-secret-with-enough-length-000';
process.env.ACCESS_TOKEN_TTL = '15m';
process.env.REFRESH_TOKEN_TTL = '7d';
process.env.COOKIE_SECURE = 'false';
process.env.CORS_ORIGINS = 'http://localhost:4200';
process.env.RATE_LIMIT_LOGIN = '5';
process.env.RATE_LIMIT_LOGIN_WINDOW_SECONDS = '60';
