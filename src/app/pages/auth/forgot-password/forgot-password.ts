import { Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Auth } from '../../../core/auth';

@Component({
  selector: 'app-forgot-password',
  imports: [RouterLink],
  templateUrl: './forgot-password.html',
  styleUrl: '../auth.css',
})
export class ForgotPassword {
  private auth = inject(Auth);
  error = signal('');
  success = signal('');
  sending = signal(false);

  async onSubmit(email: HTMLInputElement) {
    this.error.set('');
    this.success.set('');
    this.sending.set(true);
    const result = await this.auth.requestPasswordReset(email.value);
    this.sending.set(false);
    if (result.ok) this.success.set(result.message);
    else this.error.set(result.message);
  }
}

