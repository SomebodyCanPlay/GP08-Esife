import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class TaquillaService {
  private apiUrl = 'http://localhost:8080';
  private esiusuariosUrl = 'http://localhost:8081';

  constructor(private http: HttpClient) {}

  // ── RESERVAS (esientradas) ──

  preReservar(sessionId: string, idEntrada: number): Observable<any> {
    return this.http.post(`${this.apiUrl}/compras/prereservar?sessionId=${sessionId}`, {
      idEntrada: idEntrada
    });
  }

  cancelarReserva(sessionId: string, idEntrada: number): Observable<any> {
    return this.http.post(`${this.apiUrl}/compras/cancelar?sessionId=${sessionId}`, {
      idEntrada: idEntrada
    });
  }

  confirmarCompra(sessionId: string, userToken: string): Observable<any> {
    return this.http.post(`${this.apiUrl}/compras/confirmar?sessionId=${sessionId}`, {
      token: userToken
    });
  }

  // ── USUARIOS (esiusuarios) ──

  // Login → devuelve el token UUID en texto plano
  loginEsiusuarios(email: string, pwd: string): Observable<string> {
    return this.http.post(`${this.esiusuariosUrl}/users/login`, {
      email: email,
      pwd: pwd
    }, { responseType: 'text' });
  }

  // Registro → devuelve mensaje de confirmación
  registerEsiusuarios(email: string, pwd: string, nombre: string): Observable<string> {
    return this.http.post(`${this.esiusuariosUrl}/users/register`, {
      email: email,
      pwd: pwd,
      nombre: nombre
    }, { responseType: 'text' });
  }

  // Paso 1 de recuperación: pide el código por email
  recuperarPassword(email: string): Observable<string> {
    return this.http.post(`${this.esiusuariosUrl}/users/recuperarPassword`, {
      email: email
    }, { responseType: 'text' });
  }

  // Paso 2 de recuperación: usa el código para cambiar la contraseña
  restablecerPassword(codigo: string, nuevaPassword: string): Observable<string> {
    return this.http.post(`${this.esiusuariosUrl}/users/restablecerPassword`, {
      codigo: codigo,
      nuevaPassword: nuevaPassword
    }, { responseType: 'text' });
  }
}
