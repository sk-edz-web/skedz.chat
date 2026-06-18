export interface UserProfile {
  name: string;
  img: string;
  contactNo: string;
  bio?: string;
  mail?: string;
  mobile?: string;
  links?: string;
  namePublic?: boolean;
  bioPublic?: boolean;
  mailPublic?: boolean;
  mobilePublic?: boolean;
  linksPublic?: boolean;
}

export interface Room {
  id: string;
  name: string;
  icon: string;
  type: 'public' | 'private' | 'direct';
  pass?: string;
  adminId?: string;
  users?: { [uid: string]: boolean };
}

export interface QuotedMessage {
  msgId: string;
  senderName: string;
  text: string;
  type: string;
}

export interface Message {
  id?: string;
  text: string;
  type: 'text' | 'audio' | 'gif' | 'call_invite';
  mimeType?: string;
  senderId: string;
  senderName: string;
  senderImg: string;
  timestamp: number;
  callType?: 'audio' | 'video';
  replyTo?: QuotedMessage | null;
  reactions?: { [uid: string]: string };
  seenBy?: { [uid: string]: boolean };
}

export interface CallStatus {
  isRinging: boolean;
  type: 'audio' | 'video';
  callerId: string;
  callerName: string;
  callerImg: string;
  callerNumber?: string;
  ended: boolean;
  roomId?: string;
}

export interface CallSignal {
  offer?: { type: string; sdp: string };
  answer?: { type: string; sdp: string };
  status?: CallStatus;
}

export interface Feedback {
  id?: string;
  uid: string;
  name: string;
  email: string;
  rating: number;
  text: string;
  timestamp: number;
  type?: 'feedback' | 'bug';
  contactNo?: string;
}

declare global {
  interface ImportMeta {
    readonly env: Record<string, string>;
  }
}

