import { Component, afterNextRender, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { Auth } from '../../../core/auth';

@Component({
  selector: 'app-change-password',
  imports: [RouterLink],
  templateUrl: './change-password.html',
  styleUrl: '../auth.css',
})
export class ChangePassword {
  private auth = inject(Auth);

  
  private token = inject(ActivatedRoute).snapshot.queryParamMap.get('token') ?? '';
  hasToken = this.token !== '';


  loggedInMode = signal(false);
  ready = signal(false);

  error = signal('');
  success = signal('');
  saving = signal(false);

  showCurrent = signal(false);
  showNew = signal(false);
  showConfirm = signal(false);

  constructor() {
    afterNextRender(() => {
      this.loggedInMode.set(!this.hasToken && this.auth.isLoggedIn());
      this.ready.set(true);
    });
  }

  toggle(box: 'current' | 'new' | 'confirm') {
    const signalOf = { current: this.showCurrent, new: this.showNew, confirm: this.showConfirm }[box];
    signalOf.update(v => !v);
  }

  async onSubmit(current: HTMLInputElement | null, password: HTMLInputElement, confirm: HTMLInputElement) {
    if (password.value !== confirm.value) {
      this.error.set('Passwords do not match.');
      return;
    }

    this.error.set('');
    this.saving.set(true);

    const result = this.loggedInMode()
      ? await this.auth.changeOwnPassword(current?.value ?? '', password.value)
      : await this.auth.changePassword(this.token, password.value);

    this.saving.set(false);
    if (result.ok) {
      // The password changed, so sign out: the login page only opens for logged-out users
      this.auth.logout();
      this.success.set(result.message);
    } else {
      this.error.set(result.message);
    }
  }
}