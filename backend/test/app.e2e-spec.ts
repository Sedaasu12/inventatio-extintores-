import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';

describe('Health (e2e)', () => {
  let app: INestApplication<App>;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    await app.init();
  });

  it('GET /api/v1/health returns ok', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/v1/health')
      .expect(200);
    const body = response.body as {
      status: string;
      service: string;
      timestamp: string;
    };

    expect(body).toMatchObject({
      status: 'ok',
      service: 'site-backend',
    });
    expect(typeof body.timestamp).toBe('string');
  });

  it('GET /api/v1/health rejects unsupported methods', async () => {
    await request(app.getHttpServer()).post('/api/v1/health').expect(404);
  });

  afterEach(async () => {
    await app.close();
  });
});
