import {
  ExtinguisherQrService,
  buildQrPayload,
} from './extinguisher-qr.service';

describe('QR del extintor (T-QR-09 / D-05)', () => {
  const service = new ExtinguisherQrService();

  it('el payload es solo el código del activo', () => {
    const payload = buildQrPayload('EXT-000125');
    expect(payload).toBe('EXT-000125');
    expect(payload).not.toContain('http');
    expect(payload).not.toContain('UBI-');
    expect(payload).not.toMatch(/\d{4}-\d{2}-\d{2}/);
  });

  it('genera un PNG válido', async () => {
    const png = await service.renderPng('EXT-000125', 128);
    expect(png.subarray(0, 8)).toEqual(
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    );
  });

  it('genera un SVG que solo identifica el código', async () => {
    const svg = await service.renderSvg('EXT-000125', 128);
    expect(svg).toContain('<svg');
    expect(svg).not.toContain('UBI-');
    expect(svg).not.toMatch(/\d{4}-\d{2}-\d{2}/);
  });

  it('la etiqueta muestra el código y no datos variables', async () => {
    const html = await service.renderLabel('EXT-000125', 96);
    expect(html).toContain('EXT-000125');
    expect(html).toContain('data:image/png;base64,');
    expect(html).not.toContain('UBI-');
    expect(html).not.toMatch(/\d{4}-\d{2}-\d{2}/);
  });
});
