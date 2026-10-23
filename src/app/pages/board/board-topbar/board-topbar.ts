import { Component, input, output } from '@angular/core';
import { Group } from '../../../models/group';

// The top bar of the board: board picker, group buttons, and the user area
@Component({
  selector: 'app-board-topbar',
  styleUrls: ['../styles/ui.css', './board-topbar.css'],
  templateUrl: './board-topbar.html',
})
export class BoardTopbar {
  groups = input.required<Group[]>();
  workspaceId = input<string | null>(null);
  activeGroup = input<Group | null>(null);
  displayName = input('');
  initial = input('');
  pictureUrl = input<string | null>(null);
  pictureFailed = input(false);

  workspaceChange = output<string | null>();
  groupSettings = output<void>();
  refresh = output<void>();
  newGroup = output<void>();
  profile = output<void>();
  logout = output<void>();
  pictureError = output<void>();
}
