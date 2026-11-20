/**
 * Componente contenedor raíz de "App Shoper".
 *
 * Sincroniza dinámicamente el estilo y color de la barra de estado nativa
 * (`@capacitor/status-bar`) con el tema claro u oscuro del sistema.
 */

import { Component, OnDestroy, OnInit } from '@angular/core';
import { Capacitor } from '@capacitor/core';
import { StatusBar, Style } from '@capacitor/status-bar';
import { IonApp, IonRouterOutlet } from '@ionic/angular';

/**
 * Aloja el árbol de navegación principal e inicializa la barra de estado nativa.
 */
@Component({
  selector: 'app-root',
  standalone: true,
  imports: [IonApp, IonRouterOutlet],
  templateUrl: 'app.component.html',
  styleUrls: ['app.component.scss'],
})
export class AppComponent implements OnInit, OnDestroy {
  private darkModeQuery: MediaQueryList | null = null;
  private readonly handleThemeChange = (event: MediaQueryListEvent): void => {
    void this.syncNativeStatusBar(event.matches);
  };

  /**
   * Configura la barra de estado nativa y escucha cambios del tema del sistema.
   */
  ngOnInit(): void {
    if (!Capacitor.isNativePlatform()) {
      return;
    }

    if (typeof window !== 'undefined' && typeof window.matchMedia === 'function') {
      this.darkModeQuery = window.matchMedia('(prefers-color-scheme: dark)');
      void this.syncNativeStatusBar(this.darkModeQuery.matches);
      this.darkModeQuery.addEventListener('change', this.handleThemeChange);
      return;
    }

    void this.syncNativeStatusBar(false);
  }

  /**
   * Libera el oyente del tema del sistema al destruir el componente raíz.
   */
  ngOnDestroy(): void {
    this.darkModeQuery?.removeEventListener('change', this.handleThemeChange);
    this.darkModeQuery = null;
  }

  /**
   * Aplica estilo de iconos, color de fondo y no superposición al StatusBar nativo.
   *
   * @param isDarkMode Indica si el dispositivo opera en modo oscuro.
   */
  private async syncNativeStatusBar(isDarkMode: boolean): Promise<void> {
    try {
      await StatusBar.setOverlaysWebView({ overlay: false });
      await StatusBar.setStyle({ style: isDarkMode ? Style.Dark : Style.Light });
      await StatusBar.setBackgroundColor({ color: isDarkMode ? '#0b1220' : '#eef2f9' });
    } catch {
      // Ignora fallos en plataformas sin implementación nativa del plugin.
    }
  }
}
