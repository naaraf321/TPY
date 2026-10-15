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
