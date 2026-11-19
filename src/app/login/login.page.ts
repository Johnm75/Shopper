/**
 * Controlador de la pantalla de inicio de sesión JWT de "App Shoper".
 *
 * Responsabilidades principales:
 * - Formulario reactivo con `username`, `password` y rol inicial (`customer`
 *   | `seller`) gestionado mediante un `ion-segment`.
 * - Botones de autocompletado rápido que rellenan las credenciales
 *   demostrativas publicadas en `environment.demoCredentials`.
 * - Delegación de la autenticación en `JwtAuthenticationService.login()`:
 *   si la red falla, el servicio activa el token local `offline-fallback` y
 *   esta vista lo comunica con un aviso informativo (toast accesible).
 * - Navegación segura a `/tabs` tras el éxito, sanitizando `returnUrl` para
 *   prevenir redirecciones abiertas (SEC-001 / OWASP).
 *
 * ⚠️ AVISO DE SEGURIDAD (SEC-002): el token JWT es demostrativo, se almacena
 * en texto plano vía `@capacitor/preferences` (sin Keystore/Keychain) y la
 * app no solicita ni persiste PII financiera.
 *
 * @author John Fredy Marciales Morales
 * @date 2026-11-12
 * @phase SDD Fase 5B — Desarrollo de Vistas UI y Navegación (TASK-016)
 */

import { Component, inject, signal } from '@angular/core';
// Constructor de formularios reactivos y validadores estándar de Angular.
import { FormBuilder, Validators } from '@angular/forms';
// Router para la navegación programática y ActivatedRoute para leer `returnUrl`.
import { ActivatedRoute, Router } from '@angular/router';
// Contrato de ciclo de vida de Ionic: anuncio accesible al entrar a la vista.
import type { ViewDidEnter } from '@ionic/angular';
// Controlador de toasts: aviso no bloqueante cuando entra el modo offline.
import { ToastController } from '@ionic/angular';
// Registro explícito de iconos (obligatorio en builds standalone/bundled).
import { addIcons } from 'ionicons';
import {
  alertCircleOutline,
  briefcaseOutline,
  logInOutline,
  personOutline,
  shieldCheckmarkOutline,
  storefrontOutline,
  wifiOutline,
} from 'ionicons/icons';

// Servicio canónico de sesión JWT (login remoto + fallback offline).
import { JwtAuthenticationService } from '../services/auth-jwt.service';
// Código de error de dominio devuelto por el servicio al fallar la autenticación.
import type { AuthenticationErrorCode } from '../models/auth.model';
// Rol de usuario del dominio Shoper ('customer' | 'seller').
import type { UserRole } from '../models/shoper.model';
// Credenciales demostrativas y bandera de entorno para los atajos de login.
import { environment } from '../../environments/environment';
// Utilidad que sanitiza la ruta de retorno para evitar open-redirect.
import { sanitizePostLoginRedirectUrl } from '../utils/return-url.util';
// Utilidad que anuncia la vista a TalkBack/VoiceOver moviendo el foco al título.
import { announcePageNavigation } from '../utils/a11y-announce.util';

@Component({
  selector: 'app-login',
  templateUrl: 'login.page.html',
  styleUrls: ['login.page.scss'],
  // La app usa NgModule lazy-loading; la página se declara en `LoginPageModule`.
  standalone: false,
})
export class LoginPage implements ViewDidEnter {
  // Servicio de autenticación JWT con fallback offline integrado.
  private readonly authenticationService = inject(JwtAuthenticationService);
  // Constructor del formulario reactivo de credenciales.
  private readonly formBuilder = inject(FormBuilder);
  // Router para navegar a `/tabs` tras el inicio de sesión exitoso.
  private readonly router = inject(Router);
  // Ruta activa: permite leer el parámetro `returnUrl` inyectado por el guarda.
  private readonly activatedRoute = inject(ActivatedRoute);
  // Controlador de toasts para el aviso informativo de modo offline.
  private readonly toastController = inject(ToastController);

  /** Señal que bloquea el formulario mientras hay una petición en curso. */
  readonly isSubmittingCredentials = signal<boolean>(false);
  /** Señal que habilita los mensajes de validación tras el primer intento. */
  readonly hasAttemptedSubmit = signal<boolean>(false);
  /** Código de error normalizado devuelto por el servicio de autenticación. */
  readonly authenticationErrorCode = signal<AuthenticationErrorCode | null>(null);
  /** Mensaje de error legible mostrado en la región `role="alert"`. */
  readonly authenticationErrorMessage = signal<string | null>(null);

  /**
   * Credenciales demostrativas expuestas a la plantilla para los botones de
   * autocompletado rápido "Cliente" y "Vendedor" (nunca usar en producción).
   */
  readonly demoCredentials = environment.demoCredentials;

  /**
   * Formulario reactivo tipado y no nulo:
   * - `username`: obligatorio (DummyJSON exige usuario existente).
   * - `password`: obligatorio con longitud mínima de 4 caracteres.
   * - `role`: rol inicial sincronizado con el `ion-segment` de la vista.
   */
  readonly credentialsForm = this.formBuilder.nonNullable.group({
    username: ['', [Validators.required, Validators.minLength(3)]],
    password: ['', [Validators.required, Validators.minLength(4)]],
    role: this.formBuilder.nonNullable.control<UserRole>('customer'),
  });

  /**
   * Registra únicamente los iconos utilizados por esta vista para no inflar
   * el bundle con la colección completa de Ionicons.
   */
  constructor() {
    addIcons({
      alertCircleOutline,
      briefcaseOutline,
      logInOutline,
      personOutline,
      shieldCheckmarkOutline,
      storefrontOutline,
      wifiOutline,
    });
  }

