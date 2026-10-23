import { Component, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { Auth } from '../../../core/auth';

@Component({
  selector: 'app-login',
  imports: [RouterLink],
  templateUrl: './login.html',
  styleUrl: '../auth.css',
})
export class Login {
  private auth = inject(Auth);
  private router = inject(Router);

  error = signal('');
  showPassword = signal(false);
  submitting = signal(false);

  togglePassword() {
    this.showPassword.update(v => !v);
  }

  async onSubmit(email: HTMLInputElement, password: HTMLInputElement) {
    this.error.set('');
    this.submitting.set(true);

    const result = await this.auth.login(email.value, password.value);

    this.submitting.set(false);
    if (result.ok) {
      this.router.navigateByUrl('/');
    } else {
      this.error.set(result.message);
    }
  }
}
