import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';
import { API_URL } from './api';
import { Auth } from './auth';

// Adds the login token to every request that goes to our backend
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const auth = inject(Auth);
  const router = inject(Router);
  const token = auth.token;

  const isOurApi = req.url.startsWith(API_URL);
  const request = token && isOurApi
    ? req.clone({ setHeaders: { Authorization: `Bearer ${token}` } })
    : req;

  return next(request).pipe(
    catchError((error: HttpErrorResponse) => {
      // Token expired or invalid: log out and go to the login page
      const isAuthCall = req.url.includes('/auth/');
      if (error.status === 401 && token && !isAuthCall) {
        auth.logout();
        router.navigateByUrl('/login');
      }
      return throwError(() => error);
    })
  );
};
