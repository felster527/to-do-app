import { Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Auth } from '../../../core/auth';

@Component({
  selector: 'app-register',
  imports: [RouterLink],
  templateUrl: './register.html',
  styleUrl: '../auth.css',
})
export class Register {
  private auth = inject(Auth);

  error = signal('');
  success = signal('');
  sending = signal(false);

  async onSubmit(username: HTMLInputElement, email: HTMLInputElement) {
    this.error.set('');
    this.sending.set(true);

    const result = await this.auth.register(username.value, email.value);

    this.sending.set(false);
    if (result.ok) {
      this.success.set(result.message);
    } else {
      this.error.set(result.message);
    }
  }
}
