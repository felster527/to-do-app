import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';

import { API_URL } from '../../../core/api';
import { StatusColumn } from '../../../models/status';
import { Task } from '../../../models/task';

import { BoardColumns } from './board-columns';
import { BoardState } from './board-state';

// Drag and drop on the board: cards between columns, and columns by their handle.
@Injectable()
export class BoardDragDrop {
  private http = inject(HttpClient);
  private state = inject(BoardState);
  private columnActions = inject(BoardColumns);

  onColumnDragStart(event: DragEvent, status: StatusColumn) {
    if (event.dataTransfer) {
      event.dataTransfer.setData('application/x-kanban-column', status._id);
      event.dataTransfer.effectAllowed = 'move';
      // Show the whole column as the dragged picture, not just the little handle
      const column = (event.currentTarget as HTMLElement).closest('.column');
      if (column) event.dataTransfer.setDragImage(column, 24, 20);
    }
    this.state.draggingColumnId.set(status._id);
  }

  onColumnDragEnd() {
    this.state.draggingColumnId.set(null);
    this.state.columnDropTarget.set(null);
  }

  // Is the mouse in the second half of the column it is over?
  // That is the right half, or the lower half on small screens where the columns are stacked.
  private isSecondHalf(event: DragEvent) {
    const box = (event.currentTarget as HTMLElement).getBoundingClientRect();
    const stacked = window.matchMedia('(max-width: 640px)').matches;
    return stacked
      ? event.clientY > box.top + box.height / 2
      : event.clientX > box.left + box.width / 2;
  }

  onDragStart(event: DragEvent, task: Task) {
    event.dataTransfer?.setData('text', task._id);
    this.state.draggingId.set(task._id);
  }

  onDragEnd() {
    this.state.draggingId.set(null);
    this.state.dragOverStatus.set(null);
  }

  onDragOver(event: DragEvent, status: StatusColumn) {
    event.preventDefault(); // allows dropping here

    // A column is being dragged: show a bar on the side where it would land
    const movingId = this.state.draggingColumnId();
    if (movingId) {
      if (movingId === status._id) {
        this.state.columnDropTarget.set(null);
        return;
      }
      const after = this.isSecondHalf(event);
      const current = this.state.columnDropTarget();
      if (current?.id !== status._id || current.after !== after) {
        this.state.columnDropTarget.set({ id: status._id, after });
      }
      return;
    }

    this.state.dragOverStatus.set(status.name);
  }

  onDragLeave(event: DragEvent) {
    // Ignore the "leave" that fires when moving over a card inside the same column
    const column = event.currentTarget as HTMLElement;
    if (!column.contains(event.relatedTarget as Node | null)) {
      this.state.dragOverStatus.set(null);
      this.state.columnDropTarget.set(null);
    }
  }

  async onDrop(event: DragEvent, target: StatusColumn) {
    event.preventDefault();

    // A column was dropped here: move it before or after this one
    const movingColumnId = this.state.draggingColumnId();
    if (movingColumnId) {
      const after = this.isSecondHalf(event);
      this.onColumnDragEnd();
      await this.columnActions.moveColumnNextTo(movingColumnId, target._id, after);
      return;
    }

    this.state.dragOverStatus.set(null);
    this.state.draggingId.set(null);

    const taskId = event.dataTransfer?.getData('text');
    const task = this.state.tasks().find(t => t._id === taskId);
    if (!task || this.state.belongsTo(task, target)) return;

    // Remember where the card was, in case the server says no
    const previous = { columnId: task.columnId, status: task.status };

    // Move the card on screen first, so it feels instant
    this.state.tasks.update(list =>
      list.map(t => (t._id === taskId ? { ...t, columnId: target._id, status: target.name } : t))
    );

    try {
      await firstValueFrom(
        this.http.patch(`${API_URL}/todos/${taskId}`, {
          columnId: target._id,
          status: target.name,
        })
      );
      this.state.errorMessage.set('');
    } catch {
      // The server said no, so put the card back
      this.state.tasks.update(list =>
        list.map(t => (t._id === taskId ? { ...t, ...previous } : t))
      );
      this.state.errorMessage.set('Could not move the task. It was put back.');
    }
  }
}
