import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import { JwtAuthGuard } from './common/auth/jwt-auth.guard';
import { PasswordChangeGuard } from './common/auth/password-change.guard';
import { PermissionsGuard } from './common/auth/permissions.guard';
import { CodeCounterModule } from './common/codes/code-counter.module';
import { ApiExceptionFilter } from './common/errors/api-exception.filter';
import { IdempotencyModule } from './common/idempotency/idempotency.module';
import { RequestIdMiddleware } from './common/middleware/request-id.middleware';
import { APP_ENV, AppConfigModule } from './config/config.module';
import type { AppEnv } from './config/env';
import { AuditModule } from './modules/audit/audit.module';
import { AuthModule } from './modules/auth/auth.module';
import { ExternalPartiesModule } from './modules/catalogs/external-parties/external-parties.module';
import { ExtinguisherTypesModule } from './modules/catalogs/extinguisher-types/extinguisher-types.module';
import { ExtinguishersModule } from './modules/extinguishers/extinguishers.module';
import { HealthModule } from './modules/health/health.module';
import { LocationsModule } from './modules/locations/locations.module';
import { MaintenanceModule } from './modules/maintenance/maintenance.module';
import { MovementsModule } from './modules/movements/movements.module';
import { UsersModule } from './modules/users/users.module';
import { PrismaModule } from './prisma/prisma.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env', '../.env'],
    }),
    AppConfigModule,
    PrismaModule,
    JwtModule.registerAsync({
      global: true,
      inject: [APP_ENV],
      useFactory: (env: AppEnv) => ({
        secret: env.jwtAccessSecret,
        signOptions: { expiresIn: env.accessTokenTtlSeconds },
      }),
    }),
    AuditModule,
    AuthModule,
    UsersModule,
    CodeCounterModule,
    IdempotencyModule,
    LocationsModule,
    ExtinguisherTypesModule,
    ExternalPartiesModule,
    ExtinguishersModule,
    MovementsModule,
    MaintenanceModule,
    HealthModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: PasswordChangeGuard },
    { provide: APP_GUARD, useClass: PermissionsGuard },
    { provide: APP_FILTER, useClass: ApiExceptionFilter },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(RequestIdMiddleware).forRoutes('*');
  }
}
