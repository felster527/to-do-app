import { Injectable, inject } from '@angular/core';

import { Group } from '../../../models/group';
import { DEFAULT_STATUSES } from '../board.constants';

import { BoardData } from './board-data';
import { BoardState } from './board-state';
import { BoardWorkspace } from './board-workspace';

// Opening, switching and reloading boards (your own board or a group's board).
@Injectable()
export class BoardSwitcher {
  private state = inject(BoardState);
  private workspace = inject(BoardWorkspace);
  private data = inject(BoardData);

  // First load when the page opens
  async start() {
    // Your groups first, because the board that opens may be a group's board
    await this.workspace.loadGroups();
    await this.workspace.joinPendingInvite();
    this.workspace.restoreWorkspace();

    // Columns first, because tasks need a column to sit in
    await this.data.loadColumns();
    await this.data.loadTasks();
    this.state.loading.set(false);
  }

  // The new group was made: open its board and give it the same starter columns as your own board
  async onGroupCreated(group: Group) {
    this.state.groups.update(list => [...list, group]);
    this.workspace.closeGroupWindow();
    await this.switchWorkspace(group._id);
    try {
      for (const column of DEFAULT_STATUSES) {
        await this.data.createColumn(column.name, column.color);
      }
    } catch {
      this.state.errorMessage.set('The group was created, but its starter columns could not be added. Add them yourself.');
    }
  }

  // You left or deleted a group: forget it and open your own board
  async onGroupGone(groupId: string) {
    this.state.groups.update(list => list.filter(g => g._id !== groupId));
    this.workspace.closeGroupWindow();
    await this.switchWorkspace(null);
  }

  // Opens your own board (null) or the board of a group
  async switchWorkspace(id: string | null) {
    if (id === this.state.workspaceId()) return;
    this.state.workspaceId.set(id);
    this.workspace.saveWorkspace();
    await this.reloadBoard();
  }

  // Loads the latest members, columns and tasks (other people may have changed things)
  async refreshBoard() {
    await this.workspace.loadGroups();

    // The group may be gone (deleted, or you were removed from it)
    const lost = this.state.workspaceId() !== null && !this.state.activeGroup();
    if (lost) {
      this.state.workspaceId.set(null);
      this.workspace.saveWorkspace();
    }
    await this.reloadBoard();
    if (lost) {
      this.state.notice.set('You no longer have access to that group, so your own board was opened.');
    }
  }

  private async reloadBoard() {
    this.state.loading.set(true);
    this.state.statuses.set([]);
    this.state.tasks.set([]);
    this.state.columnsLoaded = false;
    this.state.addingTaskTo.set(null);
    this.state.addingColumn.set(false);
    this.state.editingId.set(null);
    this.state.commentsOpenFor.set(null);
    this.state.renamingColumnId.set(null);
    this.state.errorMessage.set('');
    this.state.notice.set('');

    await this.data.loadColumns();
    await this.data.loadTasks();
    this.state.loading.set(false);
  }
}
