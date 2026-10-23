import { Component, input, output } from '@angular/core';
import { Task, TaskComment } from '../../../models/task';
import { commentTime, dueLabel, dueValue, isOverdue, priorityLabel } from '../board.utils';

// The form fields of the edit form, handed to the board when you press Save
export interface TaskEditFields {
  title: HTMLInputElement;
  description: HTMLTextAreaElement;
  priority: HTMLSelectElement;
  due: HTMLInputElement;
}

// One task on the board: the card, its edit form, and its comments.
// The board owns the data and the open/closed state; this component only shows it and reports clicks.
@Component({
  selector: 'app-task-card',
  styleUrls: ['../styles/ui.css', './task-card.css'],
  templateUrl: './task-card.html',
})
export class TaskCard {
  cardTask = input.required<Task>({ alias: 'task' });
  editing = input(false);
  dragging = input(false);
  commentsOpen = input(false);
  authorOf = input.required<(comment: TaskComment) => string>();

  editStart = output<void>();
  editCancel = output<void>();
  editSave = output<TaskEditFields>();
  deleteClick = output<void>();
  doneToggle = output<void>();
  dragStartCard = output<DragEvent>();
  dragEndCard = output<void>();
  commentsToggle = output<void>();
  commentsClose = output<void>();
  commentAdd = output<HTMLInputElement>();

  // Helper functions the template calls directly (they live in board.utils.ts)
  readonly priorityLabel = priorityLabel;
  readonly dueValue = dueValue;
  readonly isOverdue = isOverdue;
  readonly dueLabel = dueLabel;
  readonly commentTime = commentTime;
}
