import { Component, OnInit, AfterViewInit, OnDestroy, ChangeDetectorRef, HostListener } from '@angular/core';
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

  // ── Flujo de pago en 2 pasos ──
  mostrarFormularioPago: boolean = false; // true cuando el usuario pulsa "Ir al Pago"
  totalCentimos: number = 0;             // total calculado por el backend al iniciar pago

  // Campos del formulario de tarjeta
  tarjetaNumero: string = '';
  tarjetaCaducidad: string = '';  // formato MM/AA
  tarjetaCvc: string = '';
  tarjetaNombre: string = '';     // nombre del titular
  errorTarjeta: string = '';      // mensaje de error de validación
  procesandoPago: boolean = false;

  // Timer para el keep-alive de la cola (se cancela al salir de la página)
  private keepAliveTimer: any = null;

  constructor(
    private http: HttpClient,
    private route: ActivatedRoute,
    private router: Router,
    private cdRef: ChangeDetectorRef,
    private taquillaService: TaquillaService
  ) { }

  // Esto detecta si el usuario le da a la "X" de cerrar la pestaña
  @HostListener('window:beforeunload', ['$event'])
  unloadNotification($event: any) {
    this.avisarSalidaInstantanea();
  }

  // Esto detecta si el usuario le da a la flecha de "Atrás" o a otro enlace
  ngOnDestroy(): void {
    // 1. Limpiamos el temporizador para que no siga ejecutándose en segundo plano
    if (this.keepAliveTimer) {
      clearInterval(this.keepAliveTimer);
    }

    // 2. Lanzamos el aviso instantáneo a Java para liberar el hueco en la cola
    this.avisarSalidaInstantanea();
  }

  avisarSalidaInstantanea() {
    if (this.sessionId) {
      // Usamos sendBeacon: es un misil que el navegador lanza al servidor
      // incluso si la pestaña ya se está cerrando o muriendo.
      const url = `http://localhost:8080/cola/abandonar?sessionId=${this.sessionId}`;
      navigator.sendBeacon(url);
    }
  }
  ngOnInit(): void {
    if (typeof window !== 'undefined' && window.sessionStorage) {
      this.sessionId = sessionStorage.getItem('taquilla_sessionId') || '';
      this.espectaculoId = Number(this.route.snapshot.paramMap.get('id'));

      // Recuperamos el token de sesión de esiusuarios guardado en el login
      this.userToken = sessionStorage.getItem('esiusuarios_token') || '';

      if (!this.sessionId) {
        this.mensajeError = 'Error de sesión. Por favor vuelve a Búsqueda.';
      }
      // No bloqueamos con mensaje de error aquí si no hay token, 
      // porque el usuario puede querer ver las entradas antes de loguearse.
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


  cargarDatos() {
    // 1. Cargamos todas las entradas del espectáculo
    this.http.get<Entrada[]>(`http://localhost:8080/busqueda/getEntradas?espectaculoid=${this.espectaculoId}&sessionId=${this.sessionId}`)
      .subscribe({
        next: (data) => {
          this.entradas = data;
          this.cdRef.detectChanges(); // Pintamos las entradas YA

          // 2. Intentamos recuperar el carrito (si falla, no pasa nada, se ven las entradas igual)
          this.http.get<number[]>(`http://localhost:8080/compras/misReservas?sessionId=${this.sessionId}`)
            .subscribe({
              next: (misIds) => {
                if (misIds && misIds.length > 0) {
                  this.entradasSeleccionadas = this.entradas.filter(e => misIds.includes(e.id));
                  this.cdRef.detectChanges();
                }
              },
              error: (err) => console.warn("Aún no se puede recuperar el carrito (reinicio pendiente):", err)
            });
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

  // PASO 1: El usuario pulsa "Ir al Pago"
  irAlPago() {
    console.log("Intentando ir al pago...");
    if (!this.userToken) {
      console.log("No hay token, guardando returnUrl y redirigiendo a /auth");
      sessionStorage.setItem('auth_returnUrl', `/compra/${this.espectaculoId}`);
      this.router.navigate(['/auth']);
      return;
    }

    if (this.entradasSeleccionadas.length === 0) {
      this.mensajeError = 'Tu carrito está vacío.';
      return;
    }

    console.log("Llamando a iniciarPago con sessionId:", this.sessionId);
    this.taquillaService.iniciarPago(this.sessionId, this.userToken).subscribe({
      next: (res) => {
        console.log("Pago iniciado correctamente:", res);
        this.totalCentimos = res.totalCentimos || 0;
        this.mostrarFormularioPago = true;
        this.mensajeError = '';
        this.cdRef.detectChanges();
      },
      error: (err) => {
        console.error("Error en iniciarPago:", err);
        if (err.status === 403) {
          this.mensajeError = 'Tu sesión de reserva ha caducado. Por favor, selecciona las entradas de nuevo.';
        } else if (err.status === 401) {
          this.mensajeError = 'Tu sesión ha caducado. Por favor, inicia sesión de nuevo.';
        } else if (err.status === 404) {
          this.mensajeError = 'El servidor dice que no hay reservas activas en tu carrito (404). Por favor, quita la entrada y vuelve a seleccionarla.';
        } else {
          this.mensajeError = `Error del servidor (${err.status}): ${err.error?.message || err.error?.error || 'Inténtalo de nuevo.'}`;
        }
        this.cdRef.detectChanges();
      }
    });
  }

  // Formatea el número de tarjeta con espacios cada 4 dígitos mientras el usuario escribe
  // Ejemplo: "1234567812345678" → "1234 5678 1234 5678"
  formatearNumeroTarjeta(event: any) {
    let val = event.target.value.replace(/\D/g, '').substring(0, 16);
    this.tarjetaNumero = val.replace(/(\d{4})(?=\d)/g, '$1 ');
  }

  // Formatea la fecha de caducidad como MM/AA mientras el usuario escribe
  formatearCaducidad(event: any) {
    let val = event.target.value.replace(/\D/g, '').substring(0, 4);
    if (val.length > 2) val = val.substring(0, 2) + '/' + val.substring(2);
    this.tarjetaCaducidad = val;
  }

  // Valida los datos de la tarjeta antes de enviar
  // Para la demo acepta cualquier número de 16 dígitos, CVC de 3 y fecha válida
  validarTarjeta(): boolean {
    const numero = this.tarjetaNumero.replace(/\s/g, '');
    if (numero.length !== 16) {
      this.errorTarjeta = 'El número de tarjeta debe tener 16 dígitos';
      return false;
    }
    if (!/^\d{2}\/\d{2}$/.test(this.tarjetaCaducidad)) {
      this.errorTarjeta = 'La fecha debe tener el formato MM/AA';
      return false;
    }
    const [mes, anio] = this.tarjetaCaducidad.split('/').map(Number);
    const ahora = new Date();
    const anioCompleto = 2000 + anio;
    if (mes < 1 || mes > 12 || anioCompleto < ahora.getFullYear() ||
      (anioCompleto === ahora.getFullYear() && mes < ahora.getMonth() + 1)) {
      this.errorTarjeta = 'La tarjeta ha caducado o la fecha no es válida';
      return false;
    }
    if (!/^\d{3,4}$/.test(this.tarjetaCvc)) {
      this.errorTarjeta = 'El CVC debe tener 3 dígitos';
      return false;
    }
    if (!this.tarjetaNombre.trim()) {
      this.errorTarjeta = 'Introduce el nombre del titular';
      return false;
    }
    this.errorTarjeta = '';
    return true;
  }

  // PASO 2: El usuario ha rellenado la tarjeta y pulsa "Pagar"
  // El backend actualiza los pagos de PENDIENTE a COMPLETADO
  procesarPago() {
    if (!this.validarTarjeta()) return;

    this.procesandoPago = true;
    this.taquillaService.confirmarCompra(this.sessionId, this.userToken).subscribe({
      next: (res) => {
        this.compraCompletada = true;
        this.mostrarFormularioPago = false;
        this.entradasSeleccionadas = [];
        this.mensajeError = '';
        this.procesandoPago = false;
        this.cdRef.detectChanges();
      },
      error: (err) => {
        this.mensajeError = 'Error procesando el pago. La reserva puede haber caducado.';
        this.procesandoPago = false;
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
