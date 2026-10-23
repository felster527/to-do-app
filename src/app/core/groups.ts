import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Observable, firstValueFrom, map } from 'rxjs';
import { API_URL } from './api';
import { Group, Invitation } from '../models/group';

// The join page saves the invite token here until you are logged in and the board can use it
export const PENDING_INVITE_KEY = 'kanban_pending_invite';

// How many people a new group allows (the owner counts too)
export const DEFAULT_MAX_MEMBERS = 10;

// Every call answers with ok + data, or ok = false + a message that can be shown on screen
export type Result<T> = { ok: true; data: T } | { ok: false; message: string; groupId?: string };

// Messages by HTTP status. A call can add its own on top of these.
type Messages = Partial<Record<number, string>>;

const COMMON_MESSAGES: Messages = {
  0: 'Cannot reach the server. Is the backend running?',
  403: 'Only the group owner can do that.',
  404: 'That group or invite link does not exist any more.',
};

@Injectable({ providedIn: 'root' })
export class Groups {
  private http = inject(HttpClient);

  list() {
    return this.run(this.http.get<Group[]>(`${API_URL}/groups`), {
      403: 'You do not have access to your groups.',
    });
  }

  // The backend needs a size limit for every group. The owner can change it later in the group settings.
  create(name: string, maxMembers = DEFAULT_MAX_MEMBERS) {
    return this.run(this.http.post<Group>(`${API_URL}/groups`, { name: name.trim(), maxMembers }), {
      400: 'Please enter a group name of 2 to 50 characters.',
    }, true);
  }

  // Owner only: change the group name and/or how many people may be in it
  update(groupId: string, name: string, maxMembers: number) {
    return this.run(this.http.patch<Group>(`${API_URL}/groups/${groupId}`, { name: name.trim(), maxMembers }), {
      400: 'Use a name of 2 to 50 characters and a limit of 1 to 100 people, not lower than the number of people already in the group.',
    }, true);
  }

  createInvitation(groupId: string, maxUses: number, expiresInDays: number) {
    return this.run(
      this.http
        .post<Invitation>(`${API_URL}/groups/${groupId}/invitations`, { maxUses, expiresInDays })
        .pipe(map(invitation => this.withLink(invitation))),
      { 400: 'Use a limit of 1 to 100 people and 1 to 30 days.' }
    );
  }

  listInvitations(groupId: string) {
    return this.run(
      this.http
        .get<Invitation[]>(`${API_URL}/groups/${groupId}/invitations`)
        .pipe(map(list => list.map(invitation => this.withLink(invitation))))
    );
  }

  updateMaxUses(invitationId: string, newMaxUses: number) {
    return this.run(
      this.http
        .patch<Invitation>(`${API_URL}/groups/invitations/${invitationId}/max-uses`, { newMaxUses })
        .pipe(map(invitation => this.withLink(invitation))),
      { 400: 'The limit must be 1 to 100 and cannot be lower than the number of people who already joined.' }
    );
  }

  revokeInvitation(invitationId: string) {
    return this.run(
      this.http
        .patch<Invitation>(`${API_URL}/groups/invitations/${invitationId}/revoke`, {})
        .pipe(map(invitation => this.withLink(invitation)))
    );
  }

  deleteInvitation(invitationId: string) {
    return this.run(this.http.delete<unknown>(`${API_URL}/groups/invitations/${invitationId}`), {
      400: 'Turn the link off before deleting it.',
    });
  }

  join(token: string) {
    return this.run(this.http.post<{ groupId: string }>(`${API_URL}/groups/join`, { token }), {
      400: 'This invite link cannot be used any more. It was turned off, it has expired, or the group is full.',
      404: 'This invite link is not valid.',
      409: 'You are already in this group.',
    });
  }

  leave(groupId: string) {
    return this.run(this.http.patch<unknown>(`${API_URL}/groups/${groupId}/leave`, {}), {
      400: 'The owner cannot leave the group. Delete the group instead.',
      404: 'You are not in this group any more.',
    });
  }

  kick(groupId: string, memberId: string) {
    return this.run(this.http.patch<unknown>(`${API_URL}/groups/${groupId}/kick/${memberId}`, {}), {
      400: 'You cannot remove yourself from the group.',
      404: 'That person is not in this group any more.',
    });
  }

  remove(groupId: string) {
    return this.run(this.http.delete<unknown>(`${API_URL}/groups/${groupId}`));
  }


  private withLink(invitation: Invitation): Invitation {
    if (typeof window === 'undefined' || !invitation.token) return invitation;
    return { ...invitation, inviteLink: `${window.location.origin}/join?token=${invitation.token}` };
  }

  // The reason the backend gave for a 400 (it may be a text or a list of texts), or ''
  private serverReason(error: HttpErrorResponse): string {
    const reason = error.error?.message;
    if (Array.isArray(reason)) return reason.join('. ');
    return typeof reason === 'string' ? reason : '';
  }

  // Runs one request and turns the answer (or the error) into a Result.
  // With showServerReason, a 400 shows what the backend really said instead of our guess.
  private async run<T>(
    request: Observable<T>,
    messages: Messages = {},
    showServerReason = false
  ): Promise<Result<T>> {
    try {
      return { ok: true, data: await firstValueFrom(request) };
    } catch (error) {
      if (error instanceof HttpErrorResponse) {
        const reason = showServerReason && error.status === 400 ? this.serverReason(error) : '';
        const message = reason || messages[error.status] || COMMON_MESSAGES[error.status];
        if (message) {
          // When you are already in the group, the backend also says which group it is
          return { ok: false, message, groupId: error.error?.groupId };
        }
      }
      return { ok: false, message: 'Something went wrong. Please try again.' };
    }
  }
}
