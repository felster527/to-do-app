import { Injectable, inject } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';

import { Groups, PENDING_INVITE_KEY } from '../../../core/groups';
import { Group } from '../../../models/group';

import { BoardState } from './board-state';

// Which board is open: your own, or the board of a group (plus the group windows).
@Injectable()
export class BoardWorkspace {
  private state = inject(BoardState);

  private groupsApi = inject(Groups);
  private workspaceKey = `kanban_workspace_${this.state.user()?.email}`;

  // ---------- Group windows ----------

  openNewGroup() {
    this.state.groupWindow.set('new');
  }

  openGroupSettings() {
    if (this.state.activeGroup()) this.state.groupWindow.set('settings');
  }

  closeGroupWindow() {
    this.state.groupWindow.set(null);
  }

  // The settings window changed the group (name, limit or members)
  onGroupChanged(updated: Group) {
    this.state.groups.update(list => list.map(g => (g._id === updated._id ? updated : g)));
  }

  // ---------- Groups and workspaces ----------

  async loadGroups() {
    const result = await this.groupsApi.list();
    if (result.ok) {
      this.state.groups.set(result.data);
    } else {
      this.state.errorMessage.set(result.message);
    }
  }

  // Opens the board you used last time (if you still belong to that group)
  restoreWorkspace() {
    if (this.state.workspaceId() || typeof localStorage === 'undefined') return;
    const saved = localStorage.getItem(this.workspaceKey);
    if (saved && this.state.groups().some(g => g._id === saved)) {
      this.state.workspaceId.set(saved);
    }
  }

  saveWorkspace() {
    if (typeof localStorage === 'undefined') return;
    const id = this.state.workspaceId();
    if (id) {
      localStorage.setItem(this.workspaceKey, id);
    } else {
      localStorage.removeItem(this.workspaceKey);
    }
  }

  // You opened an invite link earlier (the join page saved it): join that group now
  async joinPendingInvite() {
    if (typeof localStorage === 'undefined') return;
    const token = localStorage.getItem(PENDING_INVITE_KEY);
    if (!token) return;
    localStorage.removeItem(PENDING_INVITE_KEY);

    const result = await this.groupsApi.join(token);

    // A real failure (bad link, full group...). Being in the group already is fine, we just open it.
    if (!result.ok && !result.groupId) {
      this.state.errorMessage.set(result.message);
      return;
    }

    const groupId = result.ok ? result.data.groupId : result.groupId;
    await this.loadGroups();
    const group = this.state.groups().find(g => g._id === groupId);
    if (group) {
      this.state.workspaceId.set(group._id);
      this.saveWorkspace();
      this.state.notice.set(result.ok ? `You joined "${group.name}".` : `You are already in "${group.name}".`);
    }
  }

  // Called when a group's board fails to load. If you lost access to it, go back to your own board.
  async leaveLostGroup(error: unknown) {
    const lostAccess = error instanceof HttpErrorResponse && (error.status === 403 || error.status === 404);
    if (!this.state.workspaceId() || !lostAccess) return false;

    await this.loadGroups();
    this.state.workspaceId.set(null);
    this.saveWorkspace();
    this.state.statuses.set([]);
    this.state.tasks.set([]);
    this.state.notice.set('You no longer have access to that group, so your own board was opened.');
    return true;
  }
}
