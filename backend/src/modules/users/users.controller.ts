import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Put,
  Query,
  Req,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import type { AuthenticatedUser } from '../../common/auth/authenticated-user';
import { CurrentUser } from '../../common/auth/current-user.decorator';
import { RequirePermissions } from '../../common/auth/require-permissions.decorator';
import type { RequestContext } from '../auth/auth.service';
import { ReplaceRolePermissionsDto } from './dto/replace-role-permissions.dto';
import {
  CreateUserDto,
  ListUsersQueryDto,
  ResetPasswordDto,
  UpdateUserDto,
} from './dto/users.dto';
import { UsersService } from './users.service';

type RequestWithId = Request & { requestId?: string };

@ApiTags('users')
@ApiBearerAuth()
@Controller()
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('users')
  @RequirePermissions('users.read')
  @ApiOperation({ summary: 'Lista paginada de usuarios' })
  list(@Query() query: ListUsersQueryDto) {
    return this.usersService.list(query);
  }

  @Post('users')
  @RequirePermissions('users.manage')
  @ApiOperation({ summary: 'Crea un usuario con contraseña temporal' })
  create(
    @Body() dto: CreateUserDto,
    @CurrentUser() actor: AuthenticatedUser,
    @Req() request: RequestWithId,
  ) {
    return this.usersService.create(dto, actor, this.context(request));
  }

  @Get('users/:id')
  @RequirePermissions('users.read')
  @ApiOperation({ summary: 'Detalle de un usuario' })
  get(@Param('id') id: string) {
    return this.usersService.get(id);
  }

  @Patch('users/:id')
  @RequirePermissions('users.manage')
  @ApiOperation({ summary: 'Actualiza nombre, estado o roles' })
  update(
    @Param('id') id: string,
    @Body() dto: UpdateUserDto,
    @CurrentUser() actor: AuthenticatedUser,
    @Req() request: RequestWithId,
  ) {
    return this.usersService.update(id, dto, actor, this.context(request));
  }

  @Post('users/:id/deactivate')
  @HttpCode(204)
  @RequirePermissions('users.manage')
  @ApiOperation({ summary: 'Desactiva el usuario y revoca sus sesiones' })
  async deactivate(
    @Param('id') id: string,
    @CurrentUser() actor: AuthenticatedUser,
    @Req() request: RequestWithId,
  ): Promise<void> {
    await this.usersService.deactivate(id, actor, this.context(request));
  }

  @Post('users/:id/reset-password')
  @HttpCode(200)
  @RequirePermissions('users.manage')
  @ApiOperation({ summary: 'Restablece la contraseña con una temporal' })
  resetPassword(
    @Param('id') id: string,
    @Body() dto: ResetPasswordDto,
    @CurrentUser() actor: AuthenticatedUser,
    @Req() request: RequestWithId,
  ) {
    return this.usersService.resetPassword(
      id,
      dto,
      actor,
      this.context(request),
    );
  }

  @Get('roles')
  @RequirePermissions('users.read')
  @ApiOperation({ summary: 'Lista de roles con sus permisos' })
  listRoles() {
    return this.usersService.listRoles();
  }

  @Get('permissions')
  @RequirePermissions('users.read')
  @ApiOperation({ summary: 'Catálogo de permisos' })
  listPermissions() {
    return this.usersService.listPermissions();
  }

  @Put('roles/:id/permissions')
  @RequirePermissions('roles.manage')
  @ApiOperation({ summary: 'Reemplaza los permisos de un rol' })
  replaceRolePermissions(
    @Param('id') id: string,
    @Body() dto: ReplaceRolePermissionsDto,
    @CurrentUser() actor: AuthenticatedUser,
    @Req() request: RequestWithId,
  ) {
    return this.usersService.replaceRolePermissions(
      id,
      dto.permissionCodes,
      actor,
      this.context(request),
    );
  }

  private context(request: RequestWithId): RequestContext {
    return {
      ip: request.ip,
      userAgent: request.header('user-agent'),
      requestId: request.requestId,
    };
  }
}
