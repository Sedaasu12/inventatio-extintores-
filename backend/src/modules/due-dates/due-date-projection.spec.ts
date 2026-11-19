import {
  applyDueDateProjection,
  eventTypeForService,
  shouldReplaceProjection,
} from './due-date-projection';

describe('eventTypeForService', () => {
  it('mapea cada servicio a su categoría de fecha objetivo', () => {
    expect(eventTypeForService('MANTENIMIENTO')).toBe('MANTENIMIENTO');
    expect(eventTypeForService('RECARGA')).toBe('RECARGA');
    expect(eventTypeForService('PRUEBA_HIDROSTATICA')).toBe(
      'PRUEBA_HIDROSTATICA',
    );
  });

  it('registra REPARACION en la categoría MANTENIMIENTO', () => {
    expect(eventTypeForService('REPARACION')).toBe('MANTENIMIENTO');
  });
});

describe('shouldReplaceProjection', () => {
  const event = new Date('2026-11-10T15:00:00.000Z');

  it('reemplaza cuando no hay proyección previa', () => {
    expect(shouldReplaceProjection(null, event)).toBe(true);
  });

  it('reemplaza una proyección sin fecha de evento fuente', () => {
    expect(shouldReplaceProjection({ sourceEventAt: null }, event)).toBe(true);
  });

  it('no reemplaza un evento anterior (BR-111)', () => {
    expect(
      shouldReplaceProjection(
        { sourceEventAt: new Date('2026-11-11T15:00:00.000Z') },
        event,
      ),
    ).toBe(false);
  });

  it('reemplaza en empate para que gane el registro más reciente', () => {
    expect(shouldReplaceProjection({ sourceEventAt: event }, event)).toBe(true);
  });

  it('reemplaza un evento posterior (BR-112)', () => {
    expect(
      shouldReplaceProjection(
        { sourceEventAt: new Date('2026-11-09T15:00:00.000Z') },
        event,
      ),
    ).toBe(true);
  });
});

describe('applyDueDateProjection', () => {
  const sourceEventAt = new Date('2026-11-10T15:00:00.000Z');
  const dueDate = new Date('2027-11-10T00:00:00.000Z');

  const buildClient = (existing: { sourceEventAt: Date | null } | null) => {
    const findUnique = jest.fn().mockResolvedValue(existing);
    const deleteMany = jest.fn().mockResolvedValue({ count: 1 });
    const upsert = jest.fn().mockResolvedValue({});
    return {
      client: { dueDate: { findUnique, deleteMany, upsert } },
      findUnique,
      deleteMany,
      upsert,
    };
  };

  it('crea la proyección cuando no existe', async () => {
    const { client, upsert } = buildClient(null);
    const result = await applyDueDateProjection(client as never, {
      extinguisherId: 'ext-1',
      eventType: 'RECARGA',
      dueDate,
      sourceType: 'MAINTENANCE_SERVICE',
      sourceId: 'svc-1',
      sourceEventAt,
    });

    expect(result).toBe('UPSERTED');
    const expectedCreate = expect.objectContaining({
      extinguisherId: 'ext-1',
      eventType: 'RECARGA',
      dueDate,
      sourceType: 'MAINTENANCE_SERVICE',
      sourceId: 'svc-1',
      sourceEventAt,
    }) as unknown;
    expect(upsert).toHaveBeenCalledWith(
      expect.objectContaining({ create: expectedCreate }),
    );
  });

  it('no toca una proyección más reciente aunque el evento no traiga fecha', async () => {
    const { client, deleteMany, upsert } = buildClient({
      sourceEventAt: new Date('2026-12-01T00:00:00.000Z'),
    });
    const result = await applyDueDateProjection(client as never, {
      extinguisherId: 'ext-1',
      eventType: 'RECARGA',
      dueDate: null,
      sourceType: 'MAINTENANCE_SERVICE',
      sourceId: 'svc-viejo',
      sourceEventAt,
    });

    expect(result).toBe('SKIPPED');
    expect(deleteMany).not.toHaveBeenCalled();
    expect(upsert).not.toHaveBeenCalled();
  });

  it('elimina la proyección cuando el evento vigente no indica próxima fecha', async () => {
    const { client, deleteMany, upsert } = buildClient({
      sourceEventAt: new Date('2026-01-01T00:00:00.000Z'),
    });
    const result = await applyDueDateProjection(client as never, {
      extinguisherId: 'ext-1',
      eventType: 'INSPECCION',
      dueDate: null,
      sourceType: 'INSPECTION',
      sourceId: 'ins-1',
      sourceEventAt,
    });

    expect(result).toBe('DELETED');
    expect(deleteMany).toHaveBeenCalledWith({
      where: { extinguisherId: 'ext-1', eventType: 'INSPECCION' },
    });
    expect(upsert).not.toHaveBeenCalled();
  });

  it('actualiza la proyección cuando el evento es posterior', async () => {
    const { client, upsert } = buildClient({
      sourceEventAt: new Date('2026-01-01T00:00:00.000Z'),
    });
    const result = await applyDueDateProjection(client as never, {
      extinguisherId: 'ext-1',
      eventType: 'MANTENIMIENTO',
      dueDate,
      sourceType: 'MAINTENANCE_SERVICE',
      sourceId: 'svc-2',
      sourceEventAt,
    });

    expect(result).toBe('UPSERTED');
    const expectedUpdate = expect.objectContaining({
      dueDate,
      sourceId: 'svc-2',
      sourceEventAt,
    }) as unknown;
    expect(upsert).toHaveBeenCalledWith(
      expect.objectContaining({ update: expectedUpdate }),
    );
  });
});
