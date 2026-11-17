import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { AUTH_PROVIDER } from './auth-provider';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { LocalAuthProvider } from './local-auth.provider';
import { LoginRateLimiter } from './login-rate-limiter';
import { TokenService } from './token.service';

@Module({
  imports: [AuditModule],
  controllers: [AuthController],
  providers: [
    AuthService,
    TokenService,
    LoginRateLimiter,
    LocalAuthProvider,
    { provide: AUTH_PROVIDER, useExisting: LocalAuthProvider },
  ],
  exports: [AuthService, TokenService],
})
export class AuthModule {}
