import { Routes } from '@angular/router';
import { Board } from './pages/board/board';
import { Login } from './pages/auth/login/login';
import { Register } from './pages/auth/register/register';
import { ChangePassword } from './pages/auth/change-password/change-password';
import { ForgotPassword } from './pages/auth/forgot-password/forgot-password';
import { Join } from './pages/join/join';
import { authGuard, guestGuard } from './core/auth.guards';

export const routes: Routes = [
  { path: '', component: Board, pathMatch: 'full', canActivate: [authGuard] },
  { path: 'login', component: Login, canActivate: [guestGuard] },
  { path: 'register', component: Register, canActivate: [guestGuard] },
  { path: 'change-password', component: ChangePassword },
  { path: 'forgot-password', component: ForgotPassword, canActivate: [guestGuard] },
  { path: 'join', component: Join },
  { path: '**', redirectTo: '' }
];