'use client';
import {useEffect,useMemo,useState} from 'react';
import type {User} from '@supabase/supabase-js';
import {ArrowRight,Check,Clock,Grid2X2,HeartHandshake, List,MapPin,MessageCircle,MoreHorizontal,Search,Shield,UserPlus,Users,X} from 'lucide-react';
import type {Person} from '@/lib/data';
import type {Persona,FriendRequest} from '@/lib/types';
import {getSupabase} from '@/lib/supabase';
import {errorMessage} from '@/lib/errorMessage';
import ProfileAvatar from './ProfileAvatar';

type Panel='all'|'requests'|'suggestions'|'nearby';
type Props={user:User;directory:Persona[];friendIds:string[];requests:FriendRequest[];people:Person[];onlineIds:string[];onProfile:(id:string)=>void;onChat:(id:string)=>void;onExplore:()=>void;onAccept:(r:FriendRequest)=>void;onDecline:(r:FriendRequest)=>void;onAddFriend:(id:string)=>void;onError:(e:unknown)=>void;onChanged:()=>void};
const db=getSupabase();
export default function FriendsDashboard({user,directory,friendIds,requests,people,onlineIds,onProfile,onChat,onExplore,onAccept,onDecline,onAddFriend,onError,onChanged}:Props){
 const [active,setActive]=useState<Panel>('all');
 const [search,setSearch]=useState('');
 const [layout,setLayout]=useState<'grid'|'list'>('grid');
 const [following,setFollowing]=useState<string[]>([]);
 const [menu,setMenu]=useState<string|null>(null);
 const [busy,setBusy]=useState<string|null>(null);
 const friendSet=useMemo(()=>new Set(friendIds),[friendIds]);
 const onlineSet=useMemo(()=>new Set(onlineIds),[onlineIds]);
 const incoming=requests.filter(r=>r.receiver_id===user.id&&r.status==='pending');
 const outgoing=new Set(requests.filter(r=>r.sender_id===user.id&&r.status==='pending').map(r=>r.receiver_id));
 const allFriends=directory.filter(p=>friendSet.has(p.user_id));
 const nearbyIDs=new Set(people.map(p=>p.id));
 const discover=directory.filter(p=>p.user_id!==user.id&&!friendSet.has(p.user_id)&&!outgoing.has(p.user_id));
 const matches=(p:Persona)=>`${p.display_name} @${p.username}`.toLowerCase().includes(search.trim().toLowerCase());
 const shownFriends=allFriends.filter(matches);
 const suggestions=discover.filter(matches);
 const nearby=directory.filter(p=>nearbyIDs.has(p.user_id)&&p.user_id!==user.id).filter(matches);
 useEffect(()=>{if(!db)return;let alive=true;
  void db.from('tpy_follows').select('followed_id').eq('follower_id',user.id).then(({data,error})=>{
   if(alive){if(!error)setFollowing((data||[]).map(x=>x.followed_id));else if(error.code!=='PGRST205')onError(error);}
  });return()=>{alive=false};},[user.id,onError]);
 const follow=async(id:string)=>{
  if(!db)return;setBusy(id);
  try{
   const had=following.includes(id);
   const result=had?await db.from('tpy_follows').delete().eq('follower_id',user.id).eq('followed_id',id):await db.from('tpy_follows').insert({follower_id:user.id,followed_id:id});
   if(result.error)throw result.error;
   setFollowing(cur=>had?cur.filter(x=>x!==id):[...cur,id]);
  }catch(e){onError(errorMessage(e));}finally{setBusy(null);}
 };
 const unfriend=async(id:string)=>{
  if(!db||!window.confirm('Remove this person from your friends?'))return;
  setBusy(id);try{const {error}=await db.rpc('tpy_remove_friend',{p_other_user:id});if(error)throw error;onChanged();}
  catch(e){onError(errorMessage(e));}finally{setBusy(null);setMenu(null);}
 };
 const countOnline=allFriends.filter(p=>onlineSet.has(p.user_id)).length;
 return <div className="ui-page ui-friends">
  <section className="ui-page-hero ui-friends-hero">
   <div className="ui-hero-inner"><span className="ui-overline">SOCIAL CONNECTIONS</span><h1>Your <em>Circle</em></h1><p>Meet people worth knowing. Your connections, requests and discoveries in one place.</p></div>
   <div className="ui-hero-orbit" aria-hidden="true"><HeartHandshake size={110} strokeWidth={.5}/></div>
  </section>
  <section className="ui-section-tabs"><div className="ui-pills">
   {([['all','All friends',allFriends.length,Users],['requests','Requests',incoming.length,Clock],['suggestions','Suggestions',suggestions.length,UserPlus],['nearby','Nearby',nearby.length,MapPin]] as const).map(([key,label,count,Icon])=><button key={key} className={`ui-pill ${active===key?'active':''}`} onClick={()=>setActive(key)}><Icon size={16}/>{label}<span>{count}</span></button>)}
  </div><label className="ui-inline-search"><Search size={17}/><input aria-label="Search members" placeholder="Search your circle…" value={search} onChange={e=>setSearch(e.target.value)}/></label></section>
  <div className="ui-content-with-rail"><main className="ui-primary-column">
   {(active==='requests'||(active==='all'&&incoming.length>0))&&<section className="ui-section"><header className="ui-section-title"><h2>Friend requests <span className="ui-count">{incoming.length}</span></h2>{active==='all'&&incoming.length>3&&<button onClick={()=>setActive('requests')}>View all <ArrowRight size={15}/></button>}</header>
     {incoming.length?<div className="ui-member-grid">{incoming.filter(r=>directory.find(p=>p.user_id===r.sender_id&&matches(p))).slice(0,active==='requests'?undefined:3).map(r=>{
      const person=directory.find(p=>p.user_id===r.sender_id);return <article className="ui-member-card" key={r.id}>
       <button className="ui-card-person" onClick={()=>onProfile(r.sender_id)}><ProfileAvatar profile={person} size={64}/><span><b>{person?.display_name||'Member'}</b><small>@{person?.username||'account'}</small><small className="ui-muted">Wants to connect with you</small></span></button>
       <div className="ui-card-actions"><button className="ui-btn-pink" onClick={()=>onAccept(r)}><Check size={15}/>Accept</button><button className="ui-btn-outline" onClick={()=>onDecline(r)}><X size={15}/>Remove</button></div>
      </article>})}</div>:<div className="ui-empty"><Users size={26}/><p>No pending friend requests.</p></div>}
    </section>}
   {(active==='all'||active==='nearby')&&<section className="ui-section"><header className="ui-section-title"><h2>{active==='all'?'All friends':'People sharing nearby areas'} <span className="ui-count">{active==='all'?shownFriends.length:nearby.length}</span></h2><div className="ui-layout-toggle"><button className={layout==='grid'?'active':''} onClick={()=>setLayout('grid')} aria-label="Grid view"><Grid2X2 size={17}/></button><button className={layout==='list'?'active':''} onClick={()=>setLayout('list')} aria-label="List view"><List size={18}/></button></div></header>
     {(active==='all'?shownFriends:nearby).length?<div className={`ui-member-grid ${layout==='list'?'list':''}`}>
      {(active==='all'?shownFriends:nearby).map(p=><article className="ui-member-card" key={p.user_id}>
       <button className="ui-card-person" onClick={()=>onProfile(p.user_id)}><ProfileAvatar profile={p} size={66} online={onlineSet.has(p.user_id)}/><span><b>{p.display_name}</b><small>@{p.username}</small><small className={onlineSet.has(p.user_id)?'ui-online-text':'ui-muted'}>{onlineSet.has(p.user_id)?'● Online now':'View public profile'}</small></span></button>
       <div className="ui-card-actions">{friendSet.has(p.user_id)?<button className="ui-btn-pink" onClick={()=>onChat(p.user_id)}><MessageCircle size={16}/>Message</button>:<button className="ui-btn-pink" disabled={outgoing.has(p.user_id)} onClick={()=>onAddFriend(p.user_id)}><UserPlus size={16}/>{outgoing.has(p.user_id)?'Requested':'Add friend'}</button>}
        <button className="ui-btn-outline" onClick={()=>onProfile(p.user_id)}>View profile</button>
        {friendSet.has(p.user_id)&&<div className="ui-popover-anchor"><button className="ui-btn-icon" aria-label="Friend options" aria-expanded={menu===p.user_id} onClick={()=>setMenu(menu===p.user_id?null:p.user_id)}><MoreHorizontal size={19}/></button>{menu===p.user_id&&<div className="ui-small-popover"><button disabled={busy===p.user_id} onClick={()=>void unfriend(p.user_id)}>Remove friend</button><button onClick={()=>{setMenu(null);onProfile(p.user_id);}}>View profile</button></div>}</div>}
       </div></article>)}
     </div>:<div className="ui-empty"><Users size={25}/><p>{active==='all'?'No friends found yet. Discover people and start your circle.':'No nearby members are sharing a public area.'}</p></div>}
    </section>}
   {active==='suggestions'&&<section className="ui-section"><header className="ui-section-title"><h2>Suggested for you <span className="ui-count">{suggestions.length}</span></h2></header>
    {suggestions.length?<div className="ui-member-grid">{suggestions.map(p=><article className="ui-member-card" key={p.user_id}><button className="ui-card-person" onClick={()=>onProfile(p.user_id)}><ProfileAvatar profile={p} size={66}/><span><b>{p.display_name}</b><small>@{p.username}</small></span></button><div className="ui-card-actions"><button className="ui-btn-pink" onClick={()=>onAddFriend(p.user_id)}><UserPlus size={15}/>Add friend</button><button className="ui-btn-outline" disabled={busy===p.user_id} onClick={()=>void follow(p.user_id)}>{following.includes(p.user_id)?'Following':'Follow'}</button></div></article>)}</div>:<div className="ui-empty">No other members match your search.</div>}
   </section>}
  </main><aside className="ui-context-rail">
   <section className="ui-rail-panel ui-stats-row"><div><Users size={19}/><b>{allFriends.length}</b><small>Friends</small></div><div><HeartHandshake size={19}/><b>{incoming.length}</b><small>Requests</small></div><div><span className="ui-status-dot"/><b>{countOnline}</b><small>Online</small></div></section>
   <button className="ui-rail-banner" onClick={onExplore}><MapPin size={29}/><span><b>Grow your circle</b><small>Find real members sharing nearby areas</small></span><ArrowRight size={18}/></button>
   <section className="ui-rail-panel"><header><h3>Suggested for you</h3><button onClick={()=>setActive('suggestions')}>View all →</button></header>{suggestions.slice(0,5).map(p=><div className="ui-rail-person" key={p.user_id}><button onClick={()=>onProfile(p.user_id)}><ProfileAvatar profile={p} size={40}/><span><b>{p.display_name}</b><small>@{p.username}</small></span></button><button className="ui-add-outline" onClick={()=>onAddFriend(p.user_id)}><UserPlus size={16}/></button></div>)}{!suggestions.length&&<p className="ui-muted">No new suggestions yet.</p>}</section>
   <section className="ui-rail-panel"><header><h3>People nearby</h3><button onClick={onExplore}>View map →</button></header>{nearby.slice(0,4).map(p=><div className="ui-rail-person" key={p.user_id}><button onClick={()=>onProfile(p.user_id)}><ProfileAvatar profile={p} size={40}/><span><b>{p.display_name}</b><small>@{p.username}</small></span></button><button className="ui-add-outline" onClick={()=>onProfile(p.user_id)}>View</button></div>)}{!nearby.length&&<p className="ui-muted">No public locations yet.</p>}</section>
  </aside></div>
 </div>;
}
