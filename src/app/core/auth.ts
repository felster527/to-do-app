import { Injectable, PLATFORM_ID, inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { API_URL, fixPictureUrl } from './api';

interface AuthResult {
  ok: boolean;
  message: string;
}

interface LoginResponse {
  access_token: string;
  username?: string;
  profilePicture?: string; 
  user?: { id: string; username?: string; email: string; profilePictureUrl?: string | null };
  isUsingTemporaryPassword?: boolean; 
}

// What the backend sends back after a profile update
interface ProfileResponse {
  username?: string;
  url?: string | null;
}

// Rules for the profile photo (the backend checks the same things)
export const PHOTO_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
export const MAX_PHOTO_MB = 2;

const TOKEN_KEY = 'kanban_token';
const EMAIL_KEY = 'kanban_email';
const USERNAME_KEY = 'kanban_username';
const PICTURE_KEY = 'kanban_picture';
const TEMP_PASSWORD_KEY = 'kanban_temp_password';

@Injectable({ providedIn: 'root' })
export class Auth {
  private http = inject(HttpClient);
  private isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  private readUsername(token: string): string | null {
    try {
      const payload = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
      return payload.username ?? null;
       } catch {
         return null;
       }
  }

  // The backend creates the password and sends it to the user's Gmail
  async register(username: string, email: string): Promise<AuthResult> {
    username = username.trim();
    email = email.trim();

    if (!username || !email) {
      return { ok: false, message: 'Please fill in all fields.' };
    }

    try {
      await firstValueFrom(
        this.http.post(`${API_URL}/auth/register`, { username, email })
      );
      return { ok: true, message: 'Your account is ready. We sent a link to your Gmail so you can set your password. Check your inbox (and spam folder).' };
    } catch (error) {
      return { ok: false, message: this.getErrorMessage(error) };
    }
  }

  // Request a password-reset email from the backend.
  async requestPasswordReset(email: string): Promise<AuthResult> {
    email = email.trim();
    if (!email) return { ok: false, message: 'Enter your email address.' };

    try {
      const response = await firstValueFrom(
        this.http.post<{ message?: string }>(`${API_URL}/auth/reset-password`, { email })
      );
      return { ok: true, message: response.message ?? 'If that email is registered, a reset link has been sent. Check your inbox and spam folder.' };
    } catch (error) {
      return { ok: false, message: this.getErrorMessage(error) };
    }
  }

  // Used by the page that opens from the link in the email
  async changePassword(token: string, newPassword: string): Promise<AuthResult> {
    if (newPassword.length < 8) {
      return { ok: false, message: 'Password must be at least 8 characters.' };
    }
    // Needs at least one number and one special character (anything that is not a letter, number or space)
    if (!/\d/.test(newPassword) || !/[^\p{L}\p{N}\s]/u.test(newPassword)) {
      return { ok: false, message: 'Password must contain at least one number and one special character (for example ! @ # $).' };
    }

    try {
      await firstValueFrom(
        this.http.post(`${API_URL}/auth/confirm-reset`, { token, newPassword })
      );
      return { ok: true, message: 'Your password was changed. You can log in now.' };
    } catch (error) {
      if (error instanceof HttpErrorResponse) {
        if (error.status === 401) {
          return { ok: false, message: 'This link is invalid, expired or already used.' };
        }
        if (error.status === 400) {
          return { ok: false, message: 'The request was invalid. Use a password of at least 6 characters with a number and a special character.' };
        }
      }
      return { ok: false, message: this.getErrorMessage(error) };
    }
  }

  // For a logged-in user (no email link needed): needs the current password
  async changeOwnPassword(currentPassword: string, newPassword: string): Promise<AuthResult> {
    if (!currentPassword) {
      return { ok: false, message: 'Enter your current password.' };
    }
    if (newPassword.length < 6) {
      return { ok: false, message: 'Password must be at least 6 characters.' };
    }
    if (!/\d/.test(newPassword) || !/[^\p{L}\p{N}\s]/u.test(newPassword)) {
      return { ok: false, message: 'Password must contain at least one number and one special character (for example ! @ # $).' };
    }

    try {
      await firstValueFrom(
        this.http.put(`${API_URL}/auth/change-password`, { currentPassword, newPassword })
      );
      return { ok: true, message: 'Your password was changed. Please log in with your new password.' };
    } catch (error) {
      if (error instanceof HttpErrorResponse) {
        if (error.status === 401) return { ok: false, message: 'Your current password is wrong.' };
        if (error.status === 400) return { ok: false, message: 'Use a password of at least 8 characters with a number and a special character (for example ! @ # $ -).' };
      }
      return { ok: false, message: this.getErrorMessage(error) };
    }
  }

  async login(email: string, password: string): Promise<AuthResult> {
    email = email.trim();

    try {
      const response = await firstValueFrom(
        this.http.post<LoginResponse>(`${API_URL}/auth/login`, { email, password })
      );
      localStorage.setItem(TOKEN_KEY, response.access_token);
      localStorage.setItem(EMAIL_KEY, email);

      // Keep the username if the backend sent one, otherwise clear any old one
      const username = response.username ?? response.user?.username ?? this.readUsername(response.access_token);
      if (username) {
        localStorage.setItem(USERNAME_KEY, username);
      } else {
        localStorage.removeItem(USERNAME_KEY);
      }

      // The profile picture (the backend sends the full address, or '' if you have none)
      const picture = response.profilePicture || response.user?.profilePictureUrl;
      if (picture) {
        localStorage.setItem(PICTURE_KEY, picture);
      } else {
        localStorage.removeItem(PICTURE_KEY);
      }

      // Remember the backend's answer for this login, so the board can show the password reminder once
      if (response.isUsingTemporaryPassword) {
        localStorage.setItem(TEMP_PASSWORD_KEY, '1');
      } else {
        localStorage.removeItem(TEMP_PASSWORD_KEY);
      }
      return { ok: true, message: '' };
    } catch (error) {
      return { ok: false, message: this.getErrorMessage(error) };
    }
  }

 
  takePasswordReminder(): boolean {
    if (!this.isBrowser || !this.token) return false;
    const needed = localStorage.getItem(TEMP_PASSWORD_KEY) === '1';
    localStorage.removeItem(TEMP_PASSWORD_KEY);
    return needed;
  }

  logout() {
    if (!this.isBrowser) return;
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(EMAIL_KEY);
    localStorage.removeItem(USERNAME_KEY);
    localStorage.removeItem(PICTURE_KEY);
    localStorage.removeItem(TEMP_PASSWORD_KEY);
  }

  get token(): string | null {
    return this.isBrowser ? localStorage.getItem(TOKEN_KEY) : null;
  }

  isLoggedIn(): boolean {
    return this.token !== null;
  }

  get currentUser(): { email: string; username: string | null; picture: string | null } | null {
    if (!this.isBrowser || !this.token) return null;
    const email = localStorage.getItem(EMAIL_KEY);
    if (!email) return null;
    return {
      email,
      username: localStorage.getItem(USERNAME_KEY),
      picture: fixPictureUrl(localStorage.getItem(PICTURE_KEY)),
    };
  }

  // The id of the logged-in user, read from the login token (its "sub" field)
  get userId(): string | null {
    const token = this.token;
    if (!token) return null;
    try {
      const payload = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
      return payload.sub ?? null;
    } catch {
      return null;
    }
  }

  // Returns an error message if the photo is not allowed, or '' if it is fine
  checkPhoto(file: File): string {
    if (!PHOTO_TYPES.includes(file.type)) {
      return 'Please choose a JPG, PNG, GIF or WEBP image.';
    }
    if (file.size > MAX_PHOTO_MB * 1024 * 1024) {
      return `The image is too big. The maximum is ${MAX_PHOTO_MB} MB.`;
    }
    return '';
  }

  // Saves a new profile photo and/or a new username (both are optional, but send at least one)
  async updateProfile(file: File | null, username: string): Promise<AuthResult> {
    username = username.trim();
    const usernameChanged = username !== '' && username !== (this.currentUser?.username ?? '');

    if (!file && !usernameChanged) {
      return { ok: false, message: 'Nothing to save. Pick a new photo or change your username.' };
    }
    if (file) {
      const photoError = this.checkPhoto(file);
      if (photoError) return { ok: false, message: photoError };
    }
    if (usernameChanged && (username.length < 2 || username.length > 30)) {
      return { ok: false, message: 'Username must be between 2 and 30 characters.' };
    }

    // The backend has two routes: one saves the photo, the other saves the username
    try {
      if (file) {
        // The photo goes as a form (multipart), not as JSON
        const form = new FormData();
        form.append('file', file);
        const response = await firstValueFrom(
          this.http.post<ProfileResponse>(`${API_URL}/auth/profile/upload`, form)
        );
        if (response.url) localStorage.setItem(PICTURE_KEY, response.url);
      }
    } catch (error) {
      return { ok: false, message: this.getProfileErrorMessage(error) };
    }

    try {
      if (usernameChanged) {
        const response = await firstValueFrom(
          this.http.put<ProfileResponse>(`${API_URL}/auth/profile`, { username })
        );
        localStorage.setItem(USERNAME_KEY, response.username ?? username);
      }
    } catch (error) {
      const photoNote = file ? ' Your new photo was saved.' : '';
      return { ok: false, message: this.getProfileErrorMessage(error) + photoNote };
    }
    return { ok: true, message: 'Profile updated.' };
  }

  private getProfileErrorMessage(error: unknown): string {
    if (error instanceof HttpErrorResponse) {
      if (error.status === 0) return 'Cannot reach the server. Is the backend running?';
      if (error.status === 400) return 'Please choose a JPG or PNG image and a username of 2 to 30 characters.';
      if (error.status === 401) return 'Your session has expired. Please log in again.';
      if (error.status === 413) return `The image is too big. The maximum is ${MAX_PHOTO_MB} MB.`;
    }
    return 'Could not save your profile. Please try again.';
  }

  private getErrorMessage(error: unknown): string {
    if (error instanceof HttpErrorResponse) {
      if (error.status === 0) return 'Cannot reach the server. Is the backend running?';
      if (error.status === 400) return 'Please check your details and try again.';
      if (error.status === 409) return 'This email is already registered.';
      if (error.status === 404) return 'No account was found with that email address.';
      if (error.status === 429) return 'Too many attempts. Please wait a minute and try again.';
      if (error.status === 401) return 'Wrong email or password.';
      if (error.status === 500) return 'The server had a problem (for example it could not send the email). Please try again later.';
    }
    return 'Something went wrong. Please try again.';
  }
}