import { Component, OnDestroy, OnInit, inject } from '@angular/core';
import { BoardTopbar } from './board-topbar/board-topbar';
import { TaskCard } from './task-card/task-card';
import { PasswordReminderDialog } from './dialogs/password-reminder-dialog/password-reminder-dialog';
import { GroupNewDialog } from './dialogs/group-new-dialog/group-new-dialog';
import { GroupSettingsDialog } from './dialogs/group-settings-dialog/group-settings-dialog';
import { ProfileDialog } from './dialogs/profile-dialog/profile-dialog';
import { BoardAccount } from './services/board-account';
import { BoardColumns } from './services/board-columns';
import { BoardData } from './services/board-data';
import { BoardDragDrop } from './services/board-drag-drop';
import { BoardState } from './services/board-state';
import { BoardSwitcher } from './services/board-switcher';
import { BoardSync } from './services/board-sync';
import { BoardTasks } from './services/board-tasks';
import { BoardWorkspace } from './services/board-workspace';
import { getTextColor } from './board.utils';

// The board page. The real work lives in the services in ./services (one per topic).
// This file only starts the page and hands the services to the template.
@Component({
  selector: 'app-board',
  imports: [BoardTopbar, TaskCard, PasswordReminderDialog, ProfileDialog, GroupNewDialog, GroupSettingsDialog],
  // One set of services per board page, so nothing is shared between logins
  providers: [BoardState, BoardWorkspace, BoardData, BoardColumns, BoardTasks, BoardDragDrop, BoardSync, BoardSwitcher, BoardAccount],
  styleUrls: ['./styles/ui.css', './board.css'],
  templateUrl: './board.html',
})
export class Board implements OnInit, OnDestroy {
  private state = inject(BoardState);
  private workspace = inject(BoardWorkspace);
  private columnActions = inject(BoardColumns);
  private taskActions = inject(BoardTasks);
  private dragDrop = inject(BoardDragDrop);
  private sync = inject(BoardSync);
  private switcher = inject(BoardSwitcher);
  private account = inject(BoardAccount);
 
  readonly user = this.state.user;
  readonly myId = this.state.myId;
  readonly groups = this.state.groups;
  readonly workspaceId = this.state.workspaceId;
  readonly activeGroup = this.state.activeGroup;
  readonly isGroupOwner = this.state.isGroupOwner;
  readonly canManageColumns = this.state.canManageColumns;
  readonly notice = this.state.notice;
  readonly groupWindow = this.state.groupWindow;
  readonly statuses = this.state.statuses;
  readonly errorMessage = this.state.errorMessage;
  readonly loading = this.state.loading;
  readonly addingTaskTo = this.state.addingTaskTo;
  readonly addingColumn = this.state.addingColumn;
  readonly editingId = this.state.editingId;
  readonly commentsOpenFor = this.state.commentsOpenFor;
  readonly dragOverStatus = this.state.dragOverStatus;
  readonly draggingId = this.state.draggingId;
  readonly renamingColumnId = this.state.renamingColumnId;
  readonly draggingColumnId = this.state.draggingColumnId;
  readonly columnDropTarget = this.state.columnDropTarget;
  readonly editingProfile = this.state.editingProfile;
  readonly pictureFailed = this.state.pictureFailed;
  readonly getTasksByColumn = this.state.getTasksByColumn.bind(this.state);

  // Groups and boards (services/board-workspace.ts)
  readonly openNewGroup = this.workspace.openNewGroup.bind(this.workspace);
  readonly openGroupSettings = this.workspace.openGroupSettings.bind(this.workspace);
  readonly closeGroupWindow = this.workspace.closeGroupWindow.bind(this.workspace);
  readonly onGroupChanged = this.workspace.onGroupChanged.bind(this.workspace);

  // Columns (services/board-columns.ts)
  readonly openColumnForm = this.columnActions.openColumnForm.bind(this.columnActions);
  readonly closeColumnForm = this.columnActions.closeColumnForm.bind(this.columnActions);
  readonly addStatus = this.columnActions.addStatus.bind(this.columnActions);
  readonly deleteStatus = this.columnActions.deleteStatus.bind(this.columnActions);
  readonly startRename = this.columnActions.startRename.bind(this.columnActions);
  readonly cancelRename = this.columnActions.cancelRename.bind(this.columnActions);
  readonly saveRename = this.columnActions.saveRename.bind(this.columnActions);
  readonly changeStatusColor = this.columnActions.changeStatusColor.bind(this.columnActions);
  readonly saveStatusColor = this.columnActions.saveStatusColor.bind(this.columnActions);
  readonly moveColumn = this.columnActions.moveColumn.bind(this.columnActions);

  // Tasks (services/board-tasks.ts)
  readonly openTaskForm = this.taskActions.openTaskForm.bind(this.taskActions);
  readonly closeTaskForm = this.taskActions.closeTaskForm.bind(this.taskActions);
  readonly addTaskTo = this.taskActions.addTaskTo.bind(this.taskActions);
  readonly deleteTask = this.taskActions.deleteTask.bind(this.taskActions);
  readonly startEdit = this.taskActions.startEdit.bind(this.taskActions);
  readonly cancelEdit = this.taskActions.cancelEdit.bind(this.taskActions);
  readonly saveEdit = this.taskActions.saveEdit.bind(this.taskActions);
  readonly toggleDone = this.taskActions.toggleDone.bind(this.taskActions);
  readonly toggleComments = this.taskActions.toggleComments.bind(this.taskActions);
  readonly closeComments = this.taskActions.closeComments.bind(this.taskActions);
  readonly addComment = this.taskActions.addComment.bind(this.taskActions);
  readonly authorOf = this.taskActions.authorOf;

  // Drag and drop (services/board-drag-drop.ts)
  readonly onColumnDragStart = this.dragDrop.onColumnDragStart.bind(this.dragDrop);
  readonly onColumnDragEnd = this.dragDrop.onColumnDragEnd.bind(this.dragDrop);
  readonly onDragStart = this.dragDrop.onDragStart.bind(this.dragDrop);
  readonly onDragEnd = this.dragDrop.onDragEnd.bind(this.dragDrop);
  readonly onDragOver = this.dragDrop.onDragOver.bind(this.dragDrop);
  readonly onDragLeave = this.dragDrop.onDragLeave.bind(this.dragDrop);
  readonly onDrop = this.dragDrop.onDrop.bind(this.dragDrop);

  // Helper the template calls directly (it lives in board.utils.ts)
  readonly getTextColor = getTextColor;

  // Boards (services/board-switcher.ts)
  readonly switchWorkspace = this.switcher.switchWorkspace.bind(this.switcher);
  readonly refreshBoard = this.switcher.refreshBoard.bind(this.switcher);
  readonly onGroupCreated = this.switcher.onGroupCreated.bind(this.switcher);
  readonly onGroupGone = this.switcher.onGroupGone.bind(this.switcher);

  // Account and profile (services/board-account.ts)
  readonly logout = this.account.logout.bind(this.account);
  readonly openProfile = this.account.openProfile.bind(this.account);
  readonly closeProfile = this.account.closeProfile.bind(this.account);
  readonly onProfileSaved = this.account.onProfileSaved.bind(this.account);

  get displayName() {
    return this.account.displayName;
  }
  get initial() {
    return this.account.initial;
  }
  get pictureUrl() {
    return this.account.pictureUrl;
  }

  async ngOnInit() {
    await this.switcher.start();
    this.sync.startLiveUpdates();
  }

  ngOnDestroy() {
    this.sync.stopLiveUpdates();
  }

}
