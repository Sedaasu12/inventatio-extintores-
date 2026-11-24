import type { StatusTone } from '../../shared/components/status-chip/status-chip';
import type {
  LogisticsStatus,
  TechnicalCondition,
} from './extinguisher.models';

/** Tono visual de un estado logístico; no altera el valor ni su etiqueta. */
export function logisticsTone(status: LogisticsStatus): StatusTone {
  switch (status) {
    case 'ASIGNADO':
      return 'success';
    case 'EN_MANTENIMIENTO':
      return 'warning';
    case 'DADO_DE_BAJA':
      return 'danger';
    default:
      return 'info';
  }
}

/** Tono visual de una condición técnica. */
export function conditionTone(condition: TechnicalCondition): StatusTone {
  switch (condition) {
    case 'OPERATIVO':
      return 'success';
    case 'OBSERVADO':
      return 'warning';
    case 'NO_OPERATIVO':
      return 'danger';
    default:
      return 'info';
  }
}
