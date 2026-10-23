import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';

import { API_URL } from '../../../core/api';
import { StatusColumn } from '../../../models/status';
import { ServerColumn } from '../board.constants';

import { BoardData } from './board-data';
import { BoardState } from './board-state';

// Everything you can do with columns: add, delete, rename, recolor and reorder.
@Injectable()
export class BoardColumns {
  private http = inject(HttpClient);
  private state = inject(BoardState);
  private data = inject(BoardData);

  private renameSaving = false;

  // ---------- Adding and deleting columns ----------

  openColumnForm() {
    this.state.addingColumn.set(true);
    setTimeout(() => document.getElementById('new-column-name')?.focus());
  }

  closeColumnForm() {
    this.state.addingColumn.set(false);
  }

  async addStatus(nameInput: HTMLInputElement, colorInput: HTMLInputElement) {
    const name = nameInput.value.trim();
    if (!name || this.statusExists(name)) return;

    try {
      await this.data.createColumn(name, colorInput.value);
      this.state.addingColumn.set(false);
      this.state.errorMessage.set('');
    } catch {
      this.state.errorMessage.set('Could not add the column. Please try again.');
    }
  }

  async deleteStatus(status: StatusColumn) {
    const tasksInStatus = this.state.getTasksByColumn(status);

    if (tasksInStatus.length > 0) {
      const confirmed = confirm(`Delete "${status.name}" and its ${tasksInStatus.length} task(s)?`);
      if (!confirmed) return;
    }

    try {
      // Delete every card of this column, then the column itself
      await Promise.all(
        tasksInStatus.map(t => firstValueFrom(this.http.delete(`${API_URL}/todos/${t._id}`)))
      );
      await firstValueFrom(this.http.delete(`${API_URL}/columns/${status._id}`));
    } catch {
      // Some deletes may have worked, so reload the real state from the server
      await this.data.loadTasks();
      this.state.errorMessage.set('Could not delete the column, so it was kept.');
      return;
    }

    const deletedIds = new Set(tasksInStatus.map(t => t._id));
    this.state.tasks.update(list => list.filter(t => !deletedIds.has(t._id)));
    this.state.statuses.update(list => list.filter(s => s._id !== status._id));
    if (this.state.addingTaskTo() === status._id) this.state.addingTaskTo.set(null);
    this.state.errorMessage.set('');
  }

  // ---------- Renaming a column ----------

  startRename(status: StatusColumn) {
    if (!this.state.canManageColumns()) return;
    this.state.renamingColumnId.set(status._id);
    setTimeout(() => {
      const input = document.getElementById(`rename-${status._id}`) as HTMLInputElement | null;
      input?.focus();
      input?.select();
    });
  }

  cancelRename() {
    this.state.renamingColumnId.set(null);
  }

  // Runs on Enter and when you click away from the name box
  async saveRename(status: StatusColumn, input: HTMLInputElement) {
    // Enter and clicking away can both land here, so only the first one counts
    if (this.state.renamingColumnId() !== status._id || this.renameSaving) return;

    const name = input.value.trim();

    // Empty or unchanged: nothing to save, just close the box
    if (!name || name === status.name) {
      this.state.renamingColumnId.set(null);
      return;
    }
    if (this.statusExists(name, status._id)) {
      this.state.errorMessage.set(`There is already a column called "${name}".`);
      return;
    }

    this.renameSaving = true;
    try {
      // Very old cards find their column by name (they have no column id yet), so give them the id first
      const oldCards = this.state.getTasksByColumn(status).filter(t => !this.state.taskColumnId(t));
      await Promise.all(
        oldCards.map(t =>
          firstValueFrom(
            this.http.patch(`${API_URL}/todos/${t._id}`, { columnId: status._id, status: name })
          )
        )
      );
      const oldCardIds = new Set(oldCards.map(t => t._id));
      this.state.tasks.update(list =>
        list.map(t => (oldCardIds.has(t._id) ? { ...t, columnId: status._id, status: name } : t))
      );

      await firstValueFrom(this.http.patch(`${API_URL}/columns/${status._id}`, { name }));
      this.state.statuses.update(list => list.map(s => (s._id === status._id ? { ...s, name } : s)));

      this.state.renamingColumnId.set(null);
      this.state.errorMessage.set('');
    } catch {
      // Stay in edit mode so the typed name is not lost
      this.state.errorMessage.set('Could not rename the column. Please try again.');
    } finally {
      this.renameSaving = false;
    }
  }

