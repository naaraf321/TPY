'use client';
import { useCallback, useEffect, useMemo, useState } from 'react';
import type { User } from '@supabase/supabase-js';
import { ArrowRight, Compass, MapPin, MessageCircle, Search, ShieldCheck, Users } from 'lucide-react';
import type { Person } from '@/lib/data';
import type { Persona } from '@/lib/types';
import { nameFor, timeAgo } from '@/lib/types';
import { getSupabase } from '@/lib/supabase';
import FeedPanel from './FeedPanel';
import ProfileAvatar from './ProfileAvatar';
import dynamic from 'next/dynamic';

const StreetMap = dynamic(() => import('./StreetMap'), {ssr:false, loading:()=> <div className="tpy-mini-map-loading">Loading streets…</div>});
const db=getSupabase();
type ConversationRow={conversation_id:string;other_user_id:string;last_message_at:string|null};
type MessagePreview={conversation_id:string;body:string|null;media_type:string;created_at:string};
type Props={
 user:User|null;persona:Persona|null;directory:Persona[];people:Person[];
 ownLocation:[number,number]|null;friends:Persona[];
 onLogin:()=>void;onProfile:(id:string)=>void;onExplore:()=>void;
 onFriends:()=>void;onChat:(id:string)=>void;onError:(error:unknown)=>void;
};
export default function HomeDashboard({user,persona,directory,people,ownLocation,friends,onLogin,onProfile,onExplore,onFriends,onChat,onError}:Props){
 const [conversations,setConversations]=useState<ConversationRow[]>([]);
 const [previews,setPreviews]=useState<MessagePreview[]>([]);
 const [filter,setFilter]=useState('');
 const [view,setView]=useState<'all'|'recent'|'friends'>('all');
 const [recentPosts,setRecentPosts]=useState<{id:string;author_id:string;body:string;created_at:string}[]>([]);
 const [loadingChats,setLoadingChats]=useState(true);
 const refreshChats=useCallback(async()=>{
  if(!db||!user){setConversations([]);setPreviews([]);setLoadingChats(false);return;}
  const r=await db.rpc('tgy_list_direct_chats');
  if(r.error){onError(r.error);setLoadingChats(false);return;}
  const rows=(r.data||[]) as ConversationRow[];
  setConversations(rows);
  const ids=rows.map(x=>x.conversation_id).filter(Boolean);
  if(ids.length){
   const m=await db.from('tgy_messages').select('conversation_id,body,media_type,created_at')
    .in('conversation_id',ids).order('created_at',{ascending:false}).limit(250);
   if(!m.error)setPreviews((m.data||[]) as MessagePreview[]);
  }else setPreviews([]);
  setLoadingChats(false);
 },[user?.id,onError]);
 useEffect(()=>{void refreshChats();},[refreshChats]);
 useEffect(()=>{
  if(!db||!user)return;
  const sub=db.channel(`tpy-home-preview-${user.id}`).on('postgres_changes',
    {event:'INSERT',schema:'public',table:'tgy_messages'},()=>{void refreshChats();}).subscribe();
  const interval=window.setInterval(()=>{void refreshChats();},30000);
  return()=>{clearInterval(interval);void db?.removeChannel(sub);};
 },[user?.id,refreshChats]);
 useEffect(()=>{
  if(!db)return;
  const load=async()=>{
   const r=await db!.from('tgy_posts').select('id,author_id,body,created_at')
     .eq('visibility','public').order('created_at',{ascending:false}).limit(3);
   if(!r.error)setRecentPosts(r.data||[]);
  };void load();
  const channel=db.channel('tpy-dashboard-posts').on('postgres_changes',
    {event:'INSERT',schema:'public',table:'tgy_posts'},()=>{void load();}).subscribe();
  return()=>{void db?.removeChannel(channel);};
 },[]);
 const suggestions=useMemo(()=>directory.filter(x=>x.user_id!==user?.id&&!friends.some(f=>f.user_id===x.user_id)).slice(0,5),[directory,user?.id,friends]);
 const chats=useMemo(()=>{
  const rows=[...conversations];
  for(const f of friends)if(!rows.some(c=>c.other_user_id===f.user_id))rows.push({conversation_id:'',other_user_id:f.user_id,last_message_at:null});
  return rows.filter(c=>`${nameFor(directory,c.other_user_id)}`.toLowerCase().includes(filter.toLowerCase()))
    .filter(c=>view!=='recent'||!!c.last_message_at)
    .filter(c=>view!=='friends'||friends.some(f=>f.user_id===c.other_user_id));
 },[conversations,filter,view,directory,friends]);
 const previewOf=(id:string)=>{
  const m=previews.find(p=>p.conversation_id===id);
  return m ? (m.body?.trim()|| (m.media_type==='audio'?'Voice message':m.media_type==='image'?'Photo':m.media_type==='video'?'Video':'Attachment')) : 'Start a conversation';
 };
 return <div className="tpy-home-grid">
  <section className="tpy-home-feed" aria-label="Community feed">
   <FeedPanel user={user} persona={persona} directory={directory} onLogin={onLogin} onProfile={onProfile} onError={onError} embedded/>
  </section>
  <aside className="tpy-home-discovery" aria-label="Discovery">
   <section className="tpy-widget tpy-people-widget">
    <div className="tpy-widget-heading"><h2>People nearby</h2><button onClick={onExplore}>View map <ArrowRight size={15}/></button></div>
    <div className="tpy-mini-map">
      <StreetMap people={people} center={ownLocation??[20,0]} ownLocation={ownLocation} onSelect={p=>onProfile(p.id)}/>
      <button className="tpy-map-open" onClick={onExplore}><MapPin size={15}/>{people.length} {people.length===1?'member':'members'} on map <ArrowRight size={14}/></button>
    </div>
    <p className="tpy-widget-helper"><ShieldCheck size={14}/> Map markers show approximate areas, not homes or floors.</p>
   </section>
   <section className="tpy-widget">
    <div className="tpy-widget-heading"><h2>Discover people</h2><button onClick={onFriends}>See all <ArrowRight size={15}/></button></div>
    {user&&suggestions.length?suggestions.map(p=><div className="tpy-suggested" key={p.user_id}>
      <button className="tpy-circle-avatar ui-image-avatar" onClick={()=>onProfile(p.user_id)} aria-label={`View ${p.display_name}`}><ProfileAvatar profile={p} size={38}/></button>
      <button className="tpy-suggested-person" onClick={()=>onProfile(p.user_id)}><b>{p.display_name}</b><small>@{p.username}</small></button>
      <button className="tpy-outline-action" onClick={()=>onProfile(p.user_id)}>View</button>
    </div>):<p className="tpy-sidebar-empty">{user?'No new members to suggest yet.':'Sign in to discover member profiles.'}</p>}
   </section>
   <section className="tpy-widget tpy-latest-widget">
    <div className="tpy-widget-heading"><h2>Recent public posts</h2><span><Compass size={15}/></span></div>
    {recentPosts.length?recentPosts.map(p=><a className="tpy-trend-row" key={p.id} href={`/p/${p.id}`}>
      <span className="tpy-trend-avatar">{nameFor(directory,p.author_id)[0]}</span>
      <span><b>{user?nameFor(directory,p.author_id):'Community post'}</b><small>{(p.body||'Shared a post').slice(0,86)} · {timeAgo(p.created_at)}</small></span>
    </a>):<p className="tpy-sidebar-empty">Public posts will appear here as members share them.</p>}
   </section>
  </aside>
  <aside className="tpy-home-chat-rail" aria-label="Your conversations">
   <div className="tpy-rail-title"><h2>Chats</h2><MessageCircle size={20}/></div>
   <div className="tpy-rail-search"><Search size={17}/><input value={filter} onChange={e=>setFilter(e.target.value)} placeholder="Search chats" aria-label="Search chats"/></div>
   <div className="tpy-rail-filters" role="group" aria-label="Conversation filter">
    {(['all','recent','friends'] as const).map(type=><button key={type} className={view===type?'selected':''} onClick={()=>setView(type)}>{type==='all'?'All':type==='recent'?'Recent':'Friends'}</button>)}
   </div>
   {!user?<div className="tpy-chat-rail-empty"><MessageCircle size={24}/><p>Sign in to see your conversations.</p><button onClick={onLogin}>Sign in</button></div>:
    loadingChats?<p className="tpy-sidebar-empty">Loading conversations…</p>:
    chats.length?chats.map(c=><button className="tpy-rail-chat" key={c.other_user_id} onClick={()=>onChat(c.other_user_id)}>
      <ProfileAvatar profile={directory.find(p=>p.user_id===c.other_user_id)} size={39}/>
      <span className="tpy-rail-chat-content"><b>{nameFor(directory,c.other_user_id)}</b><small>{previewOf(c.conversation_id)}</small></span>
      {c.last_message_at&&<time>{timeAgo(c.last_message_at)}</time>}
     </button>):<div className="tpy-chat-rail-empty"><Users size={25}/><p>No conversations yet. Add a friend to start chatting.</p><button onClick={onFriends}>Find friends</button></div>}
  </aside>
 </div>;
}
