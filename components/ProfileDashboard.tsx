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
