import { getSupabase } from './supabase';
export const POST_BUCKET = 'tgy-post-media';
export const CHAT_BUCKET = 'tgy-chat-media';

/** Auth-aware, short lived URLs for media in private Supabase buckets. */
export async function signedMedia(bucket: string, path: string) {
  const db = getSupabase();
  if (!db) throw Error('Supabase unavailable');
  const { data, error } = await db.storage.from(bucket).createSignedUrl(path, 3600);
  if (error) throw error;
  return data.signedUrl;
}

export function validateUpload(file: File, kind: 'post' | 'chat') {
  const allowed = kind === 'post'
    ? ['image/jpeg','image/png','image/webp','image/gif','video/mp4','video/webm']
    : ['image/jpeg','image/png','image/webp','image/gif','video/mp4','video/webm','audio/webm','audio/mp4','audio/mpeg','audio/ogg','application/pdf'];
  if (!allowed.includes(file.type)) throw Error('This file type is not supported. Use an image, MP4/WebM video, or supported chat attachment.');
  if (file.size > 25 * 1024 * 1024) throw Error('Maximum file size is 25 MB.');
}

export async function uploadMedia(bucket: string, userId: string, parentId: string, file: File) {
  const db = getSupabase();
  if (!db) throw Error('Supabase unavailable');
  const extension = (file.name.split('.').pop() || 'bin').toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 8);
  const path = `${userId}/${parentId}/${crypto.randomUUID()}.${extension}`;
  const { error } = await db.storage.from(bucket).upload(path, file, { upsert: false, contentType: file.type });
  if (error) throw error;
  return path;
}
