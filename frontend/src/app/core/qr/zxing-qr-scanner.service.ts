import { Injectable } from '@angular/core';
import { Subject } from 'rxjs';
import {
  QrScannerError,
  QrScannerPort,
} from './qr-scanner.port';

interface ScannerControls {
  stop: () => void;
}

/**
 * Adaptador basado en `@zxing/browser`, cargado de forma diferida para no
 * incluir el decodificador en el paquete inicial. La cámara se detiene al
 * primer resultado o al salir de la pantalla.
 */
@Injectable()
export class ZxingQrScannerService implements QrScannerPort {
  private readonly results = new Subject<string>();
  private controls: ScannerControls | null = null;

  readonly results$ = this.results.asObservable();

  async start(video: HTMLVideoElement): Promise<void> {
    this.stop();

    try {
      const { BrowserQRCodeReader } = await import('@zxing/browser');
      const reader = new BrowserQRCodeReader();
      this.controls = await reader.decodeFromVideoDevice(
        undefined,
        video,
        (result) => {
          if (result !== undefined) {
            this.results.next(result.getText());
          }
        },
      );
    } catch (error: unknown) {
      this.stop();
      throw toScannerError(error);
    }
  }

  stop(): void {
    this.controls?.stop();
    this.controls = null;
  }
}

function toScannerError(error: unknown): QrScannerError {
  const name = error instanceof Error ? error.name : '';

  if (name === 'NotAllowedError' || name === 'SecurityError') {
    return new QrScannerError('denied', name);
  }
  if (
    name === 'NotFoundError' ||
    name === 'OverconstrainedError' ||
    name === 'NotReadableError'
  ) {
    return new QrScannerError('unavailable', name);
  }
  return new QrScannerError('error', name === '' ? 'camera-error' : name);
}
