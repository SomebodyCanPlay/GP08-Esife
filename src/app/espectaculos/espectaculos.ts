import { Component, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
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
  espectaculos?: Espectaculo[];
  expanded?: boolean;
}

@Component({
  selector: 'app-espectaculos',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './espectaculos.html',
  styleUrls: ['./espectaculos.css']
})
export class EspectaculosComponent implements OnInit, OnDestroy {
  terminoBusqueda: string = '';
  espectaculos: Espectaculo[] = [];
  escenarios: Escenario[] = [];

  mensajeError: string = '';
  enCola: boolean = true;
  posicionCola: number = 0;
  sessionId: string = '';
  mostrarEscenarios: boolean = false;

  // Referencia al temporizador del polling para poder cancelarlo al salir
  private colaTimer: any = null;

  // Constante: máximo de compradores simultáneos (debe coincidir con el backend)
  readonly MAX_SIMULTANEOS = 3;

  constructor(private http: HttpClient, private cdRef: ChangeDetectorRef) {}

  ngOnInit() {
    if (typeof window !== 'undefined' && window.sessionStorage) {
      // Recuperar o generar el sessionId único de esta pestaña del navegador
      this.sessionId = sessionStorage.getItem('taquilla_sessionId') || '';
      if (!this.sessionId) {
        this.sessionId = Math.random().toString(36).substring(2, 15);
        sessionStorage.setItem('taquilla_sessionId', this.sessionId);
      }
      // Empezar el ciclo de comprobación de la cola
      this.comprobarCola();
    }
  }

  // Se llama automáticamente cuando el usuario navega a otra página o cierra la pestaña
  // Importante: cancelamos el polling para no seguir ocupando un puesto en la cola
  ngOnDestroy() {
    if (this.colaTimer) {
      clearTimeout(this.colaTimer);
      this.colaTimer = null;
    }
  }

  comprobarCola() {
    // Llamamos al backend para apuntarnos a la cola (o actualizar nuestra posición)
    // El endpoint devuelve: { canPass: true/false, posicion: N }
    this.http.get<any>(`http://localhost:8080/compras/check?sessionId=${this.sessionId}`).subscribe({
      next: (res) => {
        if (res.canPass) {
          // ¡Es nuestro turno! Salimos de la pantalla de cola
          this.enCola = false;
          this.mensajeError = '';
        } else {
          // Seguimos esperando — actualizamos la posición y volvemos a comprobar en 2s
          this.enCola = true;
          this.posicionCola = res.posicion;
          // ANTES era 5000ms (5 segundos) → ahora 2000ms (2 segundos)
          // Así si alguien delante sale, el siguiente lo sabe en máximo 2 segundos
          this.colaTimer = setTimeout(() => this.comprobarCola(), 2000);
        }
        this.cdRef.detectChanges();
      },
      error: () => {
        this.mensajeError = 'Error conectando con la taquilla. Reintentando...';
        // Aunque haya error de red, volvemos a intentarlo en 3s (no bloquear al usuario)
        this.colaTimer = setTimeout(() => this.comprobarCola(), 3000);
        this.cdRef.detectChanges();
      }
    });
  }

  // Texto informativo para mostrar al usuario según su posición en la cola
  get mensajeCola(): string {
    if (this.posicionCola <= 0) return 'Entrando...';
    if (this.posicionCola === 1) return 'Eres el siguiente en entrar. ¡Casi es tu turno!';
    return `Hay ${this.posicionCola - 1} persona${this.posicionCola - 1 > 1 ? 's' : ''} delante de ti.`;
  }

  // Tiempo estimado de espera en minutos (muy aproximado, orientativo)
  get tiempoEstimado(): string {
    if (this.posicionCola <= 1) return 'menos de 1 min';
    const minutos = Math.ceil((this.posicionCola - 1) * 2); // ~2 min por persona
    return `~${minutos} min`;
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
        this.mensajeError = 'Error cargando los escenarios.';
        this.cdRef.detectChanges();
      }
    });
  }

  toggleEscenario(escenario: Escenario) {
    if (this.enCola) return;

    escenario.expanded = !escenario.expanded;

    if (escenario.expanded && (!escenario.espectaculos || escenario.espectaculos.length === 0)) {
      this.http.get<Espectaculo[]>(
        `http://localhost:8080/busqueda/getEspectaculosPorEscenario?escenarioId=${escenario.id}&sessionId=${this.sessionId}`
      ).subscribe({
        next: (data) => {
          escenario.espectaculos = data;
          this.cdRef.detectChanges();
        },
        error: (err) => {
          if (err.status === 403) this.mensajeError = 'Sesión caducada. Vuelve a la cola.';
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
