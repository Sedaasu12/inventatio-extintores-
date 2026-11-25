import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

export type QueryValue = string | number | boolean | null | undefined;

export interface RequestOptions {
  params?: Record<string, QueryValue>;
  headers?: Record<string, string>;
  /** Solo las rutas de autenticación necesitan la cookie de refresh. */
  withCredentials?: boolean;
}

function toParams(values: Record<string, QueryValue>): HttpParams {
  let params = new HttpParams();
  for (const [key, value] of Object.entries(values)) {
    if (value !== undefined && value !== null) {
      params = params.set(key, String(value));
    }
  }
  return params;
}

/** Cliente HTTP con la base de la API y la forma de error ya normalizada. */
@Injectable({ providedIn: 'root' })
export class ApiClient {
  private readonly http = inject(HttpClient);

  url(path: string): string {
    return `${environment.apiBaseUrl}${path.startsWith('/') ? path : `/${path}`}`;
  }

  get<T>(path: string, options: RequestOptions = {}): Observable<T> {
    return this.http.get<T>(this.url(path), this.options(options));
  }

  getText(path: string, options: RequestOptions = {}): Observable<string> {
    return this.http.get(this.url(path), {
      ...this.options(options),
      responseType: 'text',
    });
  }

  getBlob(path: string, options: RequestOptions = {}): Observable<Blob> {
    return this.http.get(this.url(path), {
      ...this.options(options),
      responseType: 'blob',
    });
  }

  post<T>(path: string, body: unknown, options: RequestOptions = {}): Observable<T> {
    return this.http.post<T>(this.url(path), body, this.options(options));
  }

  patch<T>(path: string, body: unknown, options: RequestOptions = {}): Observable<T> {
    return this.http.patch<T>(this.url(path), body, this.options(options));
  }

  put<T>(path: string, body: unknown, options: RequestOptions = {}): Observable<T> {
    return this.http.put<T>(this.url(path), body, this.options(options));
  }

  delete<T>(path: string, options: RequestOptions = {}): Observable<T> {
    return this.http.delete<T>(this.url(path), this.options(options));
  }

  private options(options: RequestOptions): {
    params?: HttpParams;
    headers?: HttpHeaders;
    withCredentials?: boolean;
  } {
    return {
      ...(options.params === undefined ? {} : { params: toParams(options.params) }),
      ...(options.headers === undefined
        ? {}
        : { headers: new HttpHeaders(options.headers) }),
      withCredentials: options.withCredentials === true,
    };
  }
}
