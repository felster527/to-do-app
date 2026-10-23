
export interface GroupMember {
  _id: string;
  username: string;
  email: string;
  profilePictureUrl: string | null;
  isOwner: boolean;
}

export interface Group {
  _id: string;
  name: string;
  ownerId: string;
  maxMembers: number; 
  members: GroupMember[];
}


export interface Invitation {
  _id: string;
  token: string;
  inviteLink: string;
  expireAt: string;
  maxUses: number;
  currentUses: number;
  isRevoked: boolean;
  status: 'active' | 'revoked' | 'expired' | 'full';
}
