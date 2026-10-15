# The Pussy Is Yours — Complete Changed Files for Copy/Paste

**Important:** Copy all the files listed below; do not mix incompatible component versions. The SQL `005` is NOT deployed automatically.

---

## `components/SocialApp.tsx`

```tsx
'use client';
import { useCallback, useEffect, useMemo, useState } from 'react';
import dynamic from 'next/dynamic';
import { ArrowLeft, Bell, Bookmark, Check, CheckCircle2, ChevronDown, Compass, Copy, Heart, Home, LockKeyhole, LogIn, LogOut, MapPin, MessageCircle, Navigation, Plus, Search, Settings2, ShieldCheck, Users, UserRound, X } from 'lucide-react';
import type { User } from '@supabase/supabase-js';
import type { Person } from '@/lib/data';
import type { Persona, FriendRequest, FriendLink, Geo, MapLocation } from '@/lib/types';
import { publicUrl, nameFor } from '@/lib/types';
import { getSupabase, loginWith, recoverLegacyOAuthFragment } from '@/lib/supabase';
import { errorMessage } from '@/lib/errorMessage';
import {getPresenceChannel} from '@/lib/presence';
import Brand, {BrandMark} from './Brand';
import AccountSettings from './AccountSettings';
import HomeDashboard from './HomeDashboard';
import FriendsDashboard from './FriendsDashboard';
import ExploreDashboard from './ExploreDashboard';
import ProfileDashboard from './ProfileDashboard';
import FeedPanel from './FeedPanel';
import ChatPanel from './ChatPanel';
import NotificationCenter from './NotificationCenter';

const StreetMap = dynamic(()=>import('./StreetMap'),{ssr:false,loading:()=> <div className="globe-loading">Loading streets…</div>});
const db=getSupabase();
type Tab='home'|'explore'|'feed'|'friends'|'messages'|'me'|'settings';
type GeoState='checking'|'required'|'granted'|'unavailable';
type Props={initialPostId?:string;initialUsername?:string;initialTab?:Tab};
const msg = errorMessage;
const asPerson=(p:Persona,lat=0,lng=0):Person=>({id:p.user_id,name:p.display_name,handle:`@${p.username}`,city:'Approximate region',country:'',avatar:p.avatar_path||'',lat,lng,online:false,bio:p.bio,interests:[]});

export default function SocialApp({initialPostId,initialUsername,initialTab}:Props){
 const [user,setUser]=useState<User|null>(null);
 const [authReady,setAuthReady]=useState(false);
 const [geoState,setGeoState]=useState<GeoState>('checking');
 const [geoError,setGeoError]=useState('');
 const [geoAllowed,setGeoAllowed]=useState(false);
 const [ownGeo,setOwnGeo]=useState<Geo|null>(null);
 const [guestAccepted,setGuestAccepted]=useState(false);
 const [loginOpen,setLoginOpen]=useState(false);
 const [tab,setTab]=useState<Tab>(initialPostId?'feed':initialTab||'home');
 const [mapFocus,setMapFocus]=useState<[number,number]|null>(null);
 const [notice,setNotice]=useState('');
 const [menuOpen,setMenuOpen]=useState(false);
 const [persona,setPersona]=useState<Persona|null>(null);
 const [directory,setDirectory]=useState<Persona[]>([]);
 const [publicPeople,setPublicPeople]=useState<Person[]>([]);
 const [selected,setSelected]=useState<Person|null>(null);
 const [friends,setFriends]=useState<string[]>([]);
 const [requests,setRequests]=useState<FriendRequest[]>([]);
 const [handle,setHandle]=useState('');
 const [displayName,setDisplayName]=useState('');
 const [bio,setBio]=useState('');
 const [shareLocation,setShareLocation]=useState(true);
 const [busy,setBusy]=useState(false);
 const [presence,setPresence]=useState<number|null>(null);
 const [onlineIds,setOnlineIds]=useState<string[]>([]);
 const [profileTarget,setProfileTarget]=useState<string|null>(null);
 const [chatPeer,setChatPeer]=useState<string|null>(null);
 const [memberQuery,setMemberQuery]=useState('');
 const [searchOpen,setSearchOpen]=useState(false);
 const [mobileSearch,setMobileSearch]=useState(false);
 const [postSearchResults,setPostSearchResults]=useState<{id:string;body:string}[]>([]);
 useEffect(()=>{
  const routes:Record<string,Tab>={'/':'home','/explore':'explore','/feed':'feed','/friends':'friends','/messages':'messages','/profile':'me','/settings':'settings'};
  const sync=()=>{const next=routes[window.location.pathname];if(next)setTab(next);};
  window.addEventListener('popstate',sync);return()=>window.removeEventListener('popstate',sync);
 },[]);
 const error=useCallback((e:unknown)=>{setNotice(msg(e));},[]);

 const getLocation=useCallback((permissionConfirmed=false)=>{
  if(typeof navigator==='undefined')return;
  if(!window.isSecureContext){setGeoState('unavailable');setGeoError('Location needs HTTPS on your live website or localhost during development.');return;}
  if(!navigator.geolocation){setGeoState('unavailable');setGeoError('This browser does not support location.');return;}
  setGeoState('checking');setGeoError('');
  navigator.geolocation.getCurrentPosition(pos=>{
   const geo={lat:pos.coords.latitude,lng:pos.coords.longitude,accuracy:pos.coords.accuracy};
   setOwnGeo(geo);setGeoState('granted');setGeoAllowed(true);
  },e=>{
   if(e.code===e.PERMISSION_DENIED){setGeoAllowed(false);setGeoState('required');setGeoError('Location access is blocked. Allow it using your browser site settings, then try again.');}
   else {setGeoState('unavailable');setGeoError(e.code===e.TIMEOUT?'GPS timed out. Check your device location service and press Retry.':'Your device could not determine its position. Check Location Services and retry.');}
  },{enableHighAccuracy:true,timeout:22000,maximumAge:30000});
 },[]);
 // Request permission only when unknown/denied, and silently continue if already granted.
 useEffect(()=>{
  let live=true;let permission:PermissionStatus|null=null;
  async function check(){
   if(!navigator.permissions?.query){setGeoState('required');return;}
   try{
    const p=await navigator.permissions.query({name:'geolocation'});
    if(!live)return;
    permission=p;
    if(p.state==='granted'){setGeoAllowed(true);getLocation(true);}
    else {setGeoState('required');setGeoAllowed(false);}
    p.onchange=()=>{if(!live)return;if(p.state==='granted'){setGeoAllowed(true);getLocation(true);}else{setOwnGeo(null);setGeoAllowed(false);setGeoState('required');}};
   }catch{if(live)setGeoState('required');}
  }
  void check();
  return()=>{live=false;if(permission)permission.onchange=null;};
 },[getLocation]);

 // Resolve persisted Supabase sessions even if the user returns from an old OAuth fragment.
 useEffect(()=>{
  if(!db){setAuthReady(true);return;}
  let live=true;
  const {data:sub}=db.auth.onAuthStateChange((event,session)=>{
   if(!live)return;
   if(event==='SIGNED_OUT'){setUser(null);setPersona(null);setPresence(null);setDirectory([]);setFriends([]);}
   else if(session?.user){setUser(session.user);setGuestAccepted(false);sessionStorage.removeItem('tgy_guest_entered');}
  });
  async function boot(){
   try{
    await recoverLegacyOAuthFragment();
    const {data,error:err}=await db!.auth.getSession();
    if(err)throw err;
    if(!live)return;
    setUser(data.session?.user||null);
    if(!data.session?.user)setGuestAccepted(sessionStorage.getItem('tgy_guest_entered')==='true');
   }catch(e){if(live)error(`Sign-in needs attention: ${msg(e)}`);}finally{if(live)setAuthReady(true);}
  }
  void boot();
  return()=>{live=false;sub.subscription.unsubscribe();};
 },[error]);

 const reload=useCallback(async(current:User|null)=>{
  if(!db)return;
  try{
   const locations=await db.from('tgy_locations').select('user_id,latitude,longitude,is_visible').eq('is_visible',true).limit(500);
   if(locations.error)throw locations.error;
   const geoRecords=(locations.data||[]) as MapLocation[];
   if(!current){
    setPublicPeople(geoRecords.map(l=>({id:l.user_id,name:'Nearby member',handle:'Sign in to view',city:'Approximate region',country:'',avatar:'',lat:Number(l.latitude),lng:Number(l.longitude),online:false,bio:'',interests:[]})));
    setDirectory([]);setFriends([]);setRequests([]);setPersona(null);return;
   }
   const [myProfile,allProfiles,links,req,saved]=await Promise.all([
    db.from('tgy_personas').select('id,user_id,username,display_name,bio,avatar_path,cover_path,interests,created_at').eq('user_id',current.id).maybeSingle(),
    db.from('tgy_personas').select('id,user_id,username,display_name,bio,avatar_path,cover_path,interests,created_at').limit(500),
    db.from('tgy_friendships').select('user_a,user_b').or(`user_a.eq.${current.id},user_b.eq.${current.id}`),
    db.from('tgy_friend_requests').select('id,sender_id,receiver_id,status').or(`sender_id.eq.${current.id},receiver_id.eq.${current.id}`),
    db.from('tgy_locations').select('is_visible').eq('user_id',current.id).maybeSingle(),
   ]);
   for(const r of [myProfile,allProfiles,links,req,saved])if(r.error)throw r.error;
   const profiles=(allProfiles.data||[]) as Persona[];
   const byId=new Map(profiles.map(p=>[p.user_id,p]));
   setDirectory(profiles);setPersona(myProfile.data as Persona|null);
   setFriends(((links.data||[]) as FriendLink[]).map(f=>f.user_a===current.id?f.user_b:f.user_a));
   setRequests((req.data||[]) as FriendRequest[]);
   setPublicPeople(geoRecords.filter(p=>byId.has(p.user_id)).map(p=>asPerson(byId.get(p.user_id)!,Number(p.latitude),Number(p.longitude))));
   setShareLocation(saved.data?.is_visible ?? true);
   if(myProfile.data){setHandle(myProfile.data.username);setDisplayName(myProfile.data.display_name);setBio(myProfile.data.bio||'');}
   else{setTab('me');setHandle('');setDisplayName('');setBio('');}
  }catch(e){error(`Unable to load account data: ${msg(e)}`);}
 },[error]);
 useEffect(()=>{if(authReady&&db)void reload(user);},[authReady,user,reload]);
 useEffect(()=>{
  if(!user||!db)return;
  const ch=getPresenceChannel(user.id);if(!ch)return;
  ch.on('presence',{event:'sync'},()=>{const ids=Object.keys(ch.presenceState());setOnlineIds(ids);setPresence(ids.length);});
  ch.subscribe(status=>{if(status==='SUBSCRIBED')void ch.track({at:new Date().toISOString()});});
  return()=>{void db?.removeChannel(ch);};
 },[user]);
 // GPS is stored in an owner-only table; the public point is calculated server-side.
 useEffect(()=>{
  if(!user||!ownGeo||!db)return;
  const client=db;
  let active=true;
  const task=async()=>{
   // Existing users retain their current visibility setting; new users default to showing a region.
   const saved=await client.from('tgy_locations').select('is_visible').eq('user_id',user.id).maybeSingle();
   if(saved.error||!active)return;
   const res=await client.rpc('tgy_set_location',{
    p_lat:ownGeo.lat,p_lng:ownGeo.lng,p_accuracy:Math.round(ownGeo.accuracy),p_visible:saved.data?.is_visible??true,
   });
   if(res.error&&active)error(`Location save: ${res.error.message}`);
   else if(active)void reload(user);
  };
  void task();
  return()=>{active=false;};
 // Only account changes and verified GPS updates should write location.
 },[user?.id,ownGeo?.lat,ownGeo?.lng,ownGeo?.accuracy,error,reload]);

 const logIn=async(provider:'google'|'facebook')=>{try{await loginWith(provider);}catch(e){error(e);}};
 const enterGuest=()=>{sessionStorage.setItem('tgy_guest_entered','true');setGuestAccepted(true);setLoginOpen(false);setTab('home');};
 const saveIdentity=async()=>{
  if(!db||!user)return;
  const username=handle.trim().toLowerCase().replace(/^@/,'');const name=displayName.trim();
  if(!/^[a-z0-9_]{3,24}$/.test(username)||name.length<1||name.length>80){error('Use a name and a username of 3–24 letters, digits, or underscores.');return;}
  setBusy(true);
  try{
   const account=await db.from('tgy_accounts').upsert({id:user.id},{onConflict:'id'});if(account.error)throw account.error;
   const p=await db.from('tgy_personas').upsert({user_id:user.id,username,display_name:name,bio:bio.trim()},{onConflict:'user_id'});
   if(p.error)throw p.error;
   const r=await db.from('tgy_accounts').update({onboarding_completed:true}).eq('id',user.id);if(r.error)throw r.error;
   if(ownGeo){const loc=await db.rpc('tgy_set_location',{p_lat:ownGeo.lat,p_lng:ownGeo.lng,p_accuracy:Math.round(ownGeo.accuracy),p_visible:shareLocation});if(loc.error)throw loc.error;}
   await reload(user);setTab('home');setNotice('Profile saved. Welcome to your world!');
  }catch(e){error(e);}finally{setBusy(false);}
 };
 const saveLocation=async()=>{
  if(!db||!user||!ownGeo)return;setBusy(true);
  try{const r=await db.rpc('tgy_set_location',{p_lat:ownGeo.lat,p_lng:ownGeo.lng,p_accuracy:Math.round(ownGeo.accuracy),p_visible:shareLocation});if(r.error)throw r.error;await reload(user);setNotice(shareLocation?'Your approximate map area is now visible.':'Your map location is hidden.');}
  catch(e){error(e);}finally{setBusy(false);}
 };
 const sendRequest=async(p:Person)=>{
  if(!db||!user){setLoginOpen(true);return;}
  if(!persona){setTab('me');error('Create your identity first.');return;}
  const r=await db.from('tgy_friend_requests').insert({sender_id:user.id,receiver_id:p.id});
  if(r.error)error(r.error);else{setNotice('Friend request sent.');await reload(user);}
 };
 const acceptRequest=async(r:FriendRequest)=>{
  if(!db||!user)return;
  const res=await db.rpc('tgy_accept_friend_request',{p_request_id:r.id});
  if(res.error)error(res.error);else{setNotice('Friend request accepted.');await reload(user);}
 };
 const denyRequest=async(r:FriendRequest)=>{
  if(!db||!user)return;
  const res=await db.from('tgy_friend_requests').update({status:'declined'}).eq('id',r.id).eq('receiver_id',user.id);
  if(res.error)error(res.error);else await reload(user);
 };
 const openProfile=async(p:Person)=>{
  if(!user){setLoginOpen(true);error('Sign in with Google or Facebook to see member profiles.');return;}
  if(!persona){setTab('me');return;}
  if(p.id===user.id){setProfileTarget(null);setTab('me');return;}
  setSelected(null);setProfileTarget(p.id);setTab('me');if(typeof window!=='undefined'){const known=directory.find(x=>x.user_id===p.id);if(known)window.history.pushState({},'',`/u/${encodeURIComponent(known.username)}`)}
  if(db)void db.rpc('tgy_record_profile_view',{p_profile_user_id:p.id}).then(({error:rpcError})=>{if(rpcError)console.warn('Profile-view event unavailable:',rpcError.message);});
 };
 const openProfileById=(id:string)=>{
  const p=directory.find(p=>p.user_id===id);
  if(p)void openProfile(asPerson(p));else if(!user){setLoginOpen(true);}else error('Profile unavailable, private, or blocked.');
 };
 const openChat=(id:string)=>{if(!user){setLoginOpen(true);return;}setSelected(null);setChatPeer(id);setTab('messages');};
 const nav=(next:Tab)=>{
  if(!user&&(next==='friends'||next==='messages'||next==='me'||next==='settings')){setLoginOpen(true);return;}
  if(user&&!persona&&next!=='me'&&next!=='settings'){setTab('me');return;}
  setTab(next);setSelected(null);setProfileTarget(null);setMenuOpen(false);
  const routes:Record<Tab,string>={home:'/',explore:'/explore',feed:'/feed',friends:'/friends',messages:'/messages',me:'/profile',settings:'/settings'};
  if(typeof window!=='undefined')window.history.pushState({},'',routes[next]);
 };
 const onNotification=(kind:string,payload:Record<string,string>)=>{
  if(kind==='message'){setChatPeer(payload.actor_id||null);nav('messages');}
  else if(kind==='friend_request'||kind==='friend_accepted'||kind==='follow')nav('friends');
  else if(kind==='reaction'||kind==='comment'||kind==='share'){nav('feed');if(payload.post_id)window.history.replaceState({},'',`/p/${payload.post_id}`);}
  else if(kind==='profile_view')nav('me');
 };
 useEffect(()=>{
  if(!initialUsername||!user||!directory.length)return;
  const p=directory.find(p=>p.username.toLowerCase()===initialUsername.toLowerCase());
  if(p&&p.user_id!==user.id)void openProfile(asPerson(p));
 // eslint-disable-next-line react-hooks/exhaustive-deps
 },[initialUsername,user?.id,directory.length]);
 const shareMyProfile=async()=>{
  if(!persona)return;
  const link=publicUrl(`/u/${encodeURIComponent(persona.username)}`);
  if(!link){error('Configure NEXT_PUBLIC_SITE_URL with your deployed HTTPS domain before sharing links outside localhost.');return;}
  try{if(navigator.share)await navigator.share({url:link,title:persona.display_name});else{await navigator.clipboard.writeText(link);setNotice('Profile link copied.');}}
  catch(e){if(msg(e).toLowerCase().includes('abort'))return;error(e);}
 };
 const reportProfile=async(targetUserId:string)=>{
  if(!db||!user)return;
  const reason=window.prompt('Why are you reporting this member?');
  if(reason===null)return;
  if(reason.trim().length<5){error('Please provide a reason of at least five characters.');return;}
  const r=await db.from('tpy_content_reports').insert({reporter_id:user.id,target_user_id:targetUserId,reason:reason.trim().slice(0,1000)});
  if(r.error)error(r.error);else setNotice('Your report was sent for moderator review.');
 };
 const blockProfile=async(targetUserId:string)=>{
  if(!db||!user||targetUserId===user.id)return;
  if(!window.confirm('Block this member? They will not be able to view your public profile or posts while blocked.'))return;
  const r=await db.from('tgy_blocks').insert({blocker_id:user.id,blocked_id:targetUserId});
  if(r.error)error(r.error);else{setSelected(null);setNotice('Member blocked. Manage blocked accounts in Settings.');await reload(user);}
 };
 const friendIds=useMemo(()=>new Set(friends),[friends]);
 const outgoing=new Set(requests.filter(r=>r.sender_id===user?.id&&r.status==='pending').map(r=>r.receiver_id));
 const friendProfiles=directory.filter(p=>friendIds.has(p.user_id));
 const center: [number,number]=mapFocus||(ownGeo?[ownGeo.lat,ownGeo.lng]:[20,0]);
 const currentProfile=profileTarget?directory.find(p=>p.user_id===profileTarget)||null:persona;
 useEffect(()=>{
  const term=memberQuery.trim();
  if(!db||term.length<2){setPostSearchResults([]);return;}
  let active=true;
  const timer=window.setTimeout(async()=>{
   const r=await db!.from('tgy_posts').select('id,body').ilike('body',`%${term.replace(/[%_]/g,'')}%`).limit(5);
   if(active)setPostSearchResults(r.error?[]:(r.data||[]));
  },300);
  return()=>{active=false;window.clearTimeout(timer);};
 },[memberQuery]);
 const searchResults=memberQuery.trim().length>1?directory.filter(p=>`${p.display_name} ${p.username}`.toLowerCase().includes(memberQuery.trim().toLowerCase())).slice(0,7):[];
 const startCompose=()=>{if(!user||!persona){if(user)nav('me');else setLoginOpen(true);return;}
  if(tab!=='home'&&tab!=='feed')nav('home');
  window.setTimeout(()=>window.dispatchEvent(new Event('tpy:create-post')),80);
 };
 const navigation=(mobile=false)=><nav className="nav" aria-label={mobile?'Mobile navigation':'Main navigation'}>
  {([['home','Home',Home],['explore','Explore',Compass],['friends','Friends',Users],['messages','Messages',MessageCircle],['me','Profile',UserRound]] as const).map(([k,name,Icon])=><button key={k} className={tab===k||(k==='home'&&tab==='feed')?'current':''} onClick={()=>nav(k)} aria-current={tab===k?'page':undefined}><Icon size={20}/><span>{name}</span>{!mobile&&k==='friends'&&requests.filter(r=>r.receiver_id===user?.id&&r.status==='pending').length>0&&<span className="tpy-side-count">{requests.filter(r=>r.receiver_id===user?.id&&r.status==='pending').length}</span>}</button>)}
  {!mobile&&<>
    <button onClick={()=>window.dispatchEvent(new Event('tpy:open-notifications'))}><Bell size={20}/><span>Notifications</span></button>
    <button onClick={()=>nav('settings')}><Bookmark size={20}/><span>Saved & settings</span></button>
    <button onClick={()=>{nav('home');window.setTimeout(()=>document.querySelector('.tpy-stories')?.scrollIntoView({behavior:'smooth',block:'center'}),80);}}><Heart size={20}/><span>Stories</span></button>
  </>}
 </nav>;

 if(!db)return <main className="location-gate"><div className="gate-card"><h1>Connect Supabase</h1><p>Add your public Supabase URL and publishable key to <code>.env.local</code> and restart the server.</p></div></main>;
 if(!authReady)return <main className="location-gate"><div className="gate-card"><h1>Loading your session…</h1><p>Checking your Google/Facebook account securely.</p></div></main>;
 if(geoState==='checking')return <main className="auth-callback"><div className="gate-card"><h1>Finding your world…</h1><p>Retrieving your permitted device location. You won't be asked again if the browser already allows it.</p></div></main>;
 if(geoState!=='granted')return <main className="location-gate"><section className="gate-card">
  <div className="gate-emblem"><MapPin/></div><p className="eyebrow">LOCATION-BASED SOCIAL WORLD</p>
  <h1>{geoState==='checking'?'Checking your location…':geoState==='required'?'Enable location to enter.':'Location services unavailable'}</h1>
  <p>Location is a required part of The Pussy Is Yours. Your device position is used for the map. Signed-in accounts store only an approximate map area on the server, which you can hide in Profile.</p>
  <div className="privacy-points"><div><Navigation size={18}/> Find your position on streets and mapped buildings</div><div><ShieldCheck size={18}/> Public pins use nearby areas, not your building or floor</div><div><LockKeyhole size={18}/> You can hide your public pin at any time</div></div>
  {geoState!=='checking'&&<button className="primary gate-cta" onClick={()=>getLocation()}><MapPin size={18}/>{geoAllowed?'Retry locating my device':'Allow location & continue'}</button>}
  {geoError&&<p className="gate-error" role="alert">{geoError}</p>}
  {geoState==='checking'&&<p className="muted">Your browser already has permission? You will proceed automatically once coordinates are available.</p>}
  <small>If location permission is denied, the social app stays locked. You can change this in your browser site settings.</small>
 </section></main>;
 if(!user&&!guestAccepted)return <main className="location-gate"><section className="gate-card entry-card">
   <BrandMark size={64}/><p className="eyebrow">THE PUSSY IS YOURS</p><h1>Find your world.</h1>
   <p>Choose how to enter. You must select Google, Facebook, or Guest before you can explore.</p>
   <button className="oauth" onClick={()=>void logIn('google')}>Continue with Google</button>
   <button className="oauth" onClick={()=>void logIn('facebook')}>Continue with Facebook</button>
   <button className="secondary guest-entry" onClick={enterGuest}>Continue as guest</button>
   <small>Guests can explore public posts and the map. Sign in to view member profiles, chat, like, comment, and create posts. By signing in, you accept our <a href="/terms">Terms</a> and <a href="/privacy">Privacy Notice</a>.</small>
   {notice&&<p className="gate-error">{notice}</p>}
  </section></main>;

 return <div className="shell tpy-reference-shell">
  <header className="tpy-global-header">
    <div className="tpy-top-logo"><Brand/></div>
    <div className={`tpy-global-search ${mobileSearch ? 'mobile-open' : ''}`}>
      <Search size={20}/><input value={memberQuery} onChange={e=>{setMemberQuery(e.target.value);setSearchOpen(true);}} onFocus={()=>setSearchOpen(true)} onKeyDown={e=>{if(e.key==='Escape')setSearchOpen(false);if(e.key==='Enter'&&searchResults[0]){openProfileById(searchResults[0].user_id);setSearchOpen(false);}}} placeholder="Search people and posts…" aria-label="Search community members"/>
      {memberQuery&&<button aria-label="Clear search" onClick={()=>{setMemberQuery('');setSearchOpen(false);}}><X size={17}/></button>}
      {searchOpen&&memberQuery.trim().length>1&&<div className="tpy-search-results">
        {searchResults.length?searchResults.map(p=><button key={p.user_id} onClick={()=>{openProfileById(p.user_id);setSearchOpen(false);setMobileSearch(false);setMemberQuery('');}}><span className="tpy-circle-avatar">{p.display_name[0]}</span><span><b>{p.display_name}</b><small>@{p.username}</small></span></button>):null}
        {postSearchResults.map(p=><button key={p.id} onClick={()=>window.location.assign(`/p/${p.id}`)}><span className="tpy-circle-avatar"><Search size={15}/></span><span><b>Community post</b><small>{p.body.slice(0,85)||'Shared a post'}</small></span></button>)}
        {!searchResults.length&&!postSearchResults.length&&<p>No matching people or posts yet.</p>}
      </div>}
    </div>
    <div className="tpy-top-actions">
     <button className="tpy-search-toggle" aria-label="Search" onClick={()=>{setMobileSearch(x=>!x);setSearchOpen(true);}}><Search size={21}/></button>
     {user&&presence!==null&&<span className="tpy-presence"><i/>{presence} online</span>}
     <button className={tab==='home'?'active':''} onClick={()=>nav('home')} aria-label="Home"><Home size={21}/></button>
     <button className={tab==='friends'?'active':''} onClick={()=>nav('friends')} aria-label="Friends"><Users size={21}/></button>
     <button className={tab==='explore'?'active':''} onClick={()=>nav('explore')} aria-label="Explore map"><MapPin size={21}/></button>
     {user&&<NotificationCenter user={user} directory={directory} onNavigate={onNotification} onError={error}/>}
     <button className={tab==='messages'?'active':''} onClick={()=>nav('messages')} aria-label="Messages"><MessageCircle size={21}/></button>
     <div className="tpy-top-account"><button className="tpy-account-toggle" onClick={()=>setMenuOpen(v=>!v)} aria-label="Account menu" aria-expanded={menuOpen}><span className="avatar-button">{persona?.display_name?.[0]?.toUpperCase()||(user?'✓':'♡')}</span><span className="tpy-account-label">{persona?.display_name||'Guest'}</span><ChevronDown size={15}/></button>
      {menuOpen&&<div className="dropdown">{user?<><button onClick={()=>nav('me')}><UserRound size={17}/>Profile</button><button onClick={()=>nav('settings')}><Settings2 size={17}/>Settings & safety</button><a className="menu-admin-link" href="/admin"><ShieldCheck size={17}/>Moderation</a><button onClick={async()=>{const res=await db.auth.signOut();if(res.error)error(res.error);setMenuOpen(false);setGuestAccepted(false);sessionStorage.removeItem('tgy_guest_entered');}}><LogOut size={17}/>Log out</button></>:<button onClick={()=>{setLoginOpen(true);setMenuOpen(false);}}><LogIn size={17}/>Sign in</button>}</div>}
     </div>
    </div>
  </header>
  <aside className="sidebar tpy-sidebar">{navigation()}<button className="tpy-sidebar-compose" onClick={startCompose}><Plus size={19}/>Create Post</button><div className="tpy-side-foot"><p>Discover · Connect · Belong</p><a href="/privacy">Privacy</a> · <a href="/terms">Terms</a></div></aside>
  <section className="main tpy-main">
   <div className="content">
   {tab==='home'&&<HomeDashboard user={user} persona={persona} directory={directory} people={publicPeople.filter(p=>p.id!==user?.id)} ownLocation={ownGeo?[ownGeo.lat,ownGeo.lng]:null} friends={friendProfiles} onLogin={()=>setLoginOpen(true)} onError={error} onProfile={openProfileById} onExplore={()=>nav('explore')} onFriends={()=>nav('friends')} onChat={openChat}/>}
   {tab==='explore'&&<ExploreDashboard user={user} directory={directory} people={publicPeople.filter(p=>p.id!==user?.id)} ownLocation={ownGeo?[ownGeo.lat,ownGeo.lng]:null} onlineIds={onlineIds} friendIds={friends} onProfile={openProfileById} onChat={openChat} onAddFriend={id=>{const p=directory.find(x=>x.user_id===id);if(p)void sendRequest(asPerson(p));}} onLogin={()=>setLoginOpen(true)} onError={error}/>}
   {tab==='feed'&&<FeedPanel user={user} persona={persona} directory={directory} focusPostId={initialPostId}
      onLogin={()=>setLoginOpen(true)} onError={error} onProfile={openProfileById}/>}
   {tab==='friends'&&user&&<FriendsDashboard user={user} directory={directory} friendIds={friends} requests={requests} people={publicPeople} onlineIds={onlineIds} onProfile={openProfileById} onChat={openChat} onExplore={()=>nav('explore')} onAccept={r=>void acceptRequest(r)} onDecline={r=>void denyRequest(r)} onAddFriend={id=>{const p=directory.find(x=>x.user_id===id);if(p)void sendRequest(asPerson(p));}} onError={error} onChanged={()=>void reload(user)}/>}
   {tab==='messages'&&user&&<ChatPanel user={user} friends={friendProfiles} directory={directory} initialPeerId={chatPeer} onError={error}/>}
   {tab==='settings'&&user&&<AccountSettings user={user} directory={directory} onError={error}/>}
   {tab==='me'&&user&&(currentProfile?<ProfileDashboard user={user} persona={persona} profile={currentProfile} directory={directory} friendIds={friends} onChat={openChat} onProfile={openProfileById} onAddFriend={id=>{const p=directory.find(x=>x.user_id===id);if(p)void sendRequest(asPerson(p))}} onChanged={()=>void reload(user)} onError={error} onLogin={()=>setLoginOpen(true)} onShare={()=>void shareMyProfile()} onReport={id=>void reportProfile(id)} onBlock={id=>void blockProfile(id)} onSettings={()=>nav('settings')}/>:
    <div className="narrow profile-editor"><h1>Create your identity</h1><section className="social-card form"><h2>Introduce yourself</h2><p className="muted">Your Google or Facebook account stays separate from this public persona.</p><label>Display name<input maxLength={80} value={displayName} onChange={e=>setDisplayName(e.target.value)}/></label><label>Username<input maxLength={24} value={handle} onChange={e=>setHandle(e.target.value)}/></label><label>Bio<textarea maxLength={500} value={bio} onChange={e=>setBio(e.target.value)}/></label><button className="primary" disabled={busy} onClick={()=>void saveIdentity()}>{busy?'Saving…':'Create profile'}</button></section></div>)}
   </div>
  </section>
  <div className="mobile-nav">{navigation(true)}</div>
  {selected&&<div className="overlay" onMouseDown={e=>{if(e.target===e.currentTarget)setSelected(null);}}><section className="sheet" role="dialog" aria-modal="true" aria-label="Member profile">
    <button className="close" aria-label="Close" onClick={()=>setSelected(null)}><X/></button><span className="profile-circle">{selected.name.slice(0,1)}</span><h2>{selected.name}</h2><p className="muted">{selected.handle}</p>
    <p>{selected.bio||'Member of The Pussy Is Yours'}</p>
    <div className="action-row"><button className="primary" disabled={friendIds.has(selected.id)||outgoing.has(selected.id)} onClick={()=>void sendRequest(selected)}><Users size={17}/>{friendIds.has(selected.id)?'Friends':outgoing.has(selected.id)?'Requested':'Add friend'}</button>
      <button className="secondary" disabled={!friendIds.has(selected.id)} onClick={()=>openChat(selected.id)}><MessageCircle size={17}/> Chat</button></div>
    <div className="tpy-moderation-actions"><button className="secondary" onClick={()=>void reportProfile(selected.id)}>Report member</button><button className="secondary" onClick={()=>void blockProfile(selected.id)}>Block member</button></div>
    <small className="muted">Profile viewing notifies this member at most once per day if notifications are enabled.</small>
   </section></div>}
  {loginOpen&&!user&&<div className="overlay" onMouseDown={e=>{if(e.target===e.currentTarget)setLoginOpen(false);}}><section className="login panel" role="dialog" aria-modal="true" aria-label="Sign in">
    <button className="close" aria-label="Close" onClick={()=>setLoginOpen(false)}><X/></button><BrandMark size={64}/><h2>Connect with people.</h2><p>Sign in to see member profiles, send messages, comment and post.</p>
    <button className="oauth" onClick={()=>void logIn('google')}>Continue with Google</button>
    <button className="oauth" onClick={()=>void logIn('facebook')}>Continue with Facebook</button>
    <button className="secondary" onClick={()=>setLoginOpen(false)}>Return to guest exploration</button>
   </section></div>}
  {notice&&<div className="inapp-toast" role="alert">{notice}<button onClick={()=>setNotice('')} aria-label="Dismiss"><X size={16}/></button></div>}
 </div>;
}
```

