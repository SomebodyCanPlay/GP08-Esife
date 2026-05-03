import { Component, OnInit, AfterViewInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { ActivatedRoute } from '@angular/router';
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
export class CompraComponent implements OnInit, AfterViewInit {
  espectaculoId!: number;
  entradas: Entrada[] = [];
  resumen: DtoEntradas | null = null;
  mensajeError: string = '';

  sessionId: string = '';

  // Checkout UI state
  entradaSeleccionada: Entrada | null = null;
  compraCompletada: boolean = false;
  loginName: string = '';
  loginPwd: string = '';

  constructor(
    private http: HttpClient, 
    private route: ActivatedRoute,
    private cdRef: ChangeDetectorRef,
    private taquillaService: TaquillaService
  ) {}

  ngOnInit(): void {
    if (typeof window !== 'undefined' && window.sessionStorage) {
      this.sessionId = sessionStorage.getItem('taquilla_sessionId') || '';
      this.espectaculoId = Number(this.route.snapshot.paramMap.get('id'));

      if (!this.sessionId) {
        this.mensajeError = 'Error de sesión temporal: Por favor vuelve a Búsqueda y entra desde allí para obtener turno en la cola.';
      }
    }
  }

  ngAfterViewInit(): void {
    if (typeof window !== 'undefined' && window.sessionStorage) {
      if (!isNaN(this.espectaculoId) && this.sessionId) {
        setTimeout(() => {
          this.cargarDatos();
        }, 10);
      }
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
        this.entradaSeleccionada = ent;
        this.mensajeError = '';
        this.cdRef.detectChanges();
      },
      error: (err) => {
        this.mensajeError = 'Error al pre-reservar la entrada. Puede que ya esté ocupada.';
        this.cdRef.detectChanges();
      }
    });
  }

  confirmarPago() {
    // Simulamos el inicio de sesión para obtener el token desde EsiUsuarios
    this.taquillaService.loginEsiusuarios(this.loginName, this.loginPwd).subscribe({
      next: (userToken) => {
        // Con el token de usuario, confirmamos la compra en EsiEntradas
        this.taquillaService.confirmarCompra(this.sessionId, userToken).subscribe({
          next: (res) => {
            this.compraCompletada = true;
            this.mensajeError = '';
            this.cdRef.detectChanges();
          },
          error: (err) => {
            this.mensajeError = 'Error confirmando el pago. El token podría no ser válido o la reserva caducó.';
            this.cdRef.detectChanges();
          }
        });
      },
      error: (err) => {
        this.mensajeError = 'Credenciales de EsiUsuarios incorrectas. No se pudo iniciar sesión.';
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
