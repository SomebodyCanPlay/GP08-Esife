import { Routes } from '@angular/router';

export const routes: Routes = [
  // Cuando entres a "localhost:4200/", cargará la pantalla de espectáculos
  { 
    path: '', 
    loadComponent: () => import('./espectaculos/espectaculos').then(m => m.EspectaculosComponent) 
  },
  // Cuando entres a "localhost:4200/compra", cargará la de compra
  { 
    path: 'compra', 
    loadComponent: () => import('./compra/compra').then(m => m.CompraComponent) 
  },
  // Si alguien escribe una ruta que no existe, lo devuelve al inicio
  { 
    path: '**', 
    redirectTo: '' 
  }
];