/**
 * Pruebas unitarias de `AppComponent`.
 */

import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { Capacitor } from '@capacitor/core';
import { provideIonicAngular } from '@ionic/angular';

import { AppComponent } from './app.component';

describe('AppComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AppComponent],
      providers: [provideIonicAngular(), provideRouter([])],
    }).compileComponents();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('debe instanciar el componente raíz y montar ion-app junto a ion-router-outlet', () => {
    const fixture = TestBed.createComponent(AppComponent);
    fixture.detectChanges();

    expect(fixture.componentInstance).toBeTruthy();
    const hostElement = fixture.nativeElement as HTMLElement;
    expect(hostElement.querySelector('ion-app')).not.toBeNull();
    expect(hostElement.querySelector('ion-router-outlet')).not.toBeNull();
  });

  it('debe omitir la sincronización nativa de StatusBar en entorno web y limpiar recursos al destruirse', () => {
    const nativeSpy = vi.spyOn(Capacitor, 'isNativePlatform').mockReturnValue(false);

    const fixture = TestBed.createComponent(AppComponent);
    fixture.detectChanges();
    expect(nativeSpy).toHaveBeenCalled();

    expect(() => fixture.destroy()).not.toThrow();
  });
});
