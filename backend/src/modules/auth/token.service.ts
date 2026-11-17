import { Inject, Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { createHash, randomBytes } from 'node:crypto';
import { APP_ENV } from '../../config/config.module';
import type { AppEnv } from '../../config/env';

export const REFRESH_COOKIE_NAME = 'refresh_token';
export const REFRESH_COOKIE_PATH = '/api/v1/auth';

@Injectable()
export class TokenService {
  constructor(
    private readonly jwtService: JwtService,
    @Inject(APP_ENV) private readonly env: AppEnv,
  ) {}

  get accessTokenTtlSeconds(): number {
    return this.env.accessTokenTtlSeconds;
  }

  get refreshTokenTtlMs(): number {
    return this.env.refreshTokenTtlSeconds * 1000;
  }

  issueAccessToken(userId: string, sessionId: string): Promise<string> {
    return this.jwtService.signAsync({ sub: userId, sid: sessionId });
  }

  /**
   * El refresh token es opaco (no JWT): se guarda solo su hash SHA-256.
   */
  generateRefreshToken(): { raw: string; hash: string } {
    const raw = randomBytes(32).toString('base64url');
    return { raw, hash: this.hashRefreshToken(raw) };
  }

  hashRefreshToken(raw: string): string {
    return createHash('sha256').update(raw).digest('hex');
  }
}
