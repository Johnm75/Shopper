/**
 * Actividad principal de Android para App Shoper.
 * Extiende BridgeActivity de Capacitor para hospedar la aplicación web híbrida
 * y exponer el puente nativo hacia los plugins de Capacitor.
 *
 * @author John Fredy Marciales Morales
 * @date 2026-11-13
 * @phase Fase 8 SDD — Release Nativo Android
 */

// Declaración del paquete; debe coincidir con applicationId y namespace en build.gradle.
package com.abp.appshoper;

// Importa la actividad puente de Capacitor que carga el WebView y el runtime nativo.
import com.getcapacitor.BridgeActivity;

/**
 * Actividad raíz que Capacitor utiliza como punto de entrada de la app híbrida.
 * No requiere lógica adicional porque BridgeActivity gestiona el ciclo de vida
 * del WebView y la comunicación con los plugins.
 */
public class MainActivity extends BridgeActivity {}