---

## `components/FriendsDashboard.tsx`

```tsx
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
```

---

## `components/ExploreDashboard.tsx`

```tsx
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
```

---

## `components/ProfileDashboard.tsx`

```tsx
'use client';
import {useCallback,useEffect,useRef,useState} from 'react';
import type {User} from '@supabase/supabase-js';
import {ArrowRight,Bookmark,CalendarDays,Camera,Check,Copy,Edit3,Grid2X2,Heart,Image as ImageIcon,MapPin,MessageCircle,MoreHorizontal,Settings2,ShieldCheck,UserPlus,Users,X} from 'lucide-react';
import type {Persona,Post,PostMedia} from '@/lib/types';
import {getSupabase} from '@/lib/supabase';
import {errorMessage} from '@/lib/errorMessage';
import {signedMedia,validateUpload} from '@/lib/media';
import ProfileAvatar from './ProfileAvatar';
import FeedPanel from './FeedPanel';
import StoriesStrip from './StoriesStrip';
const db=getSupabase();
type View='posts'|'media'|'about'|'saved'|'stories';
type Props={user:User;persona:Persona|null;profile:Persona|null;directory:Persona[];friendIds:string[];onChat:(id:string)=>void;onAddFriend:(id:string)=>void;onProfile:(id:string)=>void;onFollowChange?:()=>void;onChanged:()=>void;onLogin:()=>void;onError:(e:unknown)=>void;onShare:()=>void;onBlock:(id:string)=>void;onReport:(id:string)=>void;onSettings:()=>void};
export default function ProfileDashboard({user,persona,profile,directory,friendIds,onChat,onAddFriend,onProfile,onChanged,onError,onLogin,onShare,onBlock,onReport,onSettings}:Props){
 const own=profile?.user_id===user.id;
 const [view,setView]=useState<View>('posts');
 const [editing,setEditing]=useState(false);
 const [displayName,setDisplayName]=useState('');const [username,setUsername]=useState('');const [bio,setBio]=useState('');const [interests,setInterests]=useState('');
 const [stats,setStats]=useState({posts:0,followers:0,following:0,friends:0});
 const [following,setFollowing]=useState(false);
 const [busy,setBusy]=useState(false);
 const [profileMedia,setProfileMedia]=useState<{id:string;url:string;type:string}[]>([]);
 const [saved,setSaved]=useState<{id:string;body:string}[]>([]);
 const [menu,setMenu]=useState(false);
 const avatarFile=useRef<HTMLInputElement>(null),coverFile=useRef<HTMLInputElement>(null);
 const started=profile?.created_at?new Date(profile.created_at).toLocaleDateString(undefined,{month:'short',year:'numeric'}):'Recently';
 const photo=(path?:string|null)=>!path?'':path.startsWith('https://')?path:db?.storage.from('tpy-profile-media').getPublicUrl(path).data.publicUrl||'';
 useEffect(()=>{setDisplayName(profile?.display_name||'');setUsername(profile?.username||'');setBio(profile?.bio||'');setInterests((profile?.interests||[]).join(', '));setView('posts');setEditing(false)},[profile?.user_id]);
 const reloadStats=useCallback(async()=>{
  if(!db||!profile)return;
  const id=profile.user_id;
  const [posts,followers,followingCount,myFollows,friends]=await Promise.all([
   db.from('tgy_posts').select('id',{count:'exact',head:true}).eq('author_id',id),
   db.from('tpy_follows').select('follower_id',{count:'exact',head:true}).eq('followed_id',id),
   db.from('tpy_follows').select('followed_id',{count:'exact',head:true}).eq('follower_id',id),
   db.from('tpy_follows').select('followed_id').eq('follower_id',user.id).eq('followed_id',id).maybeSingle(),
   db.from('tgy_friendships').select('user_a',{count:'exact',head:true}).or(`user_a.eq.${id},user_b.eq.${id}`)
  ]);
  setStats({posts:posts.count||0,followers:followers.count||0,following:followingCount.count||0,friends:friends.count||0});
  if(!myFollows.error)setFollowing(!!myFollows.data);
 },[profile?.user_id,user.id]);
 useEffect(()=>{void reloadStats();},[reloadStats]);
 useEffect(()=>{if(!db||!profile)return;let live=true;
  (async()=>{
   const r=await db!.from('tgy_posts').select('id').eq('author_id',profile.user_id).order('created_at',{ascending:false}).limit(80);
   if(r.error||!r.data?.length){if(live)setProfileMedia([]);return;}
   const m=await db!.from('tgy_post_media').select('id,object_path,media_type').in('post_id',r.data.map(x=>x.id)).limit(60);
   if(m.error)return;
   const images=await Promise.all(((m.data||[]) as PostMedia[]).map(async f=>{
    try{return {id:f.id,url:await signedMedia('tgy-post-media',f.object_path),type:f.media_type}}catch{return {id:f.id,url:'',type:f.media_type}}
   }));if(live)setProfileMedia(images.filter(x=>!!x.url));
  })();return()=>{live=false};
 },[profile?.user_id]);
 useEffect(()=>{if(view!=='saved'||!own||!db||!profile)return;let live=true;
  void db.from('tpy_bookmarks').select('post_id').eq('user_id',user.id).then(async ({data,error})=>{
   if(error){onError(error);return;}const ids=(data||[]).map(x=>x.post_id);
   if(!ids.length){if(live)setSaved([]);return;}
   const posts=await db!.from('tgy_posts').select('id,body').in('id',ids);
   if(!posts.error&&live)setSaved((posts.data||[]) as {id:string;body:string}[]);
  });return()=>{live=false};},[view,own,profile?.user_id,user.id,onError]);
 const save=async()=>{
  if(!db||!profile||!own)return;
  const normalized=username.toLowerCase().trim().replace(/^@/,'');
  if(!/^[a-z0-9_]{3,24}$/.test(normalized)||!displayName.trim()||displayName.trim().length>80){onError('Use a name and a username with 3–24 letters, digits or underscores.');return;}
  setBusy(true);
  const r=await db.from('tgy_personas').update({display_name:displayName.trim(),username:normalized,bio:bio.slice(0,500),interests:interests.split(',').map(x=>x.trim()).filter(Boolean).slice(0,12)}).eq('user_id',user.id);
  if(r.error)onError(r.error);else{setEditing(false);onChanged();}setBusy(false);
 };
 const uploadPhoto=async(file:File|undefined,kind:'avatar_path'|'cover_path')=>{
  if(!file||!db||!own)return;
  setBusy(true);
  try{
   validateUpload(file,'post');if(!file.type.startsWith('image/'))throw Error('Select an image file.');
   const ext=file.type.split('/')[1]==='jpeg'?'jpg':file.type.split('/')[1];
   const path=`${user.id}/${kind}/${crypto.randomUUID()}.${ext}`;
   const upload=await db.storage.from('tpy-profile-media').upload(path,file,{contentType:file.type,upsert:false});if(upload.error)throw upload.error;
   const res=await db.from('tgy_personas').update({[kind]:path}).eq('user_id',user.id);if(res.error)throw res.error;
   onChanged();
  }catch(e){onError(errorMessage(e));}finally{setBusy(false);}
 };
 const toggleFollow=async()=>{
  if(!db||!profile||own)return;setBusy(true);
  const r=following?await db.from('tpy_follows').delete().eq('follower_id',user.id).eq('followed_id',profile.user_id):await db.from('tpy_follows').insert({follower_id:user.id,followed_id:profile.user_id});
  if(r.error)onError(r.error);else{setFollowing(!following);void reloadStats();}setBusy(false);
 };
 if(!profile)return <div className="ui-page ui-profile"><section className="ui-empty"><h2>Create your public identity</h2><p>Complete onboarding first to unlock your public profile.</p></section></div>;
 return <div className="ui-page ui-profile">
  <section className="ui-profile-top"><div className="ui-cover" style={photo(profile.cover_path)?{backgroundImage:`linear-gradient(0deg,#07091333,#07091310),url("${photo(profile.cover_path)}")`}:undefined}>
    {!profile.cover_path&&<div className="ui-cover-monogram" aria-hidden="true">Connect. Share. Belong.</div>}
    {own&&<><button className="ui-cover-edit" disabled={busy} onClick={()=>coverFile.current?.click()}><Camera size={16}/> Edit cover</button><input hidden ref={coverFile} type="file" accept="image/jpeg,image/png,image/webp" onChange={e=>void uploadPhoto(e.target.files?.[0],'cover_path')}/></>}
   </div>
   <div className="ui-profile-main"><div className="ui-profile-photo-wrap"><ProfileAvatar profile={profile} size={138}/>{own&&<><button className="ui-avatar-edit" aria-label="Change profile picture" onClick={()=>avatarFile.current?.click()}><Camera size={15}/></button><input hidden ref={avatarFile} type="file" accept="image/jpeg,image/png,image/webp" onChange={e=>void uploadPhoto(e.target.files?.[0],'avatar_path')}/></>}</div>
    <div className="ui-profile-intro"><div><h1>{profile.display_name}</h1><small>@{profile.username}</small></div><p>{profile.bio||'A new member of the community.'}</p><div className="ui-profile-facts"><span><MapPin size={15}/>Location is approximate</span><span><CalendarDays size={15}/>Joined {started}</span></div></div>
    <div className="ui-profile-side-actions"><div className="ui-profile-actions">{own?<><button className="ui-btn-pink" onClick={()=>setEditing(true)}><Edit3 size={16}/>Edit profile</button><button className="ui-btn-outline" onClick={onShare}><Copy size={16}/>Share</button><button className="ui-btn-icon" aria-label="Account settings" onClick={onSettings}><Settings2 size={18}/></button></>:<>
     <button className="ui-btn-pink" disabled={busy} onClick={()=>void toggleFollow()}><UserPlus size={16}/>{following?'Following':'Follow'}</button>
     <button className="ui-btn-outline" disabled={!friendIds.includes(profile.user_id)} title={!friendIds.includes(profile.user_id)?"Become friends to message":"Open conversation"} onClick={()=>onChat(profile.user_id)}><MessageCircle size={16}/>Message</button>
     <button className="ui-btn-outline" disabled={friendIds.includes(profile.user_id)} onClick={()=>onAddFriend(profile.user_id)}><Users size={16}/>{friendIds.includes(profile.user_id)?'Friends':'Add friend'}</button>
     <div className="ui-popover-anchor"><button className="ui-btn-icon" aria-label="Profile options" onClick={()=>setMenu(v=>!v)}><MoreHorizontal/></button>{menu&&<div className="ui-small-popover"><button onClick={()=>{setMenu(false);onReport(profile.user_id)}}>Report member</button><button onClick={()=>{setMenu(false);onBlock(profile.user_id)}}>Block member</button></div>}</div>
    </>}</div><div className="ui-profile-stats"><div><b>{stats.posts}</b><small>Posts</small></div><div><b>{stats.friends}</b><small>Friends</small></div><div><b>{stats.followers}</b><small>Followers</small></div><div><b>{stats.following}</b><small>Following</small></div></div></div>
   </div></section>
  <div className="ui-profile-stories"><StoriesStrip user={own?user:null} persona={own?persona:null} directory={directory} onLogin={onLogin} onError={onError} authorFilterId={profile.user_id}/></div>
  <nav className="ui-profile-nav" aria-label="Profile sections">{([['posts','Posts',Grid2X2],['media','Media',ImageIcon],['about','About',ShieldCheck],...(own?[['saved','Saved',Bookmark] as const]:[]),['stories','Stories',Heart]] as const).map(([k,label,Icon])=><button key={k} className={view===k?'active':''} onClick={()=>setView(k)}><Icon size={18}/>{label}</button>)}</nav>
  <div className="ui-content-with-rail"><main className="ui-primary-column">
   {view==='posts'&&<div className="ui-profile-feed"><FeedPanel user={user} persona={persona} directory={directory} authorFilterId={profile.user_id} hideComposer hideStories embedded onLogin={onLogin} onProfile={onProfile} onError={onError}/></div>}
   {view==='media'&&<div className="ui-profile-media"><h2>Photos & videos</h2>{profileMedia.length?<div className="ui-media-grid">{profileMedia.map(f=>f.type==='video'?<video key={f.id} src={f.url} controls playsInline/>:<img key={f.id} src={f.url} alt="Member uploaded media" loading="lazy"/>)}</div>:<div className="ui-empty">No visible photos or videos yet.</div>}</div>}
   {view==='about'&&<section className="ui-rail-panel ui-about-full"><h2>About {profile.display_name}</h2><p>{profile.bio||'No biography yet.'}</p><h3>Interests</h3><div className="ui-interests-row">{profile.interests?.length?profile.interests.map(s=><span className="ui-interest-chip" key={s}>{s}</span>):<span className="ui-muted">No interests added</span>}</div></section>}
   {view==='saved'&&own&&<section className="ui-rail-panel"><h2>Saved posts</h2>{saved.length?saved.map(p=><a className="ui-saved-post" key={p.id} href={`/p/${p.id}`}>{p.body?.slice(0,150)||'Open saved media post'} <ArrowRight size={16}/></a>):<p className="ui-muted">No saved posts yet.</p>}</section>}
   {view==='stories'&&<section className="ui-rail-panel"><h2>Stories</h2><p className="ui-muted">Open the circles above to view stories shared within the last 24 hours.</p></section>}
  </main><aside className="ui-context-rail"><section className="ui-rail-panel"><header><h3>About {profile.display_name}</h3></header><p>{profile.bio||'No biography yet.'}</p><div className="ui-fact"><MapPin size={17}/>Approximate nearby area</div><div className="ui-fact"><CalendarDays size={17}/>Joined {started}</div><div className="ui-fact"><ShieldCheck size={17}/>Account visibility controlled by member</div></section>
    <section className="ui-rail-panel"><header><h3>Interests</h3></header><div className="ui-interests-row">{profile.interests?.map(i=><span className="ui-interest-chip" key={i}>{i}</span>)}{!profile.interests?.length&&<p className="ui-muted">No interests listed.</p>}</div></section>
    <section className="ui-rail-panel"><header><h3>Recent media</h3></header>{profileMedia.length?<div className="ui-rail-media-grid">{profileMedia.filter(f=>f.type==='image').slice(0,6).map(f=><img key={f.id} src={f.url} alt="Publicly visible photo" loading="lazy"/>)}</div>:<p className="ui-muted">Photos from visible posts appear here.</p>}</section>
   </aside></div>
  {editing&&own&&<div className="overlay" onMouseDown={e=>{if(e.target===e.currentTarget)setEditing(false)}}><section className="ui-edit-dialog" role="dialog" aria-modal="true" aria-label="Edit profile"><header><h2>Edit your profile</h2><button className="ui-btn-icon" aria-label="Close" onClick={()=>setEditing(false)}><X/></button></header><label>Display name<input value={displayName} maxLength={80} onChange={e=>setDisplayName(e.target.value)}/></label><label>Username<input value={username} maxLength={24} onChange={e=>setUsername(e.target.value)}/></label><label>Bio<textarea value={bio} maxLength={500} onChange={e=>setBio(e.target.value)}/></label><label>Interests (separate with commas)<input value={interests} maxLength={350} onChange={e=>setInterests(e.target.value)}/></label><button className="ui-btn-pink" disabled={busy} onClick={()=>void save()}><Check size={17}/>{busy?'Saving…':'Save profile'}</button></section></div>}
 </div>;
}
```

---

## `components/ProfileAvatar.tsx`

```tsx
'use client';
import {useState} from 'react';
import type {Persona} from '@/lib/types';
import {getSupabase} from '@/lib/supabase';

export default function ProfileAvatar({profile,size=48,className='',online=false}:{profile?:Pick<Persona,'display_name'|'avatar_path'>|null;size?:number;className?:string;online?:boolean}){
 const [failed,setFailed]=useState(false);
 const path=profile?.avatar_path;
 const src=path?(path.startsWith('https://')?path:getSupabase()?.storage.from('tpy-profile-media').getPublicUrl(path).data.publicUrl):null;
 return <span className={`ui-avatar ${className}`} style={{width:size,height:size,flex:`0 0 ${size}px`}}>
  {src&&!failed?<img src={src} alt="" loading="lazy" onError={()=>setFailed(true)}/>:
   <span aria-hidden="true">{profile?.display_name?.charAt(0).toUpperCase()||'♡'}</span>}
  {online&&<i className="ui-avatar-online" aria-label="Online"/>}
 </span>;
}
```

---

## `components/ChatPanel.tsx`

```tsx
'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { User } from '@supabase/supabase-js';
import { ArrowLeft, Bell, BellOff, Check, CheckCheck, FileText, Image as ImageIcon, Mic, MoreVertical, Paperclip, Search, Send, Smile, X, Square, Pin, Star, Users, MoreHorizontal } from 'lucide-react';
import type { Persona, ChatMessage } from '@/lib/types';
import { nameFor, timeAgo } from '@/lib/types';
import { getSupabase } from '@/lib/supabase';
import { errorMessage } from '@/lib/errorMessage';
import ProfileAvatar from './ProfileAvatar';
import { CHAT_BUCKET, signedMedia, uploadMedia, validateUpload } from '@/lib/media';
const db = getSupabase();
type ChatListRow = {conversation_id:string; other_user_id:string; last_message_at:string|null};
type Props={user:User; friends:Persona[]; directory:Persona[]; initialPeerId?:string|null; onlineIds?:string[]; onProfile?:(id:string)=>void; onError:(e:unknown)=>void};

