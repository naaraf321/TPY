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
