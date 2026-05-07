import { Component, OnInit, AfterViewInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { ActivatedRoute, Router } from '@angular/router';
import { TaquillaService } from '../services/taquilla.service';

export interface Entrada {
  id: number;
  precio: number;
  estado: string;
  tipo: string;
  fila?: number;
  columna?: number;
  planta?: number;
  zona?: number;
}

export interface DtoEntradas {
  total: number;
  libres: number;
  reservadas: number;
  vendidas: number;
}

@Component({
  selector: 'app-compra',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './compra.html',
  styleUrls: ['./compra.css']
})
export class CompraComponent implements OnInit, AfterViewInit, OnDestroy {
  espectaculoId!: number;
  entradas: Entrada[] = [];
  resumen: DtoEntradas | null = null;
  mensajeError: string = '';

  sessionId: string = '';

  // Checkout UI state
  entradasSeleccionadas: Entrada[] = [];
  compraCompletada: boolean = false;
  // El token se recupera del sessionStorage (el usuario ya hizo login en la pantalla de auth)
  userToken: string = '';

  // Timer para el keep-alive de la cola (se cancela al salir de la página)
  private keepAliveTimer: any = null;

  constructor(
    private http: HttpClient,
    private route: ActivatedRoute,
    private router: Router,
    private cdRef: ChangeDetectorRef,
    private taquillaService: TaquillaService
  ) {}

  ngOnInit(): void {
    if (typeof window !== 'undefined' && window.sessionStorage) {
      this.sessionId = sessionStorage.getItem('taquilla_sessionId') || '';
      this.espectaculoId = Number(this.route.snapshot.paramMap.get('id'));

      // Recuperamos el token de sesión de esiusuarios guardado en el login
      this.userToken = sessionStorage.getItem('esiusuarios_token') || '';

      if (!this.sessionId) {
        this.mensajeError = 'Error de sesión. Por favor vuelve a Búsqueda.';
      }
      if (!this.userToken) {
        this.mensajeError = 'No has iniciado sesión. Vuelve al inicio.';
      }
    }
  }

  get precioTotal(): number {
    return this.entradasSeleccionadas.reduce((sum, ent) => sum + ent.precio, 0);
  }

  ngAfterViewInit(): void {
    if (typeof window !== 'undefined' && window.sessionStorage) {
      if (!isNaN(this.espectaculoId) && this.sessionId) {
        setTimeout(() => {
          this.cargarDatos();
        }, 10);
        // Keep-alive: pingamos la cola cada 10 segundos para no perder el turno
        // cuando el usuario navegó a auth y vuelve a esta página
        this.keepAliveTimer = setInterval(() => {
          this.http.get<any>(`http://localhost:8080/compras/check?sessionId=${this.sessionId}`).subscribe();
        }, 10000);
      }
    }
  }

  // Cancela el keep-alive al salir de la página (no dejamos timers sueltos)
  ngOnDestroy(): void {
    if (this.keepAliveTimer) {
      clearInterval(this.keepAliveTimer);
    }
  }

  cargarDatos() {
    this.http.get<Entrada[]>(`http://localhost:8080/busqueda/getEntradas?espectaculoid=${this.espectaculoId}&sessionId=${this.sessionId}`)
      .subscribe({
        next: (data) => {
          this.entradas = data;
          this.cdRef.detectChanges();
        },
        error: (err) => {
          this.manejarError(err);
          this.cdRef.detectChanges();
        }
      });

    this.http.get<DtoEntradas>(`http://localhost:8080/busqueda/getResumenEntradas?espectaculoId=${this.espectaculoId}&sessionId=${this.sessionId}`)
      .subscribe({
        next: (data) => {
          this.resumen = data;
          this.cdRef.detectChanges();
        },
        error: (err) => console.error('Error cargando resumen', err)
      });
  }

  preReservar(ent: Entrada) {
    this.taquillaService.preReservar(this.sessionId, ent.id).subscribe({
      next: (res) => {
        ent.estado = 'RESERVADA';
        this.entradasSeleccionadas.push(ent);
        this.mensajeError = '';
        this.cdRef.detectChanges();
      },
      error: (err) => {
        this.mensajeError = 'Error al pre-reservar la entrada. Puede que ya esté ocupada.';
        this.cdRef.detectChanges();
      }
    });
  }

  cancelarSeleccion(ent: Entrada) {
    this.taquillaService.cancelarReserva(this.sessionId, ent.id).subscribe({
      next: (res) => {
        // Volver a poner la entrada en verde
        let match = this.entradas.find(e => e.id === ent.id);
        if (match) match.estado = 'DISPONIBLE';
        
        // Eliminar del carrito
        this.entradasSeleccionadas = this.entradasSeleccionadas.filter(e => e.id !== ent.id);
        
        this.mensajeError = '';
        this.cdRef.detectChanges();
      },
      error: (err) => {
        this.mensajeError = 'Error al cancelar la reserva.';
        this.cdRef.detectChanges();
      }
    });
  }

  estaSeleccionada(id: number): boolean {
    return this.entradasSeleccionadas.some(e => e.id === id);
  }

  confirmarPago() {
    if (!this.userToken) {
      // No está logeado → guardar la URL actual y mandarlo al login
      sessionStorage.setItem('auth_returnUrl', `/compra/${this.espectaculoId}`);
      this.router.navigate(['/auth']);
      return;
    }
    // Tiene token → confirmar la compra directamente
    this.taquillaService.confirmarCompra(this.sessionId, this.userToken).subscribe({
      next: (res) => {
        this.compraCompletada = true;
        this.entradasSeleccionadas = [];
        this.mensajeError = '';
        this.cdRef.detectChanges();
      },
      error: (err) => {
        this.mensajeError = 'Error confirmando el pago. La reserva puede haber caducado.';
        this.cdRef.detectChanges();
      }
    });
  }

  manejarError(err: any) {
    if (err.status === 403) {
      this.mensajeError = 'Debe esperar su turno en la cola virtual.';
    } else {
      this.mensajeError = 'Error cargando las entradas del servidor.';
    }
  }
}
