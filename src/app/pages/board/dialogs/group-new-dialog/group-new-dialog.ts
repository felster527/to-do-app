import { AfterViewInit, Component, inject, output, signal } from '@angular/core';
import { Groups } from '../../../../core/groups';
import { Group } from '../../../../models/group';

// The "New group" window
@Component({
  selector: 'app-group-new-dialog',
  styleUrls: ['../../styles/ui.css', '../../styles/modal.css'],
  templateUrl: './group-new-dialog.html',
})
export class GroupNewDialog implements AfterViewInit {
  private groupsApi = inject(Groups);

  closed = output<void>();
  created = output<Group>(); // the group was made, the parent opens its board

  groupError = signal('');
  groupBusy = signal(false);

  ngAfterViewInit() {
    setTimeout(() => document.getElementById('new-group-name')?.focus());
  }

  async createGroup(nameInput: HTMLInputElement) {
    this.groupError.set('');
    this.groupBusy.set(true);

    const result = await this.groupsApi.create(nameInput.value);
    this.groupBusy.set(false);

    if (!result.ok) {
      this.groupError.set(result.message);
      return;
    }
    this.created.emit(result.data);
  }
}
