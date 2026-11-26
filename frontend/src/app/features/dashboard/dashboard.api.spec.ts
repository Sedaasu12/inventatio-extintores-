import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { ApiClient } from '../../core/api/api-client';
import { DashboardApi } from './dashboard.api';

describe('DashboardApi', () => {
  it('consulta el resumen operativo del inicio', () => {
    const get = vi.fn(() => of({}));
    TestBed.configureTestingModule({
      providers: [DashboardApi, { provide: ApiClient, useValue: { get } }],
    });

    TestBed.inject(DashboardApi).summary().subscribe();

    expect(get).toHaveBeenCalledWith('/dashboard/summary');
  });
});
