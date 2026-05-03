import { Component, OnInit, AfterViewInit, ChangeDetectorRef } from '@angular/core';
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

export interface Escenario {
  id: number;
  nombre: string;
  descripcion: string;
  espectaculos?: Espectaculo[]; // Array for UI accordion
  expanded?: boolean; // UI State
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
  escenarios: Escenario[] = [];
  
  mensajeError: string = '';
  enCola: boolean = true;
  posicionCola: number = 0;
  sessionId: string = '';
  mostrarEscenarios: boolean = false; // Controla si se ven los acordeones

  constructor(private http: HttpClient, private cdRef: ChangeDetectorRef) {}

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
        this.cdRef.detectChanges();
      },
      error: () => {
        this.mensajeError = "Error conectando con la taquilla.";
        this.cdRef.detectChanges();
      }
    });
  }

  verConciertos() {
    this.mostrarEscenarios = true;
    this.cargarEscenarios();
    this.cdRef.detectChanges();
  }

  cargarEscenarios() {
    this.http.get<Escenario[]>(`http://localhost:8080/busqueda/getEscenarios`).subscribe({
      next: (data) => {
        this.escenarios = data.map(e => ({...e, expanded: false, espectaculos: []}));
        this.cdRef.detectChanges();
      },
      error: () => {
        this.mensajeError = "Error cargando los escenarios.";
        this.cdRef.detectChanges();
      }
    });
  }

  toggleEscenario(escenario: Escenario) {
    if (this.enCola) return;
    
    escenario.expanded = !escenario.expanded;
    
    if (escenario.expanded && (!escenario.espectaculos || escenario.espectaculos.length === 0)) {
      this.http.get<Espectaculo[]>(`http://localhost:8080/busqueda/getEspectaculosPorEscenario?escenarioId=${escenario.id}&sessionId=${this.sessionId}`)
        .subscribe({
          next: (data) => {
            escenario.espectaculos = data;
            this.cdRef.detectChanges();
          },
          error: (err) => {
             if (err.status === 403) this.mensajeError = 'Sesión caducada. Debe esperar en la cola.';
             else this.mensajeError = 'Error cargando espectáculos del escenario.';
             this.cdRef.detectChanges();
          }
        });
    } else {
      this.cdRef.detectChanges();
    }
  }

  buscar() {
    this.mensajeError = '';
    if (this.enCola) {
      this.mensajeError = `Estás en la cola virtual. Posición: ${this.posicionCola}. Por favor, espera.`;
      this.cdRef.detectChanges();
      return;
    }

    if (!this.terminoBusqueda.trim()) {
      this.espectaculos = [];
      this.cdRef.detectChanges();
      return;
    }

    const url = `http://localhost:8080/busqueda/getEspectaculos?artista=${encodeURIComponent(this.terminoBusqueda)}&sessionId=${this.sessionId}`;
    
    this.http.get<Espectaculo[]>(url).subscribe({
      next: (data) => {
        this.espectaculos = data;
        if (this.espectaculos.length === 0) {
          this.mensajeError = 'No se han encontrado espectáculos para ese artista.';
        }
        this.cdRef.detectChanges();
      },
      error: (err) => {
        if (err.status === 403) {
           this.mensajeError = 'Debe esperar en la cola virtual para acceder al sistema.';
        } else {
           this.mensajeError = 'Error conectando con el servidor.';
        }
        this.cdRef.detectChanges();
      }
    });
  }
}
