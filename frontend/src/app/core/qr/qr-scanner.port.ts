import { InjectionToken } from '@angular/core';
import { Observable } from 'rxjs';

/** Motivos estables para que la interfaz elija el mensaje sin leer errores. */
export type QrScannerFailure = 'denied' | 'unavailable' | 'error';

export class QrScannerError extends Error {
  constructor(
    readonly reason: QrScannerFailure,
    message?: string,
  ) {
    super(message ?? reason);
    this.name = 'QrScannerError';
  }
}

/**
 * Puerto de escaneo. El adaptador solo entrega el texto decodificado; la
 * validación del código y los permisos siguen siendo responsabilidad de la API.
 */
export interface QrScannerPort {
  readonly results$: Observable<string>;
  start(video: HTMLVideoElement): Promise<void>;
  stop(): void;
}

export const QR_SCANNER_PORT = new InjectionToken<QrScannerPort>(
  'QrScannerPort',
);