export default function ChatPanel({user,friends,directory,initialPeerId,onlineIds=[],onProfile,onError}:Props){
 const [rows,setRows]=useState<ChatListRow[]>([]);
 const [peer,setPeer]=useState<string|null>(null);
 const [conversation,setConversation]=useState<string|null>(null);
 const [messages,setMessages]=useState<ChatMessage[]>([]);
 const [readMessageIds,setReadMessageIds]=useState<string[]>([]);
 const [text,setText]=useState('');
 const [filter,setFilter]=useState('');
 const [attachmentsOpen,setAttachmentsOpen]=useState(false);
 const [urls,setUrls]=useState<Record<string,string>>({});
 const [busy,setBusy]=useState(false);
 const [recording,setRecording]=useState(false);
 const [chatNotice,setChatNotice]=useState('');
 const [chatFilter,setChatFilter]=useState<'all'|'unread'|'online'>('all');
 const [unreadIds,setUnreadIds]=useState<string[]>([]);
 const [starred,setStarred]=useState<string[]>([]);
 const [prefs,setPrefs]=useState<{muted:boolean;pinned:boolean}>({muted:false,pinned:false});
 const [detailsOpen,setDetailsOpen]=useState(true);
 const [menuOpen,setMenuOpen]=useState(false);

 const bottom=useRef<HTMLDivElement>(null);
 const fileRef=useRef<HTMLInputElement>(null);
 const recorder=useRef<MediaRecorder|null>(null);
 const recorderStream=useRef<MediaStream|null>(null);
 const recorderChunks=useRef<Blob[]>([]);
 const msg = errorMessage;
 const show=(e:unknown)=>{setChatNotice(msg(e));onError(e)};

 const loadList=useCallback(async()=>{
  if(!db)return;
  // The RPC resolves the other user safely from conversation membership, rather than exposing all participants.
  const res=await db.rpc('tgy_list_direct_chats');
  if(res.error)show(res.error);
  else setRows((res.data||[]) as ChatListRow[]);
 // eslint-disable-next-line react-hooks/exhaustive-deps
 },[user.id]);
 const loadMessages=useCallback(async(id:string)=>{
  if(!db)return;
  const res=await db.from('tgy_messages').select('id,conversation_id,sender_id,body,media_path,media_type,attachment_name,created_at')
    .eq('conversation_id',id).order('created_at',{ascending:true}).limit(250);
  if(res.error)show(res.error);
  else {
   const arr=(res.data||[]) as ChatMessage[];setMessages(arr);
   const received=arr.filter(m=>m.sender_id!==user.id).map(m=>({message_id:m.id,user_id:user.id}));
   if(received.length)void db.from('tgy_message_reads').upsert(received,{onConflict:'message_id,user_id',ignoreDuplicates:true});
   const ids=arr.filter(m=>m.sender_id===user.id).map(m=>m.id);
   if(ids.length){const receipts=await db.from('tgy_message_reads').select('message_id').in('message_id',ids);
    if(!receipts.error)setReadMessageIds((receipts.data||[]).map(r=>r.message_id));
   }
  }
 // eslint-disable-next-line react-hooks/exhaustive-deps
 },[user.id]);
 useEffect(()=>{void loadList();},[loadList]);
 useEffect(()=>{
  if(!db||!conversation)return;
  void loadMessages(conversation);
  const channel=db.channel(`dm-${conversation}`).on('postgres_changes',{
   event:'INSERT',schema:'public',table:'tgy_messages',filter:`conversation_id=eq.${conversation}`
  },()=>{void loadMessages(conversation);void loadList();}).subscribe();
  const tick=window.setInterval(()=>{void loadMessages(conversation);},15000);
  return()=>{clearInterval(tick);void db?.removeChannel(channel);};
 },[conversation,loadMessages,loadList]);
 useEffect(()=>{bottom.current?.scrollIntoView({behavior:'smooth',block:'end'});},[messages]);
 useEffect(()=>{let alive=true;Promise.all(messages.filter(m=>m.media_path).map(async m=>{
  try{return [m.id,await signedMedia(CHAT_BUCKET,m.media_path!)] as const;}catch{return [m.id,''] as const;}
 })).then(entries=>{if(alive)setUrls(Object.fromEntries(entries));});return()=>{alive=false;};},[messages]);
 const open=useCallback(async(other:string)=>{
  if(!db||other===user.id)return;
  const res=await db.rpc('tgy_open_direct_chat',{p_other_user:other});
  if(res.error){show(res.error);return;}
  setConversation(String(res.data));setPeer(other);setAttachmentsOpen(false);setMessages([]);void loadList();
  const id=String(res.data);
  void db.from('tgy_notifications').update({read_at:new Date().toISOString()}).eq('user_id',user.id).eq('kind','message').filter('payload->>conversation_id','eq',id).is('read_at',null).then(({error})=>{if(!error)setUnreadIds(x=>x.filter(y=>y!==id))});
 // eslint-disable-next-line react-hooks/exhaustive-deps
 },[user.id,loadList]);
 useEffect(()=>{if(initialPeerId)void open(initialPeerId);},[initialPeerId,open]);
 const sendText=async()=>{
  if(!db||!conversation||!text.trim())return;
  setBusy(true);
  const r=await db.from('tgy_messages').insert({conversation_id:conversation,sender_id:user.id,body:text.trim(),media_type:'text'});
  if(r.error)show(r.error);else{setText('');await loadMessages(conversation);await loadList();}
  setBusy(false);
 };
 const sendFile=async(file:File)=>{
  if(!db||!conversation)return;
  setBusy(true);setAttachmentsOpen(false);
  try{
   validateUpload(file,'chat');
   const path=await uploadMedia(CHAT_BUCKET,user.id,conversation,file);
   const category=file.type.startsWith('image/')?'image':file.type.startsWith('video/')?'video':file.type.startsWith('audio/')?'audio':'file';
   const r=await db.from('tgy_messages').insert({conversation_id:conversation,sender_id:user.id,body:null,media_path:path,media_type:category,attachment_name:file.name.slice(0,180)});
   if(r.error)throw r.error;
   await loadMessages(conversation);
  }catch(e){show(e);}finally{setBusy(false);}
 };
 const startRecording=async()=>{
  if(!conversation){setChatNotice('Open a conversation first.');return;}
  if(!navigator.mediaDevices?.getUserMedia||typeof MediaRecorder==='undefined'){setChatNotice('This browser does not support voice recording.');return;}
  try{
   const stream=await navigator.mediaDevices.getUserMedia({audio:true});
   const options=MediaRecorder.isTypeSupported('audio/webm')?{mimeType:'audio/webm'}:MediaRecorder.isTypeSupported('audio/mp4')?{mimeType:'audio/mp4'}:undefined;
   const rec=new MediaRecorder(stream,options);recorder.current=rec;recorderStream.current=stream;recorderChunks.current=[];
   rec.ondataavailable=(e)=>{if(e.data.size)recorderChunks.current.push(e.data);};
   rec.onstop=()=>{stream.getTracks().forEach(t=>t.stop());setRecording(false);
    const mime=rec.mimeType.startsWith('audio/mp4')?'audio/mp4':'audio/webm';
    const audio=new Blob(recorderChunks.current,{type:mime});
    if(audio.size>0)void sendFile(new File([audio],`voice-${Date.now()}.${mime==='audio/mp4'?'m4a':'webm'}`,{type:mime}));
   };
   rec.start();setRecording(true);
  }catch(e){show(e);}
 };
 const stopRecording=()=>recorder.current?.state==='recording'&&recorder.current.stop();
 useEffect(()=>()=>{const rec=recorder.current;if(rec?.state==='recording'){rec.onstop=null;rec.stop();}recorderStream.current?.getTracks().forEach(t=>t.stop());},[]);
 useEffect(()=>{if(!db||!user)return;
  const load=async()=>{const r=await db!.from('tgy_notifications').select('payload').eq('user_id',user.id).eq('kind','message').is('read_at',null).limit(100);
   if(!r.error)setUnreadIds((r.data||[]).map(x=>String(x.payload?.conversation_id||'')));};
  void load();const id=window.setInterval(()=>{void load()},12000);return()=>clearInterval(id);
 },[user.id]);
 useEffect(()=>{if(!db||!conversation)return;let alive=true;
  Promise.all([db.from('tpy_chat_preferences').select('muted,pinned').eq('user_id',user.id).eq('conversation_id',conversation).maybeSingle(),db.from('tpy_starred_messages').select('message_id').eq('user_id',user.id)]).then(([a,b])=>{if(!alive)return;if(!a.error)setPrefs({muted:a.data?.muted||false,pinned:a.data?.pinned||false});if(!b.error)setStarred((b.data||[]).map(x=>x.message_id));});
  return()=>{alive=false};
 },[conversation,user.id]);
 const updatePref=async(key:'muted'|'pinned')=>{if(!db||!conversation)return;const next={...prefs,[key]:!prefs[key]};
  const r=await db.from('tpy_chat_preferences').upsert({conversation_id:conversation,user_id:user.id,...next,updated_at:new Date().toISOString()},{onConflict:'user_id,conversation_id'});
  if(r.error)show(r.error);else setPrefs(next);
 };
 const toggleStar=async(id:string)=>{if(!db)return;const had=starred.includes(id);
  const r=had?await db.from('tpy_starred_messages').delete().eq('user_id',user.id).eq('message_id',id):await db.from('tpy_starred_messages').insert({user_id:user.id,message_id:id});
  if(r.error)show(r.error);else setStarred(cur=>had?cur.filter(x=>x!==id):[...cur,id]);
 };
 const chatList=[...rows];
 for(const f of friends){if(!chatList.some(r=>r.other_user_id===f.user_id))chatList.push({conversation_id:'',other_user_id:f.user_id,last_message_at:null});}
 const shown=chatList.filter(c=>nameFor(directory,c.other_user_id).toLowerCase().includes(filter.toLowerCase()))
  .filter(c=>chatFilter==='all'||(chatFilter==='unread'&&unreadIds.includes(c.conversation_id))||(chatFilter==='online'&&onlineIds.includes(c.other_user_id)))
  .sort((a,b)=>{const ap=a.conversation_id===conversation&&prefs.pinned?1:0,bp=b.conversation_id===conversation&&prefs.pinned?1:0;return bp-ap||new Date(b.last_message_at||0).getTime()-new Date(a.last_message_at||0).getTime()});
 const peerProfile=directory.find(p=>p.user_id===peer);
 const shared=messages.filter(m=>m.media_path);
 const starredMessages=messages.filter(m=>starred.includes(m.id));
 return <div className="messenger">
  <aside className={`message-sidebar ${conversation?'mobile-hidden':''}`}>
   <div className="message-heading"><h1>Messages</h1><button aria-label="New conversation" onClick={()=>setChatNotice('Select a confirmed friend below to start a secure conversation.')}><MessageCircleIcon/></button></div>
   <label className="chat-search"><Search size={18}/><input placeholder="Search conversations" value={filter} onChange={e=>setFilter(e.target.value)}/></label>
   <div className="chat-filters">{(['all','unread','online'] as const).map(x=><button type="button" key={x} className={chatFilter===x?'selected':''} onClick={()=>setChatFilter(x)}>{x==='all'?'All':x==='unread'?`Unread ${unreadIds.length||''}`:'Online'}</button>)}</div>
   {shown.length?shown.map(c=><button key={c.other_user_id} className={`conversation-row ${peer===c.other_user_id?'selected':''}`} onClick={()=>void open(c.other_user_id)}>
    <ProfileAvatar profile={directory.find(p=>p.user_id===c.other_user_id)} size={50} online={onlineIds.includes(c.other_user_id)}/><span><b>{nameFor(directory,c.other_user_id)}</b><small>{c.last_message_at?`Last activity ${timeAgo(c.last_message_at)}`:'Start a conversation'}</small></span>{unreadIds.includes(c.conversation_id)&&<i className="ui-chat-unread" aria-label="Unread messages"/>}
   </button>):<p className="chat-placeholder">No chats yet. Add a friend to start messaging.</p>}
  </aside>
  <main className={`message-thread ${!conversation?'mobile-hidden':''}`}>
   {conversation&&peer?<>
    <header className="thread-header"><button className="mobile-back" aria-label="All chats" onClick={()=>{setConversation(null);setPeer(null);}}><ArrowLeft size={20}/></button>
      <ProfileAvatar profile={peerProfile} size={45} online={onlineIds.includes(peer)}/><button className="thread-contact ui-chat-profile-link" onClick={()=>onProfile?.(peer)}><b>{nameFor(directory,peer)}</b><small>{onlineIds.includes(peer)?'● Online now':'Private conversation'}</small></button>
      <div className="thread-actions"><button aria-label="Open conversation details" onClick={()=>setDetailsOpen(v=>!v)}><Users size={19}/></button><button aria-label="Chat options" onClick={()=>setMenuOpen(v=>!v)}><MoreVertical size={20}/></button>{menuOpen&&<div className="ui-small-popover ui-thread-menu"><button onClick={()=>{void updatePref('muted');setMenuOpen(false)}}>{prefs.muted?'Unmute':'Mute'} notifications</button><button onClick={()=>{void updatePref('pinned');setMenuOpen(false)}}>{prefs.pinned?'Unpin':'Pin'} conversation</button><button onClick={()=>{setDetailsOpen(true);setMenuOpen(false)}}>Conversation details</button></div>}</div>
    </header>
    <div className="thread-scroller">
     <div className="chat-encryption">Only conversation members can access messages through Supabase policies. This is not end-to-end encryption.</div>
     {messages.map(m=><div className={`message-bubble ${m.sender_id===user.id?'my-bubble':''}`} key={m.id}>
      <button className={`ui-message-star ${starred.includes(m.id)?'active':''}`} title={starred.includes(m.id)?'Unstar message':'Star message'} aria-label={starred.includes(m.id)?'Unstar message':'Star message'} onClick={()=>void toggleStar(m.id)}><Star size={14} fill={starred.includes(m.id)?'currentColor':'none'}/></button>
      {!!m.body&&<div className="bubble-text">{m.body}</div>}
      {m.media_path&& (urls[m.id] ? (m.media_type==='audio'?<audio controls preload="metadata" src={urls[m.id]}/>:
       m.media_type==='video'?<video controls preload="metadata" className="chat-media" src={urls[m.id]}/>:
       m.media_type==='image'?<img src={urls[m.id]} className="chat-media" alt={m.attachment_name||'Shared photo'}/>:
       <a href={urls[m.id]} target="_blank" rel="noreferrer" className="chat-document"><FileText size={20}/>{m.attachment_name||'Download attachment'}</a>) : <span>Loading attachment…</span>)}
      <small>{new Date(m.created_at).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})}{m.sender_id===user.id&&(readMessageIds.includes(m.id)?<CheckCheck size={12} color="#a6ddeb"/>:<Check size={12}/>)}</small>
     </div>)}<div ref={bottom}/>
    </div>
    <form className="chat-composer" onSubmit={e=>{e.preventDefault();void sendText();}}>
      <div className="attach-wrap"><button type="button" aria-label="Attach file" onClick={()=>setAttachmentsOpen(v=>!v)}><Paperclip size={21}/></button>
        {attachmentsOpen&&<div className="attach-menu">
         <button type="button" onClick={()=>fileRef.current?.click()}><ImageIcon size={18}/> Photos &amp; videos</button>
         <button type="button" onClick={()=>fileRef.current?.click()}><FileText size={18}/> Document</button>
         <button type="button" onClick={()=>setChatNotice('Use the microphone button to record a voice note.')}><Mic size={18}/> Voice message</button>
        </div>}
      </div>
      <input ref={fileRef} type="file" hidden accept="image/*,video/mp4,video/webm,audio/webm,audio/mp4,audio/ogg,audio/mpeg,application/pdf" onChange={e=>{const file=e.target.files?.[0];if(file)void sendFile(file);e.target.value='';}}/>
      <button type="button" aria-label="Insert emoji" onClick={()=>setText(s=>s+' 😊')}><Smile size={20}/></button>
      <input className="chat-text-input" aria-label="Write a message" placeholder={recording?'Recording voice note…':'Type a message'} value={text} maxLength={10000} onChange={e=>setText(e.target.value)} disabled={busy||recording}/>
      {text.trim()?<button aria-label="Send message" type="submit" disabled={busy}><Send size={20}/></button>:
       <button aria-label={recording?'Stop recording and send':'Record voice message'} type="button" onClick={recording?stopRecording:()=>void startRecording()} className={recording?'recording':''}>{recording?<Square size={18}/>:<Mic size={20}/>}</button>}
    </form>
   </>:<div className="conversation-empty"><MessageCircleIcon/><h2>Private conversations</h2><p>Choose a friend to begin chatting. Text, images, video attachments and voice notes are supported.</p></div>}
  </main>
  {conversation&&peer&&detailsOpen&&<aside className="ui-conversation-details"><header><h2>Conversation details</h2><button className="ui-btn-icon" aria-label="Close details" onClick={()=>setDetailsOpen(false)}><X size={17}/></button></header><div className="ui-conversation-person"><ProfileAvatar profile={peerProfile} size={78} online={onlineIds.includes(peer)}/><b>{peerProfile?.display_name||'Member'}</b><small>@{peerProfile?.username||'member'}</small><button className="ui-btn-outline" onClick={()=>onProfile?.(peer)}>View profile</button></div>
    <div className="ui-conversation-option"><span><Bell size={17}/> Notifications</span><button onClick={()=>void updatePref('muted')}>{prefs.muted?'Muted':'Enabled'}</button></div>
    <div className="ui-conversation-option"><span><Pin size={17}/> Pinned conversation</span><button onClick={()=>void updatePref('pinned')}>{prefs.pinned?'Pinned':'Not pinned'}</button></div>
    <section><h3>Shared media <span>{shared.length}</span></h3>{shared.length?<div className="ui-chat-shared">{shared.slice(-8).map(m=>m.media_type==='image'&&urls[m.id]?<img src={urls[m.id]} key={m.id} alt={m.attachment_name||'Shared image'} loading="lazy"/>:<a key={m.id} href={urls[m.id]||'#'} target="_blank" rel="noopener noreferrer"><FileText size={18}/>{m.attachment_name||m.media_type}</a>)}</div>:<p>No shared media yet.</p>}</section>
    <section><h3><Star size={16}/> Starred messages <span>{starredMessages.length}</span></h3>{starredMessages.length?<div className="ui-chat-starred">{starredMessages.map(m=><button key={m.id} onClick={()=>void toggleStar(m.id)} title="Remove star">{m.body?.slice(0,90)||m.attachment_name||'Media'}<Star size={14} fill="currentColor"/></button>)}</div>:<p>Star a message to find it here.</p>}</section>
    <small className="ui-chat-privacy">Supabase row policies restrict conversations to members. Messages are not end-to-end encrypted.</small>
   </aside>}
  {chatNotice&&<div className="inapp-toast" role="status">{chatNotice}<button onClick={()=>setChatNotice('')} aria-label="Dismiss"><X size={15}/></button></div>}
 </div>;
}
function MessageCircleIcon(){return <span className="message-icon">♡</span>;}
```

---

## `components/FeedPanel.tsx`

```tsx
'use client';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { User } from '@supabase/supabase-js';
import { Bookmark, Check, ChevronDown, Earth, Heart, ImagePlus, Lock, MessageCircle, MoreHorizontal, Plus, Send, Share2, Smile, Users, Video, X, Flag, Trash2 } from 'lucide-react';
import { getSupabase } from '@/lib/supabase';
import StoriesStrip from './StoriesStrip';
import ProfileAvatar from './ProfileAvatar';
import { errorMessage } from '@/lib/errorMessage';
import { POST_BUCKET, signedMedia, uploadMedia, validateUpload } from '@/lib/media';
import { type Persona, type Post, type PostMedia, type PostComment, type PostReaction, type Visibility, nameFor, publicUrl, timeAgo, usernameFor } from '@/lib/types';

type Props = {
  user: User | null; persona: Persona | null; directory: Persona[]; focusPostId?: string;
  onLogin: () => void; onProfile: (userId: string) => void; onError: (error: unknown) => void; embedded?: boolean; authorFilterId?:string; hideComposer?:boolean; hideStories?:boolean;
};
const db = getSupabase();
const describe = (v: Visibility) => v === 'only_me' ? 'Only me' : v === 'friends' ? 'Friends' : 'Public';
const emblem = (v: Visibility) => v === 'only_me' ? <Lock size={13}/> : v === 'friends' ? <Users size={13}/> : <Earth size={13}/>;
const msg = errorMessage;

