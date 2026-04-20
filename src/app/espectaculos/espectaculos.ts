import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { RouterLink } from '@angular/router';

export interface Espectaculo {
  id: number;
  artista: string;
  fecha: string;
  escenario: any;
}

@Component({
  selector: 'app-espectaculos',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './espectaculos.html',
  styleUrls: ['./espectaculos.css']
})
export class EspectaculosComponent implements OnInit {
  terminoBusqueda: string = '';
  espectaculos: Espectaculo[] = [];
  mensajeError: string = '';
  enCola: boolean = true;
  posicionCola: number = 0;
  sessionId: string = '';

  constructor(private http: HttpClient) {}

  ngOnInit() {
    if (typeof window !== 'undefined' && window.sessionStorage) {
      this.sessionId = sessionStorage.getItem('taquilla_sessionId') || '';
      if (!this.sessionId) {
        this.sessionId = Math.random().toString(36).substring(2, 15);
        sessionStorage.setItem('taquilla_sessionId', this.sessionId);
      }
      this.comprobarCola();
    }
  }

  comprobarCola() {
    // 1. Unirse a la cola
    this.http.get<any>(`http://localhost:8080/compras/check?sessionId=${this.sessionId}`).subscribe({
      next: (res) => {
        if (res.canPass) {
          this.enCola = false;
        } else {
          this.enCola = true;
          this.posicionCola = res.posicion;
          this.mensajeError = `Estás en la cola virtual. Posición: ${this.posicionCola}. El sistema te habilitará pronto.`;
          // Re-intentar en 5 segundos
          setTimeout(() => this.comprobarCola(), 5000);
        }
      },
      error: () => this.mensajeError = "Error conectando con la taquilla."
    });
  }

  buscar() {
    this.mensajeError = '';
    if (this.enCola) {
      this.mensajeError = `Estás en la cola virtual. Posición: ${this.posicionCola}. Por favor, espera.`;
      return;
    }

    if (!this.terminoBusqueda.trim()) {
      this.espectaculos = [];
      return;
    }

    // Llama al backend
    const url = `http://localhost:8080/busqueda/getEspectaculos?artista=${encodeURIComponent(this.terminoBusqueda)}&sessionId=${this.sessionId}`;
    
    this.http.get<Espectaculo[]>(url).subscribe({
      next: (data) => {
        this.espectaculos = data;
        if (this.espectaculos.length === 0) {
          this.mensajeError = 'No se han encontrado espectáculos para ese artista.';
        }
      },
      error: (err) => {
        console.error('Error fetching data', err);
        if (err.status === 403) {
           this.mensajeError = 'Debe esperar en la cola virtual para acceder al sistema.';
        } else {
           this.mensajeError = 'Error conectando con el servidor.';
        }
      }
    });
  }
}
