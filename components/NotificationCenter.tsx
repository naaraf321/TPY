'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Bell, BellRing, Check, Settings, X } from 'lucide-react';
import type { User } from '@supabase/supabase-js';
import { getSupabase } from '@/lib/supabase';
import { type NotificationEvent, type Persona, nameFor, timeAgo } from '@/lib/types';

const db = getSupabase();
type Props = {
  user: User;
  directory: Persona[];
  onNavigate: (kind: string, payload: Record<string, string>) => void;
  onError: (error: unknown) => void;
};
const labels: Record<string, string> = {
  friend_request: 'sent you a friend request',
  friend_accepted: 'accepted your friend request',
  message: 'sent you a message',
  reaction: 'liked your post',
  comment: 'commented on your post',
  share: 'shared your post',
  profile_view: 'viewed your profile',
  follow: 'started following you',
};

export default function NotificationCenter({user,directory,onNavigate,onError}:Props) {
  const [items,setItems] = useState<NotificationEvent[]>([]);
  const [open,setOpen] = useState(false);
  const [toast,setToast] = useState('');
  const [browserEnabled,setBrowserEnabled] = useState(false);
  const knownIds = useRef(new Set<string>());
  const started = useRef(false);
  const directoryRef = useRef(directory);
  directoryRef.current = directory;
  const errorRef = useRef(onError);
  errorRef.current = onError;

  const titleFor = useCallback((n:NotificationEvent) => {
    const actor = String(n.payload?.actor_id ?? '');
    return `${nameFor(directoryRef.current,actor)} ${labels[n.kind] ?? 'sent you an update'}`;
  }, []);
  const announce = useCallback((n:NotificationEvent) => {
    const text = titleFor(n);
    setToast(text); // In-app alerts work without browser permission.
    if(typeof window !== 'undefined' && 'Notification' in window && window.Notification.permission === 'granted') {
      try {
        const notice = new window.Notification('The Pussy Is Yours', {body:text,tag:`tgy-${n.id}`});
        notice.onclick = () => {window.focus();setOpen(true);notice.close();};
      } catch { /* In-app notification remains available. */ }
    }
  },[titleFor]);

  const reload = useCallback(async () => {
    if(!db) return;
    const result = await db.from('tgy_notifications')
      .select('id,kind,user_id,payload,created_at,read_at')
      .eq('user_id',user.id)
      .order('created_at',{ascending:false})
      .limit(100);
    if(result.error) {errorRef.current(result.error);return;}
    const records = (result.data ?? []) as NotificationEvent[];
    if(started.current) {
      for(const record of [...records].reverse()) {
        if(!knownIds.current.has(record.id)) announce(record);
      }
    }
    for(const record of records) knownIds.current.add(record.id);
    started.current = true;
    setItems(records);
  },[user.id,announce]);

  useEffect(() => {
    knownIds.current.clear();
    started.current = false;
    setItems([]);
    setToast('');
    if(typeof window !== 'undefined' && 'Notification' in window)
      setBrowserEnabled(window.Notification.permission === 'granted');
    void reload();

    // The Realtime INSERT stream is fast; polling and visibility refresh recover missed events.
    const channel = db?.channel(`tgy-notifications-${user.id}`)
      .on('postgres_changes', {
        event:'INSERT',schema:'public',table:'tgy_notifications',filter:`user_id=eq.${user.id}`,
      }, () => {void reload();})
      .subscribe();
    const poll = window.setInterval(() => {void reload();},12000);
    const onVisible = () => {if(document.visibilityState === 'visible') void reload();};
    document.addEventListener('visibilitychange',onVisible);
    return () => {
      window.clearInterval(poll);
      document.removeEventListener('visibilitychange',onVisible);
      if(channel) void db?.removeChannel(channel);
    };
  },[user.id,reload]);

  useEffect(()=>{
    const openPanel=()=>setOpen(true);
    window.addEventListener('tpy:open-notifications',openPanel);
    return()=>window.removeEventListener('tpy:open-notifications',openPanel);
  },[]);

  const mark = async (id:string) => {
    if(!db) return;
    const {error} = await db.from('tgy_notifications')
      .update({read_at:new Date().toISOString()}).eq('id',id).eq('user_id',user.id);
    if(error) errorRef.current(error);
    else void reload();
  };
  const markAll = async () => {
    if(!db) return;
    const {error} = await db.from('tgy_notifications')
      .update({read_at:new Date().toISOString()}).eq('user_id',user.id).is('read_at',null);
    if(error) errorRef.current(error);
    else void reload();
  };
  const enableDesktop = async () => {
    if(typeof window === 'undefined' || !('Notification' in window)) {
      setToast('Desktop notifications are unavailable here. In-app notifications still work.');return;
    }
    const permission = await window.Notification.requestPermission();
    setBrowserEnabled(permission === 'granted');
    if(permission !== 'granted') setToast('Desktop alerts are off, but your in-app alerts remain active.');
  };
  const unread = items.filter(n => !n.read_at).length;

  return <div className="notification-center">
    <button className="notification-bell" aria-label={`Notifications: ${unread} unread`} onClick={() => {setOpen(v=>!v);void reload();}}>
      {unread ? <BellRing size={20}/> : <Bell size={20}/>}
      {unread > 0 && <span className="notification-counter">{unread > 99 ? '99+' : unread}</span>}
    </button>
    {open && <div className="notification-dropdown" role="dialog" aria-label="Notifications">
      <div className="notification-heading"><h2>Notifications</h2><button aria-label="Close" onClick={()=>setOpen(false)}><X size={19}/></button></div>
      <div className="notification-tools">
        <button onClick={()=>void markAll()} disabled={!unread}><Check size={16}/> Mark all read</button>
        <button onClick={()=>void enableDesktop()}><Settings size={16}/>{browserEnabled?'Desktop alerts on':'Enable desktop alerts'}</button>
      </div>
      <div className="notification-list">
        {items.length ? items.map(n => <button key={n.id} className={`notification-item ${n.read_at?'':'unread'}`} onClick={()=>{
          void mark(n.id);setOpen(false);onNavigate(n.kind,n.payload);
        }}>
          <span className="social-avatar">{nameFor(directory,String(n.payload?.actor_id??'')).slice(0,1)}</span>
          <span className="notification-text"><b>{titleFor(n)}</b><small>{timeAgo(n.created_at)}</small></span>
          {!n.read_at && <i className="unread-dot"/>}
        </button>) : <p className="notification-empty">No new activity yet. New messages, friend requests, comments, likes and profile views will appear here.</p>}
      </div>
      <small className="notification-disclaimer">In-app alerts work while the website is open. Background push alerts need a separate push service.</small>
    </div>}
    {toast && <div className="inapp-toast" role="status" aria-live="polite">{toast}<button onClick={()=>setToast('')} aria-label="Dismiss alert"><X size={15}/></button></div>}
  </div>;
}
