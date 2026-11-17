import {
  formatCalendarDate,
  parseCalendarDate,
  todayInTimeZone,
  validateCalendarDates,
} from './extinguisher-dates';

describe('fechas de extintor (T-EXT-09)', () => {
  it('acepta fechas calendario reales y rechaza las imposibles', () => {
    expect(formatCalendarDate(parseCalendarDate('2025-02-28'))).toBe(
      '2025-02-28',
    );
    expect(parseCalendarDate('2025-02-30')).toBeNull();
    expect(parseCalendarDate('2025-13-01')).toBeNull();
    expect(parseCalendarDate('15/01/2025')).toBeNull();
  });

  it('rechaza una fabricación futura con DATE_IN_FUTURE', () => {
    const error = validateCalendarDates(
      {
        manufactureDate: parseCalendarDate('2026-12-31'),
        acquiredAt: null,
        commissionedAt: null,
        manufacturerExpiryDate: null,
      },
      '2026-11-16',
    );
    expect(error?.code).toBe('DATE_IN_FUTURE');
    expect(error?.field).toBe('manufactureDate');
  });

  it('rechaza adquisición anterior a fabricación', () => {
    const error = validateCalendarDates(
      {
        manufactureDate: parseCalendarDate('2025-01-10'),
        acquiredAt: parseCalendarDate('2025-01-01'),
        commissionedAt: null,
        manufacturerExpiryDate: null,
      },
      '2026-11-16',
    );
    expect(error?.code).toBe('DATE_BEFORE_EVENT');
    expect(error?.field).toBe('acquiredAt');
  });

  it('rechaza puesta en servicio anterior a la adquisición', () => {
    const error = validateCalendarDates(
      {
        manufactureDate: parseCalendarDate('2025-01-10'),
        acquiredAt: parseCalendarDate('2025-02-01'),
        commissionedAt: parseCalendarDate('2025-01-20'),
        manufacturerExpiryDate: null,
      },
      '2026-11-16',
    );
    expect(error?.code).toBe('DATE_BEFORE_EVENT');
    expect(error?.field).toBe('commissionedAt');
  });

  it('rechaza vencimiento documentado anterior a fabricación', () => {
    const error = validateCalendarDates(
      {
        manufactureDate: parseCalendarDate('2025-01-10'),
        acquiredAt: null,
        commissionedAt: null,
        manufacturerExpiryDate: parseCalendarDate('2024-12-31'),
      },
      '2026-11-16',
    );
    expect(error?.code).toBe('DATE_BEFORE_EVENT');
    expect(error?.field).toBe('manufacturerExpiryDate');
  });

  it('acepta fechas coherentes y datos opcionales ausentes', () => {
    expect(
      validateCalendarDates(
        {
          manufactureDate: parseCalendarDate('2020-01-01'),
          acquiredAt: parseCalendarDate('2020-02-01'),
          commissionedAt: parseCalendarDate('2020-02-10'),
          manufacturerExpiryDate: parseCalendarDate('2035-01-01'),
        },
        '2026-11-16',
      ),
    ).toBeNull();

    expect(
      validateCalendarDates(
        {
          manufactureDate: null,
          acquiredAt: null,
          commissionedAt: null,
          manufacturerExpiryDate: null,
        },
        '2026-11-16',
      ),
    ).toBeNull();
  });

  it('calcula la fecha de hoy en la zona configurada', () => {
    const instant = new Date('2026-11-17T02:00:00.000Z');
    expect(todayInTimeZone('America/Lima', instant)).toBe('2026-11-16');
    expect(todayInTimeZone('UTC', instant)).toBe('2026-11-17');
  });
});
