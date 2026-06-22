import { Component, OnInit } from '@angular/core';
import { RouterOutlet, Router, NavigationEnd } from '@angular/router';
import { CommonModule } from '@angular/common';
import { filter } from 'rxjs/operators';
import { TaquillaService } from './services/taquilla.service';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, CommonModule, FormsModule],
  templateUrl: './app.html',
  styleUrl: './app.css'
})
export class App implements OnInit {

  mostrarFormBaja: boolean = false;
  passConfirmacion: string = '';
  mostrarPwdBaja: boolean = false; 

  estaLogeado: boolean = false;
  emailUsuario: string = '';

  // NUEVO: Variable para guardar los euros
  saldoMonedero: number = 0;

  mostrarNavbar: boolean = true;

  constructor(
    public router: Router,
    private taquillaService: TaquillaService
  ) {}

  ngOnInit() {
    this.actualizarEstadoLogin();

    this.router.events
      .pipe(filter(e => e instanceof NavigationEnd))
      .subscribe((e: any) => {
        this.actualizarEstadoLogin();
        this.mostrarNavbar = !e.urlAfterRedirects.startsWith('/auth');
      });
  }

  actualizarEstadoLogin() {
    if (typeof window !== 'undefined' && window.sessionStorage) {
      const token = sessionStorage.getItem('esiusuarios_token');
      const email = sessionStorage.getItem('esiusuarios_email');
      this.estaLogeado = !!token;
      this.emailUsuario = email || '';

      // NUEVO: Si está logueado, pedimos el saldo
      if (this.estaLogeado && token) {
        this.taquillaService.obtenerSaldoMonedero(token).subscribe({
          next: (saldo) => {
            this.saldoMonedero = saldo;
          },
          error: (err) => console.error('Error al obtener el saldo', err)
        });
      } else {
        this.saldoMonedero = 0;
      }
    }
  }

  get nombreCorto(): string {
    return this.emailUsuario.split('@')[0] || 'Usuario';
  }

  irAlLogin() {
    this.router.navigate(['/auth']);
  }

  irAlRegistro() {
    sessionStorage.setItem('auth_pantalla', 'registro');
    this.router.navigate(['/auth']);
  }

  cerrarSesion() {
    const token = sessionStorage.getItem('esiusuarios_token');
    if (token) {
      this.taquillaService.logoutEsiusuarios(token).subscribe({
        next: () => console.log('Sesión cerrada en el servidor'),
        error: (err) => console.error('Error cerrando sesión en servidor', err)
      });
    }

    sessionStorage.removeItem('esiusuarios_token');
    sessionStorage.removeItem('esiusuarios_email');
    this.estaLogeado = false;
    this.emailUsuario = '';
    this.saldoMonedero = 0; // NUEVO: Reseteamos el dinero
    this.router.navigate(['/']);
  }

  ejecutarBaja() {
    if (!this.passConfirmacion) {
      alert('Debes introducir la contraseña para confirmar la baja.');
      return;
    }

    if (confirm('¿Estás seguro de que quieres cancelar tu cuenta? Esta acción no se puede deshacer.')) {
      this.taquillaService.cancelarCuenta(this.emailUsuario, this.passConfirmacion).subscribe({
        next: () => {
          alert('Cuenta cancelada correctamente.');
          this.mostrarFormBaja = false;
          this.passConfirmacion = '';
          this.cerrarSesion();
        },
        error: (err) => {
          alert('Error: ' + (err.error || 'Contraseña incorrecta'));
        }
      });
    }
  }
}