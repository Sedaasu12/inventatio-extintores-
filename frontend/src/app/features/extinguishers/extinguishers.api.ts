import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiClient } from '../../core/api/api-client';
import type {
  ChangeConditionPayload,
  CreateExtinguisherPayload,
  CreateExtinguisherResponse,
  ExtinguisherDetail,
  ExtinguisherFilters,
  ExtinguisherListResponse,
  ExtinguisherTypeListResponse,
  LocationTreeResponse,
  UpdateExtinguisherPayload,
} from './extinguisher.models';

export const EXTINGUISHER_PAGE_SIZE = 20;
/** El backend limita `pageSize` a 100; el catálogo de tipos es pequeño. */
const CATALOG_PAGE_SIZE = 100;

/**
 * Acceso a los endpoints de lectura del inventario. No transforma estados ni
 * calcula ubicaciones: solo envía filtros y devuelve el contrato del servidor.
 */
@Injectable({ providedIn: 'root' })
export class ExtinguishersApi {
  private readonly api = inject(ApiClient);

  list(
    filters: ExtinguisherFilters,
    includeDescendants: boolean,
  ): Observable<ExtinguisherListResponse> {
    return this.api.get<ExtinguisherListResponse>('/extinguishers', {
      params: {
        page: filters.page,
        pageSize: EXTINGUISHER_PAGE_SIZE,
        q: filters.q === '' ? undefined : filters.q,
        typeId: filters.typeId === '' ? undefined : filters.typeId,
        locationId:
          filters.locationId === '' ? undefined : filters.locationId,
        includeDescendants:
          includeDescendants && filters.locationId !== '' ? true : undefined,
        logisticsStatus:
          filters.logisticsStatus === ''
            ? undefined
            : filters.logisticsStatus,
        technicalCondition:
          filters.technicalCondition === ''
            ? undefined
            : filters.technicalCondition,
        includeRetired: filters.includeRetired ? true : undefined,
        sort: filters.sort,
      },
    });
  }

  types(): Observable<ExtinguisherTypeListResponse> {
    return this.api.get<ExtinguisherTypeListResponse>('/extinguisher-types', {
      params: {
        active: 'true',
        pageSize: CATALOG_PAGE_SIZE,
      },
    });
  }

  locations(): Observable<LocationTreeResponse> {
    return this.api.get<LocationTreeResponse>('/locations', {
      params: {
        tree: true,
        active: 'true',
      },
    });
  }

  get(id: string): Observable<ExtinguisherDetail> {
    return this.api.get<ExtinguisherDetail>(
      `/extinguishers/${encodeURIComponent(id)}`,
    );
  }

  /** Resuelve el QR o un código escrito/leído por USB. */
  getByCode(assetCode: string): Observable<ExtinguisherDetail> {
    return this.api.get<ExtinguisherDetail>(
      `/extinguishers/by-code/${encodeURIComponent(assetCode)}`,
    );
  }

  /** PNG del QR que solo contiene el `assetCode` (D-05). */
  qrImage(id: string): Observable<Blob> {
    return this.api.getBlob(
      `/extinguishers/${encodeURIComponent(id)}/qr`,
      { params: { format: 'png', size: 512 } },
    );
  }

  create(
    payload: CreateExtinguisherPayload,
    idempotencyKey: string,
  ): Observable<CreateExtinguisherResponse> {
    return this.api.post<CreateExtinguisherResponse>(
      '/extinguishers',
      payload,
      { headers: { 'Idempotency-Key': idempotencyKey } },
    );
  }

  update(
    id: string,
    payload: UpdateExtinguisherPayload,
  ): Observable<ExtinguisherDetail> {
    return this.api.patch<ExtinguisherDetail>(
      `/extinguishers/${encodeURIComponent(id)}`,
      payload,
    );
  }

  changeCondition(
    id: string,
    payload: ChangeConditionPayload,
  ): Observable<ExtinguisherDetail> {
    return this.api.post<ExtinguisherDetail>(
      `/extinguishers/${encodeURIComponent(id)}/condition`,
      payload,
    );
  }
}
