import { Component, afterNextRender, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { Auth } from '../../../../core/auth';


@Component({
  selector: 'app-password-reminder-dialog',
  styleUrls: ['../../styles/ui.css', '../../styles/modal.css', './password-reminder-dialog.css'],
  templateUrl: './password-reminder-dialog.html',
})
export class PasswordReminderDialog {
  private auth = inject(Auth);
  private router = inject(Router);

  open = signal(false);

  constructor() {
    // Runs in the browser only, after the first render (the answer is kept in the browser at login)
    afterNextRender(() => {
      if (this.auth.takePasswordReminder()) {
        this.open.set(true);
        setTimeout(() => document.getElementById('reminder-change')?.focus());
      }
    });
  }

  changePassword() {
    this.open.set(false);
    this.router.navigateByUrl('/change-password');
  }

  close() {
    this.open.set(false);
  }
}
