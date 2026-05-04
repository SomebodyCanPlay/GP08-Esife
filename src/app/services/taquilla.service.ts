import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class TaquillaService {
  private apiUrl = 'http://localhost:8080';
  private esiusuariosUrl = 'http://localhost:8081'; // Asumiendo puerto de esiusuarios

  constructor(private http: HttpClient) {}

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

  loginEsiusuarios(name: string, pwd: string): Observable<string> {
    // Retorna el token JWT en texto plano desde esiusuarios
    return this.http.post(`${this.esiusuariosUrl}/users/login`, {
      name: name,
      pwd: pwd
    }, { responseType: 'text' });
  }
}
