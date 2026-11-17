import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import type { AuthenticatedUser } from '../../common/auth/authenticated-user';
import { CurrentUser } from '../../common/auth/current-user.decorator';
import { RequirePermissions } from '../../common/auth/require-permissions.decorator';
import type { RequestContext } from '../auth/auth.service';
import {
  CreateLocationDto,
  ListLocationExtinguishersQueryDto,
  ListLocationsQueryDto,
  UpdateLocationDto,
} from './dto/locations.dto';
import { LocationsService } from './locations.service';

type RequestWithId = Request & { requestId?: string };

@ApiTags('locations')
@ApiBearerAuth()
@Controller('locations')
export class LocationsController {
  constructor(private readonly locationsService: LocationsService) {}

  @Get()
  @RequirePermissions('locations.read')
  @ApiOperation({ summary: 'Lista paginada o árbol de ubicaciones' })
  list(@Query() query: ListLocationsQueryDto) {
    return this.locationsService.list(query);
  }

  @Post()
  @RequirePermissions('locations.manage')
  @ApiOperation({ summary: 'Crea una ubicación con código generado' })
  create(
    @Body() dto: CreateLocationDto,
    @CurrentUser() actor: AuthenticatedUser,
    @Req() request: RequestWithId,
  ) {
    return this.locationsService.create(dto, actor, this.context(request));
  }

  @Get(':id')
  @RequirePermissions('locations.read')
  @ApiOperation({ summary: 'Detalle con padre e hijos' })
  get(@Param('id') id: string) {
    return this.locationsService.get(id);
  }

  @Patch(':id')
  @RequirePermissions('locations.manage')
  @ApiOperation({ summary: 'Actualiza nombre, dirección o padre' })
  update(
    @Param('id') id: string,
    @Body() dto: UpdateLocationDto,
    @CurrentUser() actor: AuthenticatedUser,
    @Req() request: RequestWithId,
  ) {
    return this.locationsService.update(id, dto, actor, this.context(request));
  }

  @Post(':id/deactivate')
  @HttpCode(204)
  @RequirePermissions('locations.manage')
  @ApiOperation({ summary: 'Desactiva la ubicación si no tiene activos' })
  async deactivate(
    @Param('id') id: string,
    @CurrentUser() actor: AuthenticatedUser,
    @Req() request: RequestWithId,
  ): Promise<void> {
    await this.locationsService.deactivate(id, actor, this.context(request));
  }

  @Get(':id/extinguishers')
  @RequirePermissions('extinguishers.read')
  @ApiOperation({ summary: 'Inventario de la ubicación o sede' })
  listExtinguishers(
    @Param('id') id: string,
    @Query() query: ListLocationExtinguishersQueryDto,
  ) {
    return this.locationsService.listExtinguishers(id, query);
  }

  private context(request: RequestWithId): RequestContext {
    return {
      ip: request.ip,
      userAgent: request.header('user-agent'),
      requestId: request.requestId,
    };
  }
}
