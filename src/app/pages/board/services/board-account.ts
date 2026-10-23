import { Injectable, inject } from '@angular/core';
import { Router } from '@angular/router';
import { Auth } from '../../../core/auth';
import { BoardState } from './board-state';


@Injectable()
export class BoardAccount {
  private auth = inject(Auth);
  private router = inject(Router);
  private state = inject(BoardState);

  // Name and first letter shown in the top bar
  get displayName() {
    return this.state.user()?.username || this.state.user()?.email || '';
  }

  get initial() {
    return this.displayName.charAt(0).toUpperCase();
  }

  // Profile picture shown in the top bar (null means: show the first letter instead)
  get pictureUrl() {
    return this.state.user()?.picture ?? null;
  }

  logout() {
    this.auth.logout();
    this.router.navigateByUrl('/login');
  }

  openProfile() {
    this.state.editingProfile.set(true);
  }

  closeProfile() {
    this.state.editingProfile.set(false);
  }

  // The dialog saved the profile: read the new name and picture back so the top bar updates right away
  onProfileSaved() {
    this.state.user.set(this.auth.currentUser);
    this.state.pictureFailed.set(false);
    this.closeProfile();
  }
}