  // ---------- Color ----------

  // Runs while you move around in the color picker: only updates the screen
  changeStatusColor(status: StatusColumn, event: Event) {
    const color = (event.target as HTMLInputElement).value;
    this.state.pickingColor = true;
    this.state.statuses.update(list =>
      list.map(s => (s._id === status._id ? { ...s, color } : s))
    );
  }

  // Runs once when you close the color picker: saves the final color to the database
  async saveStatusColor(status: StatusColumn) {
    this.state.pickingColor = false;
    const current = this.state.statuses().find(s => s._id === status._id);
    if (!current) return;

    try {
      await firstValueFrom(
        this.http.patch(`${API_URL}/columns/${current._id}`, { color: current.color })
      );
      this.state.errorMessage.set('');
    } catch {
      this.state.errorMessage.set('Could not save the new color. Please try again.');
    }
  }

  // Is there already a column with this name? (exceptId lets a column keep its own name)
  private statusExists(name: string, exceptId?: string) {
    return this.state.statuses().some(
      s => s._id !== exceptId && s.name.toLowerCase() === name.toLowerCase()
    );
  }

  // ---------- Reordering columns ----------

  // Keyboard: the left and right arrow keys on the handle move the column one place
  async moveColumn(status: StatusColumn, step: -1 | 1) {
    const list = [...this.state.statuses()];
    const from = list.findIndex(s => s._id === status._id);
    const to = from + step;
    if (from < 0 || to < 0 || to >= list.length) return;

    const moved = list.splice(from, 1)[0];
    list.splice(to, 0, moved);
    await this.saveColumnOrder(list);

    // Moving the column can drop the keyboard focus, so put it back on the handle
    setTimeout(() => document.getElementById(`grip-${status._id}`)?.focus());
  }

  // Puts the dragged column right before or right after the column it was dropped on
  async moveColumnNextTo(movingId: string, targetId: string, after: boolean) {
    if (movingId === targetId) return;

    const list = [...this.state.statuses()];
    const from = list.findIndex(s => s._id === movingId);
    if (from < 0) return;

    const moved = list.splice(from, 1)[0];
    const to = list.findIndex(s => s._id === targetId);
    if (to < 0) return;

    list.splice(after ? to + 1 : to, 0, moved);
    await this.saveColumnOrder(list);
  }

  // Shows the new order right away, then saves it (only the columns whose number changed)
  private async saveColumnOrder(newList: StatusColumn[]) {
    const previous = this.state.statuses();
    if (newList.every((s, i) => s._id === previous[i]?._id)) return;

    const renumbered = newList.map((s, i) => ({ ...s, order: i }));
    this.state.statuses.set(renumbered);

    const changed = renumbered.filter(
      s => previous.find(p => p._id === s._id)?.order !== s.order
    );

    try {
      await Promise.all(
        changed.map(s =>
          firstValueFrom(
            this.http.patch(`${API_URL}/columns/${s._id}/order`, { order: s.order })
          )
        )
      );
      this.state.errorMessage.set('');
    } catch {
      // Some of the saves may have worked, so ask the server what the real order is
      try {
        const columns = await firstValueFrom(this.http.get<ServerColumn[]>(this.state.columnsListUrl()));
        this.state.statuses.set(columns.map(c => this.state.toStatus(c)));
      } catch {
        this.state.statuses.set(previous);
      }
      this.state.errorMessage.set('Could not save the new column order. Please try again.');
    }
  }
}
