import { Component, OnInit, AfterViewInit, OnDestroy, ChangeDetectorRef, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { ActivatedRoute, Router } from '@angular/router';
import { TaquillaService } from '../services/taquilla.service';
import { environment } from '../environments/environment';

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

  entradasSeleccionadas: Entrada[] = [];
  compraCompletada: boolean = false;
  userToken: string = '';

  mostrarFormularioPago: boolean = false; 
  totalCentimos: number = 0;             

  tarjetaNumero: string = '';
  tarjetaCaducidad: string = '';  
  tarjetaCvc: string = '';
  tarjetaNombre: string = '';     
  errorTarjeta: string = '';      
  procesandoPago: boolean = false;
  compraCompletadaError: boolean = false; 

  // Variables para el monedero
  saldoDisponibleEuros: number = 0;
  usarSaldo: boolean = false;

  private keepAliveTimer: any = null;

  constructor(
    private http: HttpClient,
    private route: ActivatedRoute,
    private router: Router,
    public cdRef: ChangeDetectorRef,
    private taquillaService: TaquillaService
  ) { }

  @HostListener('window:beforeunload', ['$event'])
  unloadNotification($event: any) {
    this.avisarSalidaInstantanea();
  }

  ngOnDestroy(): void {
    if (this.keepAliveTimer) {
      clearInterval(this.keepAliveTimer);
    }
  }

  avisarSalidaInstantanea() {
    if (this.sessionId) {
      const url = `${environment.apiUrl}/cola/abandonar?sessionId=${this.sessionId}`;
      navigator.sendBeacon(url);
    }
  }

  ngOnInit(): void {
    if (typeof window !== 'undefined' && window.sessionStorage) {
      this.sessionId = sessionStorage.getItem('taquilla_sessionId') || '';
      this.espectaculoId = Number(this.route.snapshot.paramMap.get('id'));

      this.userToken = sessionStorage.getItem('esiusuarios_token') || '';

      if (!this.sessionId) {
        console.error("COMPRA: No hay sessionId en sessionStorage");
        this.mensajeError = 'Error de sesión. Por favor vuelve a Búsqueda.';
      } else {
        console.log("COMPRA: Iniciando carga inicial en ngOnInit...", {id: this.espectaculoId, session: this.sessionId});
        this.cargarDatos();

        // Cargar saldo si el usuario está logueado
        if (this.userToken) {
          this.taquillaService.obtenerSaldoMonedero(this.userToken).subscribe({
            next: (saldo) => {
              this.saldoDisponibleEuros = saldo;
              this.cdRef.detectChanges();
            },
            error: (err) => console.error("Error al cargar monedero", err)
          });
        }
      }
    }
  }

  get precioTotal(): number {
    return this.entradasSeleccionadas.reduce((sum, ent) => sum + ent.precio, 0);
  }

  // Cálculos del monedero
  get saldoAAplicarEuros(): number {
    if (!this.usarSaldo) return 0;
    return Math.min(this.saldoDisponibleEuros, this.precioTotal / 100);
  }

  get totalFinalEuros(): number {
    return (this.precioTotal / 100) - this.saldoAAplicarEuros;
  }

  ngAfterViewInit(): void {
    if (typeof window !== 'undefined' && window.sessionStorage) {
      if (this.sessionId) {
        setTimeout(() => {
          if (this.entradas.length === 0 && !this.mensajeError) {
            console.log("COMPRA: Re-intentando carga en ngAfterViewInit...");
            this.cargarDatos();
          }
        }, 500);

        this.keepAliveTimer = setInterval(() => {
          this.http.get<any>(`${environment.apiUrl}/compras/check?sessionId=${this.sessionId}`).subscribe();
        }, 10000);
      }
    }
  }

  cargarDatos() {
    if (!this.espectaculoId || !this.sessionId) return;
    
    console.log("COMPRA: Llamando a getEntradas...");
    this.http.get<Entrada[]>(`${environment.apiUrl}/busqueda/getEntradas?espectaculoid=${this.espectaculoId}&sessionId=${this.sessionId}`)
      .subscribe({
        next: (data) => {
          console.log("COMPRA: Entradas recibidas:", data.length);
          this.entradas = data;
          this.cdRef.markForCheck();
          this.cdRef.detectChanges(); 

          this.http.get<number[]>(`${environment.apiUrl}/compras/misReservas?sessionId=${this.sessionId}`)
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

    this.http.get<DtoEntradas>(`${environment.apiUrl}/busqueda/getResumenEntradas?espectaculoId=${this.espectaculoId}&sessionId=${this.sessionId}`)
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
        this.entradasSeleccionadas = [...this.entradasSeleccionadas, ent];
        this.mensajeError = '';
        this.cdRef.markForCheck();
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
        let match = this.entradas.find(e => e.id === ent.id);
        if (match) match.estado = 'DISPONIBLE';

        this.entradasSeleccionadas = this.entradasSeleccionadas.filter(e => e.id !== ent.id);

        this.mensajeError = '';
        this.cdRef.markForCheck();
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
        console.log("PAGO: Iniciar pago OK", res);
        this.totalCentimos = res.totalCentimos || 0;
        this.mostrarFormularioPago = true;
        this.mensajeError = '';
        this.errorTarjeta = ''; 
        this.cdRef.markForCheck();
        this.cdRef.detectChanges();
      },
      error: (err) => {
        console.error("PAGO: Error en iniciarPago:", err);
        if (err.status === 403) {
          this.mensajeError = 'Tu sesión de reserva ha caducado. Por favor, selecciona las entradas de nuevo.';
        } else if (err.status === 401) {
          this.mensajeError = 'Tu sesión ha caducado. Por favor, inicia sesión de nuevo.';
        } else {
          this.mensajeError = `No se pudo iniciar el pago (${err.status}). Inténtalo de nuevo.`;
        }
        this.cdRef.detectChanges();
      }
    });
  }

  formatearNumeroTarjeta(event: any) {
    let val = event.target.value.replace(/\D/g, '').substring(0, 16);
    this.tarjetaNumero = val.replace(/(\d{4})(?=\d)/g, '$1 ');
  }

  formatearCaducidad(event: any) {
    let val = event.target.value.replace(/\D/g, '').substring(0, 4);
    if (val.length > 2) val = val.substring(0, 2) + '/' + val.substring(2);
    this.tarjetaCaducidad = val;
  }

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

  procesarPago() {
    if (!this.validarTarjeta()) return;

    this.procesandoPago = true;
    this.taquillaService.confirmarCompra(this.sessionId, this.userToken).subscribe({
      next: (res) => {
        // Si usó el saldo, se lo restamos en el backend de usuarios
        if (this.usarSaldo && this.saldoAAplicarEuros > 0) {
          const email = sessionStorage.getItem('esiusuarios_email');
          this.http.post(`${environment.esiusuariosUrl}/users/restarSaldo`, {
            email: email,
            cantidad: this.saldoAAplicarEuros
          }).subscribe({
            next: () => console.log('Monedero descontado'),
            error: (err) => console.error('Error al descontar monedero', err)
          });
        }

        this.compraCompletada = true;
        this.mostrarFormularioPago = false;
        this.compraCompletadaError = false;
        this.entradasSeleccionadas = [];
        this.mensajeError = '';
        this.procesandoPago = false;
        this.cdRef.detectChanges();
      },
      error: (err) => {
        console.error("Error en confirmarCompra:", err);
        this.errorTarjeta = 'Error al confirmar la compra. El servidor no responde o la reserva ha caducado.';
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

  volverAEspectaculos() {
    this.router.navigate(['/espectaculos']);
  }
}