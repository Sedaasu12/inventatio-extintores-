import {
  Body,
  Controller,
  Get,
  HttpCode,
  Post,
  Req,
  Res,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { CurrentUser } from '../../common/auth/current-user.decorator';
import { Public } from '../../common/auth/public.decorator';
import type { AuthenticatedUser } from '../../common/auth/authenticated-user';
import { APP_ENV } from '../../config/config.module';
import type { AppEnv } from '../../config/env';
import { Inject } from '@nestjs/common';
import { AuthService, type RequestContext } from './auth.service';
import { ChangePasswordDto } from './dto/change-password.dto';
import { LoginDto } from './dto/login.dto';
import { REFRESH_COOKIE_NAME, REFRESH_COOKIE_PATH } from './token.service';

type RequestWithId = Request & { requestId?: string };

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    @Inject(APP_ENV) private readonly env: AppEnv,
  ) {}

  @Public()
  @Post('login')
  @HttpCode(200)
  @ApiOperation({ summary: 'Inicia sesión con correo y contraseña' })
  async login(
    @Body() dto: LoginDto,
    @Req() request: RequestWithId,
    @Res({ passthrough: true }) response: Response,
  ) {
    const result = await this.authService.login(
      dto.email,
      dto.password,
      this.context(request),
    );

    this.setRefreshCookie(
      response,
      result.refreshToken,
      result.refreshExpiresAt,
    );

    return {
      accessToken: result.accessToken,
      expiresIn: result.expiresIn,
      user: result.user,
    };
  }

  @Public()
  @Post('refresh')
  @HttpCode(200)
  @ApiOperation({ summary: 'Rota el refresh token y emite un access token' })
  async refresh(
    @Req() request: RequestWithId,
    @Res({ passthrough: true }) response: Response,
  ) {
    const cookies = (request.cookies ?? {}) as Record<string, string>;
    const result = await this.authService.refresh(
      cookies[REFRESH_COOKIE_NAME],
      this.context(request),
    );

    this.setRefreshCookie(
      response,
      result.refreshToken,
      result.refreshExpiresAt,
    );

    return {
      accessToken: result.accessToken,
      expiresIn: result.expiresIn,
      user: result.user,
    };
  }

  @Post('logout')
  @HttpCode(204)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Cierra la sesión y revoca el refresh actual' })
  async logout(
    @CurrentUser() user: AuthenticatedUser,
    @Req() request: RequestWithId,
    @Res({ passthrough: true }) response: Response,
  ): Promise<void> {
    await this.authService.logout(
      user.id,
      user.fullName,
      user.sessionId,
      this.context(request),
    );
    this.clearRefreshCookie(response);
  }

  @Get('me')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Perfil, roles y permisos efectivos' })
  me(@CurrentUser() user: AuthenticatedUser) {
    return this.authService.me(user.id);
  }

  @Post('change-password')
  @HttpCode(204)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Cambia la contraseña propia' })
  async changePassword(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: ChangePasswordDto,
    @Req() request: RequestWithId,
  ): Promise<void> {
    await this.authService.changePassword(
      user.id,
      user.sessionId,
      dto.currentPassword,
      dto.newPassword,
      this.context(request),
    );
  }

  private context(request: RequestWithId): RequestContext {
    return {
      ip: request.ip,
      userAgent: request.header('user-agent'),
      requestId: request.requestId,
      origin: request.header('origin'),
    };
  }

  private setRefreshCookie(
    response: Response,
    rawToken: string,
    expiresAt: Date,
  ): void {
    response.cookie(REFRESH_COOKIE_NAME, rawToken, {
      httpOnly: true,
      secure: this.env.cookieSecure,
      sameSite: 'strict',
      path: REFRESH_COOKIE_PATH,
      expires: expiresAt,
    });
  }

  private clearRefreshCookie(response: Response): void {
    response.clearCookie(REFRESH_COOKIE_NAME, {
      httpOnly: true,
      secure: this.env.cookieSecure,
      sameSite: 'strict',
      path: REFRESH_COOKIE_PATH,
    });
  }
}
