'use client';
import {useCallback,useEffect,useState} from 'react';
import {Bell,Bookmark,Check,ExternalLink,Eye,EyeOff,Lock,ShieldAlert,UserMinus} from 'lucide-react';
import type {User} from '@supabase/supabase-js';
import {getSupabase} from '@/lib/supabase';
import type {Persona} from '@/lib/types';
import {nameFor,publicUrl} from '@/lib/types';

const db=getSupabase();
type Settings={user_id:string;allow_profile_view_notifications:boolean;allow_message_notifications:boolean;allow_social_notifications:boolean;discoverable:boolean};
const initial=(id:string):Settings=>({user_id:id,allow_profile_view_notifications:true,allow_message_notifications:true,allow_social_notifications:true,discoverable:true});
export default function AccountSettings({user,directory,onError}:{user:User;directory:Persona[];onError:(e:unknown)=>void}){
 const [settings,setSettings]=useState<Settings>(initial(user.id));
 const [bookmarks,setBookmarks]=useState<{post_id:string,created_at:string}[]>([]);
 const [blocks,setBlocks]=useState<{blocked_id:string}[]>([]);
 const [followed,setFollowed]=useState<{followed_id:string}[]>([]);
 const [query,setQuery]=useState('');
 const [notice,setNotice]=useState('');
 const [saving,setSaving]=useState(false);
 const reload=useCallback(async()=>{
  if(!db)return;
  const [a,b,c,d]=await Promise.all([
   db.from('tpy_user_settings').select('*').eq('user_id',user.id).maybeSingle(),
   db.from('tpy_bookmarks').select('post_id,created_at').eq('user_id',user.id).order('created_at',{ascending:false}),
   db.from('tgy_blocks').select('blocked_id').eq('blocker_id',user.id),
   db.from('tpy_follows').select('followed_id').eq('follower_id',user.id),
  ]);
  for(const r of [a,b,c,d])if(r.error){onError(r.error);return;}
  setSettings(a.data as Settings||initial(user.id));setBookmarks(b.data||[]);setBlocks(c.data||[]);setFollowed(d.data||[]);
 },[user.id,onError]);
 useEffect(()=>{void reload();},[reload]);
 const save=async()=>{if(!db)return;setSaving(true);
  const {error}=await db.from('tpy_user_settings').upsert({...settings,user_id:user.id,updated_at:new Date().toISOString()},{onConflict:'user_id'});
  if(error)onError(error);else setNotice('Preferences saved.');setSaving(false);
 };
 const updateFollow=async(id:string,following:boolean)=>{
  if(!db)return;
  const r=following?await db.from('tpy_follows').delete().eq('follower_id',user.id).eq('followed_id',id):await db.from('tpy_follows').insert({follower_id:user.id,followed_id:id});
  if(r.error)onError(r.error);else void reload();
 };
 const unblock=async(id:string)=>{if(!db)return;const r=await db.from('tgy_blocks').delete().eq('blocker_id',user.id).eq('blocked_id',id);if(r.error)onError(r.error);else void reload();};
 const deleteRequest=async()=>{
  if(!db)return;
  if(!window.confirm('Submit an account deletion request to the site operator? This is a request, not immediate deletion.'))return;
  const r=await db.from('tpy_deletion_requests').insert({user_id:user.id,status:'pending'});
  if(r.error?.code==='23505')setNotice('A deletion request for your account is already pending.');
  else if(r.error)onError(r.error);else setNotice('Your deletion request was submitted. An administrator must complete it.');
 };
 const exportMyData=async()=>{
  if(!db)return;
  const [p,posts,messages]=await Promise.all([
   db.from('tgy_personas').select('*').eq('user_id',user.id),
   db.from('tgy_posts').select('*').eq('author_id',user.id),
   db.from('tgy_messages').select('*').eq('sender_id',user.id),
  ]);
  for(const r of [p,posts,messages])if(r.error){onError(r.error);return;}
  const payload={exportedAt:new Date().toISOString(),profile:p.data,posts:posts.data,messagesSent:messages.data,note:'Export covers these listed data categories only. Contact the operator for a comprehensive privacy export.'};
  const blob=new Blob([JSON.stringify(payload,null,2)],{type:'application/json'});
  const link=document.createElement('a');link.href=URL.createObjectURL(blob);link.download='tpy-partial-data-export.json';link.click();URL.revokeObjectURL(link.href);
 };
 const matches=directory.filter(p=>p.user_id!==user.id&&p.display_name.toLowerCase().includes(query.toLowerCase())).slice(0,15);
 return <main className="narrow tpy-settings"><h1>Settings & safety</h1>
  <section className="social-card form"><h2><Bell size={20}/> Notification preferences</h2><p className="muted">Choose which events you want saved and shown in the notification bell.</p>
   {([['allow_message_notifications','New messages'],['allow_social_notifications','Friend requests, likes, comments and shares'],['allow_profile_view_notifications','Profile views']] as const).map(([key,title])=><label className="tpy-switch" key={key}><input type="checkbox" checked={settings[key]} onChange={e=>setSettings(s=>({...s,[key]:e.target.checked}))}/><span>{title}</span></label>)}
   <h3>Discovery</h3><label className="tpy-switch"><input type="checkbox" checked={settings.discoverable} onChange={e=>setSettings(s=>({...s,discoverable:e.target.checked}))}/><span>Include me in public member suggestions</span></label>
   <button className="primary" disabled={saving} onClick={()=>void save()}><Check size={17}/>{saving?'Saving…':'Save preferences'}</button>
  </section>
  <section className="social-card form"><h2><Bookmark size={20}/> Saved posts</h2>
   {bookmarks.length?bookmarks.map(b=><a key={b.post_id} href={publicUrl(`/p/${b.post_id}`)||`/p/${b.post_id}`} className="tpy-saved-link"><ExternalLink size={15}/> Open saved post <small>{new Date(b.created_at).toLocaleDateString()}</small></a>):<p className="muted">Saved posts will appear here when you bookmark them in Feed.</p>}
  </section>
  <section className="social-card form"><h2>Follow people</h2><input placeholder="Search member names" value={query} onChange={e=>setQuery(e.target.value)} aria-label="Search member names"/>
   {query&&matches.map(p=><div className="tpy-simple-row" key={p.user_id}><span><b>{p.display_name}</b><small>@{p.username}</small></span><button className="secondary" onClick={()=>void updateFollow(p.user_id,followed.some(f=>f.followed_id===p.user_id))}>{followed.some(f=>f.followed_id===p.user_id)?'Unfollow':'Follow'}</button></div>)}
   {!query&&<p className="muted">You follow {followed.length} member(s). Search to follow someone new.</p>}
  </section>
  <section className="social-card form"><h2><ShieldAlert size={20}/> Blocked accounts</h2>
   {blocks.length?blocks.map(b=><div key={b.blocked_id} className="tpy-simple-row"><span>{nameFor(directory,b.blocked_id)}</span><button className="secondary" onClick={()=>void unblock(b.blocked_id)}><UserMinus size={15}/> Unblock</button></div>):<p className="muted">No blocked accounts.</p>}
  </section>
  <section className="social-card form"><h2><Lock size={20}/> Your data and account</h2><p className="muted">Messaging is private between permitted accounts, but it is not end-to-end encrypted.</p>
   <button className="secondary" onClick={()=>void exportMyData()}><Eye size={17}/> Download partial data export</button>
   <button className="secondary" onClick={()=>void deleteRequest()}><EyeOff size={17}/> Request account deletion</button>
   <p className="muted">Requests require manual action by the operator. Neither button automatically erases data.</p>
  </section>
  {notice&&<p role="status" className="tpy-inline-note">{notice}</p>}
 </main>;
}
