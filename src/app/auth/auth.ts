import { Component, OnInit, ChangeDetectorRef, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { TaquillaService } from '../services/taquilla.service';
import { environment } from '../environments/environment';

type Pantalla = 'login' | 'registro' | 'recuperar' | 'codigoRecuperacion';

@Component({
  selector: 'app-auth',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './auth.html',
  styleUrls: ['./auth.css']
})
export class AuthComponent implements OnInit, OnDestroy {

  // Pantalla activa ('login' al arrancar)
  pantalla: Pantalla = 'login';

  // ── Campos del formulario de LOGIN ──
  loginEmail: string = '';
  loginPwd: string = '';

  // ── Campos del formulario de REGISTRO ──
  regNombre: string = '';
  regEmail: string = '';
  regPwd: string = '';
  regPwdConfirm: string = '';

  // ── Campo de RECUPERACIÓN ──
  recEmail: string = '';
  recCodigo: string = '';
  recNuevaPassword: string = '';
  recNuevaPasswordConfirm: string = ''; 

  // Mensajes de estado
  mensajeExito: string = '';
  mensajeError: string = '';
  cargando: boolean = false;

  // Control de visibilidad de contraseñas
  mostrarLoginPwd: boolean = false;
  mostrarRegPwd: boolean = false;
  mostrarRegPwdConfirm: boolean = false;
  mostrarRecPwd: boolean = false;
  mostrarRecPwdConfirm: boolean = false; 

  // Mensajes de validación del email
  errorEmail: string = '';

  // Estado de cada requisito de la contraseña
  pwdTieneMinimo: boolean = false;      
  pwdTieneMayuscula: boolean = false;   
  pwdTieneMinuscula: boolean = false;   
  pwdTieneEspecial: boolean = false;    
  
  // Mantenimiento de cola
  private keepAliveTimer: any = null;
  private sessionId: string = '';

  constructor(
    private taquillaService: TaquillaService,
    private router: Router,
    private route: ActivatedRoute,
    private cdr: ChangeDetectorRef,
    private http: HttpClient
  ) { }

  ngOnInit() {
    const tokenExistente = sessionStorage.getItem('esiusuarios_token');
    if (tokenExistente) {
      const returnUrl = sessionStorage.getItem('auth_returnUrl') || '/';
      sessionStorage.removeItem('auth_returnUrl');
      this.router.navigateByUrl(returnUrl);
      return;
    }

    const pantalla = sessionStorage.getItem('auth_pantalla');
    if (pantalla === 'registro') {
      this.pantalla = 'registro';
      sessionStorage.removeItem('auth_pantalla');
    }

    if (typeof window !== 'undefined' && window.sessionStorage) {
      this.sessionId = sessionStorage.getItem('taquilla_sessionId') || '';
      if (this.sessionId) {
        this.keepAliveTimer = setInterval(() => {
          this.http.get(`${environment.apiUrl}/compras/check?sessionId=${this.sessionId}`).subscribe();
        }, 10000);
      }
    }
  }

  ngOnDestroy() {
    if (this.keepAliveTimer) {
      clearInterval(this.keepAliveTimer);
    }
  }

  mostrar(pantalla: Pantalla) {
    this.pantalla = pantalla;
    this.mensajeError = '';
    this.mensajeExito = '';
    this.errorEmail = '';
  }

  validarEmail(email: string): boolean {
    if (!email) {
      this.errorEmail = '';
      return false;
    }
    if (!email.includes('@')) {
      this.errorEmail = 'El email debe contener @';
      return false;
    }
    const partesDespuesArroba = email.split('@');
    const dominio = partesDespuesArroba[partesDespuesArroba.length - 1];
    if (!dominio.includes('.')) {
      this.errorEmail = 'El dominio debe contener un punto (ej: .com, .es)';
      return false;
    }
    if (dominio.endsWith('.')) {
      this.errorEmail = 'El email no puede terminar en punto';
      return false;
    }
    this.errorEmail = '';
    return true;
  }

  validarPassword(pwd: string) {
    this.pwdTieneMinimo = pwd.length >= 8;
    this.pwdTieneMayuscula = /[A-ZÁÉÍÓÚÜÑ]/.test(pwd);
    this.pwdTieneMinuscula = /[a-záéíóúüñ]/.test(pwd);
    this.pwdTieneEspecial = /[\d!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?`~]/.test(pwd);
  }

  get passwordCompleta(): boolean {
    return this.pwdTieneMinimo && this.pwdTieneMayuscula &&
      this.pwdTieneMinuscula && this.pwdTieneEspecial;
  }

  iniciarSesion() {
    if (!this.loginEmail || !this.loginPwd) {
      this.mensajeError = 'Por favor, rellena el email y la contraseña.';
      return;
    }
    this.cargando = true;
    this.mensajeError = '';

    this.taquillaService.loginEsiusuarios(this.loginEmail, this.loginPwd).subscribe({
      next: (token) => {
        sessionStorage.setItem('esiusuarios_token', token);
        sessionStorage.setItem('esiusuarios_email', this.loginEmail);
        this.cargando = false;
        const returnUrl = sessionStorage.getItem('auth_returnUrl') || '/';
        sessionStorage.removeItem('auth_returnUrl');
        this.router.navigateByUrl(returnUrl);
      },
      error: (err) => {
        setTimeout(() => {
          this.cargando = false;
          console.log('Error capturado:', err);

          if (err.status === 401) {
            this.mensajeError = 'Email o contraseña incorrectos.';
          } else if (err.status === 403) {
            this.mensajeExito = 'Si el email existe, recibirás un código en tu bandeja de entrada.';
            this.loginPwd = ''; 
          } else if (err.status === 0) {
            this.mensajeError = 'Servidor de usuarios no disponible (8081).';
          } else {
            this.mensajeError = 'Error de conexión: ' + (err.statusText || 'Desconocido');
          }

          this.cdr.detectChanges();
        }, 0);
      }
    });
  }

  registrarse() {
    if (!this.regNombre || !this.regEmail || !this.regPwd) {
      this.mensajeError = 'Por favor, rellena todos los campos.';
      return;
    }
    if (this.regPwd !== this.regPwdConfirm) {
      this.mensajeError = 'Las contraseñas no coinciden.';
      return;
    }
    if (!this.passwordCompleta) {
      this.mensajeError = 'La contraseña no cumple con los requisitos de seguridad.';
      return;
    }

    this.cargando = true;
    this.mensajeError = '';

    const finalizarRegistro = () => {
      this.cargando = false;
      this.pantalla = 'login';
      this.mensajeExito = `Se ha enviado un correo de confirmación a ${this.regEmail}.`;
      
      this.regNombre = '';
      this.regEmail = '';
      this.regPwd = '';
      this.regPwdConfirm = '';
      this.cdr.detectChanges();
    };

    this.taquillaService.registerEsiusuarios(this.regEmail, this.regPwd, this.regNombre).subscribe({
      next: () => {
        finalizarRegistro();
      },
      error: (err) => {
        console.error("Error en registro:", err);
        if (err.status === 0) {
          this.cargando = false;
          this.mensajeError = 'No se pudo contactar con el servidor. Inténtalo más tarde.';
          this.cdr.detectChanges();
        } else {
          finalizarRegistro();
        }
      }
    });
  }

  pedirCodigo() {
    if (!this.recEmail) {
      this.mensajeError = 'Introduce tu email.';
      return;
    }
    this.cargando = true;
    this.mensajeError = '';

    this.taquillaService.recuperarPassword(this.recEmail).subscribe({
      next: () => {
        this.cargando = false;
        this.mensajeExito = 'Si el email existe, recibirás un código en tu bandeja de entrada.';
        this.pantalla = 'codigoRecuperacion';
        this.cdr.detectChanges();
      },
      error: () => {
        this.cargando = false;
        this.mensajeExito = 'Si el email existe, recibirás un código en tu bandeja de entrada.';
        this.pantalla = 'codigoRecuperacion';
        this.cdr.detectChanges();
      }
    });
  }

  restablecerPassword() {
    if (!this.recCodigo || !this.recNuevaPassword || !this.recNuevaPasswordConfirm) {
      this.mensajeError = 'Por favor, rellena todos los campos.';
      return;
    }

    if (this.recNuevaPassword !== this.recNuevaPasswordConfirm) {
      this.mensajeError = 'Las contraseñas no coinciden.';
      return;
    }

    if (!this.passwordCompleta) {
      this.mensajeError = 'La contraseña no cumple con los requisitos de seguridad.';
      return;
    }

    this.cargando = true;
    this.mensajeError = '';
    this.mensajeExito = '';
    console.log("Enviando petición para restablecer contraseña...");

    this.taquillaService.restablecerPassword(this.recCodigo, this.recNuevaPassword).subscribe({
      next: (res) => {
        console.log("PAGO: Restablecer OK", res);
        this.cargando = false;
        this.mensajeExito = '✅ Contraseña actualizada correctamente. Ya puedes iniciar sesión.';
        this.cdr.detectChanges();
        
        setTimeout(() => {
          this.mostrar('login');
          this.cdr.detectChanges();
        }, 2500);
      },
      error: (err) => {
        this.cargando = false;
        console.error("Error en restablecerPassword:", err);
        
        if (err.error && typeof err.error === 'string') {
          this.mensajeError = err.error;
        } else {
          this.mensajeError = 'El código es incorrecto o ha caducado. Inténtalo de nuevo.';
        }
        
        this.cdr.detectChanges();
      }
    });
  }
}