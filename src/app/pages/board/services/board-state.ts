import { Injectable, computed, inject, signal } from '@angular/core';
import { API_URL } from '../../../core/api';
import { Auth } from '../../../core/auth';
import { Group } from '../../../models/group';
import { StatusColumn } from '../../../models/status';
import { Task } from '../../../models/task';
import { AUTO_STATUS_COLOR, ServerColumn } from '../board.constants';

@Injectable()
export class BoardState {
  private auth = inject(Auth);

  user = signal(this.auth.currentUser);
  myId = this.auth.userId;

  groups = signal<Group[]>([]);
  workspaceId = signal<string | null>(null);

  activeGroup = computed(
    () => this.groups().find(g => g._id === this.workspaceId()) ?? null
  );

  isGroupOwner = computed(() => this.activeGroup()?.ownerId === this.myId);

  canManageColumns = computed(() => !this.activeGroup() || this.isGroupOwner());

  notice = signal('');
  groupWindow = signal<'new' | 'settings' | null>(null);

  statuses = signal<StatusColumn[]>([]);
  tasks = signal<Task[]>([]);
  errorMessage = signal('');
  loading = signal(true);
  columnsLoaded = false;

  addingTaskTo = signal<string | null>(null);
  addingColumn = signal(false);

  editingId = signal<string | null>(null);
  commentsOpenFor = signal<string | null>(null);

  dragOverStatus = signal<string | null>(null);
  draggingId = signal<string | null>(null);

  pickingColor = false;

  renamingColumnId = signal<string | null>(null);

  draggingColumnId = signal<string | null>(null);
  columnDropTarget = signal<{ id: string; after: boolean } | null>(null);

  editingProfile = signal(false);
  pictureFailed = signal(false);

  columnsListUrl() {
    const id = this.workspaceId();
    return id ? `${API_URL}/columns/group/${id}` : `${API_URL}/columns`;
  }

  tasksListUrl() {
    const id = this.workspaceId();
    return id ? `${API_URL}/todos/group/${id}` : `${API_URL}/todos`;
  }

  toStatus(column: ServerColumn): StatusColumn {
    return {
      _id: column._id,
      name: column.name,
      color: column.color ?? AUTO_STATUS_COLOR,
      order: column.order ?? 0,
    };
  }

  taskColumnId(task: Task): string | undefined {
    const column = task.columnId;
    return typeof column === 'object' && column !== null
      ? column._id
      : column;
  }

  belongsTo(task: Task, status: StatusColumn) {
    const columnId = this.taskColumnId(task);
    return columnId ? columnId === status._id : task.status === status.name;
  }

  getTasksByColumn(status: StatusColumn) {
    return this.tasks().filter(t => this.belongsTo(t, status));
  }

  updateTask(id: string, changes: Partial<Task>) {
    this.tasks.update(list =>
      list.map(t => (t._id === id ? { ...t, ...changes } : t))
    );
  }
}
