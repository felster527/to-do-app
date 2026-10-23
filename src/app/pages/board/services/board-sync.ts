import { Injectable, PLATFORM_ID, inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';

import { Groups } from '../../../core/groups';
import { PendingWrites } from '../../../core/pending-writes';
import { Task } from '../../../models/task';
import { POLL_MS, ServerColumn } from '../board.constants';
import { sameData } from '../board.utils';

import { BoardData } from './board-data';
import { BoardState } from './board-state';
import { BoardWorkspace } from './board-workspace';

@Injectable()
export class BoardSync {
  private http = inject(HttpClient);
  private state = inject(BoardState);
  private workspace = inject(BoardWorkspace);
  private data = inject(BoardData);

  private groupsApi = inject(Groups);
  private writes = inject(PendingWrites);
  private isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private pollTimer: ReturnType<typeof setInterval> | undefined;
  private pollCount = 0;
  private syncing = false;
  private readonly onTabVisible = () => {
    if (document.visibilityState === 'visible') this.poll(true);
  };

  startLiveUpdates() {
    if (!this.isBrowser) return;

    this.pollTimer = setInterval(() => this.poll(false), POLL_MS);
    document.addEventListener('visibilitychange', this.onTabVisible);
  }

  private async poll(checkGroupsNow: boolean) {
    if (document.visibilityState !== 'visible') return;
    if (this.state.loading() || this.syncing) return;
    if (this.state.draggingId() || this.state.draggingColumnId()) return;
    if (this.state.pickingColor) return;

    await this.syncBoard();

    this.pollCount++;
    if (checkGroupsNow || this.pollCount % 3 === 0) await this.syncGroups();
  }

  // Loads columns and tasks quietly: no loading screen, open forms stay open
  private async syncBoard() {
    // One of your own changes is still being saved: wait, or the old data would jump back
    if (this.writes.count > 0) return;

    this.syncing = true;
    try {
      const workspace = this.state.workspaceId();
      const statusesBefore = this.state.statuses();
      const tasksBefore = this.state.tasks();

      const [columns, tasks] = await Promise.all([
        firstValueFrom(this.http.get<ServerColumn[]>(this.state.columnsListUrl())),
        firstValueFrom(this.http.get<Task[]>(this.state.tasksListUrl())),
      ]);

      // While waiting, you switched board or changed something yourself: this answer is already old
      if (
        workspace !== this.state.workspaceId() ||
        this.writes.count > 0 ||
        this.state.statuses() !== statusesBefore ||
        this.state.tasks() !== tasksBefore
      ) {
        return;
      }

      const newStatuses = columns.map(c => this.state.toStatus(c));
      if (!sameData(newStatuses, this.state.statuses())) this.state.statuses.set(newStatuses);

      // The card you are editing is not overwritten, so your typing is safe
      const editingId = this.state.editingId();
      const editingTask = editingId ? this.state.tasks().find(t => t._id === editingId) : undefined;
      const newTasks = editingTask ? tasks.map(t => (t._id === editingId ? editingTask : t)) : tasks;
      if (!sameData(newTasks, this.state.tasks())) this.state.tasks.set(newTasks);
    } catch (error) {
      // Lost access to the group (removed, or the group was deleted): open your own board
      if (await this.workspace.leaveLostGroup(error)) {
        await this.data.loadColumns();
        await this.data.loadTasks();
      }
      // Any other error (for example no internet) is ignored, the next round tries again
    } finally {
      this.syncing = false;
    }
  }

  // Quietly refreshes the group list, so new members, renames and removals show up
  private async syncGroups() {
    if (this.writes.count > 0) return;

    const before = this.state.groups();
    const result = await this.groupsApi.list();
    // Failed, or you changed the groups yourself while waiting: skip this round
    if (!result.ok || this.state.groups() !== before || this.writes.count > 0) return;

    if (!sameData(result.data, before)) this.state.groups.set(result.data);
  }

  stopLiveUpdates() {
    clearInterval(this.pollTimer);
    if (this.isBrowser) document.removeEventListener('visibilitychange', this.onTabVisible);
  }
}
