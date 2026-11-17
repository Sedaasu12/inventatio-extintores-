import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import type { AuthenticatedUser } from '../../../common/auth/authenticated-user';
import { CurrentUser } from '../../../common/auth/current-user.decorator';
import { RequirePermissions } from '../../../common/auth/require-permissions.decorator';
import type { RequestContext } from '../../auth/auth.service';
import {
  CreateExtinguisherTypeDto,
  ListExtinguisherTypesQueryDto,
  UpdateExtinguisherTypeDto,
} from './dto/extinguisher-types.dto';
import { ExtinguisherTypesService } from './extinguisher-types.service';

type RequestWithId = Request & { requestId?: string };

@ApiTags('catalogs')
@ApiBearerAuth()
@Controller('extinguisher-types')
export class ExtinguisherTypesController {
  constructor(private readonly typesService: ExtinguisherTypesService) {}

  @Get()
  @RequirePermissions('catalogs.read')
  @ApiOperation({ summary: 'Lista paginada de tipos de extintor' })
  list(@Query() query: ListExtinguisherTypesQueryDto) {
    return this.typesService.list(query);
  }

  @Post()
  @RequirePermissions('catalogs.manage')
  @ApiOperation({ summary: 'Crea un tipo de extintor' })
  create(
    @Body() dto: CreateExtinguisherTypeDto,
    @CurrentUser() actor: AuthenticatedUser,
    @Req() request: RequestWithId,
  ) {
    return this.typesService.create(dto, actor, this.context(request));
  }

  @Patch(':id')
  @RequirePermissions('catalogs.manage')
  @ApiOperation({ summary: 'Edita o desactiva un tipo de extintor' })
  update(
    @Param('id') id: string,
    @Body() dto: UpdateExtinguisherTypeDto,
    @CurrentUser() actor: AuthenticatedUser,
    @Req() request: RequestWithId,
  ) {
    return this.typesService.update(id, dto, actor, this.context(request));
  }

  private context(request: RequestWithId): RequestContext {
    return {
      ip: request.ip,
      userAgent: request.header('user-agent'),
      requestId: request.requestId,
    };
  }
}
