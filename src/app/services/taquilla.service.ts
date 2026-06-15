import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../environments/environment'; // Ajusta la ruta si es necesario

@Injectable({
  providedIn: 'root'
})
export class TaquillaService {
  // Usamos las variables del entorno
  private apiUrl = environment.apiUrl;
  private esiusuariosUrl = environment.esiusuariosUrl;

  constructor(private http: HttpClient) { }

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

  // Paso 3.5: El usuario pulsa "Ir al Pago" → crea pagos PENDIENTE en la BD
  // Devuelve el total en céntimos y los IDs de los pagos creados
  iniciarPago(sessionId: string, userToken: string): Observable<any> {
    return this.http.post<any>(
      `${this.apiUrl}/compras/iniciarPago?sessionId=${sessionId}`,
      { token: userToken }
    );
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

  // Logout → avisa al backend para borrar el token de la BD
  logoutEsiusuarios(token: string): Observable<string> {
    return this.http.post(`${this.esiusuariosUrl}/users/logout`, {
      token: token
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
  // ============================================================
  // Cancelar Cuenta (Dar de baja)
  // ============================================================
  cancelarCuenta(email: string, pwd: string): Observable<string> {
    return this.http.delete(`${this.esiusuariosUrl}/users/cancelarCuenta`, {
      body: { email: email, pwd: pwd },
      responseType: 'text'
    });
  }

}
