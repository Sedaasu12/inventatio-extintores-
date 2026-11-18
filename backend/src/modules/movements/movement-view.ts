import { Prisma } from '@prisma/client';

export const MOVEMENT_SELECT = {
  id: true,
  extinguisherId: true,
  assetSequence: true,
  movementType: true,
  entrySource: true,
  originKind: true,
  originLocationId: true,
  originExternalPartyId: true,
  originLabel: true,
  destinationKind: true,
  destinationLocationId: true,
  destinationExternalPartyId: true,
  destinationLabel: true,
  movedAt: true,
  requestedBy: true,
  authorizedBy: true,
  deliveredBy: true,
  receivedBy: true,
  reason: true,
  documentRef: true,
  notes: true,
  correctsMovementId: true,
  createdById: true,
  createdAt: true,
  captureMode: true,
  extinguisher: { select: { id: true, assetCode: true } },
  createdBy: { select: { id: true, fullName: true } },
} satisfies Prisma.MovementSelect;

export type MovementRow = Prisma.MovementGetPayload<{
  select: typeof MOVEMENT_SELECT;
}>;

export function toMovementView(row: MovementRow) {
  return {
    id: row.id,
    extinguisher: row.extinguisher,
    assetSequence: row.assetSequence,
    type: row.movementType,
    entrySource: row.entrySource,
    origin: {
      kind: row.originKind,
      locationId: row.originLocationId,
      externalPartyId: row.originExternalPartyId,
      label: row.originLabel,
    },
    destination: {
      kind: row.destinationKind,
      locationId: row.destinationLocationId,
      externalPartyId: row.destinationExternalPartyId,
      label: row.destinationLabel,
    },
    movedAt: row.movedAt.toISOString(),
    createdAt: row.createdAt.toISOString(),
    requestedBy: row.requestedBy,
    authorizedBy: row.authorizedBy,
    deliveredBy: row.deliveredBy,
    receivedBy: row.receivedBy,
    reason: row.reason,
    documentRef: row.documentRef,
    notes: row.notes,
    correctsMovementId: row.correctsMovementId,
    createdBy: row.createdBy,
    captureMode: row.captureMode,
  };
}
