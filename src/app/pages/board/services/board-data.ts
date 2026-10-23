import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';

import { API_URL } from '../../../core/api';
import { Task } from '../../../models/task';
import { AUTO_STATUS_COLOR, DEFAULT_STATUSES, ServerColumn } from '../board.constants';

import { BoardState } from './board-state';
import { BoardWorkspace } from './board-workspace';

// Loading the board from the server: columns, tasks, and the one-time move of old browser columns.
@Injectable()
export class BoardData {
  private http = inject(HttpClient);
  private state = inject(BoardState);
  private workspace = inject(BoardWorkspace);

  // Browser storage keys: the old column list, and a "columns already moved to the database" flag
  private oldStatusKey = `kanban_statuses_${this.state.user()?.email}`;
  private migratedKey = `kanban_columns_migrated_${this.state.user()?.email}`;

  // ---------- Loading ----------

  async loadColumns() {
    try {
      const columns = await firstValueFrom(this.http.get<ServerColumn[]>(this.state.columnsListUrl()));
      this.state.statuses.set(columns.map(c => this.state.toStatus(c)));
      this.state.columnsLoaded = true;

      // Your own board only. A group's board starts empty and its owner adds the columns.
      if (!this.state.workspaceId()) {
        // First time only: an empty account gets the columns it had in the browser (or the defaults)
        if (columns.length === 0 && !this.isMigrated()) {
          await this.createStarterColumns();
        }
        this.markMigrated();
      }
    } catch (error) {
      // Lost access to the group? Then open your own board instead
      if (await this.workspace.leaveLostGroup(error)) {
        await this.loadColumns();
        return;
      }
      this.state.errorMessage.set('Could not load your columns. Is the backend running?');
    }
  }

  async loadTasks() {
    try {
      const tasks = await firstValueFrom(this.http.get<Task[]>(this.state.tasksListUrl()));
      this.state.tasks.set(tasks);
      this.state.errorMessage.set('');
      await this.addMissingStatuses(tasks);
    } catch (error) {
      // Lost access to the group? Then open your own board instead
      if (await this.workspace.leaveLostGroup(error)) {
        await this.loadColumns();
        await this.loadTasks();
        return;
      }
      this.state.errorMessage.set('Could not load your tasks. Is the backend running?');
    }
  }

  // ---------- Creating columns ----------

  // Saves a new column in the database and adds it to the board
  async createColumn(name: string, color: string) {
    const nextOrder = this.state.statuses().reduce((max, s) => Math.max(max, s.order), -1) + 1;
    const created = await firstValueFrom(
      this.http.post<ServerColumn>(`${API_URL}/columns`, {
        name,
        color,
        order: nextOrder,
        ...(this.state.workspaceId() ? { groupId: this.state.workspaceId() } : {}),
      })
    );
    this.state.statuses.update(list => [...list, this.state.toStatus(created)]);
  }

  // Old cards (no columnId) that use a column name we don't have yet: create that column
  private async addMissingStatuses(tasks: Task[]) {
    // Only your own board has old-style cards
    if (!this.state.columnsLoaded || this.state.workspaceId()) return;

    const known = new Set(this.state.statuses().map(s => s.name));
    const oldStyleNames = tasks
      .filter(t => !this.state.taskColumnId(t) && t.status)
      .map(t => t.status as string);
    const missing = [...new Set(oldStyleNames)].filter(name => !known.has(name));

    for (const name of missing) {
      try {
        await this.createColumn(name, AUTO_STATUS_COLOR);
      } catch {
        // Skip it, it will be tried again next time the board loads
      }
    }
  }

  // ---------- Moving old browser columns into the database (runs once) ----------

  private isMigrated() {
    return typeof localStorage !== 'undefined' && localStorage.getItem(this.migratedKey) === 'yes';
  }

  private markMigrated() {
    if (typeof localStorage !== 'undefined') localStorage.setItem(this.migratedKey, 'yes');
  }

  private readOldBrowserColumns(): { name: string; color: string }[] {
    if (typeof localStorage === 'undefined') return DEFAULT_STATUSES;

    try {
      const saved = JSON.parse(localStorage.getItem(this.oldStatusKey) ?? 'null');
      if (Array.isArray(saved) && saved.length > 0 && saved.every(s => typeof s?.name === 'string')) {
        return saved.map(s => ({ name: s.name, color: s.color ?? AUTO_STATUS_COLOR }));
      }
    } catch {
      // Damaged data: fall back to the defaults
    }
    return DEFAULT_STATUSES;
  }

  private async createStarterColumns() {
    for (const column of this.readOldBrowserColumns()) {
      await this.createColumn(column.name, column.color);
    }
  }
}
