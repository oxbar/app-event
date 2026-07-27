import {registerLocaleData} from '@angular/common';
import localePt from '@angular/common/locales/pt';
import {provideHttpClient, withInterceptors} from '@angular/common/http';
import {isDevMode, LOCALE_ID} from '@angular/core';
import {bootstrapApplication} from '@angular/platform-browser';
import {provideAnimations} from '@angular/platform-browser/animations';
import {provideRouter, withComponentInputBinding} from '@angular/router';
import {provideServiceWorker} from '@angular/service-worker';
import {provideTaiga} from '@taiga-ui/core';
import {AppComponent} from './app/app.component';
import {routes} from './app/app.routes';
import {authInterceptor} from './app/core/http';

registerLocaleData(localePt, 'pt-BR');

const localHostnames = new Set(['localhost', '127.0.0.1']);
const serviceWorkerEnabled = !isDevMode() && !localHostnames.has(window.location.hostname);

bootstrapApplication(AppComponent, {
  providers: [
    provideTaiga(),
    provideRouter(routes, withComponentInputBinding()),
    provideHttpClient(withInterceptors([authInterceptor])),
    provideAnimations(),
    provideServiceWorker('ngsw-worker.js', {
      enabled: serviceWorkerEnabled,
      registrationStrategy: 'registerWhenStable:30000',
    }),
    {provide: LOCALE_ID, useValue: 'pt-BR'},
  ],
}).catch(error => console.error('Falha ao iniciar a aplicação:', error));
