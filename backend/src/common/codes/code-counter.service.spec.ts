import {
  EXTINGUISHER_COUNTER,
  LOCATION_COUNTER,
  formatCounterCode,
} from './code-counter.service';
import type { CounterDefinition } from './code-counter.service';

describe('formatCounterCode (D-04 / BR-027C)', () => {
  it('rellena con ceros a la izquierda hasta el ancho configurado', () => {
    expect(formatCounterCode('UBI-', 1, 6)).toBe('UBI-000001');
    expect(formatCounterCode('EXT-', 42, 6)).toBe('EXT-000042');
  });

  it('no trunca valores que superan el ancho', () => {
    expect(formatCounterCode('UBI-', 1234567, 6)).toBe('UBI-1234567');
  });

  it('expone el contador de ubicaciones aprobado', () => {
    const definition: CounterDefinition = LOCATION_COUNTER;
    expect(definition).toEqual({
      scope: 'LOCATION',
      prefix: 'UBI-',
      padding: 6,
    });
  });

  it('expone el contador de extintores aprobado', () => {
    const definition: CounterDefinition = EXTINGUISHER_COUNTER;
    expect(definition).toEqual({
      scope: 'EXTINGUISHER',
      prefix: 'EXT-',
      padding: 6,
    });
  });
});
