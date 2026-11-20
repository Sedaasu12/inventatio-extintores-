import { Inject, Injectable } from '@nestjs/common';
import { DueDateEventType, Prisma } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import type { AuthenticatedUser } from '../../common/auth/authenticated-user';
import { ApiError } from '../../common/errors/api-error';
import { ErrorCodes } from '../../common/errors/error-codes';
import { formatCalendarDate } from '../../common/time/calendar';
import { APP_ENV } from '../../config/config.module';
import type { AppEnv } from '../../config/env';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import type { RequestContext } from '../auth/auth.service';
import {
  AlertSettingValue,
  AlertStatus,
  DUE_DATE_EVENT_TYPES,
  classifyAlert,
  effectiveAlertSettings,
  emptyStatusCounts,
  localToday,
} from './alert-policy';
import {
  AlertSummaryQueryDto,
  ListAlertsQueryDto,
  UpdateAlertSettingDto,
} from './dto/alerts.dto';

const ALERT_SETTING_SELECT = {
  id: true,
  eventType: true,
  daysBefore: true,
  enabled: true,
  updatedAt: true,
  updatedById: true,
  updatedBy: { select: { id: true, fullName: true } },
} satisfies Prisma.AlertSettingSelect;

type AlertSettingViewRow = Prisma.AlertSettingGetPayload<{
  select: typeof ALERT_SETTING_SELECT;
}>;

interface AssetAlertRow {
  id: string;
  assetCode: string;
  currentLocation: { id: string; code: string; name: string } | null;
  currentExternalParty: { id: string; code: string; name: string } | null;
  dueDates: Array<{
    eventType: DueDateEventType;
    dueDate: Date;
    sourceType: string;
    sourceId: string;
  }>;
}

export interface AlertRowView {
  extinguisherId: string;
  assetCode: string;
  location: { id: string; code: string; name: string } | null;
  externalParty: { id: string; code: string; name: string } | null;
  eventType: DueDateEventType;
  dueDate: string | null;
  status: AlertStatus;
  daysRemaining: number | null;
  sourceType: string | null;
  sourceId: string | null;
  thresholdDays: number | null;
  thresholdConfigured: boolean;
}

export interface AlertSettingPayload {
  eventType: DueDateEventType;
  daysBefore: number | null;
  enabled: boolean;
  updatedAt: string | null;
  updatedBy: { id: string; fullName: string } | null;
}

function isValidEventType(value: string): value is DueDateEventType {
  return (DUE_DATE_EVENT_TYPES as readonly string[]).includes(value);
}

function toSettingPayload(
  value: AlertSettingValue,
  row: AlertSettingViewRow | undefined,
): AlertSettingPayload {
  return {
    eventType: value.eventType,
    daysBefore: value.daysBefore,
    enabled: value.enabled,
    updatedAt: value.updatedAt === null ? null : value.updatedAt.toISOString(),
    updatedBy: row?.updatedBy ?? null,
  };
}

function compareNullableNumbers(
  left: number | null,
  right: number | null,
): number {
  if (left === null && right === null) {
    return 0;
  }
  if (left === null) {
    return 1;
  }
  if (right === null) {
    return -1;
  }
  return left - right;
}

function compareNullableStrings(
  left: string | null,
  right: string | null,
): number {
  if (left === null && right === null) {
    return 0;
  }
  if (left === null) {
    return 1;
  }
  if (right === null) {
    return -1;
  }
  return left.localeCompare(right);
}

function sortRows(rows: AlertRowView[], sort: string | undefined): void {
  const value = sort ?? 'dueDate';
  const direction = value.startsWith('-') ? -1 : 1;
  const key = value.replace(/^-/, '');

  rows.sort((left, right) => {
    let result = 0;
    if (key === 'assetCode') {
      result = left.assetCode.localeCompare(right.assetCode);
    } else if (key === 'status') {
      result = left.status.localeCompare(right.status);
    } else if (key === 'daysRemaining') {
      result = compareNullableNumbers(left.daysRemaining, right.daysRemaining);
    } else {
      result = compareNullableStrings(left.dueDate, right.dueDate);
    }
    if (result !== 0) {
      return result * direction;
    }
    const byAsset = left.assetCode.localeCompare(right.assetCode);
    if (byAsset !== 0) {
      return byAsset;
    }
    return left.eventType.localeCompare(right.eventType);
  });
}

