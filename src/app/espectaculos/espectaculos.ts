import { Component, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router'; 
import { environment } from '../environments/environment';

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
  espectaculos?: Espectaculo[];
  expanded?: boolean;
}

@Component({
  selector: 'app-espectaculos',
  standalone: true,
  imports: [CommonModule, FormsModule], 
  templateUrl: './espectaculos.html',
  styleUrls: ['./espectaculos.css']
})
export class EspectaculosComponent implements OnInit, OnDestroy {
  terminoBusqueda: string = '';
  espectaculos: Espectaculo[] = [];
  escenarios: Escenario[] = [];

  mensajeError: string = '';

  enCola: boolean = false;
  posicionCola: number = 0;
  sessionId: string = '';
  mostrarEscenarios: boolean = true;

  espectaculoEnColaId: number | null = null;

  private colaTimer: any = null;
  readonly MAX_SIMULTANEOS = 3;

  constructor(private http: HttpClient, private cdRef: ChangeDetectorRef, private router: Router) { }

  ngOnInit() {
    if (typeof window !== 'undefined' && window.sessionStorage) {
      this.sessionId = sessionStorage.getItem('taquilla_sessionId') || '';
      if (!this.sessionId) {
        this.sessionId = Math.random().toString(36).substring(2, 15);
        sessionStorage.setItem('taquilla_sessionId', this.sessionId);
      }
    }
    this.cargarEscenarios();
  }

  ngOnDestroy() {
    if (this.colaTimer) {
      clearTimeout(this.colaTimer);
      this.colaTimer = null;
    }
  }

  entrarColaEspectaculo(espectaculoId: number) {
    this.espectaculoEnColaId = espectaculoId;
    this.enCola = true;
    this.comprobarCola();
  }

  comprobarCola() {
    if (this.espectaculoEnColaId === null) return;

    this.http.get<any>(`${environment.apiUrl}/cola/check?espectaculoId=${this.espectaculoEnColaId}&sessionId=${this.sessionId}`).subscribe({
      next: (res) => {
        if (res.canPass) {
          this.enCola = false;
          this.mensajeError = '';

          if (this.espectaculoEnColaId !== null) {
            this.router.navigate(['/compra', this.espectaculoEnColaId]);
          }

        } else {
          this.enCola = true;
          this.posicionCola = res.posicion;
          this.colaTimer = setTimeout(() => this.comprobarCola(), 2000);
        }
        this.cdRef.detectChanges();
      },
      error: () => {
        this.mensajeError = 'Error conectando con la taquilla. Reintentando...';
        this.colaTimer = setTimeout(() => this.comprobarCola(), 3000);
        this.cdRef.detectChanges();
      }
    });
  }

  get mensajeCola(): string {
    if (this.posicionCola <= 0) return 'Entrando...';
    if (this.posicionCola === 1) return 'Eres el siguiente en entrar. ¡Casi es tu turno!';
    return `Hay ${this.posicionCola - 1} persona${this.posicionCola - 1 > 1 ? 's' : ''} delante de ti.`;
  }

  get tiempoEstimado(): string {
    if (this.posicionCola <= 1) return 'menos de 1 min';
    const minutos = Math.ceil((this.posicionCola - 1) * 2);
    return `~${minutos} min`;
  }

  verConciertos() {
    this.mostrarEscenarios = true;
    this.cargarEscenarios();
    this.cdRef.detectChanges();
  }

  cargarEscenarios() {
    this.http.get<Escenario[]>(`${environment.apiUrl}/busqueda/getEscenarios`).subscribe({
      next: (data) => {
        this.escenarios = data.map(e => ({ ...e, expanded: false, espectaculos: [] }));
        this.cdRef.detectChanges();
      },
      error: () => {
        this.mensajeError = 'Error cargando los escenarios.';
        this.cdRef.detectChanges();
      }
    });
  }

  toggleEscenario(escenario: Escenario) {
    escenario.expanded = !escenario.expanded;
    if (escenario.expanded && (!escenario.espectaculos || escenario.espectaculos.length === 0)) {
      this.http.get<Espectaculo[]>(
        `${environment.apiUrl}/busqueda/getEspectaculosPorEscenario?escenarioId=${escenario.id}&sessionId=${this.sessionId}`
      ).subscribe({
        next: (data) => {
          escenario.espectaculos = data;
          this.cdRef.detectChanges();
        },
        error: (err) => {
          this.mensajeError = 'Error cargando espectáculos del escenario.';
          this.cdRef.detectChanges();
        }
      });
    } else {
      this.cdRef.detectChanges();
    }
  }

  buscar() {
    this.mensajeError = '';
    if (!this.terminoBusqueda.trim()) {
      this.espectaculos = [];
      this.cdRef.detectChanges();
      return;
    }

    const url = `${environment.apiUrl}/busqueda/getEspectaculos?artista=${encodeURIComponent(this.terminoBusqueda)}&sessionId=${this.sessionId}`;
    this.http.get<Espectaculo[]>(url).subscribe({
      next: (data) => {
        this.espectaculos = data;
        if (this.espectaculos.length === 0) {
          this.mensajeError = 'No se han encontrado espectáculos para ese artista.';
        }
        this.cdRef.detectChanges();
      },
      error: (err) => {
        this.mensajeError = 'Error conectando con el servidor.';
        this.cdRef.detectChanges();
      }
    });
  }
}