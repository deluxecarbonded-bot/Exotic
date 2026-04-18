export interface User {
  id: string;
  username: string;
  display_name: string;
  bio: string;
  avatar_url: string | null;
  is_verified: boolean;
  is_owner: boolean;
  is_private: boolean;
  followers_count: number;
  following_count: number;
  answers_count: number;
  questions_asked_count: number;
  allow_anonymous: boolean;
  show_online: boolean;
  email_notifications: boolean;
  push_notifications: boolean;
  is_deactivated: boolean;
  deactivated_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface Question {
  id: string;
  content: string;
  sender_id: string | null;
  sender: User | null;
  receiver_id: string;
  receiver: User | null;
  is_anonymous: boolean;
  is_answered: boolean;
  answer: Answer | null;
  created_at: string;
}

export interface Answer {
  id: string;
  content: string;
  question_id: string;
  question: Question | null;
  user_id: string;
  user: User | null;
  likes_count: number;
  is_liked: boolean;
  comments_count: number;
  shares_count: number;
  created_at: string;
}

export interface Comment {
  id: string;
  content: string;
  user_id: string;
  user: User | null;
  answer_id: string;
  parent_id: string | null;
  likes_count: number;
  is_liked: boolean;
  created_at: string;
}

export interface Notification {
  id: string;
  type: 'question_received' | 'answer_posted' | 'follow' | 'like' | 'comment' | 'mention' | 'live_stream';
  actor_id: string;
  actor: User | null;
  target_id: string;
  target_type: 'question' | 'answer' | 'comment' | 'user' | 'live_stream';
  message: string;
  is_read: boolean;
  created_at: string;
}

export interface Follow {
  id: string;
  follower_id: string;
  following_id: string;
  created_at: string;
}

export type ThemeMode = 'light' | 'dark' | 'system';

export interface Post {
  id: string;
  user_id: string;
  user: User | null;
  caption: string;
  media_urls: string[];
  media_types: string[];
  likes_count: number;
  comments_count: number;
  is_liked: boolean;
  created_at: string;
  updated_at: string;
}

export interface AppSettings {
  theme: ThemeMode;
  allow_anonymous_questions: boolean;
  show_online_status: boolean;
  email_notifications: boolean;
  push_notifications: boolean;
}

export type MediaSourceType = 'screen' | 'camera' | 'both' | 'browser' | 'browser_camera' | 'rtmp' | 'none';

export interface LiveStream {
  id: string;
  user_id: string;
  user: User | null;
  title: string;
  description: string;
  status: 'live' | 'ended';
  media_type: MediaSourceType;
  viewer_count: number;
  started_at: string;
  ended_at: string | null;
  created_at: string;
  // RTMP / Cloudflare Stream fields (populated when media_type === 'rtmp')
  rtmp_url: string | null;
  rtmp_key: string | null;
  cf_live_input_uid: string | null;
  cf_embed_url: string | null;
}

export interface LiveMessage {
  id: string;
  stream_id: string;
  user_id: string;
  user: User | null;
  content: string;
  is_pinned: boolean;
  created_at: string;
}

export interface LiveViewer {
  id: string;
  stream_id: string;
  user_id: string;
  user: User | null;
  joined_at: string;
}

export interface Channel {
  id: string;
  name: string;
  handle: string;
  description: string | null;
  avatar_url: string | null;
  owner_id: string;
  owner?: User;
  is_public: boolean;
  subscribers_count: number;
  posts_count: number;
  created_at: string;
  is_subscribed?: boolean;
  is_muted?: boolean;
  member_role?: 'owner' | 'admin' | 'member' | null;
}

export interface ChannelPost {
  id: string;
  channel_id: string;
  user_id: string;
  user?: User;
  content: string | null;
  media_urls: string[];
  media_types: string[];
  views_count: number;
  reactions_count: number;
  comments_count: number;
  is_pinned: boolean;
  posted_as: 'channel' | 'user';
  edited_at: string | null;
  scheduled_for: string | null;
  is_draft: boolean;
  created_at: string;
  my_reaction?: string | null;
  reactions?: { emoji: string; count: number }[];
}

export interface ChannelMember {
  id: string;
  channel_id: string;
  user_id: string;
  user?: User;
  role: 'owner' | 'admin' | 'member';
  joined_at: string;
}

export interface ChannelPostComment {
  id: string;
  post_id: string;
  user_id: string;
  user?: User;
  content: string;
  parent_id: string | null;
  created_at: string;
}

export interface ChannelInvite {
  id: string;
  channel_id: string;
  created_by: string;
  code: string;
  expires_at: string | null;
  max_uses: number | null;
  uses_count: number;
  is_active: boolean;
  created_at: string;
}
