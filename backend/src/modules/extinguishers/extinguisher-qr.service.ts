import { Injectable } from '@nestjs/common';
import QRCode from 'qrcode';

/**
 * D-05 / BR-140: el QR contiene únicamente el código estable del activo.
 * Nunca incluye ubicación, fechas, nombres ni datos personales.
 */
export function buildQrPayload(assetCode: string): string {
  return assetCode;
}

function escapeHtml(value: string): string {
  return value.replace(
    /[&<>"']/g,
    (character) =>
      ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;',
      })[character] ?? character,
  );
}

@Injectable()
export class ExtinguisherQrService {
  payload(assetCode: string): string {
    return buildQrPayload(assetCode);
  }

  renderPng(assetCode: string, size: number): Promise<Buffer> {
    return QRCode.toBuffer(this.payload(assetCode), {
      type: 'png',
      width: size,
      margin: 1,
      errorCorrectionLevel: 'M',
    });
  }

  renderSvg(assetCode: string, size: number): Promise<string> {
    return QRCode.toString(this.payload(assetCode), {
      type: 'svg',
      width: size,
      margin: 1,
      errorCorrectionLevel: 'M',
    });
  }

  async renderLabel(assetCode: string, size = 256): Promise<string> {
    const code = escapeHtml(assetCode);
    const png = await this.renderPng(assetCode, size);
    const dataUrl = `data:image/png;base64,${png.toString('base64')}`;

    return `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<title>Etiqueta ${code}</title>
<style>
  * { box-sizing: border-box; }
  body { margin: 0; font-family: Arial, Helvetica, sans-serif; background: #fff; }
  .label { width: 70mm; padding: 6mm; text-align: center; border: 1px solid #111; }
  .code { font-size: 20pt; font-weight: 700; letter-spacing: 1px; }
  .hint { margin: 2mm 0 4mm; font-size: 9pt; color: #333; }
  img { width: 45mm; height: 45mm; }
</style>
</head>
<body>
  <div class="label">
    <div class="code">${code}</div>
    <div class="hint">Escanee para identificar el extintor</div>
    <img src="${dataUrl}" alt="QR ${code}">
  </div>
</body>
</html>`;
  }
}
