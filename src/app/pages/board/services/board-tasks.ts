import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';

import { API_URL } from '../../../core/api';
import { StatusColumn } from '../../../models/status';
import { Task, TaskComment } from '../../../models/task';
import { dueValue } from '../board.utils';

import { BoardState } from './board-state';

// Everything you can do with tasks: add, edit, delete, tick off and comment.
@Injectable()
export class BoardTasks {
  private http = inject(HttpClient);
  private state = inject(BoardState);

  // ---------- Adding and deleting tasks ----------

  openTaskForm(status: StatusColumn) {
    this.state.addingTaskTo.set(status._id);
    setTimeout(() => document.getElementById(`new-title-${status._id}`)?.focus());
  }

  closeTaskForm() {
    this.state.addingTaskTo.set(null);
  }

  // Adds a task to the column whose form was used. The form stays open for the next task.
  async addTaskTo(
    status: StatusColumn,
    titleInput: HTMLInputElement,
    descInput: HTMLTextAreaElement,
    priorityInput: HTMLSelectElement,
    dueInput: HTMLInputElement,
  ) {
    const title = titleInput.value.trim();
    const description = descInput.value.trim();
    const priority = priorityInput.value;
    const dueDate = dueInput.value;

    if (!title) {
      this.state.errorMessage.set('A task needs a title.');
      return;
    }

    try {
      const created = await firstValueFrom(
        this.http.post<Task>(`${API_URL}/todos`, {
          title,
          description,
          columnId: status._id,
          status: status.name,
          // Only sent when you picked something (the backend wants a real value, not an empty one)
          ...(priority ? { priority } : {}),
          ...(dueDate ? { dueDate } : {}),
          ...(this.state.workspaceId() ? { groupId: this.state.workspaceId() } : {}),
        })
      );
      this.state.tasks.update(list => [...list, created]);
      this.state.errorMessage.set('');
      titleInput.value = '';
      descInput.value = '';
      priorityInput.value = '';
      dueInput.value = '';
      titleInput.focus();
    } catch {
      this.state.errorMessage.set('Could not add the task. Please try again.');
    }
  }

  async deleteTask(id: string) {
    try {
      await firstValueFrom(this.http.delete(`${API_URL}/todos/${id}`));
      this.state.tasks.update(list => list.filter(t => t._id !== id));
      this.state.errorMessage.set('');
    } catch {
      this.state.errorMessage.set('Could not delete the task. Please try again.');
    }
  }

  // ---------- Editing a task ----------

  startEdit(task: Task) {
    this.state.editingId.set(task._id);
    // Wait for the edit form to appear, then put the cursor in the title box
    setTimeout(() => document.getElementById(`edit-title-${task._id}`)?.focus());
  }

  cancelEdit() {
    this.state.editingId.set(null);
  }

  async saveEdit(
    task: Task,
    titleInput: HTMLInputElement,
    descInput: HTMLTextAreaElement,
    priorityInput: HTMLSelectElement,
    dueInput: HTMLInputElement,
  ) {
    const title = titleInput.value.trim();
    const description = descInput.value.trim();
    const priority = priorityInput.value;
    const dueDate = dueInput.value;

    if (!title) {
      this.state.errorMessage.set('A task needs a title.');
      return;
    }

    // Only send what really changed. An empty priority or date is sent as null, which clears it.
    const changes: Partial<Task> = {};
    if (title !== task.title) changes.title = title;
    if (description !== (task.description ?? '')) changes.description = description;
    if (priority !== (task.priority ?? '')) changes.priority = priority || null;
    if (dueDate !== dueValue(task)) changes.dueDate = dueDate || null;

    // Nothing changed, so just close the form
    if (Object.keys(changes).length === 0) {
      this.cancelEdit();
      return;
    }

    try {
      await firstValueFrom(this.http.patch(`${API_URL}/todos/${task._id}`, changes));
      this.state.updateTask(task._id, changes);
      this.state.errorMessage.set('');
      this.state.editingId.set(null);
    } catch {
      // Stay in edit mode so the typed text is not lost
      this.state.errorMessage.set('Could not save your changes. Please try again.');
    }
  }

  // ---------- Task details: done checkbox, priority, due date, comments ----------

  async toggleDone(task: Task) {
    const isCompleted = !task.isCompleted;

    // Tick it on screen first, so it feels instant
    this.state.updateTask(task._id, { isCompleted });

    try {
      await firstValueFrom(this.http.patch(`${API_URL}/todos/${task._id}`, { isCompleted }));
      this.state.errorMessage.set('');
    } catch {
      // The server said no, so put the checkbox back
      this.state.updateTask(task._id, { isCompleted: !isCompleted });
      this.state.errorMessage.set('Could not update the task. Please try again.');
    }
  }

  toggleComments(task: Task) {
    if (this.state.commentsOpenFor() === task._id) {
      this.state.commentsOpenFor.set(null);
      return;
    }
    this.state.commentsOpenFor.set(task._id);
    setTimeout(() => document.getElementById(`comment-${task._id}`)?.focus());
  }

  closeComments() {
    this.state.commentsOpenFor.set(null);
  }

  // Who wrote a comment: you, a member of the open group, or someone who has left
  commentAuthor(comment: TaskComment) {
    if (!comment.userId) return '';
    if (comment.userId === this.state.myId) return 'You';
    const member = this.state.activeGroup()?.members.find(m => m._id === comment.userId);
    return member ? member.username : 'Former member';
  }

  // Handed to the task cards, so they can show who wrote each comment
  readonly authorOf = (comment: TaskComment) => this.commentAuthor(comment);

  async addComment(task: Task, input: HTMLInputElement) {
    const content = input.value.trim();
    if (!content) return;

    try {
      // The backend sends back the whole task, including all of its comments
      const updated = await firstValueFrom(
        this.http.post<Task>(`${API_URL}/todos/${task._id}/comments`, { content })
      );
      this.state.updateTask(task._id, { comments: updated.comments ?? [] });
      this.state.errorMessage.set('');
      input.value = '';
      input.focus();
    } catch {
      this.state.errorMessage.set('Could not add the comment. Please try again.');
    }
  }
}
