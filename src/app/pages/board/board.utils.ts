import { Task, TaskComment } from '../../models/task';

// Pure helper functions for the board (no state, no server calls)

// Are these two values the same data? (used to skip screen updates when nothing changed)
export const sameData = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

// Returns dark or light text, whichever is easier to read on this background color
export function getTextColor(hex: string) {
  const value = hex.replace('#', '');
  const r = parseInt(value.substring(0, 2), 16);
  const g = parseInt(value.substring(2, 4), 16);
  const b = parseInt(value.substring(4, 6), 16);
  const brightness = (r * 299 + g * 587 + b * 114) / 1000;
  return brightness > 150 ? '#1d2433' : '#ffffff';
}

export function priorityLabel(priority: string) {
  return priority.charAt(0).toUpperCase() + priority.slice(1);
}

// The date part of the due date as YYYY-MM-DD (the format the date box understands)
export function dueValue(task: Task) {
  return task.dueDate ? task.dueDate.slice(0, 10) : '';
}

// Today as YYYY-MM-DD, in your own time zone
export function todayValue() {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${now.getFullYear()}-${month}-${day}`;
}

// A task is overdue when its date is before today and it is not done yet
export function isOverdue(task: Task) {
  const due = dueValue(task);
  return !!due && !task.isCompleted && due < todayValue();
}

export function dueLabel(task: Task) {
  const due = dueValue(task);
  if (!due) return '';
  if (due === todayValue()) return 'Due today';

  const text = new Date(`${due}T00:00:00`).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
  return isOverdue(task) ? `Overdue: ${text}` : `Due ${text}`;
}

export function commentTime(comment: TaskComment) {
  if (!comment.createdAt) return '';
  return new Date(comment.createdAt).toLocaleString('en-GB', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}
