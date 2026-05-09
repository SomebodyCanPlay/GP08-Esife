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

  // Variables para el formulario de baja
  mostrarFormBaja: boolean = false;
  passConfirmacion: string = '';
  mostrarPwdBaja: boolean = false; // "Ojo" para la contraseña de baja


  // ¿Está el usuario logeado? Lo sabemos mirando el sessionStorage
  estaLogeado: boolean = false;
  emailUsuario: string = '';

  // Ocultamos la navbar en la pantalla de auth para que no quede raro
  mostrarNavbar: boolean = true;

  constructor(
    public router: Router,
    private taquillaService: TaquillaService
  ) {}

  ngOnInit() {
    this.actualizarEstadoLogin();

    // Cada vez que el usuario navega a otra página, actualizamos el estado
    this.router.events
      .pipe(filter(e => e instanceof NavigationEnd))
      .subscribe((e: any) => {
        this.actualizarEstadoLogin();
        // En la página de auth no mostramos la navbar (ya tiene su propio diseño)
        this.mostrarNavbar = !e.urlAfterRedirects.startsWith('/auth');
      });
  }

  actualizarEstadoLogin() {
    if (typeof window !== 'undefined' && window.sessionStorage) {
      const token = sessionStorage.getItem('esiusuarios_token');
      const email = sessionStorage.getItem('esiusuarios_email');
      this.estaLogeado = !!token;
      this.emailUsuario = email || '';
    }
  }

  // Nombre corto para mostrar en la navbar (solo la parte antes del @)
  get nombreCorto(): string {
    return this.emailUsuario.split('@')[0] || 'Usuario';
  }

  irAlLogin() {
    this.router.navigate(['/auth']);
  }

  irAlRegistro() {
    // Guardamos en sessionStorage que queremos abrir el formulario de registro
    sessionStorage.setItem('auth_pantalla', 'registro');
    this.router.navigate(['/auth']);
  }

  cerrarSesion() {
    const token = sessionStorage.getItem('esiusuarios_token');
    if (token) {
      // Avisamos al backend para que invalide el token en la BD
      this.taquillaService.logoutEsiusuarios(token).subscribe({
        next: () => console.log('Sesión cerrada en el servidor'),
        error: (err) => console.error('Error cerrando sesión en servidor', err)
      });
    }

    // Limpiamos el navegador
    sessionStorage.removeItem('esiusuarios_token');
    sessionStorage.removeItem('esiusuarios_email');
    this.estaLogeado = false;
    this.emailUsuario = '';
    this.router.navigate(['/']);
  }

  // Nueva función para dar de baja al usuario
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
