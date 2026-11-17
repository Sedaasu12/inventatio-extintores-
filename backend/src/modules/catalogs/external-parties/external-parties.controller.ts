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
  CreateExternalPartyDto,
  ListExternalPartiesQueryDto,
  UpdateExternalPartyDto,
} from './dto/external-parties.dto';
import { ExternalPartiesService } from './external-parties.service';

type RequestWithId = Request & { requestId?: string };

@ApiTags('catalogs')
@ApiBearerAuth()
@Controller('external-parties')
export class ExternalPartiesController {
  constructor(private readonly partiesService: ExternalPartiesService) {}

  @Get()
  @RequirePermissions('catalogs.read')
  @ApiOperation({ summary: 'Lista paginada de contrapartes externas' })
  list(@Query() query: ListExternalPartiesQueryDto) {
    return this.partiesService.list(query);
  }

  @Post()
  @RequirePermissions('catalogs.manage')
  @ApiOperation({ summary: 'Crea una contraparte externa' })
  create(
    @Body() dto: CreateExternalPartyDto,
    @CurrentUser() actor: AuthenticatedUser,
    @Req() request: RequestWithId,
  ) {
    return this.partiesService.create(dto, actor, this.context(request));
  }

  @Get(':id')
  @RequirePermissions('catalogs.read')
  @ApiOperation({ summary: 'Detalle de una contraparte externa' })
  get(@Param('id') id: string) {
    return this.partiesService.get(id);
  }

  @Patch(':id')
  @RequirePermissions('catalogs.manage')
  @ApiOperation({ summary: 'Edita o desactiva una contraparte externa' })
  update(
    @Param('id') id: string,
    @Body() dto: UpdateExternalPartyDto,
    @CurrentUser() actor: AuthenticatedUser,
    @Req() request: RequestWithId,
  ) {
    return this.partiesService.update(id, dto, actor, this.context(request));
  }

  private context(request: RequestWithId): RequestContext {
    return {
      ip: request.ip,
      userAgent: request.header('user-agent'),
      requestId: request.requestId,
    };
  }
}
