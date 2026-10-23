import { Component, OnInit, computed, inject, input, output, signal } from '@angular/core';
import { Groups, Result } from '../../../../core/groups';
import { Group, GroupMember, Invitation } from '../../../../models/group';

// The group settings window: details, members, invite links, leave or delete
@Component({
  selector: 'app-group-settings-dialog',
  styleUrls: ['../../styles/ui.css', '../../styles/modal.css', './group-settings-dialog.css'],
  templateUrl: './group-settings-dialog.html',
})
export class GroupSettingsDialog implements OnInit {
  private groupsApi = inject(Groups);

  // The group that is open, and who you are in it
  activeGroup = input.required<Group>();
  isOwner = input.required<boolean>();
  myId = input<string | null>(null);

  closed = output<void>();
  groupChanged = output<Group>(); // the group has new data (name, limit, members)
  groupGone = output<string>(); // you left the group or deleted it (the group id)

  groupError = signal('');
  groupBusy = signal(false);
  groupDetailsNote = signal(''); // small "Saved." message under the group name form
  invitations = signal<Invitation[]>([]);
  copiedInvitationId = signal<string | null>(null);
  // The link you just made with "Create link". Only this one is shown big, the rest sit under "Manage links".
  latestInvitationId = signal<string | null>(null);
  latestInvitation = computed(() => this.invitations().find(i => i._id === this.latestInvitationId()) ?? null);

  async ngOnInit() {
    // Only the owner can see and manage the invite links
    if (!this.isOwner()) return;

    const result = await this.groupsApi.listInvitations(this.activeGroup()._id);
    if (result.ok) {
      this.invitations.set(result.data);
    } else {
      this.groupError.set(result.message);
    }
  }

  // ---------- Group details ----------

  // Owner only: save a new group name and/or member limit
  async saveGroupDetails(nameInput: HTMLInputElement, limitInput: HTMLInputElement) {
    const group = this.activeGroup();

    const name = nameInput.value.trim();
    const maxMembers = Number(limitInput.value);

    this.groupDetailsNote.set('');
    this.groupError.set('');

    if (name.length < 2 || name.length > 50) {
      this.groupError.set('Use a group name of 2 to 50 characters.');
      return;
    }
    if (!Number.isInteger(maxMembers) || maxMembers < 1 || maxMembers > 100) {
      this.groupError.set('The limit must be a whole number from 1 to 100.');
      return;
    }
    if (maxMembers < group.members.length) {
      this.groupError.set(`There are already ${group.members.length} people in this group. Remove someone first, or choose a higher limit.`);
      return;
    }
    if (name === group.name && maxMembers === group.maxMembers) {
      this.groupDetailsNote.set('Nothing changed.');
      return;
    }

    this.groupBusy.set(true);
    const result = await this.groupsApi.update(group._id, name, maxMembers);
    this.groupBusy.set(false);

    if (result.ok) {
      this.groupChanged.emit(result.data);
      this.groupDetailsNote.set('Saved.');
    } else {
      this.groupError.set(result.message);
    }
  }

  // ---------- Invite links ----------

  async createInvitation(maxUsesInput: HTMLInputElement, daysInput: HTMLInputElement) {
    this.groupError.set('');
    this.groupBusy.set(true);
    const result = await this.groupsApi.createInvitation(
      this.activeGroup()._id,
      Number(maxUsesInput.value),
      Number(daysInput.value)
    );
    this.groupBusy.set(false);

    if (result.ok) {
      this.invitations.update(list => [result.data, ...list]);
      this.latestInvitationId.set(result.data._id);
    } else {
      this.groupError.set(result.message);
    }
  }

  // Copies text to the clipboard. The modern way only works on https or localhost,
  // so on a plain http address (like http://192.168.x.x:4200) we use the old way instead.
  private async copyText(text: string) {
    if (typeof navigator !== 'undefined' && navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return;
    }

    const box = document.createElement('textarea');
    box.value = text;
    box.setAttribute('readonly', '');
    box.style.position = 'fixed';
    box.style.opacity = '0';
    document.body.appendChild(box);
    box.select();
    box.setSelectionRange(0, text.length);
    const copied = document.execCommand('copy');
    document.body.removeChild(box);
    if (!copied) throw new Error('copy failed');
  }

