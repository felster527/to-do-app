import { Injectable, inject } from '@angular/core';
import { HttpInterceptorFn } from '@angular/common/http';
import { finalize } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class PendingWrites {
  count = 0;
}

export const trackWritesInterceptor: HttpInterceptorFn = (req, next) => {
  if (req.method === 'GET') return next(req);

  const pending = inject(PendingWrites);
  pending.count++;
  return next(req).pipe(finalize(() => pending.count--));
};

