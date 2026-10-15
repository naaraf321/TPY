import {getSupabase} from './supabase';
/** Online status is derived from active Realtime sessions, not fabricated counts. */
export const presenceChannelName='tpy-community-presence';
export function getPresenceChannel(userId:string){const db=getSupabase();if(!db)return null;return db.channel(presenceChannelName,{config:{presence:{key:userId}}})}