export default function FeedPanel({ user, persona, directory, focusPostId, onLogin, onProfile, onError, embedded = false, authorFilterId, hideComposer=false, hideStories=false }: Props) {
  const [posts, setPosts] = useState<Post[]>([]);
  const [media, setMedia] = useState<PostMedia[]>([]);
  const [reactions, setReactions] = useState<PostReaction[]>([]);
  const [comments, setComments] = useState<PostComment[]>([]);
  const [mediaUrls, setMediaUrls] = useState<Record<string,string>>({});
  const [loading, setLoading] = useState(true);
  const [composeOpen, setComposeOpen] = useState(false);
  const [postText, setPostText] = useState('');
  const [audience, setAudience] = useState<Visibility>('public');
  const [audienceOpen, setAudienceOpen] = useState(false);
  const audienceRef = useRef<HTMLDivElement>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [publishing, setPublishing] = useState(false);
  const [inputComments, setInputComments] = useState<Record<string,string>>({});
  const [expandedComments, setExpandedComments] = useState<string[]>([]);
  const [likedPost, setLikedPost] = useState<string | null>(null);
  const [toast, setToast] = useState('');
  const [bookmarks, setBookmarks] = useState<string[]>([]);
  const [postMenu, setPostMenu] = useState<string | null>(null);
  const [mediaError, setMediaError] = useState('');
  const fileInput = useRef<HTMLInputElement>(null);
  const focused = useRef<HTMLDivElement>(null);
  const report = (e: unknown) => { setToast(msg(e)); onError(e); };

  const reload = useCallback(async () => {
    if (!db) return;
    setLoading(true);
    try {
      let query=db.from('tgy_posts').select('id,author_id,body,visibility,created_at');
      if(authorFilterId)query=query.eq('author_id',authorFilterId);
      const r = await query.order('created_at',{ascending:false}).limit(80);
      if (r.error) throw r.error;
      const all = (r.data || []) as Post[];
      if (focusPostId && !all.some(p => p.id === focusPostId)) {
        const one = await db.from('tgy_posts').select('id,author_id,body,visibility,created_at').eq('id',focusPostId).maybeSingle();
        if (!one.error && one.data) all.unshift(one.data as Post);
      }
      setPosts(authorFilterId?all.filter(p=>p.author_id===authorFilterId):all);
      const ids = (authorFilterId?all.filter(p=>p.author_id===authorFilterId):all).map(p => p.id);
      if (!ids.length) { setMedia([]);setReactions([]);setComments([]);setMediaUrls({});return; }
      const [m, likes, replies] = await Promise.all([
        db.from('tgy_post_media').select('id,post_id,object_path,media_type,mime_type').in('post_id',ids).limit(300),
        db.from('tgy_reactions').select('post_id,user_id,kind').in('post_id',ids).limit(1000),
        db.from('tgy_comments').select('id,post_id,author_id,body,created_at').in('post_id',ids).order('created_at',{ascending:true}).limit(1000),
      ]);
      if (m.error) throw m.error;
      if (likes.error) throw likes.error;
      if (replies.error) throw replies.error;
      setMedia((m.data || []) as PostMedia[]);
      setReactions((likes.data || []) as PostReaction[]);
      setComments((replies.data || []) as PostComment[]);
    } catch (e) { report(e); } finally { setLoading(false); }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusPostId,user?.id,authorFilterId]);

  useEffect(() => {
    const openComposer = () => user && persona ? setComposeOpen(true) : onLogin();
    window.addEventListener('tpy:create-post', openComposer);
    return () => window.removeEventListener('tpy:create-post', openComposer);
  },[user?.id,persona?.user_id,onLogin]);
  useEffect(() => {
    if (!audienceOpen) return;
    const outside = (e: PointerEvent) => {
      if (!audienceRef.current?.contains(e.target as Node)) setAudienceOpen(false);
    };
    const escape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setAudienceOpen(false);
    };
    document.addEventListener('pointerdown', outside);
    document.addEventListener('keydown', escape);
    return () => {
      document.removeEventListener('pointerdown', outside);
      document.removeEventListener('keydown', escape);
    };
  }, [audienceOpen]);
  useEffect(() => { void reload(); },[reload]);
  useEffect(()=>{
    if(!db||!user){setBookmarks([]);return;}
    void db.from('tpy_bookmarks').select('post_id').eq('user_id',user.id)
      .then(({data,error})=>{if(error){if(error.code!=='PGRST205'&&!/could not find the table|does not exist/i.test(error.message||''))onError(error);}else setBookmarks((data||[]).map(x=>x.post_id));});
  },[user?.id]);
  useEffect(() => {
    if (!db) return;
    const channel = db.channel('tgy-feed-refresh')
      .on('postgres_changes',{event:'INSERT',schema:'public',table:'tgy_posts'},()=>{void reload();})
      .subscribe();
    return () => { void db.removeChannel(channel); };
  },[reload]);
  useEffect(() => {
    let active = true;
    Promise.all(media.map(async m => {
      try {return [m.id,await signedMedia(POST_BUCKET,m.object_path)] as const;} catch {return [m.id,''] as const;}
    })).then(pairs => { if(active) setMediaUrls(Object.fromEntries(pairs)); });
    return () => { active=false; };
  },[media]);
  useEffect(()=>{if(focusPostId) focused.current?.scrollIntoView({block:'center',behavior:'smooth'});},[focusPostId,posts]);

  async function createPost() {
    if (!db || !user || !persona) {onLogin();return;}
    if (!postText.trim() && !files.length) return;
    setPublishing(true); setMediaError('');
    let id: string | null = null;
    try {
      const r = await db.from('tgy_posts').insert({author_id:user.id,body:postText.trim(),visibility:audience}).select('id').single();
      if (r.error) throw r.error;
      id = r.data.id as string;
      for (const file of files) {
        validateUpload(file,'post');
        const path = await uploadMedia(POST_BUCKET,user.id,id!,file);
        const m = await db.from('tgy_post_media').insert({post_id:id,object_path:path,media_type:file.type.startsWith('video/')?'video':'image',mime_type:file.type});
        if(m.error) throw m.error;
      }
      setComposeOpen(false);setPostText('');setFiles([]);setAudience('public');
      await reload(); setToast('Post shared successfully');
    } catch (e) {
      setMediaError(`${msg(e)}${id ? ' — Your text post may have been saved; refresh the feed to check.' : ''}`);
      report(e);
    } finally {setPublishing(false);}
  }
  async function toggleLike(postId:string) {
    if (!db || !user) {onLogin();return;}
    const mine = reactions.find(x=>x.post_id===postId && x.user_id===user.id);
    const r = mine
      ? await db.from('tgy_reactions').delete().eq('post_id',postId).eq('user_id',user.id)
      : await db.from('tgy_reactions').insert({post_id:postId,user_id:user.id,kind:'like'});
    if(r.error) report(r.error); else await reload();
  }
  async function addComment(postId:string) {
    if(!db||!user) {onLogin();return;}
    const body=inputComments[postId]?.trim();if(!body)return;
    const r=await db.from('tgy_comments').insert({post_id:postId,author_id:user.id,body});
    if(r.error)report(r.error);else{setInputComments(v=>({...v,[postId]:''}));await reload();}
  }
  async function share(p:Post) {
    const url=publicUrl(`/p/${p.id}`);
    if(!url){setToast('Add NEXT_PUBLIC_SITE_URL=https://your-real-domain.com to .env.local, redeploy, then public sharing will work. Localhost links cannot be shared with friends.');return;}
    if(user && db) void db.from('tgy_post_shares').insert({post_id:p.id,user_id:user.id});
    try {
      if(navigator.share) await navigator.share({title:'The Pussy Is Yours',url});
      else {await navigator.clipboard.writeText(url);setToast('Public post link copied.');}
    } catch (e) {if(msg(e).toLowerCase().includes('abort'))return;report(e);}
  }
  async function toggleBookmark(postId:string){
    if(!db||!user){onLogin();return;}
    const saved=bookmarks.includes(postId);
    const r=saved?await db.from('tpy_bookmarks').delete().eq('post_id',postId).eq('user_id',user.id):
      await db.from('tpy_bookmarks').insert({post_id:postId,user_id:user.id});
    if(r.error)report(r.error);else setBookmarks(prev=>saved?prev.filter(x=>x!==postId):[...prev,postId]);
    setPostMenu(null);
  }
  async function reportPost(p:Post){
    if(!db||!user){onLogin();return;}
    const reason=window.prompt('Why are you reporting this post?');
    if(reason===null)return;
    if(reason.trim().length<5){setToast('Please provide at least five characters.');return;}
    const r=await db.from('tpy_content_reports').insert({reporter_id:user.id,target_post_id:p.id,reason:reason.trim().slice(0,1000)});
    if(r.error)report(r.error);else setToast('Report submitted to the moderation queue.');
    setPostMenu(null);
  }
  async function deletePost(p:Post){
    if(!db||p.author_id!==user?.id)return;
    if(!window.confirm('Delete this post? This cannot be undone.'))return;
    const r=await db.from('tgy_posts').delete().eq('id',p.id).eq('author_id',user.id);
    if(r.error)report(r.error);else await reload();
    setPostMenu(null);
  }
  const reactionCounts=useMemo(()=>{
    const m:Record<string,PostReaction[]>={};for(const r of reactions)(m[r.post_id]??=[]).push(r);return m;
  },[reactions]);
  const commentCounts=useMemo(()=>{
    const m:Record<string,PostComment[]>={};for(const c of comments)(m[c.post_id]??=[]).push(c);return m;
  },[comments]);
  const onFiles=(incoming:FileList|null)=>{
    if(!incoming)return;
    try {const all=Array.from(incoming).slice(0,5);all.forEach(file=>validateUpload(file,'post'));setFiles(all);setMediaError('');}
    catch(e){setMediaError(msg(e));}
  };
  const avatar=(id:string)=> <ProfileAvatar profile={directory.find(p=>p.user_id===id)|| (id===user?.id?persona:null)} size={43}/>;

  return <div className={`feed-page ${embedded ? 'tpy-embedded-feed' : ''}`}>
    <div className="feed-main">
      {!embedded && <h1 className="feed-title">Your feed</h1>}
      {!hideStories&&<StoriesStrip user={user} persona={persona} directory={directory} onLogin={onLogin} onError={onError}/>}
      {!hideComposer&&<div className="feed-create-card">
        <div className="create-prompt">{user ? avatar(user.id) : <span className="social-avatar">♡</span>}
          <button onClick={()=>user && persona ? setComposeOpen(true) : onLogin()}>{user ? `What's on your mind, ${persona?.display_name || 'friend'}?` : 'Sign in to share your story'}</button>
        </div>
        <div className="feed-shortcuts">
          <button onClick={()=>user&&persona?setComposeOpen(true):onLogin()}><Video size={18} color="#ef7c85"/> Video</button>
          <button onClick={()=>user&&persona?setComposeOpen(true):onLogin()}><ImagePlus size={18} color="#70c79b"/> Photo</button>
          <button onClick={()=>user&&persona?setComposeOpen(true):onLogin()}><Smile size={18} color="#e8b866"/> Feeling</button>
        </div>
      </div>}

      {loading && !posts.length && <div className="social-card empty-feed">Loading your community feed…</div>}
      {!loading&&!posts.length&&<div className="social-card empty-feed">Nobody has posted yet. Be the first person to share a moment.</div>}
      {posts.map(p=>{
        const ms=media.filter(m=>m.post_id===p.id);
        const likes=reactionCounts[p.id]||[];
        const cs=commentCounts[p.id]||[];
        const isMine=likes.some(r=>r.user_id===user?.id);
        const isExpanded=expandedComments.includes(p.id);
        return <div className="social-card feed-post" key={p.id} ref={p.id===focusPostId?focused:undefined}>
          <div className="feed-post-header">
            <button className="post-author" onClick={()=>user?onProfile(p.author_id):onLogin()}>
              {avatar(p.author_id)}<span><b>{user ? nameFor(directory,p.author_id) : 'Community member'}</b><small>{timeAgo(p.created_at)} · {emblem(p.visibility)} {describe(p.visibility)}</small></span>
            </button>
            <div className="tpy-post-menu-wrap"><button aria-label="Post options" className="tpy-post-menu-toggle" onClick={()=>setPostMenu(v=>v===p.id?null:p.id)}><MoreHorizontal size={20}/></button>
            {postMenu===p.id&&<div className="tpy-post-menu">
              <button onClick={()=>void toggleBookmark(p.id)}><Bookmark size={16}/>{bookmarks.includes(p.id)?'Remove from saved':'Save post'}</button>
              <button onClick={()=>void reportPost(p)}><Flag size={16}/>Report post</button>
              {p.author_id===user?.id&&<button onClick={()=>void deletePost(p)}><Trash2 size={16}/>Delete post</button>}
            </div>}</div>
          </div>
          {p.body&&<p className="feed-post-copy">{p.body}</p>}
          {!!ms.length&&<div className={`post-media-gallery ${ms.length>1?'multiple':''}`}>
            {ms.map(m=>{
              const url=mediaUrls[m.id];
              return url ? (m.media_type==='video' ?
                <video key={m.id} className="post-media-asset" controls preload="metadata" src={url}/> :
                /* CSS keeps the intrinsic aspect ratio instead of crop/stretch. */
                <img key={m.id} className="post-media-asset" src={url} alt="Member's uploaded post" loading="lazy"/>) :
                <div key={m.id} className="media-placeholder">Media loading or unavailable</div>;
            })}
          </div>}
          <div className="post-metrics">
            <button onClick={()=>setLikedPost(p.id)}><Heart size={14} fill="#e991ae" color="#e991ae"/> {likes.length} {likes.length===1?'like':'likes'}</button>
            <button onClick={()=>setExpandedComments(v=>v.includes(p.id)?v.filter(x=>x!==p.id):[...v,p.id])}>{cs.length} comments</button>
          </div>
          <div className="post-actions">
            <button className={isMine?'liked':''} onClick={()=>void toggleLike(p.id)}><Heart size={18} fill={isMine?'currentColor':'none'}/> Like</button>
            <button onClick={()=>setExpandedComments(v=>v.includes(p.id)?v.filter(x=>x!==p.id):[...v,p.id])}><MessageCircle size={18}/> Comment</button>
            <button onClick={()=>void share(p)}><Share2 size={18}/> Share</button>
          </div>
          {isExpanded&&<div className="post-comments">
            {cs.map(c=><div className="comment-row" key={c.id}>{avatar(c.author_id)}<div><b>{user?nameFor(directory,c.author_id):'Community member'}</b><p>{c.body}</p><small>{timeAgo(c.created_at)}</small></div></div>)}
            {user?<form className="comment-input" onSubmit={e=>{e.preventDefault();void addComment(p.id);}}>
              <input value={inputComments[p.id]||''} maxLength={3000} onChange={e=>setInputComments(s=>({...s,[p.id]:e.target.value}))} placeholder="Write a comment…" aria-label="Write comment"/>
              <button aria-label="Send comment" disabled={!inputComments[p.id]?.trim()}><Send size={17}/></button>
            </form>:<button className="comment-login" onClick={onLogin}>Sign in to comment</button>}
          </div>}
        </div>;
      })}
    </div>
    {!embedded && <aside className="feed-aside"><div className="social-card"><h3>Discover your circle</h3><p>Find members on the map and connect with people nearby. Only real accounts appear here.</p></div>
      <div className="social-card"><h3>Share responsibly</h3><p>Public posts are visible to anyone. Friends posts are restricted to confirmed friends. Only me posts are private.</p></div>
    </aside>}
    {!hideComposer&&user&&persona&&<button className="floating-compose" aria-label="Create post" onClick={()=>setComposeOpen(true)}><Plus/></button>}
    {composeOpen&&<div className="overlay" onMouseDown={e=>{if(e.target===e.currentTarget)setComposeOpen(false);}}>
      <section className="compose-dialog" role="dialog" aria-modal="true" aria-label="Create post">
        <div className="dialog-title"><h2>Create post</h2><button aria-label="Close" onClick={()=>setComposeOpen(false)}><X size={22}/></button></div>
        <div className="compose-author">{user&&avatar(user.id)}<div><b>{persona?.display_name}</b>
          <div className="audience-control" ref={audienceRef}>
            <button type="button" className="audience-trigger"
              aria-label={`Who can see this post: ${describe(audience)}`}
              aria-haspopup="menu" aria-expanded={audienceOpen}
              onClick={() => setAudienceOpen(open => !open)}>
              {emblem(audience)} <span>{describe(audience)}</span> <ChevronDown size={14}/>
            </button>
            {audienceOpen && <div className="audience-options" role="menu" aria-label="Post privacy">
              {(['public','friends','only_me'] as Visibility[]).map(visibility =>
                <button type="button" key={visibility} role="menuitemradio"
                  aria-checked={audience===visibility}
                  className={audience===visibility?'selected':''}
                  onClick={() => {setAudience(visibility);setAudienceOpen(false);}}>
                  <span className="audience-option-icon">{emblem(visibility)}</span>
                  <span className="audience-option-copy"><b>{describe(visibility)}</b><small>{visibility==='public'?'Anyone can see this post':visibility==='friends'?'Only your confirmed friends':'Only you can see this post'}</small></span>
                  {audience===visibility && <Check size={17} className="audience-option-check"/>}
                </button>
              )}
            </div>}
          </div>
        </div></div>
        <textarea autoFocus className="compose-body" value={postText} onChange={e=>setPostText(e.target.value)} maxLength={10000} placeholder="What's on your mind?" />
        {!!files.length&&<div className="file-chips">{files.map((file,i)=><span key={i}>{file.type.startsWith('video/')?<Video size={14}/>:<ImagePlus size={14}/>} {file.name}<button onClick={()=>setFiles(f=>f.filter((_,j)=>j!==i))} aria-label={`Remove ${file.name}`}><X size={13}/></button></span>)}</div>}
        <div className="compose-tools"><strong>Add to your post</strong><div><button aria-label="Add photos or videos" onClick={()=>fileInput.current?.click()}><ImagePlus size={23}/></button><button aria-label="Add video" onClick={()=>fileInput.current?.click()}><Video size={23}/></button><button aria-label="Add a smile" onClick={()=>setPostText(v=>v+' 😊')}><Smile size={23}/></button></div></div>
        <input ref={fileInput} type="file" accept="image/jpeg,image/png,image/webp,image/gif,video/mp4,video/webm" multiple hidden onChange={e=>onFiles(e.target.files)}/>
        {mediaError&&<p className="feed-error">{mediaError}</p>}
        <button className="primary create-publish" disabled={publishing||(!postText.trim()&&!files.length)} onClick={()=>void createPost()}>{publishing?'Publishing…':'Post'}</button>
      </section>
    </div>}
    {likedPost&&<div className="overlay" onMouseDown={e=>{if(e.target===e.currentTarget)setLikedPost(null);}}><section className="people-modal" role="dialog" aria-modal="true" aria-label="People who liked this post">
      <div className="dialog-title"><h2>People who liked this</h2><button onClick={()=>setLikedPost(null)} aria-label="Close"><X/></button></div>
      {(reactionCounts[likedPost]||[]).length ? (reactionCounts[likedPost]||[]).map(r=><div className="like-person" key={r.user_id}>{avatar(r.user_id)}<b>{user?nameFor(directory,r.user_id):'A community member'}</b>{user&&usernameFor(directory,r.user_id)&&<button onClick={()=>{onProfile(r.user_id);setLikedPost(null);}}>View</button>}</div>):<p>No likes yet.</p>}
    </section></div>}
    {toast&&<div className="inapp-toast" role="status">{toast}<button aria-label="Close notification" onClick={()=>setToast('')}><X size={15}/></button></div>}
  </div>;
}
```

---

## `components/StoriesStrip.tsx`

```tsx
'use client';
import {useCallback,useEffect,useRef,useState} from 'react';
import type {User} from '@supabase/supabase-js';
import {ChevronLeft,ChevronRight,Plus,X,Trash2,ImagePlus} from 'lucide-react';
import type {Persona} from '@/lib/types';
import {getSupabase} from '@/lib/supabase';
import {signedMedia,uploadMedia,validateUpload} from '@/lib/media';
import {errorMessage} from '@/lib/errorMessage';