@Injectable()
export class AlertsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    @Inject(APP_ENV) private readonly env: AppEnv,
  ) {}

  async list(query: ListAlertsQueryDto) {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const rows = await this.buildRows(query);
    sortRows(rows, query.sort);

    const total = rows.length;
    return {
      data: rows.slice((page - 1) * pageSize, page * pageSize),
      meta: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
      },
    };
  }

  async summary(query: AlertSummaryQueryDto) {
    const rows = await this.buildRows(query);
    const totals = emptyStatusCounts();
    const byEventType = new Map<
      DueDateEventType,
      { counts: ReturnType<typeof emptyStatusCounts>; total: number }
    >();

    for (const row of rows) {
      totals[row.status] += 1;
      const entry = byEventType.get(row.eventType) ?? {
        counts: emptyStatusCounts(),
        total: 0,
      };
      entry.counts[row.status] += 1;
      entry.total += 1;
      byEventType.set(row.eventType, entry);
    }

    return {
      data: [...byEventType.entries()]
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([eventType, entry]) => ({
          eventType,
          counts: entry.counts,
          total: entry.total,
        })),
      totals,
    };
  }

  async getSettings(): Promise<{ data: AlertSettingPayload[] }> {
    const rows = await this.prisma.alertSetting.findMany({
      select: ALERT_SETTING_SELECT,
    });
    const byType = new Map(rows.map((row) => [row.eventType, row]));
    const settings = effectiveAlertSettings(rows);

    return {
      data: settings.map((setting) =>
        toSettingPayload(setting, byType.get(setting.eventType)),
      ),
    };
  }

  async updateSetting(
    eventType: string,
    dto: UpdateAlertSettingDto,
    actor: AuthenticatedUser,
    context: RequestContext,
  ): Promise<AlertSettingPayload> {
    if (!isValidEventType(eventType)) {
      throw ApiError.unprocessable(
        ErrorCodes.VALIDATION_ERROR,
        'La categoría de alerta no es válida.',
        { field: 'eventType' },
      );
    }
    const hasDaysBefore = dto.daysBefore !== undefined;
    const hasEnabled = dto.enabled !== undefined;
    if (!hasDaysBefore && !hasEnabled) {
      throw ApiError.unprocessable(
        ErrorCodes.VALIDATION_ERROR,
        'Indica daysBefore o enabled para actualizar la configuración.',
        { field: 'daysBefore' },
      );
    }

    const existing = await this.prisma.alertSetting.findUnique({
      where: { eventType },
      select: ALERT_SETTING_SELECT,
    });

    const daysBefore = hasDaysBefore
      ? (dto.daysBefore ?? null)
      : (existing?.daysBefore ?? null);
    const enabled = hasEnabled
      ? (dto.enabled as boolean)
      : (existing?.enabled ?? true);

    const row = await this.prisma.$transaction(async (tx) => {
      const saved = await tx.alertSetting.upsert({
        where: { eventType },
        create: {
          id: randomUUID(),
          eventType,
          daysBefore,
          enabled,
          updatedById: actor.id,
        },
        update: {
          daysBefore,
          enabled,
          updatedById: actor.id,
        },
        select: ALERT_SETTING_SELECT,
      });

      await this.audit.record(
        {
          actorUserId: actor.id,
          actorLabel: actor.fullName,
          action: 'ALERT_SETTING_UPDATED',
          entityType: 'ALERT_SETTING',
          entityId: saved.id,
          beforeData:
            existing === null
              ? null
              : {
                  eventType: existing.eventType,
                  daysBefore: existing.daysBefore,
                  enabled: existing.enabled,
                },
          afterData: {
            eventType: saved.eventType,
            daysBefore: saved.daysBefore,
            enabled: saved.enabled,
          },
          ip: context.ip ?? null,
          userAgent: context.userAgent ?? null,
          requestId: context.requestId ?? null,
        },
        tx,
      );

      return saved;
    });

    return {
      eventType: row.eventType,
      daysBefore: row.daysBefore,
      enabled: row.enabled,
      updatedAt: row.updatedAt.toISOString(),
      updatedBy: row.updatedBy,
    };
  }

  private async buildRows(
    query: ListAlertsQueryDto | AlertSummaryQueryDto,
  ): Promise<AlertRowView[]> {
    const settings = await this.prisma.alertSetting.findMany({
      select: ALERT_SETTING_SELECT,
    });
    const effective = effectiveAlertSettings(settings).filter(
      (setting) =>
        setting.enabled &&
        (query.eventType === undefined ||
          setting.eventType === query.eventType),
    );

    const assets = await this.loadAssets(query);
    const today = localToday(new Date(), this.env.timezone);
    const result: AlertRowView[] = [];

    for (const asset of assets) {
      for (const setting of effective) {
        const due = asset.dueDates.find(
          (candidate) => candidate.eventType === setting.eventType,
        );
        const classification = classifyAlert(
          due?.dueDate ?? null,
          setting.daysBefore,
          today,
        );
        if (
          query.status !== undefined &&
          classification.status !== query.status
        ) {
          continue;
        }
        result.push({
          extinguisherId: asset.id,
          assetCode: asset.assetCode,
          location: asset.currentLocation,
          externalParty: asset.currentExternalParty,
          eventType: setting.eventType,
          dueDate: formatCalendarDate(due?.dueDate ?? null),
          status: classification.status,
          daysRemaining: classification.daysRemaining,
          sourceType: due?.sourceType ?? null,
          sourceId: due?.sourceId ?? null,
          thresholdDays: setting.daysBefore,
          thresholdConfigured: setting.daysBefore !== null,
        });
      }
    }

    return result;
  }

  private async loadAssets(
    query: ListAlertsQueryDto | AlertSummaryQueryDto,
  ): Promise<AssetAlertRow[]> {
    const where: Prisma.ExtinguisherWhereInput = {};
    if (query.includeRetired !== true) {
      where.logisticsStatus = { not: 'DADO_DE_BAJA' };
    }
    if (query.locationId !== undefined) {
      where.currentLocationId = query.locationId;
    }
    if (query.assetCode !== undefined) {
      where.assetCode = { contains: query.assetCode.toUpperCase() };
    }

    return this.prisma.extinguisher.findMany({
      where,
      select: {
        id: true,
        assetCode: true,
        currentLocation: { select: { id: true, code: true, name: true } },
        currentExternalParty: { select: { id: true, code: true, name: true } },
        dueDates: {
          select: {
            eventType: true,
            dueDate: true,
            sourceType: true,
            sourceId: true,
          },
        },
      },
      orderBy: { assetCode: 'asc' },
    });
  }
}
