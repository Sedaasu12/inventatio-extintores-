import { Prisma } from '@prisma/client';
import { formatCalendarDate } from '../../common/time/calendar';

export const INSPECTION_SELECT = {
  id: true,
  extinguisherId: true,
  inspectedAt: true,
  inspectedOn: true,
  inspectorUserId: true,
  inspectorName: true,
  result: true,
  checklistJson: true,
  nextDueDate: true,
  notes: true,
  documentRef: true,
  correctsId: true,
  createdById: true,
  createdAt: true,
  extinguisher: { select: { id: true, assetCode: true } },
  inspectorUser: { select: { id: true, fullName: true } },
  createdBy: { select: { id: true, fullName: true } },
} satisfies Prisma.InspectionSelect;

export type InspectionRow = Prisma.InspectionGetPayload<{
  select: typeof INSPECTION_SELECT;
}>;

export function toInspectionView(row: InspectionRow) {
  return {
    id: row.id,
    extinguisher: row.extinguisher,
    inspectedAt: row.inspectedAt.toISOString(),
    inspectedOn: formatCalendarDate(row.inspectedOn),
    inspectorName: row.inspectorName,
    inspectorUser: row.inspectorUser,
    result: row.result,
    checklist: row.checklistJson,
    nextDueDate: formatCalendarDate(row.nextDueDate),
    notes: row.notes,
    documentRef: row.documentRef,
    correctsId: row.correctsId,
    createdBy: row.createdBy,
    createdAt: row.createdAt.toISOString(),
  };
}