  async copyInvitation(invitation: Invitation) {
    try {
      await this.copyText(invitation.inviteLink);
      this.copiedInvitationId.set(invitation._id);
      setTimeout(() => {
        if (this.copiedInvitationId() === invitation._id) this.copiedInvitationId.set(null);
      }, 2000);
    } catch {
      this.groupError.set('Could not copy the link. Click the link box and copy it by hand.');
    }
  }

  async saveMaxUses(invitation: Invitation, input: HTMLInputElement) {
    this.groupError.set('');
    this.groupBusy.set(true);
    const result = await this.groupsApi.updateMaxUses(invitation._id, Number(input.value));
    this.groupBusy.set(false);

    if (result.ok) {
      this.replaceInvitation(result.data);
    } else {
      this.groupError.set(result.message);
    }
  }

  async revokeInvitation(invitation: Invitation) {
    if (!confirm('Turn this invite link off? Nobody can join with it any more.')) return;

    this.groupError.set('');
    this.groupBusy.set(true);
    const result = await this.groupsApi.revokeInvitation(invitation._id);
    this.groupBusy.set(false);

    if (result.ok) {
      this.replaceInvitation(result.data);
    } else {
      this.groupError.set(result.message);
    }
  }

  async deleteInvitation(invitation: Invitation) {
    if (!confirm('Delete this invite link for good?')) return;

    this.groupError.set('');
    this.groupBusy.set(true);
    const result = await this.groupsApi.deleteInvitation(invitation._id);
    this.groupBusy.set(false);

    if (result.ok) {
      this.invitations.update(list => list.filter(i => i._id !== invitation._id));
    } else {
      this.groupError.set(result.message);
    }
  }

  private replaceInvitation(updated: Invitation) {
    this.invitations.update(list => list.map(i => (i._id === updated._id ? updated : i)));
  }

  invitationStatusLabel(invitation: Invitation) {
    return { active: 'Active', revoked: 'Turned off', expired: 'Expired', full: 'Full' }[invitation.status];
  }

  invitationDate(invitation: Invitation) {
    return new Date(invitation.expireAt).toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  }

  // ---------- Members, leaving and deleting ----------

  async kickMember(member: GroupMember) {
    const group = this.activeGroup();
    if (!confirm(`Remove ${member.username} from "${group.name}"?`)) return;

    this.groupError.set('');
    this.groupBusy.set(true);
    const result = await this.groupsApi.kick(group._id, member._id);
    this.groupBusy.set(false);

    if (!result.ok) {
      this.groupError.set(result.message);
      return;
    }
    this.groupChanged.emit({ ...group, members: group.members.filter(m => m._id !== member._id) });
  }

  async leaveGroup() {
    const group = this.activeGroup();
    if (!confirm(`Leave "${group.name}"? You will lose access to its board.`)) return;
    await this.finishAndForget(group, this.groupsApi.leave(group._id));
  }

  async deleteGroup() {
    const group = this.activeGroup();
    if (!confirm(`Delete "${group.name}" for everyone? Its columns and tasks are deleted for good.`)) return;
    await this.finishAndForget(group, this.groupsApi.remove(group._id));
  }

  // After you left or deleted a group: tell the parent, which opens your own board
  private async finishAndForget(group: Group, request: Promise<Result<unknown>>) {
    this.groupError.set('');
    this.groupBusy.set(true);
    const result = await request;
    this.groupBusy.set(false);

    if (!result.ok) {
      this.groupError.set(result.message);
      return;
    }
    this.groupGone.emit(group._id);
  }

  memberInitial(member: GroupMember) {
    return (member.username || member.email || '?').charAt(0).toUpperCase();
  }
}
