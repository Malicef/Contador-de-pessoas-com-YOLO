import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./features/home/home')
        .then(m => m.Home)
  },
  {
    path: 'live',
    loadComponent: () =>
      import('./features/live-counter/live-counter')
        .then(m => m.LiveCounter)
  },
  {
    path: 'upload',
    loadComponent: () =>
      import('./features/upload-counter/upload-counter')
        .then(m => m.UploadCounter)
  },
  {
    path: 'dashboard',
    loadComponent: () =>
      import('./features/dashboard/dashboard')
        .then(m => m.Dashboard)
  }
];
