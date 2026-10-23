import { AfterViewInit, Component, inject, input, output, signal } from '@angular/core';
import { Auth } from '../../../../core/auth';

// The "Edit profile" window: change your photo and username
@Component({
  selector: 'app-profile-dialog',
  styleUrls: ['../../styles/ui.css', '../../styles/modal.css', './profile-dialog.css'],
  templateUrl: './profile-dialog.html',
})
export class ProfileDialog implements AfterViewInit {
  private auth = inject(Auth);

  // What the top bar already knows about you
  username = input.required<string>();
  initial = input.required<string>();
  pictureUrl = input<string | null>(null);
  pictureFailed = input(false);

  closed = output<void>();
  saved = output<void>(); // the profile was saved, the parent should read the new data

  profileSaving = signal(false);
  profileError = signal('');
  photoPreview = signal<string | null>(null);
  private selectedPhoto: File | null = null;

  ngAfterViewInit() {
    setTimeout(() => document.getElementById('profile-username')?.focus());
  }

  // Runs when you choose a file: check it, then show a preview (nothing is saved yet)
  onPhotoPicked(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    const problem = this.auth.checkPhoto(file);
    if (problem) {
      this.profileError.set(problem);
      input.value = '';
      return;
    }

    this.profileError.set('');
    this.selectedPhoto = file;

    const reader = new FileReader();
    reader.onload = () => this.photoPreview.set(reader.result as string);
    reader.readAsDataURL(file);
  }

  async saveProfile(usernameInput: HTMLInputElement) {
    this.profileError.set('');
    this.profileSaving.set(true);

    const result = await this.auth.updateProfile(this.selectedPhoto, usernameInput.value);

    this.profileSaving.set(false);
    if (!result.ok) {
      this.profileError.set(result.message);
      return;
    }
    this.saved.emit();
  }
}
