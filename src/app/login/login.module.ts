/**
 * Módulo de la pantalla de inicio de sesión de "App Shoper".
 *
 * Declara `LoginPage` y registra únicamente los custom elements de Ionic 9
 * empleados por la vista (formulario, segmento de rol y feedback) para
 * mantener el bundle perezoso lo más pequeño posible.
 *
 * @author John Fredy Marciales Morales
 * @date 2026-11-12
 * @phase SDD Fase 5B — Desarrollo de Vistas UI y Navegación (TASK-016)
 */

import { NgModule } from '@angular/core';
// Directivas estructurales base (ngIf/ngFor no se usan directamente: la
// plantilla emplea la sintaxis moderna @if/@for del compilador de Angular).
import { CommonModule } from '@angular/common';
// Infraestructura de formularios reactivos ([formGroup], formControlName).
import { ReactiveFormsModule } from '@angular/forms';
// Custom elements de Ionic usados en la plantilla de login.
import {
  IonButton,
  IonContent,
  IonIcon,
  IonInput,
  IonInputPasswordToggle,
  IonLabel,
  IonSegment,
  IonSegmentButton,
  IonSpinner,
} from '@ionic/angular';

// Página de autenticación declarada por este módulo perezoso.
import { LoginPage } from './login.page';
// Rutas hijas que vinculan `/login` con `LoginPage`.
import { LoginPageRoutingModule } from './login-routing.module';

// Ensambla el módulo: CommonModule + ReactiveFormsModule + controles Ionic
// (contenido, campos, segmento de rol, botones, iconos y spinner de envío).
@NgModule({
  imports: [
    CommonModule,
    ReactiveFormsModule,
    LoginPageRoutingModule,
    IonContent,
    IonInput,
    IonInputPasswordToggle,
    IonSegment,
    IonSegmentButton,
    IonLabel,
    IonButton,
    IonIcon,
    IonSpinner,
  ],
  declarations: [LoginPage],
})
export class LoginPageModule {}
