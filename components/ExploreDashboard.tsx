'use client';
import {useEffect,useMemo,useState} from 'react';
import dynamic from 'next/dynamic';
import type {User} from '@supabase/supabase-js';
import {ArrowRight,Compass,Flame,Grid2X2,Heart,MapPin,Navigation,Search,ShieldCheck,SlidersHorizontal,Sparkles,Star,UserPlus,Users,X} from 'lucide-react';
import type {Person} from '@/lib/data';
import type {Persona} from '@/lib/types';
import {getSupabase} from '@/lib/supabase';
import ProfileAvatar from './ProfileAvatar';
const StreetMap=dynamic(()=>import('./StreetMap'),{ssr:false,loading:()=> <div className="ui-map-loading">Loading real streets…</div>});
const db=getSupabase();
const distanceKm=(a:[number,number],b:[number,number])=>{
 const rad=Math.PI/180, dLat=(b[0]-a[0])*rad, dLng=(b[1]-a[1])*rad;
 const t=Math.sin(dLat/2)**2+Math.cos(a[0]*rad)*Math.cos(b[0]*rad)*Math.sin(dLng/2)**2;
 return 12742*Math.asin(Math.min(1,Math.sqrt(t)));
};
type Filter='nearby'|'online'|'new'|'popular'|'interests';
type Props={user:User|null;directory:Persona[];people:Person[];ownLocation:[number,number]|null;onlineIds:string[];friendIds:string[];onProfile:(id:string)=>void;onChat:(id:string)=>void;onAddFriend:(id:string)=>void;onLogin:()=>void;onError:(e:unknown)=>void};
export default function ExploreDashboard({user,directory,people,ownLocation,onlineIds,friendIds,onProfile,onChat,onAddFriend,onLogin,onError}:Props){
 const [mode,setMode]=useState<Filter>('nearby');
 const [radius,setRadius]=useState(25);
 const [query,setQuery]=useState('');
 const [interest,setInterest]=useState('');
 const [showFilters,setShowFilters]=useState(false);
 const [trend,setTrend]=useState<Record<string,number>>({});
 const [centerOverride,setCenterOverride]=useState<[number,number]|null>(null);
 const [requested,setRequested]=useState<string[]>([]);
 const [following,setFollowing]=useState<string[]>([]);
 const onlineSet=useMemo(()=>new Set(onlineIds),[onlineIds]);
 const friendsSet=useMemo(()=>new Set(friendIds),[friendIds]);
 const coords=new Map(people.map(p=>[p.id,[p.lat,p.lng] as [number,number]]));
 const matched=directory.filter(p=>p.user_id!==user?.id&&`${p.display_name} ${p.username}`.toLowerCase().includes(query.trim().toLowerCase()));
 const enriched=matched.map(p=>({profile:p,pos:coords.get(p.user_id),away:ownLocation&&coords.has(p.user_id)?distanceKm(ownLocation,coords.get(p.user_id)!):null}));
 const nearby=enriched.filter(p=>p.away!==null&&p.away<=radius);
 const online=enriched.filter(p=>onlineSet.has(p.profile.user_id));
 const matching=enriched.filter(p=>(!interest||p.profile.interests?.includes(interest)));
 const options=useMemo(()=>[...new Set(directory.flatMap(p=>p.interests||[]).filter(Boolean))].slice(0,15),[directory]);
 useEffect(()=>{if(!db)return;let active=true;
  void db.from('tgy_posts').select('author_id').eq('visibility','public').order('created_at',{ascending:false}).limit(200).then(({data,error})=>{
   if(!active)return;if(error){onError(error);return;}
   const counts:Record<string,number>={};(data||[]).forEach(r=>{counts[r.author_id]=(counts[r.author_id]||0)+1});setTrend(counts);
  });return()=>{active=false};},[onError]);
 useEffect(()=>{if(!db||!user)return;let alive=true;void db.from('tpy_follows').select('followed_id').eq('follower_id',user.id).then(({data})=>{if(alive&&data)setFollowing(data.map(x=>x.followed_id))});return()=>{alive=false};},[user?.id]);
 const follow=async(id:string)=>{if(!db||!user){onLogin();return;}
  const yes=following.includes(id);
  const res=yes?await db.from('tpy_follows').delete().eq('follower_id',user.id).eq('followed_id',id):await db.from('tpy_follows').insert({follower_id:user.id,followed_id:id});
  if(res.error){onError(res.error);return;}setFollowing(a=>yes?a.filter(x=>x!==id):[...a,id]);
 };
 let filtered=mode==='nearby'?nearby:mode==='online'?online:mode==='interests'?matching:enriched;
 if(mode==='new')filtered=[...filtered].sort((a,b)=>new Date(b.profile.created_at||0).getTime()-new Date(a.profile.created_at||0).getTime());
 if(mode==='popular')filtered=[...filtered].sort((a,b)=>(trend[b.profile.user_id]||0)-(trend[a.profile.user_id]||0));
 const markers=people.filter(p=>(mode!=='nearby'||(ownLocation&&distanceKm(ownLocation,[p.lat,p.lng])<=radius))&&(!query||`${p.name} ${p.handle}`.toLowerCase().includes(query.toLowerCase())));
 const mapCenter=centerOverride||ownLocation||[35,0] as [number,number];
 const openPerson=(id:string)=>user?onProfile(id):onLogin();
 const add=(id:string)=>{if(!user){onLogin();return;}onAddFriend(id);setRequested(cur=>[...cur,id])};
 return <div className="ui-page ui-explore">
  <section className="ui-page-hero ui-explore-hero"><div className="ui-hero-inner"><span className="ui-overline">DISCOVERY</span><h1>Explore people <em>near you</em></h1><p>Discover real members, local communities and connections near your chosen area.</p></div><span className="ui-hero-orbit" aria-hidden="true"><MapPin size={108} strokeWidth={.5}/></span></section>
  <div className="ui-explore-toolbar"><div className="ui-pills">
   {([['nearby','Nearby',MapPin],['online','Online',Users],['new','New',Sparkles],['popular','Trending',Flame],['interests','Interests',Grid2X2]] as const).map(([key,label,Icon])=><button key={key} className={`ui-pill ${mode===key?'active':''}`} onClick={()=>setMode(key)}><Icon size={16}/>{label}</button>)}
  </div><div className="ui-explore-utilities"><label><span>Within</span><select aria-label="Search radius" value={radius} onChange={e=>setRadius(Number(e.target.value))}>{[5,10,25,50,100,500].map(d=><option key={d} value={d}>{d} km</option>)}</select></label><button className={`ui-btn-icon ${showFilters?'active':''}`} onClick={()=>setShowFilters(v=>!v)} aria-label="Show filters"><SlidersHorizontal size={18}/></button></div></div>
  {showFilters&&<div className="ui-filter-drawer"><label className="ui-inline-search"><Search size={17}/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search by name or username"/></label><select value={interest} onChange={e=>{setInterest(e.target.value);setMode('interests')}}><option value="">All interests</option>{options.map(i=><option key={i} value={i}>{i}</option>)}</select><button onClick={()=>{setQuery('');setInterest('')}}><X size={15}/> Clear filters</button></div>}
  <div className="ui-content-with-rail"><main className="ui-primary-column"><section className="ui-map-section"><header className="ui-map-title"><h2><MapPin size={19}/> Live nearby map</h2><span>{markers.length} {markers.length===1?'member':'members'} sharing areas</span></header>
   <div className="ui-map-frame"><StreetMap people={markers} center={mapCenter} ownLocation={ownLocation} onSelect={person=>openPerson(person.id)}/><button className="ui-map-recenter" onClick={()=>setCenterOverride(null)}><Navigation size={17}/>My location</button></div>
   <p className="ui-map-privacy"><ShieldCheck size={15}/> Public pins are approximate and grouped when people live close together. Exact building or floor is never inferred.</p>
  </section>
  <section className="ui-section"><header className="ui-section-title"><h2>Popular interests</h2><span className="ui-muted">Chosen by members</span></header>
   {options.length?<div className="ui-interests-row">{options.map(i=><button key={i} className={interest===i?'selected':''} onClick={()=>{setInterest(interest===i?'':i);setMode('interests')}}><Heart size={15}/>{i}</button>)}</div>:<div className="ui-empty ui-compact-empty">Interests will appear here when members add them to their profiles.</div>}
  </section>
  <section className="ui-section"><header className="ui-section-title"><h2>{mode==='nearby'?'People sharing nearby areas':mode==='online'?'Members online':mode==='new'?'Newest members':mode==='popular'?'Active community members':'People with matching interests'}</h2><span className="ui-count">{filtered.length}</span></header>
   {filtered.length?<div className="ui-discovery-cards">{filtered.slice(0,30).map(({profile:p,away})=><article key={p.user_id} className="ui-discovery-card"><button onClick={()=>openPerson(p.user_id)} className="ui-discovery-person"><ProfileAvatar profile={p} size={63} online={onlineSet.has(p.user_id)}/><span><b>{p.display_name}</b><small>@{p.username}</small>{away!==null&&<small className="ui-muted">About {Math.round(away*10)/10} km · approximate</small>}{onlineSet.has(p.user_id)&&<small className="ui-online-text">● Online</small>}</span></button><div className="ui-card-actions"><button className="ui-btn-pink" onClick={()=>void follow(p.user_id)}>{following.includes(p.user_id)?'Following':'Follow'}</button><button className="ui-btn-outline" onClick={()=>friendIds.includes(p.user_id)?onChat(p.user_id):add(p.user_id)}>{friendsSet.has(p.user_id)?'Message':requested.includes(p.user_id)?'Requested':'Add friend'}</button></div></article>)}</div>:<div className="ui-empty"><Compass size={26}/><p>No real members match these filters yet. Expand the radius or choose another category.</p></div>}
  </section></main>
  <aside className="ui-context-rail"><section className="ui-rail-panel"><header><h3>People nearby</h3><button onClick={()=>setMode('nearby')}>View all →</button></header>{nearby.slice(0,6).map(({profile:p,away})=><div className="ui-rail-person" key={p.user_id}><button onClick={()=>openPerson(p.user_id)}><ProfileAvatar profile={p} size={41} online={onlineSet.has(p.user_id)}/><span><b>{p.display_name}</b><small>{away!==null?`~${away.toFixed(1)} km away`:`@${p.username}`}</small></span></button><button className="ui-add-outline" onClick={()=>void follow(p.user_id)}>{following.includes(p.user_id)?'✓':'Follow'}</button></div>)}{!nearby.length&&<p className="ui-muted">No shared nearby locations yet.</p>}</section>
   <section className="ui-rail-panel"><header><h3>Suggestions</h3><span className="ui-muted">Real members</span></header>{enriched.filter(x=>!friendsSet.has(x.profile.user_id)).slice(0,5).map(({profile:p})=><div className="ui-rail-person" key={p.user_id}><button onClick={()=>openPerson(p.user_id)}><ProfileAvatar profile={p} size={40}/><span><b>{p.display_name}</b><small>@{p.username}</small></span></button><button className="ui-add-outline" onClick={()=>add(p.user_id)}><UserPlus size={16}/></button></div>)}{enriched.length<1&&<p className="ui-muted">Suggestions appear when members join.</p>}</section>
   <section className="ui-rail-panel"><header><h3>Discover safely</h3><ShieldCheck size={16}/></header><p className="ui-muted">Location is approximate for other users. Choose whether your account appears on the public map in Profile.</p></section>
  </aside></div>
 </div>;
}
