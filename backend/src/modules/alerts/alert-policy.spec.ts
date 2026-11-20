import {
  classifyAlert,
  daysUntil,
  effectiveAlertSettings,
  localToday,
} from './alert-policy';

const TODAY = new Date('2026-11-19T00:00:00.000Z');

describe('alert-policy', () => {
  describe('classifyAlert', () => {
    it('T-ALE-01: una fecha de ayer está VENCIDA', () => {
      expect(
        classifyAlert(new Date('2026-11-18T00:00:00.000Z'), 30, TODAY),
      ).toEqual({ status: 'VENCIDO', daysRemaining: -1 });
    });

    it('T-ALE-02: la fecha de hoy con umbral configurado es POR_VENCER', () => {
      expect(
        classifyAlert(new Date('2026-11-19T00:00:00.000Z'), 30, TODAY),
      ).toEqual({ status: 'POR_VENCER', daysRemaining: 0 });
    });

    it('T-ALE-03: una fecha dentro del umbral es POR_VENCER con los días restantes', () => {
      expect(
        classifyAlert(new Date('2026-12-04T00:00:00.000Z'), 30, TODAY),
      ).toEqual({ status: 'POR_VENCER', daysRemaining: 15 });
    });

    it('T-ALE-04: una fecha fuera del umbral es VIGENTE', () => {
      expect(
        classifyAlert(new Date('2027-01-19T00:00:00.000Z'), 30, TODAY),
      ).toEqual({ status: 'VIGENTE', daysRemaining: 61 });
    });

    it('T-ALE-05: sin umbral, hoy y el futuro son VIGENTE', () => {
      expect(
        classifyAlert(new Date('2026-11-19T00:00:00.000Z'), null, TODAY),
      ).toEqual({ status: 'VIGENTE', daysRemaining: 0 });
      expect(
        classifyAlert(new Date('2027-01-19T00:00:00.000Z'), null, TODAY),
      ).toEqual({ status: 'VIGENTE', daysRemaining: 61 });
    });

    it('T-ALE-06 (apoyo): sin fecha queda SIN_FECHA_CONFIGURADA', () => {
      expect(classifyAlert(null, 30, TODAY)).toEqual({
        status: 'SIN_FECHA_CONFIGURADA',
        daysRemaining: null,
      });
    });
  });

  describe('días y zona horaria', () => {
    it('T-ALE-10: el día local se deriva en America/Lima, no en UTC', () => {
      const now = new Date('2026-11-19T02:00:00.000Z');
      expect(localToday(now, 'America/Lima').toISOString()).toBe(
        '2026-11-18T00:00:00.000Z',
      );
    });

    it('daysUntil cuenta días calendario', () => {
      expect(daysUntil(new Date('2026-11-25T00:00:00.000Z'), TODAY)).toBe(6);
    });
  });

  describe('effectiveAlertSettings', () => {
    it('T-ALE-17: una categoría sin fila queda habilitada y sin umbral', () => {
      const settings = effectiveAlertSettings([]);
      expect(settings).toHaveLength(5);
      for (const setting of settings) {
        expect(setting.daysBefore).toBeNull();
        expect(setting.enabled).toBe(true);
        expect(setting.updatedAt).toBeNull();
      }
    });

    it('respeta las filas existentes y completa las ausentes', () => {
      const updatedAt = new Date('2026-11-01T10:00:00.000Z');
      const settings = effectiveAlertSettings([
        {
          eventType: 'INSPECCION',
          daysBefore: 15,
          enabled: false,
          updatedAt,
          updatedById: 'user-1',
        },
      ]);

      const inspection = settings.find(
        (setting) => setting.eventType === 'INSPECCION',
      );
      expect(inspection).toEqual({
        eventType: 'INSPECCION',
        daysBefore: 15,
        enabled: false,
        updatedAt,
        updatedById: 'user-1',
      });
      const equipment = settings.find(
        (setting) => setting.eventType === 'EQUIPO',
      );
      expect(equipment?.daysBefore).toBeNull();
      expect(equipment?.enabled).toBe(true);
    });
  });
});