type Story = {id:string;author_id:string;media_path:string;media_type:'image'|'video';caption:string;visibility:'public'|'friends';created_at:string};
const db=getSupabase();
export default function StoriesStrip({user,persona,directory,onLogin,onError,authorFilterId}:{user:User|null;persona:Persona|null;directory:Persona[];onLogin:()=>void;onError:(e:unknown)=>void;authorFilterId?:string}){
 const [stories,setStories]=useState<Story[]>([]);
 const [needsSetup,setNeedsSetup]=useState(false);
 const [urls,setUrls]=useState<Record<string,string>>({});
 const [index,setIndex]=useState<number|null>(null);
 const [busy,setBusy]=useState(false);
 const [audience,setAudience]=useState<'public'|'friends'>('friends');
 const [caption,setCaption]=useState('');
 const [selectedFile,setSelectedFile]=useState<File|null>(null);
 const [composer,setComposer]=useState(false);
 const fileInput=useRef<HTMLInputElement>(null);
 const reload=useCallback(async()=>{
  if(!db)return;
  const {data,error}=await db.from('tpy_stories').select('id,author_id,media_path,media_type,caption,visibility,created_at').gt('expires_at',new Date().toISOString()).order('created_at',{ascending:false}).limit(80);
  if(error){
   if(error.code==='PGRST205'||/could not find the table|does not exist/i.test(error.message||'')){setNeedsSetup(true);return;}
   onError(error);return;
  }
  setNeedsSetup(false);
  setStories(((data||[]) as Story[]).filter(s=>!authorFilterId||s.author_id===authorFilterId));
 },[onError,authorFilterId]);
 useEffect(()=>{void reload();},[reload]);
 useEffect(()=>{let active=true;
  void Promise.all(stories.map(async s=>{
   try{return [s.id,await signedMedia('tpy-stories',s.media_path)] as const;}
   catch{return [s.id,''] as const;}
  })).then(arr=>{if(active)setUrls(Object.fromEntries(arr));});
  return()=>{active=false;};
 },[stories]);
 const publish=async()=>{
  if(!db||!user||!selectedFile)return;
  setBusy(true);
  try{
   validateUpload(selectedFile,'post');
   const path=await uploadMedia('tpy-stories',user.id,'stories',selectedFile);
   const res=await db.from('tpy_stories').insert({author_id:user.id,media_path:path,media_type:selectedFile.type.startsWith('video/')?'video':'image',caption:caption.trim(),visibility:audience});
   if(res.error)throw res.error;
   setComposer(false);setSelectedFile(null);setCaption('');await reload();
  }catch(e){onError(errorMessage(e));}finally{setBusy(false);}
 };
 const remove=async(s:Story)=>{
  if(!db||s.author_id!==user?.id)return;
  if(!window.confirm('Remove this story?'))return;
  const {error}=await db.from('tpy_stories').delete().eq('id',s.id);
  if(error){onError(error);return;}
  setIndex(null);await reload();
 };
 const current=index===null?null:stories[index];
 return <section className="tpy-stories" aria-label="Stories">
  {(!authorFilterId||user?.id===authorFilterId)&&<button className="tpy-story-create" onClick={()=>user&&persona&&!needsSetup?setComposer(true):onLogin()} aria-label="Create a story">
   <span><Plus size={25}/></span><b>Your story</b><small>Share 24 hours</small>
  </button>}
  {stories.map((s,i)=>{
   const p=directory.find(p=>p.user_id===s.author_id);
   return <button key={s.id} className="tpy-story-tile" onClick={()=>setIndex(i)}>
    {urls[s.id]&&s.media_type==='image'?<img src={urls[s.id]} alt="Story preview" loading="lazy"/>:<span className="tpy-story-placeholder"><ImagePlus size={32}/></span>}
    <span className="tpy-story-ring">{p?.display_name?.slice(0,1)?.toUpperCase()||'•'}</span>
    <b>{p?.display_name||'Member'}</b>
   </button>;
  })}
  {needsSetup?<div className="tpy-empty-story">Stories need the included Supabase migration before you can upload or view them.</div>:!stories.length&&<div className="tpy-empty-story">No stories yet. Be the first to share a moment.</div>}
  {composer&&<div className="overlay" onMouseDown={e=>{if(e.target===e.currentTarget)setComposer(false);}}><section className="tpy-story-dialog" role="dialog" aria-modal="true" aria-label="New story"><header><h2>Create story</h2><button onClick={()=>setComposer(false)} aria-label="Close"><X/></button></header>
   <p className="muted">Stories expire from the feed after 24 hours. Choose who can view yours.</p>
   <button className="secondary" onClick={()=>fileInput.current?.click()}><ImagePlus size={18}/>{selectedFile?selectedFile.name:'Choose a photo or short video'}</button>
   <input hidden ref={fileInput} type="file" accept="image/jpeg,image/png,image/webp,image/gif,video/mp4,video/webm" onChange={e=>setSelectedFile(e.target.files?.[0]||null)}/>
   <label>Caption<input maxLength={500} value={caption} onChange={e=>setCaption(e.target.value)} placeholder="A little moment…"/></label>
   <label>Audience<select value={audience} onChange={e=>setAudience(e.target.value as 'public'|'friends')}><option value="friends">Friends</option><option value="public">Public</option></select></label>
   <button className="primary" disabled={busy||!selectedFile} onClick={()=>void publish()}>{busy?'Publishing…':'Share story'}</button>
  </section></div>}
  {current&&<div className="tpy-story-viewer" role="dialog" aria-modal="true" aria-label="View story"><div className="tpy-story-full"><header><b>{directory.find(p=>p.user_id===current.author_id)?.display_name||'Member'}</b><span>{current.visibility==='friends'?'Friends':'Public'}</span><button onClick={()=>setIndex(null)} aria-label="Close"><X/></button></header>
   {urls[current.id]?(current.media_type==='video'?<video src={urls[current.id]} controls playsInline autoPlay/>:<img src={urls[current.id]} alt={current.caption||'Member story'}/>):<p>Unable to load story media.</p>}
   <footer><button onClick={()=>setIndex(Math.max(0,(index||0)-1))} disabled={index===0} aria-label="Previous story"><ChevronLeft/></button><span>{current.caption}</span><button onClick={()=>setIndex(Math.min(stories.length-1,(index||0)+1))} disabled={index===stories.length-1} aria-label="Next story"><ChevronRight/></button></footer>
   {current.author_id===user?.id&&<button className="tpy-story-delete" onClick={()=>void remove(current)}><Trash2 size={15}/> Delete story</button>}
  </div></div>}
 </section>;
}
```

---

## `components/HomeDashboard.tsx`

```tsx
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
```

---

## `lib/types.ts`

```typescript
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
```

---

## `lib/presence.ts`

```typescript
import {getSupabase} from './supabase';
/** Online status is derived from active Realtime sessions, not fabricated counts. */
export const presenceChannelName='tpy-community-presence';
export function getPresenceChannel(userId:string){const db=getSupabase();if(!db)return null;return db.channel(presenceChannelName,{config:{presence:{key:userId}}})}
```

---

## `app/globals.css`

```css
:root{color-scheme:dark;--bg:#110c19;--panel:#1d1529;--panel2:#241a32;--border:#38283f;--text:#f8f2fb;--muted:#aca0b9;--pink:#ed79bb;--purple:#ad88e8}*{box-sizing:border-box}html,body{margin:0;min-height:100%;background:var(--bg);color:var(--text);font-family:Inter,ui-sans-serif,system-ui,-apple-system,Segoe UI,sans-serif}button,input,textarea,select{font:inherit}button{cursor:pointer}button:disabled{opacity:.48;cursor:not-allowed}a{color:var(--pink)}.shell{display:flex;min-height:100dvh}.sidebar{width:220px;flex-shrink:0;background:#150f20;border-right:1px solid var(--border);display:flex;flex-direction:column;padding:24px 14px;gap:40px}.brand{display:flex;align-items:center;gap:10px;color:var(--text);text-decoration:none;font-size:19px;font-weight:800;line-height:1.03;letter-spacing:-.5px}.brand b,.mobile-brand i{color:var(--pink);font-style:normal}.brand-mark{display:grid;place-items:center;width:46px;height:46px;border-radius:15px;background:var(--pink);color:#251126;font-size:35px}.nav{display:flex;flex-direction:column;gap:9px}.nav button{border:0;background:transparent;color:var(--muted);display:flex;gap:13px;align-items:center;text-align:left;padding:13px 16px;border-radius:13px;font-weight:600}.nav button:hover,.nav button.current{background:#302039;color:#ffb5dc}.side-foot{margin-top:auto;color:var(--muted);line-height:1.7}.main{flex:1;min-width:0;display:flex;flex-direction:column;min-height:100dvh}.header{height:72px;border-bottom:1px solid var(--border);display:flex;justify-content:flex-end;align-items:center;padding:0 28px;flex-shrink:0;position:relative;z-index:10;background:var(--bg)}.mobile-brand{display:none}.header-right{display:flex;align-items:center;gap:20px;position:relative}.active{font-size:12px;color:#d2c3d7}.dot{display:inline-block;width:7px;height:7px;background:#a4d992;border-radius:50%;margin-right:4px}.avatar-button{border:1px solid #ce86ba;background:#3c254b;color:white;width:38px;height:38px;border-radius:50%;font-weight:700}.dropdown{position:absolute;right:0;top:49px;z-index:100;background:#251b30;border:1px solid var(--border);border-radius:14px;padding:8px;min-width:190px;box-shadow:0 12px 35px #0008}.dropdown button{display:flex;gap:12px;align-items:center;background:none;border:0;color:var(--text);width:100%;padding:11px;text-align:left;border-radius:8px}.dropdown button:hover{background:#422e4c}.content{flex:1;min-height:0}.explore{display:grid;grid-template-columns:minmax(0,1fr) 250px;gap:14px;padding:18px;min-height:calc(100dvh - 72px)}.globe-wrap{height:calc(100dvh - 108px);min-height:420px;border:1px solid var(--border);border-radius:22px;overflow:hidden;position:relative;background:radial-gradient(ellipse at 50% 45%,#23152e,#110c19 65%)}.globe-canvas{width:100%;height:100%;touch-action:pan-y}.globe-canvas canvas{display:block}.globe-loading{display:grid;place-items:center;height:100%;color:var(--muted)}.globe-overlay{position:absolute;top:18px;left:20px;pointer-events:none}.globe-overlay h1{font-size:clamp(21px,2vw,30px);margin:0 0 5px}.globe-overlay p{font-size:12px;color:var(--muted);margin:0}.no-members{position:absolute;bottom:18px;left:18px;right:18px;text-align:center;color:var(--muted);font-size:12px;pointer-events:none}.explore-side{padding:16px;background:var(--panel);border:1px solid var(--border);border-radius:20px;overflow-y:auto}.explore-side h2{font-size:17px;margin:0 0 18px}.person-line{display:flex;width:100%;align-items:center;text-align:left;gap:11px;background:transparent;color:var(--text);border:0;border-bottom:1px solid var(--border);padding:12px 0}.person-line span:nth-child(2){flex:1;display:grid;gap:4px}.person-line small,.muted{color:var(--muted);font-size:13px}.mini-avatar{width:34px;height:34px;border-radius:50%;background:#55304e;display:grid;place-items:center}.narrow{max-width:760px;margin:0 auto;padding:28px 24px 100px}.narrow h1{font-size:clamp(24px,3vw,36px);letter-spacing:-1px;margin:0 0 24px}.panel{background:var(--panel);border:1px solid var(--border);border-radius:18px;padding:22px;margin-bottom:18px}.panel h2{font-size:19px;margin:0 0 10px}.panel p{line-height:1.6}.form{display:grid;gap:14px}.form label{display:grid;gap:8px;font-size:13px;color:var(--muted)}input,textarea,select{background:#140e1e;color:white;border:1px solid #45314f;border-radius:11px;padding:12px;width:100%;outline:none}input:focus,textarea:focus,select:focus{border-color:var(--pink)}textarea{min-height:90px;resize:vertical}.compose-row{display:flex;align-items:end;justify-content:space-between;gap:12px}.compose-row select{margin-top:7px}.primary,.secondary,.oauth{display:inline-flex;align-items:center;justify-content:center;gap:7px;padding:11px 16px;border-radius:11px;border:1px solid var(--pink);font-weight:700}.primary{background:var(--pink);color:#231121}.secondary{background:transparent;color:var(--text);border-color:#5b435f}.oauth{width:100%;background:#fff;color:#25162c;border-color:#fff}.oauth+ .oauth{background:#3268b7;color:#fff;border-color:#3268b7}.post p{white-space:pre-wrap;word-break:break-word}.empty{background:var(--panel);border:1px solid var(--border);border-radius:18px;padding:35px;color:var(--muted);text-align:center}.request,.action-row{display:flex;align-items:center;justify-content:space-between;gap:12px}.chat{padding:0;overflow:hidden}.chat-head{padding:18px;border-bottom:1px solid var(--border);display:flex;gap:14px;align-items:center}.chat-head button{background:none;border:0;color:inherit}.chat-body{min-height:300px;max-height:52vh;overflow-y:auto;padding:18px;display:flex;flex-direction:column;align-items:flex-start;gap:12px}.bubble{background:#392c45;border-radius:15px;padding:11px 15px;max-width:85%;white-space:pre-wrap}.bubble.mine{align-self:flex-end;background:#613b5c}.bubble small{display:block;text-align:right;margin-top:4px;color:#d7bcd2;font-size:10px}.chat-compose{display:flex;gap:10px;padding:14px;border-top:1px solid var(--border)}.overlay{position:fixed;inset:0;background:#07030dc9;z-index:40;display:flex;align-items:center;justify-content:center;padding:18px}.sheet,.login{position:relative;background:var(--panel);border:1px solid var(--border);border-radius:24px;padding:28px;width:min(100%,440px);max-height:90dvh;overflow-y:auto}.close{position:absolute;top:15px;right:14px;background:transparent;color:var(--muted);border:0}.profile-circle{display:grid;place-items:center;width:72px;height:72px;border-radius:50%;background:#64416a;font-size:28px;font-weight:800}.sheet h2{font-size:26px;margin:15px 0 0}.sheet .action-row{justify-content:flex-start;flex-wrap:wrap;margin:20px 0}.login{text-align:center}.login-heart{font-size:62px;color:var(--pink)}.login h2{font-size:30px}.login .oauth,.login .secondary{margin:9px 0}.login .secondary{width:100%}.login small{display:block;margin-top:16px;line-height:1.6;color:var(--muted)}.toast{position:fixed;z-index:120;bottom:18px;right:18px;max-width:min(460px,calc(100vw - 36px));background:#47304f;border:1px solid var(--pink);padding:12px 16px;border-radius:12px;display:flex;align-items:center;gap:12px}.toast button{background:none;color:#fff;border:0}.checkbox{display:flex!important;flex-direction:row;align-items:center}.checkbox input{width:auto}.mobile-nav{display:none}@media(max-width:850px){.sidebar{display:none}.header{height:56px;padding:0 16px;justify-content:space-between}.mobile-brand{display:block;font-size:16px}.active{font-size:11px}.explore{display:block;padding:0;min-height:calc(100dvh - 122px)}.globe-wrap{height:calc(100dvh - 122px);min-height:350px;border:0;border-radius:0}.explore-side{display:none}.globe-overlay{top:14px;left:15px}.globe-overlay h1{font-size:19px}.globe-overlay p{font-size:11px;max-width:230px}.no-members{font-size:11px;bottom:18px}.mobile-nav{display:block;position:fixed;bottom:0;left:0;right:0;z-index:20;background:#1d1427;border-top:1px solid var(--border);padding-bottom:env(safe-area-inset-bottom)}.mobile-nav .nav{height:65px;display:grid;grid-template-columns:repeat(5,1fr);gap:0}.mobile-nav .nav button{display:flex;flex-direction:column;justify-content:center;align-items:center;gap:4px;border-radius:0;padding:6px 0;font-size:10px}.mobile-nav .nav button span{font-size:10px}.narrow{padding:22px 14px 102px}.panel{padding:16px}.sheet{align-self:flex-end;border-radius:22px 22px 0 0;padding-bottom:calc(28px + env(safe-area-inset-bottom));width:100%}.overlay{padding:0}.login{margin:14px;align-self:center}.toast{bottom:84px;right:10px}.compose-row{align-items:stretch;flex-direction:column}.request{flex-wrap:wrap}}@media(prefers-reduced-motion:reduce){*{scroll-behavior:auto!important;animation:none!important}}

/* Private location control: placed inside globe view on desktop and mobile */
.globe-wrap{position:relative}
.locate-float{position:absolute;z-index:5;right:16px;bottom:62px;display:flex;align-items:center;gap:7px;border:1px solid #564161;background:#23182e;color:#f4eaf5;border-radius:999px;padding:10px 14px;font-weight:650;cursor:pointer;box-shadow:0 6px 20px #0005}
.locate-float:disabled{opacity:.65;cursor:wait}
@media(max-width:768px){.locate-float{right:12px;bottom:76px;padding:10px 12px;font-size:13px}}

/* Mandatory location permission with explicit opt-in and blocked/denied state */
.location-gate,.auth-callback{min-height:100dvh;display:grid;place-items:center;padding:24px;background:radial-gradient(circle at 55% 5%,#2c2035 0,#130f1b 46%,#100d16 85%)}
.gate-card{width:min(100%,520px);padding:clamp(24px,5vw,42px);background:#201826;border:1px solid #443047;border-radius:22px;box-shadow:0 18px 65px #0004}
.gate-emblem{width:56px;height:56px;display:grid;place-items:center;border:1px solid #8e6985;border-radius:15px;background:#3b2a3b;color:#f2b9d7;margin-bottom:26px}
.gate-card .eyebrow{font-size:11px;color:#e4a2ca;letter-spacing:.12em;font-weight:700}
.gate-card h1{font-size:clamp(29px,4vw,42px);letter-spacing:-.045em;line-height:1.12;margin:12px 0 17px}
.gate-card p{font-size:14px;line-height:1.7;color:#bdb0c5}
.gate-card small{display:block;font-size:11px;line-height:1.65;color:#a99eae;margin-top:16px}
.privacy-points{display:grid;gap:15px;padding:22px 0;margin:12px 0 8px;border-top:1px solid #403043;border-bottom:1px solid #403043}
.privacy-points div{display:flex;gap:12px;align-items:flex-start;font-size:13px;color:#e1d5e5;line-height:1.45}
.privacy-points svg{flex-shrink:0;color:#dda2c7}
.gate-cta{width:100%;min-height:48px}
.gate-error{margin-top:14px;background:#442533;border:1px solid #965267;border-radius:10px;padding:12px;font-size:13px;line-height:1.55;color:#ffd5dd}
/* Functional globe/street switch with no excessive effects */
.map-toolbar{position:absolute;top:16px;right:16px;z-index:700;display:flex;align-items:center;padding:4px;gap:4px;border-radius:12px;border:1px solid #58465e;background:#22192bd9;backdrop-filter:blur(10px)}
.map-toolbar button{color:#d2c4db;display:flex;align-items:center;gap:7px;font-size:13px;font-weight:650;border:0;border-radius:9px;background:transparent;padding:9px 12px}
.map-toolbar button.active-view{color:#211224;background:#efa1ce}
.street-map{position:relative;width:100%;height:100%;background:#25242a}
.street-map-canvas{height:100%;width:100%;z-index:1}
.street-map-status{position:absolute;inset:0;display:grid;place-items:center;color:#ede2f1;background:#1b1425;z-index:3;padding:24px;text-align:center}
.street-map-hint{position:absolute;bottom:14px;left:15px;max-width:calc(100% - 170px);background:#25172bcc;color:#fff;border-radius:8px;font-size:11px;padding:8px 10px;z-index:550;pointer-events:none}
.tgy-pin{background:none;border:0}
.tgy-map-dot{display:block;background:#f29dcb;border:3px solid #fff;border-radius:50%;height:22px;width:22px;box-shadow:0 1px 8px #38223380}
.tgy-pin-me .tgy-map-dot{background:#3976ef;height:28px;width:28px;border:3px solid #fff;box-shadow:0 0 0 6px #4278f253}
.street-map .leaflet-control-attribution{font-size:10px}
.street-map .leaflet-container{font-family:inherit}
.street-map .leaflet-control-zoom a{background:#261e2b;color:#fff;border:1px solid #54405c}
.street-map .leaflet-control-zoom a:hover{background:#412b49;color:#fff}
.globe-canvas{touch-action:none}
.page-heading{display:flex;justify-content:space-between;align-items:center;gap:10px}.page-heading span{font-size:12px;color:var(--muted)}
.post-head{display:flex;flex-wrap:wrap;gap:8px;justify-content:space-between;align-items:center}
.friend-row{display:flex;align-items:center;gap:12px;padding:10px 0;border-bottom:1px solid var(--border)}
.friend-name{flex:1;display:grid;gap:3px;min-width:0}.friend-name small{color:var(--muted)}
.friend-row .secondary{font-size:12px;padding:8px 10px}
.map-note{display:flex;gap:6px;align-items:center;font-size:12px;color:var(--muted);margin-top:20px}
.map-member-count{font-size:12px;color:var(--muted)}
.location-readout{display:flex;gap:8px;align-items:center;color:#b6d9c1;font-size:12px}
.sr-only{position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0}
@media(max-width:850px){.map-toolbar{top:12px;right:12px}.map-toolbar button{font-size:12px;padding:8px 10px}.globe-overlay{top:69px}.map-member-count{display:none}.street-map-hint{bottom:18px;left:8px;font-size:10px;max-width:calc(100% - 100px)}.locate-float{bottom:80px}.globe-wrap{min-height:0}.main{min-height:100dvh}}

/* Social experience: restrained palette and natural media sizing. */
:root{--bg:#131118;--panel:#1b1820;--panel2:#25212c;--border:#352d3b;--text:#f3f1f5;--muted:#aca4b4;--pink:#e28fb8;--purple:#ac95c6}
.shell{background:var(--bg)}.sidebar{background:#17141d}.header{background:#17141d}.nav button.current{background:#2c2230;color:#f0accd}
.entry-card{text-align:center}.entry-logo{display:block;color:#f09ac6;font-size:58px;line-height:1;margin:10px auto}.guest-entry{margin-top:9px;width:100%}
.entry-card .oauth{margin:7px 0}.gate-card .privacy-points>div{display:flex;align-items:center}.gate-card button{min-height:45px}
.social-card{background:var(--panel);border:1px solid var(--border);border-radius:15px;padding:19px;margin-bottom:16px;min-width:0}.social-card h2{font-size:18px;margin:0 0 14px}.social-card p{line-height:1.6}
.social-avatar{display:grid;place-items:center;flex-shrink:0;border-radius:50%;width:42px;height:42px;background:#54364d;color:#f6dbe9;font-size:17px;font-weight:800;text-transform:uppercase;user-select:none}
.social-avatar:empty:after{content:'♡'}
.feed-page{display:grid;grid-template-columns:minmax(0,710px) minmax(220px,270px);gap:24px;max-width:1160px;margin:0 auto;padding:25px 20px 115px;align-items:start}
.feed-main{min-width:0}.feed-title{font-size:24px;letter-spacing:-.03em;margin:0 0 16px}.feed-create-card{border:1px solid var(--border);border-radius:16px;padding:14px 18px;margin-bottom:15px;background:var(--panel)}
.create-prompt{display:flex;align-items:center;gap:11px}.create-prompt>button{flex:1;text-align:left;background:#2b2731;border:0;border-radius:999px;color:#bbb3c4;padding:13px 17px}.create-prompt>button:hover{background:#3a3342}.feed-shortcuts{display:grid;grid-template-columns:repeat(3,1fr);gap:5px;border-top:1px solid var(--border);margin-top:13px;padding-top:11px}.feed-shortcuts button{display:flex;align-items:center;justify-content:center;gap:9px;background:none;border:0;color:#d9d3dc;padding:9px 5px;font-size:13px;font-weight:650;border-radius:9px}.feed-shortcuts button:hover{background:#302933}
.feed-discovery-note{display:flex;gap:9px;align-items:center;color:var(--muted);font-size:12px;margin:15px 0 18px;padding-left:4px}.empty-feed{text-align:center;color:var(--muted);padding:38px 22px}
.feed-aside{position:sticky;top:92px}.feed-aside .social-card{padding:22px}.feed-aside h3{margin:0 0 8px;font-size:16px}.feed-aside p{font-size:13px;color:var(--muted);margin:0}
.feed-post{padding:0;overflow:hidden}.feed-post-header{display:flex;justify-content:space-between;align-items:center;padding:15px 17px}.post-author{display:flex;align-items:center;gap:12px;text-align:left;color:var(--text);border:0;background:none;padding:0;min-width:0}.post-author>span:last-child{display:grid;gap:4px}.post-author b{font-size:14px}.post-author small{display:flex;gap:5px;align-items:center;color:var(--muted);font-size:12px}.feed-post-header>.muted{margin-right:8px}.feed-post-copy{margin:0;padding:0 18px 16px;font-size:15px;line-height:1.6;white-space:pre-wrap;overflow-wrap:anywhere}
.post-media-gallery{display:grid;grid-template-columns:1fr;gap:2px;width:100%;background:#0f0d12}.post-media-gallery.multiple{grid-template-columns:repeat(2,minmax(0,1fr));align-items:start}.post-media-asset{width:100%;height:auto;max-height:none;object-fit:contain;display:block;background:#111;max-width:100%}.post-media-gallery.multiple .post-media-asset{max-height:650px;object-fit:contain}.media-placeholder{min-height:130px;padding:18px;display:grid;place-items:center;color:var(--muted)}
.post-metrics{display:flex;justify-content:space-between;padding:12px 17px;color:var(--muted);font-size:12px;gap:10px}.post-metrics button{border:0;background:transparent;color:inherit;display:flex;align-items:center;gap:7px}.post-metrics button:hover{text-decoration:underline}.post-actions{display:grid;grid-template-columns:repeat(3,1fr);gap:4px;border-top:1px solid var(--border);margin:0 17px;padding:5px 0}.post-actions button{background:none;color:#cfc8d3;border:0;display:flex;align-items:center;justify-content:center;gap:9px;font-weight:600;font-size:13px;padding:11px 4px;border-radius:7px}.post-actions button:hover{background:#302934}.post-actions button.liked{color:#f5a1c7}
.post-comments{border-top:1px solid var(--border);padding:16px}.comment-row{display:flex;align-items:start;gap:10px;margin-bottom:12px}.comment-row>.social-avatar{width:33px;height:33px;font-size:13px}.comment-row>div{background:#2b2731;padding:10px 14px;border-radius:13px;max-width:calc(100% - 45px)}.comment-row b{font-size:12px}.comment-row p{font-size:13px;line-height:1.5;margin:4px 0;overflow-wrap:anywhere}.comment-row small{color:var(--muted);font-size:11px}.comment-input{display:flex;align-items:center;gap:7px}.comment-input input{border-radius:22px;background:#292630;padding:12px 15px}.comment-input button{display:grid;place-items:center;color:var(--pink);border:0;background:none}.comment-login{color:var(--pink);background:none;border:0}
.floating-compose{position:fixed;z-index:22;bottom:24px;right:28px;display:grid;place-items:center;width:54px;height:54px;border:1px solid #f2bdd7;border-radius:17px;color:#211523;background:var(--pink);box-shadow:0 8px 20px #0005}
.compose-dialog,.people-modal{width:min(100%,610px);max-height:92dvh;overflow-y:auto;background:#221d29;border:1px solid #574357;border-radius:17px;padding:0 20px 20px;box-shadow:0 28px 80px #000b}.dialog-title{display:flex;justify-content:space-between;align-items:center;gap:14px;padding:16px 0;border-bottom:1px solid var(--border)}.dialog-title h2{font-size:20px;margin:0 0 0 auto;transform:translateX(17px);font-weight:750}.dialog-title button{border:0;background:#3a3440;color:#ddd;border-radius:50%;display:grid;place-items:center;width:36px;height:36px}
.compose-author{display:flex;align-items:center;gap:12px;margin:17px 0 4px}.compose-author>div{display:grid;gap:5px}.compose-author b{font-size:15px}.audience-picker{width:max-content;display:flex;align-items:center;gap:5px;background:#3c3440;border:0;border-radius:7px;padding:2px 8px;font-size:12px}.audience-picker select{padding:3px 2px;width:auto;appearance:none;border:0;background:transparent;color:#fff;font-size:12px}
.compose-body{border:0;outline:0;background:transparent;resize:vertical;font-size:22px;width:100%;min-height:200px;padding:18px 0 12px;line-height:1.5}.compose-body:focus{border-color:transparent}.compose-tools{border:1px solid var(--border);border-radius:11px;display:flex;align-items:center;justify-content:space-between;padding:10px 15px;gap:10px;margin-top:10px}.compose-tools strong{font-size:13px}.compose-tools>div{display:flex;align-items:center;gap:7px}.compose-tools button{color:#93bca4;background:transparent;border:0;display:grid;place-items:center;padding:5px}.compose-tools button:nth-child(2){color:#ef9da7}.compose-tools button:nth-child(3){color:#e7ba70}.create-publish{margin-top:15px;width:100%;justify-content:center}
.file-chips{display:flex;gap:8px;flex-wrap:wrap}.file-chips>span{display:flex;gap:7px;align-items:center;background:#332936;border-radius:10px;padding:8px;max-width:100%;overflow:hidden;text-overflow:ellipsis;font-size:12px}.file-chips button{display:grid;place-items:center;border:0;background:transparent;color:inherit}.feed-error{color:#ffc0bf;font-size:13px}.people-modal{width:min(100%,460px);padding:0 20px 16px}.like-person{display:flex;align-items:center;gap:12px;margin:13px 0}.like-person b{flex:1;font-size:14px}.like-person button{background:transparent;border:1px solid var(--border);color:var(--text);padding:8px 12px;border-radius:9px}.inapp-toast{position:fixed;z-index:170;bottom:20px;right:20px;background:#3b283b;border:1px solid #815773;padding:13px 16px;border-radius:12px;max-width:min(500px,calc(100vw - 40px));display:flex;align-items:center;gap:18px;font-size:13px;box-shadow:0 14px 40px #0006}.inapp-toast button{background:transparent;border:0;color:#fff;display:grid;place-items:center;margin-left:auto}
.friends-page h1{margin-bottom:25px}.request-row{display:flex;gap:10px;align-items:center;padding:11px 0;border-bottom:1px solid var(--border);flex-wrap:wrap}.request-row>div{display:grid;gap:4px;flex:1}.request-row small{font-size:12px;color:var(--muted)}.request-row .primary,.request-row .secondary{padding:9px 13px;font-size:12px}
.profile-editor .social-card.form{display:grid;gap:13px}.profile-editor .social-card.form label:not(.checkbox){display:grid;gap:6px;font-size:13px;color:var(--muted)}
/* WhatsApp-inspired two-column messenger, retaining this app's own identity. */
.messenger{display:flex;height:calc(100dvh - 72px);min-height:410px;overflow:hidden;background:#151418}.message-sidebar{display:flex;flex-direction:column;width:355px;min-width:300px;max-width:38%;background:#1a191d;border-right:1px solid #38363b;overflow-y:auto;flex-shrink:0}.message-heading{padding:19px 19px 12px;display:flex;justify-content:space-between;align-items:center}.message-heading h1{font-size:23px;margin:0}.message-heading button{border:0;background:#335948;color:#b6ebd1;border-radius:50%;height:38px;width:38px;display:grid;place-items:center}.message-icon{font-size:23px}.chat-search{display:flex;align-items:center;gap:9px;background:#2b292d;border-radius:10px;margin:8px 17px 15px;padding:0 13px;color:#a8a7aa}.chat-search input{background:none;border:0;flex:1;width:100%;font-size:13px;padding:12px 0}.chat-filters{display:flex;gap:8px;padding:0 17px 17px;border-bottom:1px solid #303037}.chat-filters span{font-size:12px;border-radius:30px;border:1px solid #424046;padding:6px 14px;color:#c2bac8}.chat-filters .selected{background:#21483b;color:#c4ecda;border-color:#295942}.conversation-row{background:transparent;border:0;text-align:left;width:100%;color:var(--text);display:flex;align-items:center;gap:12px;padding:15px 18px;min-height:75px;border-bottom:1px solid #2d2931}.conversation-row:hover,.conversation-row.selected{background:#302b33}.conversation-row>span:last-child{display:grid;gap:6px}.conversation-row b{font-size:14px}.conversation-row small{color:var(--muted);font-size:12px}.chat-placeholder{padding:18px;color:var(--muted);font-size:13px}
.message-thread{display:flex;flex-direction:column;flex:1;min-width:0;background:#17181b}.thread-header{height:70px;flex-shrink:0;display:flex;align-items:center;gap:13px;padding:0 21px;background:#222126;border-bottom:1px solid #36333a}.thread-contact{display:grid;gap:3px;flex:1;min-width:0}.thread-contact b{font-size:15px}.thread-contact small{color:#a6a2ac;font-size:12px}.thread-actions{display:flex;gap:10px;align-items:center}.thread-actions button,.mobile-back{border:0;background:transparent;color:#d2d0d7;display:grid;place-items:center;padding:9px;border-radius:8px}.thread-actions button:hover,.mobile-back:hover{background:#37303b}.mobile-back{display:none}.thread-scroller{flex:1;overflow-y:auto;padding:24px 6%;display:flex;align-items:flex-start;flex-direction:column;gap:10px;background-color:#141519;background-image:radial-gradient(#282329 0.8px,transparent 0.8px);background-size:34px 34px}.chat-encryption{text-align:center;margin:0 auto 10px;color:#c1b9b3;background:#302f31ab;font-size:11px;border-radius:8px;padding:8px 14px;max-width:400px}.message-bubble{display:flex;flex-direction:column;align-items:stretch;gap:4px;background:#302e35;border-radius:13px;padding:9px 12px;max-width:min(86%,520px);font-size:14px;white-space:pre-wrap;overflow-wrap:anywhere}.my-bubble{background:#254f43;align-self:flex-end}.message-bubble small{display:flex;align-items:center;gap:5px;justify-content:flex-end;color:#bbb9c3;font-size:10px;margin-top:5px}.bubble-text{white-space:pre-wrap;line-height:1.48}.message-bubble audio{max-width:240px;width:100%;height:40px}.chat-media{width:100%;height:auto;max-height:60vh;object-fit:contain;border-radius:8px;display:block}.chat-document{display:flex;align-items:center;gap:9px;color:#c5e4e6;font-size:13px}.chat-composer{flex-shrink:0;display:flex;align-items:center;gap:4px;padding:11px 15px 14px;background:#252428}.chat-composer>button,.attach-wrap>button{border:0;background:none;color:#d4cbd6;display:grid;place-items:center;padding:8px}.chat-composer>button.recording{color:#ff9aaf}.chat-composer input.chat-text-input{flex:1;min-width:0;background:#343238;border:0;padding:12px 14px;border-radius:22px;font-size:14px}.chat-composer>button:last-child{color:#b6e9c5}.attach-wrap{position:relative}.attach-menu{position:absolute;bottom:47px;left:-3px;z-index:30;background:#2c2a31;border:1px solid #504b51;border-radius:13px;box-shadow:0 14px 33px #0008;min-width:220px;padding:8px}.attach-menu button{display:flex;align-items:center;gap:12px;background:transparent;border:0;color:#e4dfe8;width:100%;padding:12px;text-align:left;border-radius:9px;font-size:13px}.attach-menu button:hover{background:#3c3740}.conversation-empty{display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%;padding:30px;color:#b8b2bc;text-align:center}.conversation-empty .message-icon{font-size:68px;color:#b8acbc}.conversation-empty h2{font-size:25px;color:#f1eaf5;margin-bottom:0}.conversation-empty p{max-width:400px;line-height:1.7;font-size:13px}
/* In-app notification menu and optional foreground desktop notifications. */
.notification-center{position:relative}.notification-bell{background:transparent;border:0;color:var(--text);width:37px;height:37px;display:grid;place-items:center;border-radius:50%;position:relative}.notification-bell:hover{background:#302735}.notification-counter{position:absolute;right:-2px;top:-3px;background:#e785ac;color:#221220;border-radius:30px;min-width:17px;height:17px;padding:0 4px;display:grid;place-items:center;font-weight:800;font-size:10px}.notification-dropdown{position:absolute;top:48px;right:-45px;z-index:140;background:#251f2a;border:1px solid #504253;border-radius:15px;width:min(410px,calc(100vw - 20px));max-height:min(75dvh,620px);display:flex;flex-direction:column;box-shadow:0 17px 48px #0009}.notification-heading{display:flex;align-items:center;justify-content:space-between;padding:17px 18px 10px}.notification-heading h2{font-size:21px;margin:0}.notification-heading button{border:0;background:none;color:var(--text)}.notification-tools{display:flex;gap:8px;padding:0 13px 11px;border-bottom:1px solid var(--border)}.notification-tools button{display:flex;align-items:center;gap:6px;background:#38313d;color:#ddd4e3;border:0;border-radius:8px;padding:8px 10px;font-size:11px}.notification-list{overflow-y:auto;min-height:75px}.notification-item{display:flex;gap:11px;align-items:center;background:transparent;color:var(--text);width:100%;border:0;text-align:left;padding:12px 14px;border-bottom:1px solid #3b323f}.notification-item.unread{background:#352536}.notification-item .social-avatar{width:38px;height:38px;font-size:14px}.notification-text{flex:1;display:grid;gap:4px}.notification-text b{font-size:12px;line-height:1.5}.notification-text small{font-size:11px;color:var(--muted)}.unread-dot{width:7px;height:7px;border-radius:50%;background:var(--pink)}.notification-empty{padding:18px;font-size:13px;color:var(--muted)}.notification-disclaimer{font-size:10px;color:var(--muted);padding:10px 15px;line-height:1.5}
.map-people-popup{display:grid;gap:7px;min-width:160px}.map-people-popup button{text-align:left;border:0;border-radius:7px;background:#efe9f2;color:#2d2331;padding:6px 9px}.tgy-cluster{background:#d98daf;border:3px solid #fff;border-radius:50%;display:grid;place-items:center;color:#221725;font-weight:800;box-shadow:0 0 0 4px #d98daf55}.tgy-cluster span{font-size:12px}.location-readout{display:flex;align-items:center;gap:7px}
@media(max-width:1050px){.feed-page{grid-template-columns:minmax(0,1fr);max-width:745px}.feed-aside{display:none}.message-sidebar{width:310px;min-width:260px}}
@media(max-width:850px){.feed-page{display:block;padding:16px 9px 125px}.feed-title{font-size:20px;padding:0 7px}.feed-aside{display:none}.feed-create-card{border-radius:12px;padding:13px}.feed-post{border-radius:10px}.post-media-gallery.multiple{grid-template-columns:1fr}.floating-compose{bottom:84px;right:15px;width:50px;height:50px}.compose-dialog{align-self:flex-end;margin:0;width:100%;border-radius:18px 18px 0 0;max-height:92dvh}.dialog-title h2{font-size:19px}.compose-body{font-size:18px;min-height:150px}.inapp-toast{bottom:87px;right:10px}.messenger{height:calc(100dvh - 56px - 65px - env(safe-area-inset-bottom));min-height:0}.message-sidebar{width:100%;max-width:none;min-width:0}.message-sidebar.mobile-hidden,.message-thread.mobile-hidden{display:none}.message-thread{width:100%;height:100%}.mobile-back{display:grid}.thread-header{height:62px;padding:0 9px;gap:6px}.thread-actions{gap:0}.thread-actions button{padding:7px}.thread-contact b{font-size:13px}.thread-scroller{padding:13px}.message-bubble{max-width:89%}.chat-composer{padding:8px 6px}.chat-composer input.chat-text-input{padding:11px 12px}.notification-dropdown{right:-58px;top:46px;max-height:65dvh}.header-right{gap:10px}.friends-page .social-card{padding:15px}.request-row .primary,.request-row .secondary{padding:8px 9px}.profile-editor{padding:20px 14px 110px}}
@media(max-width:500px){.feed-shortcuts button{font-size:11px;gap:4px}.post-actions button{font-size:12px;gap:5px}.create-prompt>button{font-size:12px}.notification-dropdown{right:-67px}.active{display:none}.profile-editor .social-card{padding:14px}}

/* ============================================================
   TPY PREMIUM DESIGN SYSTEM · 2026
   Porcelain typography, oxblood/ink surfaces, muted blush metal.
   A quiet, tactile identity rather than a neon/gaming interface.
   ============================================================ */
:root{--bg:#131015;--panel:#201b23;--panel2:#29222c;--border:#3e323e;--text:#f4e9e5;--muted:#b9aab6;--pink:#e7b4ac;--purple:#bb929f;--accent:#e7b4ac;--accent-ink:#2d1b23;color-scheme:dark}
html{scroll-behavior:smooth;scrollbar-color:#5a4652 #171319}
body{background:#131015;color:var(--text);font-family:'Segoe UI',Inter,ui-sans-serif,system-ui,sans-serif;letter-spacing:.01em}
h1,h2,h3{letter-spacing:-.025em}
:focus-visible{outline:2px solid #e8b9ae;outline-offset:3px}
::selection{background:#a76a83;color:#fff}
.sidebar{width:228px;background:#171219;border-color:#382c38;padding:26px 16px;gap:34px}
.tpy-brand{display:flex;align-items:center;gap:11px;color:#f4ebe8;text-decoration:none;max-width:100%;min-width:0}
.tpy-brand-name{display:grid;gap:0;letter-spacing:.15em;font-family:Georgia,'Times New Roman',serif;color:#e8d6d4;line-height:1.14;font-size:9px;white-space:nowrap}
.tpy-brand-name b{font-size:22px;letter-spacing:.035em;line-height:1.13;font-weight:600;color:#f7e3db}
.sidebar .nav button{font-size:13px;font-weight:620;color:#c9bbc5;border-radius:12px}
.sidebar .nav button:hover,.sidebar .nav button.current{background:#332832;color:#f1cbc3}
.sidebar .nav button.current:before{content:'';width:2px;height:20px;background:#e7b4ac;border-radius:4px;position:absolute;left:15px}
.sidebar .nav button.current{position:relative}
.side-foot{font-family:Georgia,serif;letter-spacing:.08em;text-transform:uppercase;font-size:10px}
.header{background:#171219;border-bottom:1px solid #382c38}
.avatar-button{border:1px solid #966d7d;background:#392b37;color:#f5d9d2}
.header-right .active .dot{background:#a9ceac}
.dropdown{background:#2a222c;border-color:#604c5b;box-shadow:0 24px 70px #09070c99}
.dropdown .menu-admin-link{color:var(--text);font-size:13px;text-decoration:none;display:flex;align-items:center;gap:12px;padding:11px;border-radius:8px}
.dropdown .menu-admin-link:hover{background:#41303f}
.content,.main{background:var(--bg)}
.explore-side,.social-card,.feed-create-card{background:#211c25;border-color:#443542}
.globe-wrap{border-color:#433745;background:#211d25}
.primary{background:#e4b5aa;border-color:#e4b5aa;color:#251820;box-shadow:none}
.primary:not(:disabled):hover{background:#f5cbc2;border-color:#f5cbc2}
.secondary{border:1px solid #66515f;color:#eddcdd;background:#2a222e}
.secondary:not(:disabled):hover{background:#463340;border-color:#8b6a7b}
.oauth{border-color:#e1d4d4;background:#f2e9e7;color:#261c24}
.oauth+.oauth{background:#34303e;border-color:#54455e;color:#e9ddeb}
input,textarea,select{background:#18151c!important;border:1px solid #514150;color:#eee4e7!important}
input:focus,textarea:focus,select:focus{border-color:#d9a49f}
.messenger,.message-thread{background:#18151a}
.message-sidebar{background:#1d191f;border-color:#3b3038}
.message-heading button{background:#3d2c37;color:#ebc6bd}
.chat-filters .selected{background:#4a3541;color:#f4d3ca;border-color:#695261}
.message-thread .thread-header{background:#27212a;border-color:#483a46}
.chat-composer{background:#27222b}
.chat-composer>button:last-child{color:#ecc0b9}
.thread-scroller{background-color:#19151c;background-image:radial-gradient(#493841 0.6px,transparent 0.6px)}
.my-bubble{background:#563945;color:#fff6f3}
.message-bubble:not(.my-bubble){background:#302932}
.notification-dropdown{background:#28222c;border-color:#5b4756}
.notification-item.unread{background:#3c2a36}
.notification-counter{background:#ead0c8;color:#2e1d27}
.inapp-toast{background:#332835;border-color:#b98a9d}
.feed-post,.feed-create-card,.social-card{box-shadow:0 12px 40px #0a070c18}
.post-actions button:hover{color:#e8baaf}
.tgy-cluster{background:#c18a95;box-shadow:0 0 0 4px #c18a9555}
.location-gate,.auth-callback{background:radial-gradient(circle at 50% -10%,#392938 0,#171219 42%,#110f14 90%)}
.gate-card{background:#211b25;border-color:#55404f}
.entry-logo{background:#3d2939;color:#f0c7bd}
.locate-float{background:#2a202c;border-color:#69515f;color:#f7ebe9}
.audience-options{background:#322733!important;border:1px solid #8c6c7d!important;box-shadow:0 24px 65px #070409aa!important}
.audience-options button{background:transparent!important;color:#eee5e7!important}
.audience-options button:hover,.audience-options button.selected{background:#513a4d!important}
.audience-option-copy b{color:#fff2ef!important}
.audience-option-copy small{color:#cbbbc4!important}
.mobile-brand .tpy-brand{display:inline-flex}
.mobile-brand .tpy-brand svg{width:34px;height:34px}
.tpy-member-search{width:100%;margin:4px 0 13px}
.tpy-moderation-actions{display:flex;gap:8px;flex-wrap:wrap;margin:16px 0}
.tpy-post-menu-wrap{position:relative;margin-left:auto}
.tpy-post-menu-toggle{background:transparent;border:0;color:#c6b3bf;border-radius:8px;padding:8px}
.tpy-post-menu{position:absolute;top:38px;right:0;min-width:180px;background:#312634;border:1px solid #695468;border-radius:12px;box-shadow:0 15px 40px #0008;padding:6px;z-index:9;display:grid}
.tpy-post-menu button{display:flex;align-items:center;gap:9px;text-align:left;color:#f1e6e8;background:transparent;border:0;padding:11px;border-radius:8px;font-size:12px}
.tpy-post-menu button:hover{background:#4b384b}
/* Stories */
.tpy-stories{display:flex;gap:9px;overflow-x:auto;padding:4px 0 14px;margin-bottom:7px;scroll-snap-type:x proximity}
.tpy-story-create,.tpy-story-tile{width:116px;height:176px;flex:0 0 116px;position:relative;border-radius:16px;border:1px solid #53404d;overflow:hidden;background:#29202b;color:#f8eded;scroll-snap-align:start;text-align:left;padding:0}
.tpy-story-create{display:flex;flex-direction:column;align-items:center;justify-content:flex-end;padding:12px;text-align:center;background:linear-gradient(160deg,#43303b 15%,#251e2c 80%)}
.tpy-story-create>span{height:43px;width:43px;display:grid;place-items:center;border:1px solid #d3a6ad;border-radius:50%;color:#f9d2c9;margin-bottom:12px}
.tpy-story-create b,.tpy-story-tile>b{font-size:12px;color:#f8e9e4;line-height:1.3;z-index:2}
.tpy-story-create small{color:#c4b0ba;font-size:10px;margin:5px 0 0}
.tpy-story-tile img{height:100%;width:100%;object-fit:cover}
.tpy-story-tile:after{content:'';position:absolute;inset:0;background:linear-gradient(0deg,#1a121fbb 0,transparent 53%)}
.tpy-story-tile>b{position:absolute;bottom:12px;left:10px;right:8px}
.tpy-story-ring{position:absolute;top:10px;left:9px;display:grid;place-items:center;border:2px solid #e6b5aa;background:#533947;border-radius:50%;width:31px;height:31px;z-index:2;font-size:12px;font-weight:750}
.tpy-story-placeholder{display:grid;place-items:center;height:100%;background:linear-gradient(145deg,#45343f,#25212a);color:#ddabae}
.tpy-empty-story{color:var(--muted);font-size:13px;display:grid;place-items:center;padding:18px;min-width:180px;max-width:260px}
.tpy-story-dialog{background:#29222d;color:var(--text);border:1px solid #6d5267;border-radius:22px;padding:26px;display:grid;gap:16px;width:min(95vw,450px)}
.tpy-story-dialog header{display:flex;align-items:center;justify-content:space-between}
.tpy-story-dialog header h2{margin:0}
.tpy-story-dialog header button,.tpy-story-full header button{background:none;color:#f4e7eb;border:0}
.tpy-story-dialog label{display:grid;gap:7px;color:var(--muted)}
.tpy-story-viewer{position:fixed;inset:0;z-index:180;display:grid;place-items:center;background:#08060aee;padding:12px}
.tpy-story-full{width:min(100%,520px);height:min(94dvh,860px);background:#231d24;border:1px solid #665060;border-radius:19px;display:flex;flex-direction:column;overflow:hidden}
.tpy-story-full header,.tpy-story-full footer{display:flex;align-items:center;gap:12px;padding:14px 16px;background:#221a24}
.tpy-story-full header b{flex:1}.tpy-story-full header span{font-size:11px;color:var(--muted)}
.tpy-story-full>img,.tpy-story-full>video{flex:1;min-height:0;max-height:calc(100% - 160px);width:100%;object-fit:contain}
.tpy-story-full footer span{flex:1;text-align:center;font-size:12px}
.tpy-story-full footer button,.tpy-story-delete{background:#40303b;border:1px solid #654f5c;color:#f7e7e7;border-radius:9px;padding:7px;display:flex;gap:6px}
.tpy-story-delete{margin:0 15px 13px;padding:9px 14px;align-self:flex-start;font-size:12px}
.tpy-settings .form h2{display:flex;align-items:center;gap:10px;font-family:Georgia,serif}
.tpy-switch{display:flex!important;flex-direction:row!important;align-items:center;gap:12px;color:#f3e4e5;font-size:13px}
.tpy-switch input{width:18px!important;height:18px;accent-color:#cda4a4;flex:0 0 18px}
.tpy-saved-link,.tpy-simple-row{display:flex;align-items:center;justify-content:space-between;gap:13px;padding:12px;border:1px solid #443644;border-radius:10px;color:var(--text);text-decoration:none;font-size:12px}
.tpy-saved-link small,.tpy-simple-row small{display:block;color:var(--muted);font-size:11px}
.tpy-simple-row span{display:grid;gap:4px}
.tpy-inline-note{padding:12px 14px;background:#372832;border:1px solid #815d73;border-radius:10px}
.tpy-admin{max-width:990px;margin:0 auto;padding:34px 22px 100px;display:grid;gap:18px;min-height:100dvh}
.tpy-admin>a{display:flex;align-items:center;gap:7px}
.tpy-admin h1{display:flex;align-items:center;gap:12px;font-family:Georgia,serif}
.tpy-admin-case{padding:15px 0;border-bottom:1px solid #493646}
.tpy-admin-case p{overflow-wrap:anywhere}
.tpy-admin-case small{color:var(--muted)}
.tpy-admin-case .action-row{display:flex;flex-wrap:wrap;gap:7px;justify-content:flex-start;margin-top:11px}
.tpy-admin .social-card{padding:22px}
@media(max-width:850px){.sidebar{display:none}.mobile-brand{display:block}.tpy-stories{margin:0 -9px 8px;padding-left:9px}.tpy-story-create,.tpy-story-tile{width:104px;height:155px;flex-basis:104px}.tpy-story-viewer{padding:0}.tpy-story-full{height:100dvh;border-radius:0;border:0}.tpy-admin{padding:21px 13px 120px}.tpy-story-dialog{width:100%;align-self:flex-end;border-radius:20px 20px 0 0}.tpy-post-menu{right:0}.tpy-brand svg{flex-shrink:0}}

/* ============================================================
   TPY 2026 — reference-matched desktop home and responsive UI
   Layout closely follows the supplied premium dashboard reference,
   but content is provided only by real, authenticated members.
   ============================================================ */
:root{
  --bg:#0a0b13;--panel:#12131e;--panel2:#1b1b2a;--border:#292638;
  --text:#f8f5fb;--muted:#a69faf;--pink:#fa49a3;--purple:#ae75e0;
  --accent:#ed4298;--accent-ink:#160c16;color-scheme:dark;
}
html,body{background:var(--bg);color:var(--text)}
.tpy-reference-shell{min-height:100dvh;display:grid;grid-template-columns:242px minmax(0,1fr);grid-template-rows:78px minmax(0,1fr);align-items:stretch;background:#0a0b13}
.tpy-global-header{grid-column:1/-1;grid-row:1;background:#0e1019;position:sticky;top:0;z-index:35;display:flex;align-items:center;gap:24px;padding:0 24px 0 23px;border-bottom:1px solid #292435;min-width:0;height:78px}
.tpy-top-logo{flex:0 0 345px;min-width:0}
.tpy-top-logo .tpy-brand{gap:11px}
.tpy-top-logo .tpy-brand-name{display:flex;align-items:baseline;gap:5px;letter-spacing:-.05em;text-transform:none;line-height:1;white-space:nowrap}
.tpy-top-logo .tpy-brand-name span{font-size:19px;font-weight:700;letter-spacing:-.045em;color:#f9f0f8}
.tpy-top-logo .tpy-brand-name b{font-size:30px;color:#fb64b5;font-weight:600;font-family:Georgia,'Times New Roman',serif;font-style:italic;letter-spacing:-.055em}
.tpy-top-logo .tpy-brand svg{width:53px;height:53px;flex-shrink:0}
.tpy-global-search{position:relative;max-width:650px;min-width:110px;flex:1;display:flex;align-items:center;gap:11px;background:#20202c;border:1px solid #2c293a;color:#c4bdcb;border-radius:999px;padding:0 17px;height:46px}
.tpy-global-search input{min-width:0;width:100%;background:transparent!important;border:0!important;box-shadow:none!important;outline:0;color:var(--text);padding:10px 0;font-size:14px}
.tpy-global-search input::placeholder{color:#a39dab}
.tpy-global-search>button{color:#aaa5b6;border:0;background:none;display:grid;place-items:center;padding:2px}
.tpy-search-results{position:absolute;top:54px;left:0;right:0;z-index:60;background:#1c1b2a;border:1px solid #514055;border-radius:17px;box-shadow:0 20px 54px #000a;padding:7px}
.tpy-search-results button{display:flex;gap:11px;align-items:center;width:100%;background:transparent;border:0;border-radius:11px;color:#f5eaf2;padding:9px 10px;text-align:left}
.tpy-search-results button:hover{background:#352739}
.tpy-search-results button>span:last-child{display:grid;gap:3px}
.tpy-search-results small{color:#b5a7b7}
.tpy-search-results p{padding:12px;color:#aea3b5;font-size:12px}
.tpy-top-actions{display:flex;align-items:center;gap:7px;margin-left:auto;flex-shrink:0}
.tpy-top-actions>button{height:44px;width:47px;border:0;border-radius:12px;display:grid;place-items:center;background:transparent;color:#e0dce4;position:relative}
.tpy-top-actions>button:hover,.tpy-top-actions>button.active{background:#351c31;color:#ffa5d2}
.tpy-top-actions>button.active:after{content:'';height:2px;background:var(--pink);position:absolute;left:10px;right:10px;bottom:0;border-radius:8px}
.tpy-top-actions .notification-bell{width:47px;height:44px;border-radius:12px}
.tpy-top-actions .notification-counter{background:#fa409e;color:#fff;min-width:19px;height:19px;font-size:10px;right:1px;top:0}
.tpy-top-account{border-left:1px solid #302a3b;margin-left:5px;padding-left:13px;position:relative}
.tpy-account-toggle{border:0;background:transparent;color:var(--text);display:flex;align-items:center;gap:9px;font-size:12px;font-weight:750}
.tpy-account-toggle .avatar-button{width:37px;height:37px;background:#5b304c;border:1px solid #e07bab;display:grid;place-items:center;font-size:16px;color:#fff;pointer-events:none}
.tpy-account-toggle:hover .avatar-button{background:#87466d}
.tpy-account-label{max-width:110px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.tpy-top-account .dropdown{right:0;top:52px}
.tpy-sidebar{grid-column:1;grid-row:2;position:sticky;top:78px;height:calc(100dvh - 78px);overflow-y:auto;background:#0e1019;border-right:1px solid #292435;padding:16px 13px;display:flex;flex-direction:column;gap:15px;width:242px}
.tpy-sidebar>.nav{display:flex;flex-direction:column;gap:5px}
.tpy-sidebar .nav button{padding:12px 15px;display:flex;gap:14px;color:#c6c1d0;font-weight:600;font-size:14px;border-radius:12px;min-height:49px;position:relative;width:100%}
.tpy-sidebar .nav button:hover{background:#282130;color:#fff}
.tpy-sidebar .nav button.current{background:linear-gradient(105deg,#f43d9c,#79204f);color:#fff}
.tpy-sidebar .nav button.current:before{display:none}
.tpy-side-count{margin-left:auto;background:#e83e98;color:#fff!important;display:grid;place-items:center;border-radius:50%;height:21px;min-width:21px;padding:0 4px;font-size:11px!important}
.tpy-sidebar-compose{margin-top:auto;width:100%;height:47px;display:flex;align-items:center;justify-content:center;gap:9px;background:linear-gradient(100deg,#ff4aa5,#c12677);color:#fff;border:0;border-radius:12px;font-weight:750;box-shadow:0 6px 25px #9a1e6538}
.tpy-sidebar-compose:hover{filter:brightness(1.13)}
.tpy-side-foot{margin:4px 9px 9px;color:#9990a2;font-size:11px;line-height:1.8}
.tpy-side-foot p{margin:0 0 8px}.tpy-side-foot a{color:#c0b0c2;text-decoration:none}
.tpy-main{grid-column:2;grid-row:2;min-width:0;min-height:0;background:#0b0d15;display:block}
.tpy-main>.content{background:transparent;min-height:calc(100dvh - 78px)}
.tpy-home-grid{display:grid;grid-template-columns:minmax(380px,1fr) minmax(260px,308px) minmax(245px,275px);gap:14px;align-items:start;padding:17px 16px 80px;max-width:1900px;margin:0 auto}
.tpy-home-feed{min-width:0}.tpy-embedded-feed{display:block;max-width:none;width:100%;padding:0;margin:0}
.tpy-embedded-feed>.feed-main{max-width:none;width:100%}
.tpy-embedded-feed .feed-create-card,.tpy-embedded-feed .feed-post{background:#12131e;border:1px solid #2b2838;border-radius:15px;box-shadow:none}
.tpy-embedded-feed .feed-create-card{padding:14px;margin-top:1px}
.tpy-embedded-feed .social-avatar{background:#63334f;border:2px solid #924872;color:#ffd6e6}
.tpy-embedded-feed .feed-create-card .create-prompt>button{background:#1e202d!important;border:1px solid #302a3c!important;color:#aaa5b3!important;border-radius:999px;font-size:14px;text-align:left;padding:14px 20px}
.tpy-embedded-feed .feed-shortcuts{border-top:1px solid #252433;padding-top:10px;margin-top:12px}
.tpy-embedded-feed .feed-shortcuts button{color:#ede8f0;font-weight:650;font-size:12px}
.tpy-embedded-feed .feed-post{padding:0;overflow:visible;margin-bottom:13px}
.tpy-embedded-feed .feed-post-header{padding:15px 16px 8px}
.tpy-embedded-feed .feed-post-copy{padding:4px 16px;margin:0 0 11px;font-size:14px;line-height:1.6}
.tpy-embedded-feed .post-media-gallery{margin:0 0 4px;overflow:hidden;border-radius:0;}
.tpy-embedded-feed .post-media-asset{max-height:680px;width:100%;object-fit:contain;background:#101018}
.tpy-embedded-feed .post-metrics{padding:10px 15px;border-bottom:1px solid #302b3b}
.tpy-embedded-feed .post-actions{padding:4px 12px 10px}
.tpy-embedded-feed .post-actions button:hover{color:#f85aab}
.tpy-embedded-feed .floating-compose{background:linear-gradient(135deg,#f64ca4,#b42778);box-shadow:0 10px 34px #b12c7c55}
.tpy-embedded-feed .tpy-stories{gap:8px;margin:0 0 12px;padding:1px 1px 10px;scrollbar-width:thin}
.tpy-embedded-feed .tpy-story-create,.tpy-embedded-feed .tpy-story-tile{height:180px;width:112px;flex:0 0 112px;border-radius:13px;border:1px solid #63445c}
.tpy-embedded-feed .tpy-story-create{background:linear-gradient(155deg,#50374b,#221826)}
.tpy-embedded-feed .tpy-story-ring{border-color:#fb53ad}
.tpy-embedded-feed .tpy-story-create>span{background:#f3449c;border-color:#f3449c;color:#fff}
.tpy-embedded-feed .tpy-story-tile>b{font-size:12px;text-shadow:0 2px 4px #000b}
.tpy-widget{background:#12131e;border:1px solid #2c2939;border-radius:14px;padding:15px;margin-bottom:13px;overflow:hidden}
.tpy-widget-heading{display:flex;align-items:center;justify-content:space-between;gap:9px;margin-bottom:14px}
.tpy-widget-heading h2{font-size:15px;margin:0;letter-spacing:-.02em}
.tpy-widget-heading button{display:flex;align-items:center;gap:4px;background:none;border:0;color:#ff60b3;font-size:11px;padding:0;white-space:nowrap}
.tpy-widget-heading button:hover{text-decoration:underline}
.tpy-widget-helper{display:flex;align-items:center;gap:6px;font-size:10px!important;color:#ab9fb3;margin:8px 0 0;line-height:1.4}
.tpy-mini-map{position:relative;height:230px;overflow:hidden;border-radius:12px;background:#202a33}
.tpy-mini-map .street-map{height:100%;min-height:0;width:100%;border:0;border-radius:0}
.tpy-mini-map .street-map-canvas{height:100%;width:100%}
.tpy-mini-map .street-map-hint{display:none}
.tpy-mini-map .leaflet-control-zoom{display:none}
.tpy-map-open{position:absolute;bottom:11px;left:11px;display:flex;align-items:center;gap:5px;border:1px solid #59405a;border-radius:10px;background:#121521ec;color:#fff;padding:9px 11px;font-size:10px;font-weight:700;z-index:650}
.tpy-map-open:hover{background:#3b2440}
.tpy-mini-map-loading{height:100%;display:grid;place-items:center;font-size:12px;color:#d7c9d6}
.tpy-suggested{display:flex;align-items:center;gap:8px;padding:8px 0;border-top:1px solid #242332}
.tpy-suggested:first-of-type{border-top:0}
.tpy-circle-avatar{width:38px;height:38px;flex:0 0 38px;display:grid;place-items:center;background:linear-gradient(135deg,#744264,#a4457a);color:#fff;border:2px solid #ef63ad;border-radius:50%;font-size:15px;font-weight:700;text-transform:uppercase}
.tpy-suggested button.tpy-circle-avatar{cursor:pointer}
.tpy-suggested-person{min-width:0;flex:1;background:transparent;border:0;text-align:left;display:grid;gap:2px;color:#f6eef4;padding:0}
.tpy-suggested-person b,.tpy-trend-row b{font-size:12px;overflow:hidden;white-space:nowrap;text-overflow:ellipsis}
.tpy-suggested-person small,.tpy-trend-row small{font-size:10px;color:#a89eaf;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.tpy-outline-action{border:1px solid #df529e;color:#fff;background:#2d1b2b;border-radius:8px;padding:7px 11px;font-size:11px;font-weight:700}
.tpy-outline-action:hover{background:#622e4d}
.tpy-sidebar-empty{font-size:12px;color:#a49aaa;line-height:1.5;margin:6px 0 10px}
.tpy-trend-row{display:flex;align-items:center;gap:10px;padding:9px 0;border-top:1px solid #272638;color:#f8eff8;text-decoration:none}
.tpy-trend-row span:last-child{min-width:0;flex:1;display:grid;gap:3px}
.tpy-trend-avatar{flex:0 0 40px;width:40px;height:40px;border-radius:10px;display:grid;place-items:center;background:#523047;color:#f4d7ea;text-transform:uppercase;font-weight:800}
.tpy-trend-row:hover b{color:#f662b3}
.tpy-home-chat-rail{border:1px solid #292838;border-radius:14px;background:#10111b;align-self:stretch;min-height:calc(100dvh - 114px);padding:16px 11px;overflow:hidden}
.tpy-rail-title{display:flex;align-items:center;justify-content:space-between;padding:4px 7px 17px}
.tpy-rail-title h2{margin:0;font-size:19px}
.tpy-rail-search{border-radius:10px;background:#20202b;border:1px solid #302939;display:flex;align-items:center;gap:7px;padding:0 10px;color:#b4aabd}
.tpy-rail-search input{border:0!important;box-shadow:none!important;background:transparent!important;color:white;width:100%;font-size:12px;padding:12px 0}
.tpy-rail-filters{display:flex;gap:5px;padding:12px 0}
.tpy-rail-filters button{border:1px solid #343243;color:#c7bccb;background:transparent;border-radius:100px;font-size:11px;padding:6px 11px}
.tpy-rail-filters button.selected{background:#ed449e;border-color:#ed449e;color:white}
.tpy-rail-chat{display:flex;align-items:center;gap:9px;width:100%;padding:13px 4px;background:transparent;border:0;border-top:1px solid #272633;color:#f4f0f7;text-align:left;min-width:0}
.tpy-rail-chat:hover{background:#1d1a29}
.tpy-rail-chat-content{display:grid;gap:4px;min-width:0;flex:1}
.tpy-rail-chat-content b{font-size:12px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.tpy-rail-chat-content small{font-size:11px;color:#aea5b3;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.tpy-rail-chat time{font-size:10px;color:#a19aa9;align-self:center}
.tpy-chat-rail-empty{min-height:170px;color:#aaa0ae;display:flex;flex-direction:column;align-items:center;text-align:center;justify-content:center;gap:11px;padding:16px;font-size:12px;line-height:1.5}
.tpy-chat-rail-empty p{margin:0}.tpy-chat-rail-empty button{border:1px solid #df51a0;border-radius:9px;color:#fbeaf3;background:#42223a;padding:8px 14px;font-weight:700}
.tpy-main .explore{min-height:calc(100dvh - 78px)}
.tpy-main .globe-wrap{height:calc(100dvh - 118px)}
.tpy-reference-shell .mobile-nav{display:none}
@media(max-width:1599px){
 .tpy-home-grid{grid-template-columns:minmax(0,1fr) minmax(245px,300px)}
 .tpy-home-chat-rail{display:none}
 .tpy-top-logo{flex-basis:295px}
}
@media(max-width:1199px){
 .tpy-reference-shell{grid-template-columns:205px minmax(0,1fr)}
 .tpy-sidebar{width:205px}
 .tpy-top-logo{flex-basis:232px}
 .tpy-top-logo .tpy-brand-name b{font-size:24px}
 .tpy-top-logo .tpy-brand-name span{font-size:15px}
 .tpy-top-logo .tpy-brand svg{width:43px;height:43px}
 .tpy-top-actions{gap:1px}
 .tpy-account-label{display:none}
}
@media(max-width:1030px){
 .tpy-home-grid{grid-template-columns:minmax(0,1fr);max-width:770px}
 .tpy-home-discovery,.tpy-home-chat-rail{display:none}
 .tpy-global-header{gap:12px;padding:0 12px}
 .tpy-top-logo{flex-basis:190px}
 .tpy-global-search{height:40px}
}
@media(max-width:850px){
 .tpy-reference-shell{display:block;min-height:100dvh}
 .tpy-global-header{height:61px;position:sticky;padding:0 12px;gap:9px}
 .tpy-top-logo{flex:1;min-width:0}
 .tpy-top-logo .tpy-brand-name span{font-size:13px}
 .tpy-top-logo .tpy-brand-name b{font-size:22px}
 .tpy-top-logo .tpy-brand svg{height:37px;width:37px}
 .tpy-top-actions>button{width:34px;height:37px}
 .tpy-top-actions>button:nth-child(1),.tpy-top-actions>button:nth-child(2),.tpy-top-actions>button:nth-child(3){display:none}
 .tpy-top-actions .notification-bell{width:34px;height:37px}
 .tpy-top-account{padding-left:5px}
 .tpy-account-toggle{gap:0}.tpy-account-toggle .avatar-button{height:32px;width:32px}.tpy-account-toggle>svg{display:none}
 .tpy-global-search{position:absolute;top:61px;left:8px;right:8px;max-width:none;width:auto;background:#20202a;display:none}
 .tpy-sidebar{display:none}
 .tpy-main{width:100%;min-height:calc(100dvh - 61px);background:#0c0d15}
 .tpy-home-grid{display:block;padding:10px 8px calc(95px + env(safe-area-inset-bottom));max-width:760px}
 .tpy-embedded-feed{margin:0}
 .tpy-embedded-feed .tpy-stories{margin:0 -8px 10px;padding-left:8px;gap:7px}
 .tpy-embedded-feed .tpy-story-create,.tpy-embedded-feed .tpy-story-tile{height:151px;width:98px;flex-basis:98px}
 .tpy-embedded-feed .feed-create-card{padding:12px}
 .tpy-embedded-feed .feed-post{margin-bottom:10px}
 .tpy-reference-shell .mobile-nav{display:block;position:fixed;left:0;right:0;bottom:0;z-index:30;background:#12131eeF;border-top:1px solid #363042;backdrop-filter:blur(18px);padding-bottom:env(safe-area-inset-bottom)}
 .tpy-reference-shell .mobile-nav .nav{height:61px;display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:0;}
 .tpy-reference-shell .mobile-nav .nav button{display:flex;flex-direction:column;justify-content:center;align-items:center;gap:4px;padding:5px 0;color:#b8afbd;font-size:10px;border-radius:0}
 .tpy-reference-shell .mobile-nav .nav button.current{color:#fa70b8;background:#261c2b}
 .tpy-reference-shell .mobile-nav .nav button span{font-size:10px}
 .tpy-main .explore{min-height:calc(100dvh - 122px)}.tpy-main .globe-wrap{height:calc(100dvh - 122px)}
 .messenger{height:calc(100dvh - 61px - 61px - env(safe-area-inset-bottom))}
 .notification-dropdown{top:43px;right:-45px}
 .tpy-global-header .notification-center{position:relative}
}
@media(max-width:480px){
 .tpy-top-logo .tpy-brand{gap:6px}
 .tpy-top-logo .tpy-brand-name{gap:3px}
 .tpy-top-logo .tpy-brand-name span{font-size:11px}
 .tpy-top-logo .tpy-brand-name b{font-size:18px}
 .tpy-top-actions>button[aria-label="Messages"]{display:none}
 .tpy-embedded-feed .post-actions button{font-size:12px}
 .tpy-embedded-feed .post-media-asset{max-height:530px}
}
.tpy-search-toggle{display:none!important}
.tpy-presence{display:inline-flex;gap:6px;align-items:center;white-space:nowrap;font-size:10px;color:#aaa2b2;padding:0 8px}
.tpy-presence i{width:7px;height:7px;border-radius:50%;background:#70d5a1;display:inline-block}
@media(max-width:1199px){.tpy-presence{display:none}}
@media(max-width:850px){
 .tpy-top-actions .tpy-search-toggle{display:grid!important}
 .tpy-global-search.mobile-open{display:flex;z-index:40;box-shadow:0 14px 32px #000b}
}
@media(max-width:850px){
 .tpy-top-actions>button[aria-label="Home"],
 .tpy-top-actions>button[aria-label="Friends"],
 .tpy-top-actions>button[aria-label="Explore map"]{display:none!important}
}

/* The Pussy Is Yours — shared reference-inspired page system */
.ui-page{padding:18px clamp(12px,2vw,28px) 110px;max-width:1880px;margin:0 auto;min-width:0;color:#f9f3fa}
.ui-page button,.ui-page input,.ui-page textarea,.ui-page select{font:inherit}
.ui-page button{cursor:pointer}
.ui-page-hero{border:1px solid #52213d;border-radius:21px;min-height:172px;display:flex;align-items:center;position:relative;overflow:hidden;padding:28px 34px;margin-bottom:14px;background:radial-gradient(ellipse at 76% 32%,#85244988 0,transparent 45%),linear-gradient(108deg,#160e20 0%,#1e1224 47%,#4b1537 100%)}
.ui-page-hero:after{content:'';position:absolute;width:420px;height:420px;border:1px solid #fb5a9e33;border-radius:50%;top:-265px;right:65px;pointer-events:none}
.ui-hero-inner{position:relative;z-index:1;max-width:670px}
.ui-overline{font-size:11px;font-weight:800;letter-spacing:.4em;color:#fc66ad}
.ui-page-hero h1{font:700 clamp(30px,3.5vw,51px)/1.08 Georgia,'Times New Roman',serif;margin:9px 0 10px;letter-spacing:-.045em}
.ui-page-hero h1 em{font-style:normal;color:#fb60af}
.ui-page-hero p{font-size:14px;color:#cbbdcf;max-width:570px;line-height:1.55;margin:0}
.ui-hero-orbit{position:absolute;right:9%;color:#f968b5;opacity:.26;transform:rotate(-12deg);pointer-events:none}
.ui-section-tabs,.ui-explore-toolbar{display:flex;gap:12px;align-items:center;justify-content:space-between;padding:3px 0 15px;border-bottom:1px solid #302737;margin-bottom:12px;flex-wrap:wrap}
.ui-pills{display:flex;gap:8px;align-items:center;flex-wrap:wrap;min-width:0}
.ui-pill{border:1px solid #403246;background:#12121c;border-radius:100px;display:inline-flex;gap:8px;align-items:center;color:#dfd5e0;padding:10px 14px;font-size:12px;white-space:nowrap}
.ui-pill span{font-size:11px;background:#34303e;color:#e8deea;border-radius:100px;min-width:22px;text-align:center;padding:3px 6px}
.ui-pill.active{background:linear-gradient(100deg,#f63997,#a62168);color:#fff;border-color:#ff5db0;box-shadow:0 5px 18px #d3318255}
.ui-pill.active span{background:#641641;color:#fff}
.ui-inline-search{display:flex;align-items:center;gap:9px;background:#1d1b29;border:1px solid #3d3147;border-radius:100px;min-width:0;width:min(100%,235px);padding:0 14px;color:#bfb0c3;height:43px}
.ui-inline-search input{min-width:0;width:100%;background:transparent!important;border:0!important;outline:0!important;box-shadow:none!important;font-size:12px;color:#faf1f9;padding:8px 0}
.ui-content-with-rail{display:grid;grid-template-columns:minmax(0,1fr) 306px;gap:15px;align-items:start}
.ui-primary-column{min-width:0}
.ui-context-rail{min-width:0;display:grid;gap:13px}
.ui-section{margin-bottom:20px}
.ui-section-title{display:flex;align-items:center;justify-content:space-between;gap:12px;margin:9px 0 12px}
.ui-section-title h2,.ui-map-title h2{font-size:18px;line-height:1.25;margin:0;display:flex;align-items:center;gap:9px;font-weight:750;letter-spacing:-.025em}
.ui-count{display:inline-grid;place-items:center;font-size:11px;min-width:24px;background:#392638;color:#f2cfe4;border-radius:50px;padding:4px 7px;font-weight:700}
.ui-section-title>button,.ui-rail-panel header>button{border:0;background:none;color:#fc64b0;font-size:12px;display:flex;align-items:center;gap:5px}
.ui-member-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:11px}
.ui-member-grid.list{grid-template-columns:1fr}
.ui-member-card{display:grid;gap:13px;min-width:0;border-radius:16px;background:linear-gradient(140deg,#24202b 0,#171620 100%);border:1px solid #413343;padding:15px;transition:border-color .2s,transform .2s}
.ui-member-card:hover{border-color:#a04a7d;transform:translateY(-1px)}
.ui-card-person{background:none;border:0;display:flex;align-items:center;gap:12px;min-width:0;color:inherit;text-align:left;padding:0}
.ui-card-person>span:last-child{display:grid;gap:5px;min-width:0}
.ui-card-person b{font-size:14px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.ui-card-person small{font-size:11px;color:#aaa1b5;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.ui-card-actions{display:flex;gap:7px;align-items:center;min-width:0}
.ui-btn-pink,.ui-btn-outline,.ui-btn-icon,.ui-add-outline{display:inline-flex;align-items:center;justify-content:center;gap:7px;border-radius:10px;border:1px solid #63435f;color:#f6eaf4;font-size:12px;font-weight:700;min-height:37px;padding:8px 10px;white-space:nowrap}
.ui-btn-pink{background:linear-gradient(115deg,#fc45a1,#be227e);border-color:#f344a1;color:#fff;flex:1}
.ui-btn-pink:hover{filter:brightness(1.15)}
.ui-btn-outline{background:#18141e;flex:1}
.ui-btn-outline:hover,.ui-add-outline:hover{border-color:#f25da5;background:#3e203a}
.ui-btn-icon{background:#221b2a;min-width:37px;padding:8px}
.ui-btn-pink:disabled,.ui-btn-outline:disabled,.ui-add-outline:disabled{opacity:.55;cursor:not-allowed}
.ui-avatar{display:inline-grid;place-items:center;position:relative;background:linear-gradient(145deg,#632c54,#b53d87);color:white;border:2px solid #fd4eab;border-radius:50%;overflow:visible;font-weight:800;flex-shrink:0;font-family:Georgia,serif}
.ui-avatar>span{display:grid;place-items:center;width:100%;height:100%;border-radius:50%;overflow:hidden}
.ui-avatar>img{height:100%;width:100%;object-fit:cover;border-radius:50%}
.ui-avatar-online{position:absolute;right:0;bottom:3px;width:12px;height:12px;background:#24db92;border:2px solid #12101b;border-radius:50%;box-shadow:0 0 7px #33dc976e}
.ui-online-text{color:#36de98!important}
.ui-muted{color:#b6a7bb!important;font-size:12px;line-height:1.5}
.ui-empty{min-height:150px;border:1px dashed #4b384c;border-radius:14px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:10px;color:#b8aabd;font-size:13px;padding:20px;text-align:center}
.ui-empty p{margin:0}
.ui-compact-empty{min-height:65px}
.ui-layout-toggle{display:flex;gap:4px;background:#1d1823;border-radius:10px;padding:4px}
.ui-layout-toggle button{display:grid;place-items:center;width:34px;height:30px;border:0;border-radius:7px;background:transparent;color:#c9bcce}
.ui-layout-toggle button.active{background:#d92c89;color:white}
.ui-popover-anchor{position:relative}
.ui-small-popover{position:absolute;top:40px;right:0;min-width:152px;background:#302332;border:1px solid #714366;border-radius:12px;display:grid;gap:3px;padding:5px;z-index:15;box-shadow:0 12px 28px #000a}
.ui-small-popover button{background:none;text-align:left;border:0;border-radius:8px;color:#f4e3f0;padding:10px;font-size:12px}
.ui-small-popover button:hover{background:#512f4a}
.ui-rail-panel{background:#15131f;border:1px solid #322939;border-radius:15px;padding:15px;min-width:0}
.ui-rail-panel h2,.ui-rail-panel h3{margin:0 0 12px;font-size:15px}
.ui-rail-panel header{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:13px}
.ui-rail-panel header h3{margin:0}
.ui-rail-panel>p{font-size:12px;color:#b9abba;line-height:1.65}
.ui-stats-row{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;padding:10px}
.ui-stats-row>div{display:grid;gap:6px;place-items:center;background:#262031;border:1px solid #393045;border-radius:12px;padding:14px 2px;color:#ed72be}
.ui-stats-row b{color:#fff;font-size:18px}.ui-stats-row small{font-size:10px;color:#b3a7bf}
.ui-status-dot{width:14px;height:14px;background:#26dc8e;border-radius:50%;box-shadow:0 0 12px #2cd790aa}
.ui-rail-banner{min-height:87px;background:linear-gradient(115deg,#562244,#25162e);color:#fff;display:flex;align-items:center;gap:12px;padding:14px;border:1px solid #a6477a;border-radius:14px;text-align:left;width:100%}
.ui-rail-banner>svg{color:#ff72bb;flex-shrink:0}.ui-rail-banner>span{display:grid;gap:7px;flex:1}.ui-rail-banner b{font-size:13px}.ui-rail-banner small{color:#c2adbf;font-size:11px;line-height:1.5}
.ui-rail-person{display:flex;align-items:center;gap:9px;padding:9px 0;border-top:1px solid #292333;min-width:0}
.ui-rail-person:first-of-type{border-top:0}
.ui-rail-person>button:first-child{display:flex;align-items:center;gap:8px;text-align:left;flex:1;min-width:0;background:none;border:0;color:#fff;padding:0}
.ui-rail-person>button:first-child>span:last-child{display:grid;gap:4px;min-width:0}
.ui-rail-person b{font-size:12px;overflow:hidden;white-space:nowrap;text-overflow:ellipsis}
.ui-rail-person small{font-size:10px;color:#ada3b6;overflow:hidden;white-space:nowrap;text-overflow:ellipsis}
.ui-add-outline{padding:6px 9px;min-height:30px;background:#2d172a;border-color:#d84598}
/* Explore */
.ui-explore-utilities{display:flex;gap:7px;align-items:center}
.ui-explore-utilities label{display:flex;align-items:center;gap:9px;background:#1c1924;border:1px solid #403346;color:#b9a9be;border-radius:25px;padding:7px 11px;font-size:11px}
.ui-explore-utilities select{background:transparent;color:white;border:0;outline:0;font-size:12px}
.ui-explore-utilities select option,.ui-filter-drawer select option{background:#211624;color:#f6ebf3}
.ui-filter-drawer{border:1px solid #50364f;border-radius:12px;padding:12px;display:flex;align-items:center;gap:11px;flex-wrap:wrap;margin-bottom:13px;background:#211927}
.ui-filter-drawer select{color:#fff;border:1px solid #50334e;background:#17111e;border-radius:9px;padding:10px}
.ui-filter-drawer>button{display:flex;align-items:center;gap:5px;background:transparent;color:#dca4c5;border:0}
.ui-map-section{border:1px solid #7f2d61;background:#11121e;border-radius:17px;overflow:hidden;margin-bottom:20px}
.ui-map-title{display:flex;gap:10px;align-items:center;justify-content:space-between;padding:12px 15px;background:#16101dde}
.ui-map-title>span{font-size:11px;color:#d7bad0;background:#332037;padding:7px 10px;border-radius:20px}
.ui-map-frame{height:405px;position:relative;background:#1b2334;overflow:hidden}
.ui-map-frame .street-map{height:100%;min-height:0;border:0;border-radius:0}
.ui-map-frame .street-map-canvas{width:100%;height:100%}
.ui-map-frame .leaflet-tile-pane{filter:brightness(.66) saturate(.6) invert(.94) hue-rotate(172deg) contrast(1.12)}
.ui-map-frame .street-map-hint{display:none}
.ui-map-recenter{position:absolute;z-index:500;bottom:15px;right:13px;display:flex;gap:7px;align-items:center;background:#17101fec;color:#fff;border:1px solid #895177;padding:11px;border-radius:10px;font-size:11px}
.ui-map-privacy{display:flex;align-items:center;gap:8px;color:#c0b2c2;font-size:11px;line-height:1.5;margin:0;padding:11px 15px}
.ui-interests-row{display:flex;flex-wrap:wrap;gap:7px}
.ui-interests-row button,.ui-interest-chip{border:1px solid #3b3246;border-radius:100px;background:#252031;color:#f0e0ec;padding:10px 12px;display:inline-flex;align-items:center;gap:6px;font-size:11px}
.ui-interests-row button.selected{background:#e83c98;color:#fff;border-color:#e83c98}
.ui-discovery-cards{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:11px}
.ui-discovery-card{border:1px solid #413344;background:linear-gradient(145deg,#24202c,#15121c);border-radius:15px;padding:13px;min-width:0;display:grid;gap:13px}
.ui-discovery-person{display:flex;gap:11px;align-items:center;text-align:left;background:transparent;border:0;color:#fff;min-width:0}
.ui-discovery-person>span:last-child{min-width:0;display:grid;gap:5px}
.ui-discovery-person b{font-size:13px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.ui-discovery-person small{font-size:10px;color:#b6a6b6;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
/* Profile */
.ui-profile-top{background:#0f101b;border:1px solid #34273c;border-radius:18px;overflow:hidden}
.ui-cover{height:255px;background:radial-gradient(circle at 74% 30%,#df2d8180,transparent 35%),linear-gradient(125deg,#160b20 0%,#742349 50%,#1c1329 100%);background-position:center;background-size:cover;position:relative}
.ui-cover-monogram{position:absolute;left:44%;top:40%;font:italic 36px Georgia,serif;color:#f7c1df66;transform:rotate(-8deg)}
.ui-cover-edit{position:absolute;bottom:12px;right:15px;display:flex;align-items:center;gap:7px;color:#fff;background:#17121fbf;border:1px solid #b66a9b;border-radius:9px;padding:9px 12px;font-size:11px}
.ui-profile-main{display:flex;gap:18px;padding:18px 22px 25px;position:relative;align-items:flex-start;min-height:169px}
.ui-profile-photo-wrap{flex:0 0 148px;height:96px;position:relative;align-self:stretch;margin-top:-62px;z-index:2}
.ui-avatar-edit{position:absolute;bottom:4px;right:8px;border-radius:50%;width:32px;height:32px;display:grid;place-items:center;background:#d63289;border:2px solid #18111f;color:white}
.ui-profile-intro{flex:1;min-width:0;display:grid;gap:10px}
.ui-profile-intro>div:first-child{display:grid;gap:3px}
.ui-profile-intro h1{font-size:26px;margin:0;line-height:1.2}
.ui-profile-intro small{color:#aa9cb0}
.ui-profile-intro p{font-size:12px;color:#efdfeb;margin:0;line-height:1.7;max-width:470px}
.ui-profile-facts{display:flex;gap:16px;flex-wrap:wrap;color:#b5a7bc;font-size:11px}
.ui-profile-facts span{display:flex;align-items:center;gap:5px}
.ui-profile-side-actions{min-width:290px;display:grid;gap:20px;align-self:stretch;justify-items:end}
.ui-profile-actions{display:flex;align-items:center;gap:7px}
.ui-profile-actions .ui-btn-pink,.ui-profile-actions .ui-btn-outline{min-width:90px;flex:none}
.ui-profile-stats{display:flex;gap:15px;align-items:center;justify-content:flex-end;flex-wrap:wrap}
.ui-profile-stats>div{display:grid;gap:5px;padding-right:12px;border-right:1px solid #342b3d;text-align:center;min-width:57px}
.ui-profile-stats>div:last-child{border:0;padding-right:0}
.ui-profile-stats b{font-size:15px}.ui-profile-stats small{color:#aca0b2;font-size:10px}
.ui-profile-stories{margin-top:17px}
.ui-profile-stories .tpy-stories{margin-bottom:11px}
.ui-profile-stories .tpy-story-create,.ui-profile-stories .tpy-story-tile{width:95px;height:127px;flex-basis:95px}
.ui-profile-nav{display:grid;grid-template-columns:repeat(5,1fr);margin:8px 0 17px;background:#15121e;border:1px solid #383040;border-radius:14px;overflow:hidden}
.ui-profile-nav button{display:flex;justify-content:center;align-items:center;gap:9px;color:#d3c6d4;background:transparent;border:0;border-bottom:2px solid transparent;padding:14px 8px;font-size:12px}
.ui-profile-nav button.active{background:#29162c;color:#ff69b2;border-bottom-color:#fb4ea4}
.ui-profile-feed .feed-page,.ui-profile-feed .feed-main{width:100%;max-width:none;padding:0}
.ui-profile-feed .feed-post{margin-bottom:13px}
.ui-profile-media>h2{font-size:17px;margin:10px 0 15px}
.ui-media-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px}
.ui-media-grid img,.ui-media-grid video{width:100%;height:215px;object-fit:cover;border-radius:10px;background:#241c2b}
.ui-rail-media-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:6px}
.ui-rail-media-grid img{width:100%;aspect-ratio:1;object-fit:cover;border-radius:8px}
.ui-about-full{min-height:250px}.ui-about-full h2{font-size:19px}.ui-about-full h3{margin-top:24px}
.ui-fact{display:flex;align-items:center;gap:8px;color:#c5b8c9;margin:14px 0;font-size:12px}
.ui-saved-post{display:flex;justify-content:space-between;color:#efc7e0;text-decoration:none;padding:15px 0;border-bottom:1px solid #453345}
.ui-edit-dialog{border:1px solid #674261;border-radius:18px;background:#241b29;color:#fff;width:min(94vw,520px);padding:23px;display:grid;gap:14px;box-shadow:0 22px 90px #000c}
.ui-edit-dialog header{display:flex;align-items:center;justify-content:space-between}.ui-edit-dialog h2{margin:0}
.ui-edit-dialog label{display:grid;gap:7px;color:#c1b0c4;font-size:12px}
.ui-edit-dialog input,.ui-edit-dialog textarea{border:1px solid #604961;background:#17121d;color:#fff;border-radius:9px;padding:12px;min-width:0;width:100%}
.ui-edit-dialog textarea{min-height:95px}
/* Layout responsive */
@media(max-width:1500px){.ui-content-with-rail{grid-template-columns:minmax(0,1fr) 270px}.ui-member-grid,.ui-discovery-cards{grid-template-columns:repeat(2,minmax(0,1fr))}.ui-profile-main{flex-wrap:wrap}.ui-profile-side-actions{min-width:0;width:100%;display:flex;justify-content:space-between;align-items:center}}
@media(max-width:1120px){.ui-content-with-rail{grid-template-columns:minmax(0,1fr)}.ui-context-rail{display:none}.ui-member-grid,.ui-discovery-cards{grid-template-columns:repeat(2,minmax(0,1fr))}.ui-map-frame{height:380px}}
@media(max-width:850px){.ui-page{padding:13px 11px calc(90px + env(safe-area-inset-bottom))}.ui-page-hero{border-radius:15px;min-height:135px;padding:19px;margin-bottom:12px}.ui-page-hero h1{font-size:31px}.ui-page-hero p{font-size:12px}.ui-hero-orbit{right:-5%}.ui-pill{font-size:11px;padding:9px 11px}.ui-inline-search{width:100%}.ui-section-tabs{align-items:stretch}.ui-member-grid,.ui-discovery-cards{grid-template-columns:repeat(2,minmax(0,1fr))}.ui-card-person{gap:9px}.ui-card-person .ui-avatar{width:49px!important;height:49px!important;flex-basis:49px!important}.ui-card-actions{flex-wrap:wrap}.ui-btn-outline,.ui-btn-pink{font-size:11px}.ui-map-frame{height:420px}.ui-profile-main{padding:18px 15px}.ui-cover{height:200px}.ui-profile-photo-wrap{height:85px;flex-basis:115px;margin-top:-55px}.ui-profile-photo-wrap .ui-avatar{width:108px!important;height:108px!important;flex-basis:108px!important}.ui-profile-side-actions{display:grid;gap:14px}.ui-profile-actions{flex-wrap:wrap}.ui-profile-stats{justify-content:space-between;width:100%;gap:4px}.ui-profile-nav button{font-size:10px;gap:4px;flex-direction:column}.ui-profile-nav button svg{width:17px}.ui-map-title>span{font-size:10px}}
@media(max-width:520px){.ui-page-hero h1{font-size:29px}.ui-section-title h2{font-size:16px}.ui-member-grid,.ui-discovery-cards{grid-template-columns:1fr}.ui-member-card{padding:13px}.ui-map-frame{height:360px}.ui-pill{padding:8px 10px}.ui-pill span{display:none}.ui-profile-main{display:grid;gap:13px}.ui-profile-photo-wrap{height:64px}.ui-profile-intro h1{font-size:22px}.ui-profile-side-actions{justify-items:stretch}.ui-profile-actions{flex-wrap:wrap}.ui-profile-actions .ui-btn-pink,.ui-profile-actions .ui-btn-outline{min-width:0;flex:1}.ui-profile-nav{grid-template-columns:repeat(5,minmax(0,1fr))}.ui-profile-nav button{font-size:9px}.ui-media-grid{grid-template-columns:repeat(2,minmax(0,1fr))}}
/* Premium Messenger: fully real Supabase conversations, no calling controls */
.tpy-reference-shell .messenger{display:grid;grid-template-columns:minmax(270px,330px) minmax(0,1fr) minmax(245px,285px);gap:0;min-height:calc(100dvh - 79px);height:calc(100dvh - 79px);background:#0c0d17}
.tpy-reference-shell .message-sidebar{border-right:1px solid #302839;background:#0d0e18;min-width:0;overflow-y:auto}
.tpy-reference-shell .message-heading{padding:18px 16px 10px;display:flex;align-items:center;justify-content:space-between}
.tpy-reference-shell .message-heading h1{margin:0;color:#faf3fa;font-size:22px;font-weight:800}
.tpy-reference-shell .message-heading>button{border:1px solid #403344;background:#211927;border-radius:11px;width:39px;height:39px;color:#f77cb9}
.tpy-reference-shell .chat-search{margin:0 13px 10px;height:43px;background:#1b1b28;border:1px solid #3a3041;border-radius:12px;padding:0 12px;display:flex;gap:8px;align-items:center;color:#bbb1c0}
.tpy-reference-shell .chat-search input{min-width:0;flex:1;border:0;background:none;color:#fff;outline:0;box-shadow:none;font-size:12px}
.tpy-reference-shell .chat-filters{padding:7px 12px 13px;display:flex;gap:6px;border-bottom:1px solid #302837}
.tpy-reference-shell .chat-filters button{border:1px solid #3b3141;border-radius:100px;background:#171520;color:#c9bdc9;font-size:11px;padding:7px 11px}
.tpy-reference-shell .chat-filters button.selected{background:#ed3d99;color:white;border-color:#ed3d99}
.tpy-reference-shell .conversation-row{padding:12px 13px;display:flex;align-items:center;gap:11px;min-width:0;width:100%;border:0;border-bottom:1px solid #272333;background:transparent;text-align:left;color:#fff;position:relative}
.tpy-reference-shell .conversation-row.selected{background:linear-gradient(90deg,#4f1c3d,#251524);outline:1px solid #e34598;outline-offset:-2px;border-radius:10px}
.tpy-reference-shell .conversation-row>span:nth-child(2){flex:1;min-width:0;display:grid;gap:5px}
.tpy-reference-shell .conversation-row b{font-size:13px}.tpy-reference-shell .conversation-row small{font-size:11px;color:#aaa1b3;overflow:hidden;white-space:nowrap;text-overflow:ellipsis}
.ui-chat-unread{flex-shrink:0;width:17px;height:17px;border-radius:50%;background:#e73c9a;box-shadow:0 0 10px #e73c9a55}
.tpy-reference-shell .message-thread{min-width:0;height:100%;display:flex;flex-direction:column;background:radial-gradient(circle at 88% 19%,#49113244,transparent 39%),#0c0d15}
.tpy-reference-shell .thread-header{background:#16131f;border-bottom:1px solid #35283c;display:flex;align-items:center;padding:12px 15px;min-height:77px;gap:10px}
.tpy-reference-shell .ui-chat-profile-link{display:grid;gap:5px;flex:1;min-width:0;border:0;background:transparent;text-align:left;color:#fff;padding:0}
.tpy-reference-shell .ui-chat-profile-link b{font-size:14px}
.tpy-reference-shell .ui-chat-profile-link small{font-size:11px;color:#35dc96}
.tpy-reference-shell .thread-actions{display:flex;align-items:center;position:relative;gap:5px}
.tpy-reference-shell .thread-actions>button{border:0;background:transparent;color:#e7dbe5;padding:8px}
.tpy-reference-shell .thread-scroller{flex:1;overflow-y:auto;padding:20px 16px;background-image:radial-gradient(#7a3b6531 1px,transparent 1px);background-size:22px 22px}
.tpy-reference-shell .chat-encryption{font-size:10px;color:#a598a9;background:#1e1b26ea;border:1px solid #332a37;border-radius:10px;padding:10px 13px;margin:0 auto 17px;text-align:center;width:max-content;max-width:min(100%,380px)}
.tpy-reference-shell .message-bubble{position:relative;border:1px solid #2d2839;border-radius:15px 15px 15px 3px;background:#262330;color:#fff;max-width:75%;width:max-content;margin:9px auto 9px 0;padding:11px 14px;min-width:80px;overflow:visible}
.tpy-reference-shell .message-bubble.my-bubble{background:linear-gradient(125deg,#f13b95,#b52673);border-color:#e74497;border-radius:15px 15px 3px 15px;margin-left:auto;margin-right:0}
.tpy-reference-shell .message-bubble small{display:flex;align-items:center;gap:3px;justify-content:flex-end;font-size:9px;color:#e1cbdc;margin-top:6px}
.tpy-reference-shell .message-bubble .chat-media{max-width:100%;max-height:330px;border-radius:10px;object-fit:contain}
.tpy-reference-shell .ui-message-star{position:absolute;right:-29px;top:0;color:#947c91;border:0;background:transparent;padding:4px;opacity:0;transition:opacity .15s}
.tpy-reference-shell .message-bubble:hover .ui-message-star,.tpy-reference-shell .ui-message-star.active{opacity:1;color:#f8afc9}
.tpy-reference-shell .message-bubble.my-bubble .ui-message-star{right:auto;left:-28px}
.tpy-reference-shell .chat-composer{background:#16131d;border-top:1px solid #332739;display:flex;align-items:center;gap:7px;padding:10px 13px}
.tpy-reference-shell .chat-composer>button,.tpy-reference-shell .attach-wrap>button{border:0;border-radius:50%;display:grid;place-items:center;min-width:36px;height:36px;background:#282132;color:#f3dfef}
.tpy-reference-shell .chat-composer>button:last-child{background:#ba257c;border:1px solid #eb4a9e}
.tpy-reference-shell .chat-text-input{flex:1;min-width:0;background:#20202d!important;border:1px solid #3c3247!important;border-radius:100px!important;color:#fff!important;padding:12px 15px!important;font-size:12px!important}
.tpy-reference-shell .attach-wrap{position:relative}
.tpy-reference-shell .attach-menu{position:absolute;left:0;bottom:48px;z-index:20;min-width:180px;border:1px solid #50344c;border-radius:13px;background:#26202d;box-shadow:0 12px 44px #000b;padding:6px;display:grid;gap:3px}
.tpy-reference-shell .attach-menu button{border:0;background:transparent;color:#ebdce9;padding:10px;display:flex;align-items:center;gap:10px;font-size:12px}
.tpy-reference-shell .attach-menu button:hover{background:#50304a;border-radius:7px}
.ui-thread-menu{z-index:20;top:42px;right:0}
.ui-conversation-details{overflow-y:auto;border-left:1px solid #35283d;background:#11111c;padding:15px 12px;min-width:0}
.ui-conversation-details>header{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:16px}
.ui-conversation-details>header h2{font-size:15px;margin:0}.ui-conversation-details>header button{min-width:28px;min-height:28px;width:28px;padding:0}
.ui-conversation-person{display:grid;place-items:center;gap:7px;padding:16px 7px 20px;border-bottom:1px solid #33293a}
.ui-conversation-person b{font-size:14px}.ui-conversation-person small{font-size:11px;color:#b5a4b4}
.ui-conversation-person .ui-btn-outline{margin-top:6px}
.ui-conversation-option{display:flex;align-items:center;justify-content:space-between;padding:13px 0;gap:10px;border-bottom:1px solid #2d2635}
.ui-conversation-option>span{font-size:12px;display:flex;align-items:center;gap:7px}
.ui-conversation-option button{font-size:11px;padding:6px;background:#342337;border:1px solid #694362;border-radius:7px;color:#f6d3e7}
.ui-conversation-details>section{padding:17px 0;border-bottom:1px solid #302737}
.ui-conversation-details h3{font-size:13px;display:flex;justify-content:space-between;align-items:center;gap:7px;margin:0 0 10px}.ui-conversation-details h3 span{margin-left:auto;color:#a5a0aa}
.ui-chat-shared{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:5px}
.ui-chat-shared img{width:100%;aspect-ratio:1;object-fit:cover;border-radius:8px}
.ui-chat-shared a{display:flex;flex-direction:column;gap:3px;font-size:9px;color:#f3b7d6;text-decoration:none;word-break:break-word}
.ui-chat-starred{display:grid;gap:7px}.ui-chat-starred button{display:flex;align-items:center;justify-content:space-between;gap:5px;background:#26202d;border:1px solid #4f3751;border-radius:8px;text-align:left;color:#dfc8d9;font-size:11px;padding:9px}
.ui-conversation-details section>p,.ui-chat-privacy{font-size:11px;color:#ada1b1;line-height:1.6}
@media(max-width:1550px){.tpy-reference-shell .messenger{grid-template-columns:minmax(250px,315px) minmax(0,1fr)}.ui-conversation-details{display:none}}
@media(max-width:850px){.tpy-reference-shell .messenger{height:calc(100dvh - 61px - 61px - env(safe-area-inset-bottom));min-height:0;display:block}.tpy-reference-shell .message-sidebar,.tpy-reference-shell .message-thread{height:100%;width:100%}.tpy-reference-shell .message-sidebar.mobile-hidden,.tpy-reference-shell .message-thread.mobile-hidden{display:none}.tpy-reference-shell .message-bubble{max-width:86%}.ui-conversation-details{display:none}}

.tpy-mini-map .leaflet-tile-pane{filter:brightness(.7) saturate(.6) invert(.95) hue-rotate(165deg) contrast(1.1)}
```

---

## `DEPLOYMENT-CHECKLIST.md`

```text
# The Pussy Is Yours — Deployment & Two-Account Test

## Environment

- Copy `.env.example` to `.env.local`.
- Add your Supabase **publishable** key. Never use service-role keys in `NEXT_PUBLIC_*` variables.
- Set `NEXT_PUBLIC_SITE_URL=https://thepussyisyours.com` only when the domain is deployed on HTTPS.
- Update Google and Facebook consent branding, Supabase Auth URL configuration and authorized redirect URLs to include `/auth/callback` on the live domain.
- Install dependencies using `npm install`. Then run `npm run typecheck`, `npm run build`, `npm run dev`. This release has not completed a full npm build in the authoring environment because the registry could not be reached.

## Supabase integration

The connected Supabase project `xllsgkdixmcgqenlinwh` received additive tables for stories, follows, bookmarks, user settings, moderation requests, private messaging preferences, starred messages, public profile media, and an authenticated unfriend RPC. No user data or posts were deleted in this release.

The earlier `004_premium_release.sql` is a reproducible baseline for environments that have only the original `tgy_*` database. On the connected project, **do not blindly rerun it**; many definitions already exist. The new `005_notification_preferences_optional.sql` was **not applied automatically**. Review it before execution. Until installed, notification preference toggles do not suppress server-created notifications, and follows do not generate server-side alerts.

Known production gaps: full WebRTC calling intentionally excluded; true end-to-end encryption not provided; background notifications require a push service; account deletion requests are not automatic; media expiry needs a scheduled cleanup; avatar/cover photos are publicly readable; large-media processing and content moderation enforcement need operational services; privilege audits and rate-limiting still need review. Supabase security advisor flags authenticated SECURITY DEFINER RPC functions and leaked-password protection being disabled. See https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable and https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection.

## Functional two-user test

1. On two independent browsers/devices, grant location and sign in with different Google/Facebook accounts.
2. Create a public identity on each account; upload a profile image and cover; test privacy/onboarding and `@username` deep links.
3. Test Streets map, public approximation and hide location. Confirm distinct accounts remain distinct when in the same building.
4. Send, accept, decline and remove friend requests; follow and unfollow another person.
5. Create Public, Friends and Only Me posts; verify each is visible only to the intended audience. Test photo/video uploads, reactions, comments, shared HTTPS links and saved posts.
6. Create a 24-hour story and test visibility from the other account.
7. Send a message, image, document and voice note. Verify chat receipts, message starring and muted/pinned settings. Check behavior after reload and on mobile.
8. Verify notification delivery for new messages, friend requests, reactions, comments and profile visits. Old activity doesn't create retroactive notifications.
9. Verify report/block controls, moderation permissions, signed image URLs, deletion request, device layouts and keyboard navigation.
10. Deploy to a staging HTTPS domain before public launch. Verify production build, map tile rate limits, DNS, OAuth redirects, TLS, sitemap, Open Graph, backups, alerting, abuse prevention and legal/privacy disclosures.

Do not replace all old Supabase tables or overwrite environment secrets.
```

---

## `INSTALL-COPY-PASTE.md`

```text
# Copy/paste installation — The Pussy Is Yours

**Recommended:** use the complete unified ZIP in a new folder so source versions are not mixed.

If you must paste individual source files, copy the entire text into the exact matching project paths:

1. `components/SocialApp.tsx` — navigation and integration of all five screens
2. `components/FriendsDashboard.tsx` — friends/requests/suggestions
3. `components/ExploreDashboard.tsx` — map/discovery/filters
4. `components/ProfileDashboard.tsx` — public and own profile
5. `components/ProfileAvatar.tsx` — profile image renderer
6. `components/ChatPanel.tsx` — real conversations
7. `components/FeedPanel.tsx` — posts, reactions, media and privacy
8. `components/StoriesStrip.tsx` — 24-hour stories
9. `components/HomeDashboard.tsx` — 3-column home dashboard
10. `lib/types.ts` — shared models
11. `lib/presence.ts` — realtime presence room
12. `app/globals.css` — complete unified style sheet

**Retain and keep consistent** the included unmodified project files (`components/StreetMap.tsx`, `components/NotificationCenter.tsx`, `lib/supabase.ts`, `lib/media.ts`, `package.json`, `app/*`, etc.). Do not mix previous Beta files with this release.

Use the existing `.env.local` with correct Supabase public credentials and `NEXT_PUBLIC_SITE_URL=https://thepussyisyours.com` only once the live HTTPS domain is ready. Google and Facebook Auth provider callback settings must also be updated for the deployed domain.

The 9 new `tpy_*` tables have been added to the existing connected Supabase project. See deployment checklist for the optional **not yet installed** notification preferences trigger migration.
```

---

## `README.md`

```text
# The Pussy Is Yours — Unified Social Dashboard

A cohesive Next.js 15/React/TypeScript social-network beta, using the five user-approved mockups as **visual references** for Home, Friends, Explore, Messages and Profile. Black/magenta premium branding, mobile-first responsive layouts, real Supabase user records, and no voice/video calling controls.

## Pages

- **Home** — stories, real posts, public map preview, real member recommendations and direct chat previews.
- **Friends** — requests, accept/decline, friends search, suggested accounts, follow/unfollow, profile navigation, and direct chat links.
- **Explore** — real street map, approximate public pins, live presence, distance filter, online/recent/trending/interest filters, real suggestions.
- **Messages** — direct chat, text, media and voice notes, receipts, message starring, notification muting, pinning, search and mobile layout. No audio/video calling.
- **Profile** — personal cover and avatar uploads, edit name/handle/bio/interests, public posts, visible media, 24-hour stories, follower stats, follow/friend/message actions, saved posts, block/report.
- **Notifications / Settings / Admin** — existing realtime notifications, personal account settings and RLS-protected moderation UI.

No synthetic social users, posts, likes, counts, stories, or messages are inserted. The mockups contain illustrative people; the app shows only data the actual members provide.

## Run

1. Extract this project into a new folder instead of copying isolated files from incompatible releases.
2. Copy `.env.example` to `.env.local`, fill in your Supabase **publishable** key, and keep `.env.local` out of Git.
3. `npm install`
4. `npm run typecheck`
5. `npm run build`
6. `npm run dev`

The author's environment cannot access the npm registry, so these npm commands were **not successfully run here**. The source passed TypeScript syntax parsing (39 files), local-import resolution, and ZIP integrity checks. This does **not** establish production readiness.

## Backend

The connected Supabase project `xllsgkdixmcgqenlinwh` has received additive migrations for the unified interface (9 new `tpy_*` tables, profile-media storage, stories storage, follows/bookmarks/preferences, chat settings/starred messages, moderation and a secure unfriend function). Existing `tgy_*` data was left intact during this release.

- The included `supabase/004_premium_release.sql` is the earlier baseline reference; **do not rerun it blindly** on this project because much of it is already deployed.
- `supabase/005_notification_preferences_optional.sql` remains **undeployed**: applying it after review is required for stored notification preferences to suppress server-generated events and for new-follower alerts.
- An administrator must separately review site safety, the RLS policies, user deletion process, media-cleanup scheduling, public domain configuration, background push notifications, map tile provider limits, and applicable privacy requirements.
- Existing message storage does not provide end-to-end encryption.

See `DEPLOYMENT-CHECKLIST.md` for exact setup and manual two-account verification instructions.
```

---

## `supabase/005_notification_preferences_optional.sql`

```sql
-- OPTIONAL FOLLOW-UP FOR SELF-MANAGED INSTANCES. NOT DEPLOYED AUTOMATICALLY.
-- Review this migration with a database administrator before applying it.
-- Makes tpy_user_settings notification choices govern event insertion.
create or replace function public.tpy_filter_notification()
returns trigger language plpgsql security definer set search_path = '' as $$
declare prefs public.tpy_user_settings%rowtype;
begin
 select * into prefs from public.tpy_user_settings where user_id=new.user_id;
 if not found then return new; end if;
 if new.kind='profile_view' and not prefs.allow_profile_view_notifications then return null; end if;
 if new.kind='message' and not prefs.allow_message_notifications then return null; end if;
 if new.kind in ('reaction','comment','share','friend_request','friend_accepted','follow')
    and not prefs.allow_social_notifications then return null; end if;
 return new;
end $$;
revoke all on function public.tpy_filter_notification() from public,anon,authenticated;
drop trigger if exists tpy_notification_preferences on public.tgy_notifications;
create trigger tpy_notification_preferences before insert on public.tgy_notifications
for each row execute function public.tpy_filter_notification();

create or replace function public.tpy_notify_follow()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
 if new.followed_id<>new.follower_id then
 insert into public.tgy_notifications(user_id,kind,payload)
 values(new.followed_id,'follow',jsonb_build_object('actor_id',new.follower_id));
 end if;
 return new;
end $$;
revoke all on function public.tpy_notify_follow() from public,anon,authenticated;
drop trigger if exists tpy_follow_notification on public.tpy_follows;
create trigger tpy_follow_notification after insert on public.tpy_follows
for each row execute function public.tpy_notify_follow();
notify pgrst,'reload schema';
```

---
