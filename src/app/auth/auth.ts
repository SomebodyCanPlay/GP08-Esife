import { Component, OnInit, ChangeDetectorRef, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { TaquillaService } from '../services/taquilla.service';

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
  recNuevaPasswordConfirm: string = ''; // Campo para repetir contraseña


  // Mensajes de estado
  mensajeExito: string = '';
  mensajeError: string = '';
  cargando: boolean = false;

  // Control de visibilidad de contraseñas (el "ojo")
  mostrarLoginPwd: boolean = false;
  mostrarRegPwd: boolean = false;
  mostrarRegPwdConfirm: boolean = false;
  mostrarRecPwd: boolean = false;
  mostrarRecPwdConfirm: boolean = false; // "Ojo" para el campo de repetición


  // Mensajes de validación del email (en tiempo real)
  errorEmail: string = '';

  // Estado de cada requisito de la contraseña (para la checklist visual)
  pwdTieneMinimo: boolean = false;      // Al menos 8 caracteres
  pwdTieneMayuscula: boolean = false;   // Al menos una letra mayúscula (A-Z)
  pwdTieneMinuscula: boolean = false;   // Al menos una letra minúscula (a-z)
  pwdTieneEspecial: boolean = false;    // Al menos un número o carácter especial (!@#...)
  
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
    // Si ya hay sesión activa → saltar el login directamente
    const tokenExistente = sessionStorage.getItem('esiusuarios_token');
    if (tokenExistente) {
      const returnUrl = sessionStorage.getItem('auth_returnUrl') || '/';
      sessionStorage.removeItem('auth_returnUrl');
      this.router.navigateByUrl(returnUrl);
      return;
    }

    // Si venimos del botón "Registrarse" del navbar → abrir ese formulario directamente
    const pantalla = sessionStorage.getItem('auth_pantalla');
    if (pantalla === 'registro') {
      this.pantalla = 'registro';
      sessionStorage.removeItem('auth_pantalla');
    }

    // Mantenemos viva la sesión de la cola mientras el usuario se loguea
    if (typeof window !== 'undefined' && window.sessionStorage) {
      this.sessionId = sessionStorage.getItem('taquilla_sessionId') || '';
      if (this.sessionId) {
        this.keepAliveTimer = setInterval(() => {
          this.http.get(`http://localhost:8080/compras/check?sessionId=${this.sessionId}`).subscribe();
        }, 10000);
      }
    }
  }

  ngOnDestroy() {
    if (this.keepAliveTimer) {
      clearInterval(this.keepAliveTimer);
    }
  }

  // Cambia la pantalla visible y limpia los mensajes
  mostrar(pantalla: Pantalla) {
    this.pantalla = pantalla;
    this.mensajeError = '';
    this.mensajeExito = '';
    this.errorEmail = '';
  }

  // Valida el formato del email mientras el usuario escribe
  // Comprueba que tenga @ y al menos un punto después del @
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

  // Actualiza los 4 indicadores de la checklist de contraseña mientras el usuario escribe
  // Se llama con (input)="validarPassword(regPwd)" en el HTML
  validarPassword(pwd: string) {
    // Mínimo 6 caracteres
    this.pwdTieneMinimo = pwd.length >= 6;
    // Al menos una mayúscula: cualquier letra de A a Z (incluyendo acentuadas)
    this.pwdTieneMayuscula = /[A-ZÁÉÍÓÚÜÑ]/.test(pwd);
    // Al menos una minúscula
    this.pwdTieneMinuscula = /[a-záéíóúüñ]/.test(pwd);
    // Al menos un número O un carácter especial (!@#$%^&*...)
    this.pwdTieneEspecial = /[\d!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?`~]/.test(pwd);
  }

  // Comprueba si la contraseña cumple TODOS los requisitos
  // Se usa antes de llamar al servidor para registrarse
  get passwordCompleta(): boolean {
    return this.pwdTieneMinimo && this.pwdTieneMayuscula &&
      this.pwdTieneMinuscula && this.pwdTieneEspecial;
  }

  // ============================================================
  // INICIAR SESIÓN
  // ============================================================
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
        // Usamos setTimeout para asegurar que Angular se entera del cambio
        setTimeout(() => {
          this.cargando = false;
          console.log('Error capturado:', err);

          if (err.status === 401) {
            this.mensajeError = 'Email o contraseña incorrectos.';
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

  // ============================================================
  // REGISTRARSE
  // ============================================================
  registrarse() {
    if (!this.regNombre || !this.regEmail || !this.regPwd) {
      this.mensajeError = 'Por favor, rellena todos los campos.';
      return;
    }
    if (this.regPwd !== this.regPwdConfirm) {
      this.mensajeError = 'Las contraseñas no coinciden.';
      return;
    }
    if (this.regPwd.length < 6) {
      this.mensajeError = 'La contraseña debe tener al menos 6 caracteres.';
      return;
    }

    this.cargando = true;
    this.mensajeError = '';

    this.taquillaService.registerEsiusuarios(this.regEmail, this.regPwd, this.regNombre).subscribe({
      next: () => {
        // Registro ok → hacemos login automático para no molestar al usuario
        this.taquillaService.loginEsiusuarios(this.regEmail, this.regPwd).subscribe({
          next: (token) => {
            sessionStorage.setItem('esiusuarios_token', token);
            sessionStorage.setItem('esiusuarios_email', this.regEmail);
            this.cargando = false;
            this.router.navigate(['/espectaculos']);
          },
          error: () => {
            // Registro bien pero login falló → mandamos al login
            this.cargando = false;
            this.mensajeExito = '✅ Cuenta creada. Inicia sesión con tus credenciales.';
            this.pantalla = 'login';
          }
        });
      },
      error: (err) => {
        this.cargando = false;
        console.error("Error en registro:", err);
        
        // El backend de esiusuarios suele mandar el texto del error en err.error
        // Si es un conflicto (409) o un error de datos (400), sacamos el mensaje
        if (err.error && typeof err.error === 'string') {
          this.mensajeError = err.error;
        } else if (err.error && err.error.message) {
          this.mensajeError = err.error.message;
        } else if (err.status === 409) {
          this.mensajeError = 'Este email ya está registrado. Intenta iniciar sesión.';
        } else {
          this.mensajeError = 'No se pudo crear la cuenta. Revisa los datos o inténtalo más tarde.';
        }
        
        this.cdr.detectChanges();
      }
    });
  }

  // ============================================================
  // RECUPERAR CONTRASEÑA — Paso 1: pedir el código por email
  // ============================================================
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
        this.mensajeExito = '📧 Si el email existe, recibirás un código en tu bandeja de entrada.';
        // Pasamos al formulario del código
        this.pantalla = 'codigoRecuperacion';
        this.cdr.detectChanges();
      },
      error: () => {
        this.cargando = false;
        // Mostramos el mismo mensaje (no revelamos si el email existe)
        this.mensajeExito = '📧 Si el email existe, recibirás un código en tu bandeja de entrada.';
        this.pantalla = 'codigoRecuperacion';
        this.cdr.detectChanges();
      }
    });
  }

  // ============================================================
  // RECUPERAR CONTRASEÑA — Paso 2: usar el código para cambiar contraseña
  // ============================================================
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
        
        // Esperamos 2 segundos para que el usuario vea el mensaje y volvemos al login
        setTimeout(() => {
          this.mostrar('login');
          this.cdr.detectChanges();
        }, 2500);
      },
      error: (err) => {
        this.cargando = false;
        console.error("Error en restablecerPassword:", err);
        
        // Intentamos sacar el mensaje de error del servidor
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
