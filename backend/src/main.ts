import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { APP_ENV } from './config/config.module';
import type { AppEnv } from './config/env';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);
  const env = app.get<AppEnv>(APP_ENV);

  app.setGlobalPrefix('api/v1');
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  const swaggerConfig = new DocumentBuilder()
    .setTitle('SITE API')
    .setDescription('Inventario y trazabilidad de extintores')
    .setVersion('0.1.0')
    .build();
  SwaggerModule.setup(
    'api/docs',
    app,
    SwaggerModule.createDocument(app, swaggerConfig),
  );

  app.enableShutdownHooks();
  await app.listen(env.port);
}

bootstrap().catch((error: unknown) => {
  console.error('SITE backend failed to start:', error);
  process.exitCode = 1;
});
