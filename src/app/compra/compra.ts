import { Component, OnInit, AfterViewInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { ActivatedRoute } from '@angular/router';

export interface Entrada {
  id: number;
  precio: number;
  estado: string;
  tipo: string; // "precisa" o "dezona" gracias al @JsonTypeInfo de tu Backend
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
  imports: [CommonModule],
  templateUrl: './compra.html',
  styleUrls: ['./compra.css']
})
export class CompraComponent implements OnInit, AfterViewInit {
  espectaculoId!: number;
  entradas: Entrada[] = [];
  resumen: DtoEntradas | null = null;
  mensajeError: string = '';

  sessionId: string = '';

  constructor(
    private http: HttpClient, 
    private route: ActivatedRoute,
    private cdRef: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    if (typeof window !== 'undefined' && window.sessionStorage) {
      // Recuperar el ID de sesión generado en la búsqueda
      this.sessionId = sessionStorage.getItem('taquilla_sessionId') || '';

      // 1. Obtener ID de la URL
      this.espectaculoId = Number(this.route.snapshot.paramMap.get('id'));

      if (!this.sessionId) {
        this.mensajeError = 'Error de sesión temporal: Por favor vuelve a Búsqueda y entra desde allí para obtener turno en la cola.';
      }
    }
  }

  ngAfterViewInit(): void {
    if (typeof window !== 'undefined' && window.sessionStorage) {
      if (!isNaN(this.espectaculoId) && this.sessionId) {
        // Ejecución retrasada levemente tras la renderización de la vista
        setTimeout(() => {
          this.cargarDatos();
        }, 10);
      }
    }
  }

  cargarDatos() {
    // 2. Traer la lista detallada de butacas
    this.http.get<Entrada[]>(`http://localhost:8080/busqueda/getEntradas?espectaculoid=${this.espectaculoId}&sessionId=${this.sessionId}`)
      .subscribe({
        next: (data) => {
          this.entradas = data;
          this.cdRef.detectChanges(); // Forzar actualización visual
        },
        error: (err) => {
          this.manejarError(err);
          this.cdRef.detectChanges();
        }
      });

    // 3. Traer el resumen matemático del profesor
    this.http.get<DtoEntradas>(`http://localhost:8080/busqueda/getResumenEntradas?espectaculoId=${this.espectaculoId}&sessionId=${this.sessionId}`)
      .subscribe({
        next: (data) => {
          this.resumen = data;
          this.cdRef.detectChanges();
        },
        error: (err) => console.error('Error cargando resumen', err)
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
