import { Routes } from '@angular/router';

export const routes: Routes = [
  // "/" → cartelera de espectáculos (visible sin login)
  {
    path: '',
    loadComponent: () => import('./espectaculos/espectaculos').then(m => m.EspectaculosComponent)
  },
  // "/auth" → pantalla de login/registro (nueva ruta dedicada)
  {
    path: 'auth',
    loadComponent: () => import('./auth/auth').then(m => m.AuthComponent)
  },
  // "/compra/1" → pantalla de compra del espectáculo id=1
  {
    path: 'compra/:id',
    loadComponent: () => import('./compra/compra').then(m => m.CompraComponent)
  },
  // Ruta desconocida → inicio
  {
    path: '**',
    redirectTo: ''
  }
];