export type Visibility = 'public' | 'friends' | 'only_me';
export type Persona = { id: string; user_id: string; username: string; display_name: string; bio: string; avatar_path: string | null; cover_path?: string | null; interests?: string[]; created_at?: string };
export type Post = { id: string; author_id: string; body: string; visibility: Visibility; created_at: string };
export type PostMedia = { id: string; post_id: string; object_path: string; media_type: 'image' | 'video'; mime_type: string | null };
export type PostReaction = { post_id: string; user_id: string; kind: string };
export type PostComment = { id: string; post_id: string; author_id: string; body: string; created_at: string };
export type FriendRequest = { id: string; sender_id: string; receiver_id: string; status: string };
export type FriendLink = { user_a: string; user_b: string };
export type ChatMessage = { id: string; conversation_id: string; sender_id: string; body: string | null; media_path: string | null; media_type: string; attachment_name: string | null; created_at: string };
export type MapLocation = { user_id: string; latitude: number; longitude: number; is_visible: boolean };
export type Geo = { lat: number; lng: number; accuracy: number };
export type NotificationEvent = { id: string; kind: string; user_id: string; payload: Record<string, string>; created_at: string; read_at: string | null };
export const nameFor = (profiles: Persona[], userId: string) => profiles.find(p => p.user_id === userId)?.display_name || 'Member';
export const usernameFor = (profiles: Persona[], userId: string) => profiles.find(p => p.user_id === userId)?.username;
export const timeAgo = (value: string) => {
  const delta = Math.max(0, Date.now() - new Date(value).getTime());
  if (delta < 60000) return 'now';
  if (delta < 3600000) return `${Math.floor(delta/60000)}m`;
  if (delta < 86400000) return `${Math.floor(delta/3600000)}h`;
  return new Date(value).toLocaleDateString();
};
/** Sharing across devices requires an actual deployed public origin, not localhost. */
export function publicUrl(path: string): string | null {
  const configured = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, '');
  if (configured && /^https:\/\//.test(configured) && !/localhost|127\.0\.0\.1/.test(configured)) return configured + path;
  if (typeof window !== 'undefined' && /^https:\/\//.test(window.location.origin) && !/localhost|127\.0\.0\.1/.test(window.location.hostname)) return window.location.origin + path;
  return null;
}
