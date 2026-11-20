import { Controller, Get, Param, Query, Res } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { RequirePermissions } from '../../common/auth/require-permissions.decorator';
import { ListExtinguishersQueryDto } from '../extinguishers/dto/extinguishers.dto';
import { ListInspectionsQueryDto } from '../inspections/dto/inspection.dto';
import { ListMaintenanceOrdersQueryDto } from '../maintenance/dto/maintenance.dto';
import { ListMovementsQueryDto } from '../movements/dto/movements.dto';
import {
  ExportReportQueryDto,
  ListRetiredReportQueryDto,
} from './dto/reports.dto';
import { ReportsService } from './reports.service';

@ApiTags('reports')
@ApiBearerAuth()
@Controller('reports')
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get('inventory')
  @RequirePermissions('reports.read')
  @ApiOperation({ summary: 'Reporte de inventario por ubicación y estado' })
  inventory(@Query() query: ListExtinguishersQueryDto) {
    return this.reportsService.inventory(query);
  }

  @Get('movements')
  @RequirePermissions('reports.read')
  @ApiOperation({ summary: 'Reporte de movimientos por periodo y tipo' })
  movements(@Query() query: ListMovementsQueryDto) {
    return this.reportsService.movementsReport(query);
  }

  @Get('maintenance')
  @RequirePermissions('reports.read')
  @ApiOperation({
    summary: 'Reporte de órdenes de mantenimiento con sus servicios',
  })
  maintenance(@Query() query: ListMaintenanceOrdersQueryDto) {
    return this.reportsService.maintenanceReport(query);
  }

  @Get('inspections')
  @RequirePermissions('reports.read')
  @ApiOperation({ summary: 'Reporte de inspecciones' })
  inspections(@Query() query: ListInspectionsQueryDto) {
    return this.reportsService.inspectionsReport(query);
  }

  @Get('retired')
  @RequirePermissions('reports.read')
  @ApiOperation({ summary: 'Reporte de bajas y ajustes con motivo' })
  retired(@Query() query: ListRetiredReportQueryDto) {
    return this.reportsService.retired(query);
  }

  @Get(':type/export')
  @RequirePermissions('reports.export')
  @ApiOperation({ summary: 'Exporta un reporte a CSV con los mismos filtros' })
  async export(
    @Param('type') type: string,
    @Query() query: ExportReportQueryDto,
    @Res() response: Response,
  ): Promise<void> {
    const result = await this.reportsService.export(type, query);
    response.setHeader('Content-Type', 'text/csv; charset=utf-8');
    response.setHeader(
      'Content-Disposition',
      `attachment; filename="${result.filename}"`,
    );
    response.setHeader('X-Content-Type-Options', 'nosniff');
    response.send(result.content);
  }
}