  /**
   * Ciclo de vida Ionic: al terminar la transición de entrada, anuncia la
   * vista al lector de pantalla y ubica el foco en el encabezado principal.
   */
  ionViewDidEnter(): void {
    announcePageNavigation('Iniciar sesión — App Shoper', 'login-title');
  }

  /**
   * Autocompleta el formulario con las credenciales demostrativas del rol
   * pulsado y sincroniza el `ion-segment` con ese mismo rol.
   *
   * @param role Rol elegido mediante los botones rápidos ("Cliente"/"Vendedor").
   */
  fillDemoCredentials(role: UserRole): void {
    // Selecciona el par de credenciales publicado en `environment.demoCredentials`.
    const credentials = this.demoCredentials[role];

    // Rellena los tres controles de una sola vez (formulario no nulo).
    this.credentialsForm.setValue({
      username: credentials.username,
      password: credentials.password,
      role,
    });

    // Limpia errores previos: el autocompletado siempre introduce datos válidos.
    this.authenticationErrorCode.set(null);
    this.authenticationErrorMessage.set(null);
  }

  /**
   * Valida el formulario, autentica contra DummyJSON (o activa el fallback
   * offline) y navega a la ruta interna sanitizada tras el éxito.
   */
  async submitLoginForm(): Promise<void> {
    // Evita dobles envíos cuando ya existe una petición en vuelo.
    if (this.isSubmittingCredentials()) {
      return;
    }

    this.hasAttemptedSubmit.set(true);
    if (this.credentialsForm.invalid) {
      // Marca todos los controles para que la UI muestre los errores de validación.
      this.credentialsForm.markAllAsTouched();
      return;
    }

    this.isSubmittingCredentials.set(true);
    this.authenticationErrorCode.set(null);
    this.authenticationErrorMessage.set(null);

    try {
      // El servicio intenta el login remoto; si la red falla, genera el token
      // local `offline-fallback` y devuelve igualmente un registro de sesión.
      const sessionRecord = await this.authenticationService.login(
        this.credentialsForm.getRawValue()
      );

      // Si la sesión proviene del modo offline, informa al usuario antes de
      // navegar: la app funciona con datos locales deterministas (PAT-002).
      if (sessionRecord.source === 'offline-fallback') {
        await this.presentOfflineFallbackToast();
      }

      // Sanitiza `returnUrl` (previene open-redirect) y reemplaza la entrada
      // del historial para que "atrás" no devuelva al formulario de login.
      const requestedReturnUrl = this.activatedRoute.snapshot.queryParamMap.get('returnUrl');
      const safeTargetUrl = sanitizePostLoginRedirectUrl(requestedReturnUrl);
      await this.router.navigateByUrl(safeTargetUrl, { replaceUrl: true });
    } catch (authError) {
      // El servicio lanza códigos de dominio ('invalid_credentials', etc.).
      const normalizedErrorCode: AuthenticationErrorCode =
        typeof authError === 'string'
          ? (authError as AuthenticationErrorCode)
          : 'unexpected_error';

      this.authenticationErrorCode.set(normalizedErrorCode);
      this.authenticationErrorMessage.set(this.mapErrorCodeToUserMessage(normalizedErrorCode));
    } finally {
      // Libera el bloqueo del formulario tanto en éxito como en error.
      this.isSubmittingCredentials.set(false);
    }
  }

  /**
   * Devuelve el texto de error de un campo solo tras la interacción del
   * usuario o un intento de envío (evita ruido visual al abrir la vista).
   *
   * @param fieldName Nombre del control consultado ('username' | 'password').
   */
  getFieldValidationMessage(fieldName: 'username' | 'password'): string | undefined {
    const control = this.credentialsForm.controls[fieldName];
    if (control.valid || !(control.touched || this.hasAttemptedSubmit())) {
      return undefined;
    }

    // Mensajes específicos por regla de validación incumplida.
    if (control.hasError('required')) {
      return fieldName === 'username'
        ? 'El nombre de usuario es obligatorio.'
        : 'La contraseña es obligatoria.';
    }
    if (control.hasError('minlength')) {
      return fieldName === 'username'
        ? 'El usuario debe tener al menos 3 caracteres.'
        : 'La contraseña debe tener al menos 4 caracteres.';
    }
    return 'Revisa el valor introducido.';
  }

  /**
   * Presenta un toast informativo cuando el login se resolvió con el token
   * local de contingencia porque la API remota no está alcanzable.
   */
  private async presentOfflineFallbackToast(): Promise<void> {
    const toast = await this.toastController.create({
      message: 'Sin conexión con la API: sesión iniciada en modo offline con token demostrativo local.',
      duration: 4000,
      position: 'top',
      color: 'warning',
      icon: 'wifi-outline',
      // El toast se anuncia solo; `aria-label` refuerza el contexto en TalkBack.
      htmlAttributes: { 'aria-label': 'Aviso de modo offline activado' },
    });
    await toast.present();
  }

  /**
   * Convierte el código interno de fallo de autenticación en un mensaje
   * claro y accionable para el usuario final.
   *
   * @param errorCode Código de dominio devuelto por el servicio JWT.
   */
  private mapErrorCodeToUserMessage(errorCode: AuthenticationErrorCode): string {
    switch (errorCode) {
      case 'invalid_credentials':
        return 'Usuario o contraseña incorrectos. Usa los botones de autocompletado rápido con las credenciales demostrativas.';
      case 'network_error':
        return 'No se pudo contactar con el servidor. El modo offline se activará automáticamente si la red sigue caída.';
      case 'token_expired':
        return 'La sesión ha caducado. Inicia sesión de nuevo.';
      default:
        return 'Ocurrió un error inesperado al iniciar sesión.';
    }
  }
}
