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
 useEffect(()=>{if(tab==='messages')window.scrollTo({top:0,behavior:'instant'});},[tab]);
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
  <h1>{geoState==='required'?'Enable location to enter.':'Location services unavailable'}</h1>
  <p>Location is a required part of The Pussy Is Yours. Your device position is used for the map. Signed-in accounts store only an approximate map area on the server, which you can hide in Profile.</p>
  <div className="privacy-points"><div><Navigation size={18}/> Find your position on streets and mapped buildings</div><div><ShieldCheck size={18}/> Public pins use nearby areas, not your building or floor</div><div><LockKeyhole size={18}/> You can hide your public pin at any time</div></div>
  <button className="primary gate-cta" onClick={()=>getLocation()}><MapPin size={18}/>{geoAllowed?'Retry locating my device':'Allow location & continue'}</button>
  {geoError&&<p className="gate-error" role="alert">{geoError}</p>}
  
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
  <section className={`main tpy-main ${tab === 'messages' ? 'tpy-chat-main' : ''}`}>
   <div className={`content ${tab === 'messages' ? 'tpy-chat-content' : ''}`}>
   {tab==='home'&&<HomeDashboard user={user} persona={persona} directory={directory} people={publicPeople.filter(p=>p.id!==user?.id)} ownLocation={ownGeo?[ownGeo.lat,ownGeo.lng]:null} friends={friendProfiles} onLogin={()=>setLoginOpen(true)} onError={error} onProfile={openProfileById} onExplore={()=>nav('explore')} onFriends={()=>nav('friends')} onChat={openChat}/>}
   {tab==='explore'&&<ExploreDashboard user={user} directory={directory} people={publicPeople.filter(p=>p.id!==user?.id)} ownLocation={ownGeo?[ownGeo.lat,ownGeo.lng]:null} onlineIds={onlineIds} friendIds={friends} onProfile={openProfileById} onChat={openChat} onAddFriend={id=>{const p=directory.find(x=>x.user_id===id);if(p)void sendRequest(asPerson(p));}} onLogin={()=>setLoginOpen(true)} onError={error}/>}
   {tab==='feed'&&<FeedPanel user={user} persona={persona} directory={directory} focusPostId={initialPostId}
      onLogin={()=>setLoginOpen(true)} onError={error} onProfile={openProfileById}/>}
   {tab==='friends'&&user&&<FriendsDashboard user={user} directory={directory} friendIds={friends} requests={requests} people={publicPeople} onlineIds={onlineIds} onProfile={openProfileById} onChat={openChat} onExplore={()=>nav('explore')} onAccept={r=>void acceptRequest(r)} onDecline={r=>void denyRequest(r)} onAddFriend={id=>{const p=directory.find(x=>x.user_id===id);if(p)void sendRequest(asPerson(p));}} onError={error} onChanged={()=>void reload(user)}/>}
   {tab==='messages'&&user&&<ChatPanel user={user} friends={friendProfiles} directory={directory} initialPeerId={chatPeer} onlineIds={onlineIds} onProfile={openProfileById} onError={error}/>}
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
