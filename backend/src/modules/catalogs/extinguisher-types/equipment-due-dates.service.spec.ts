import {
  addYears,
  earliestEquipmentExpiry,
} from './equipment-due-dates.service';

describe('fechas de vencimiento del equipo (D-12 / BR-107B)', () => {
  it('no inventa una fecha cuando faltan ambos datos', () => {
    expect(earliestEquipmentExpiry(null, null, 10)).toBeNull();
    expect(earliestEquipmentExpiry(null, null, null)).toBeNull();
  });

  it('usa la fecha documentada si no se puede calcular', () => {
    const documented = new Date('2030-05-01T00:00:00.000Z');
    expect(earliestEquipmentExpiry(null, documented, 10)).toBe(documented);
    expect(
      earliestEquipmentExpiry(new Date('2020-01-01T00:00:00.000Z'), null, 10),
    ).toEqual(new Date('2030-01-01T00:00:00.000Z'));
  });

  it('usa la más temprana entre la documentada y la calculada', () => {
    const manufacture = new Date('2020-01-01T00:00:00.000Z');

    expect(
      earliestEquipmentExpiry(
        manufacture,
        new Date('2035-01-01T00:00:00.000Z'),
        10,
      ),
    ).toEqual(new Date('2030-01-01T00:00:00.000Z'));

    expect(
      earliestEquipmentExpiry(
        manufacture,
        new Date('2025-06-01T00:00:00.000Z'),
        10,
      ),
    ).toEqual(new Date('2025-06-01T00:00:00.000Z'));
  });

  it('considera iguales las fechas coincidentes', () => {
    const manufacture = new Date('2020-01-01T00:00:00.000Z');
    expect(
      earliestEquipmentExpiry(
        manufacture,
        new Date('2030-01-01T00:00:00.000Z'),
        10,
      ),
    ).toEqual(new Date('2030-01-01T00:00:00.000Z'));
  });

  it('suma años calendario en UTC', () => {
    expect(addYears(new Date('2020-03-15T00:00:00.000Z'), 5)).toEqual(
      new Date('2025-03-15T00:00:00.000Z'),
    );
  });

  it('ajusta el 29 de febrero a fin de mes en años no bisiestos', () => {
    expect(addYears(new Date('2020-02-29T00:00:00.000Z'), 1)).toEqual(
      new Date('2021-02-28T00:00:00.000Z'),
    );
    expect(addYears(new Date('2020-02-29T00:00:00.000Z'), 4)).toEqual(
      new Date('2024-02-29T00:00:00.000Z'),
    );
  });
});
