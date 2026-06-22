import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../environments/environment'; 

@Injectable({
  providedIn: 'root'
})
export class TaquillaService {
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

  loginEsiusuarios(email: string, pwd: string): Observable<string> {
    return this.http.post(`${this.esiusuariosUrl}/users/login`, {
      email: email,
      pwd: pwd
    }, { responseType: 'text' });
  }

  logoutEsiusuarios(token: string): Observable<string> {
    return this.http.post(`${this.esiusuariosUrl}/users/logout`, {
      token: token
    }, { responseType: 'text' });
  }

  registerEsiusuarios(email: string, pwd: string, nombre: string): Observable<string> {
    return this.http.post(`${this.esiusuariosUrl}/users/register`, {
      email: email,
      pwd: pwd,
      nombre: nombre
    }, { responseType: 'text' });
  }

  recuperarPassword(email: string): Observable<string> {
    return this.http.post(`${this.esiusuariosUrl}/users/recuperarPassword`, {
      email: email
    }, { responseType: 'text' });
  }

  restablecerPassword(codigo: string, nuevaPassword: string): Observable<string> {
    return this.http.post(`${this.esiusuariosUrl}/users/restablecerPassword`, {
      codigo: codigo,
      nuevaPassword: nuevaPassword
    }, { responseType: 'text' });
  }

  cancelarCuenta(email: string, pwd: string): Observable<string> {
    return this.http.delete(`${this.esiusuariosUrl}/users/cancelarCuenta`, {
      body: { email: email, pwd: pwd },
      responseType: 'text'
    });
  }

  // Monedero
  obtenerSaldoMonedero(token: string): Observable<number> {
    return this.http.post<number>(`${this.esiusuariosUrl}/users/saldo`, { 
      token: token 
    });
  }
}