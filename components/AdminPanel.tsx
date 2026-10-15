'use client';
import {useCallback,useEffect,useState} from 'react';
import {Shield,RefreshCw,ArrowLeft} from 'lucide-react';
import Link from 'next/link';
import {getSupabase} from '@/lib/supabase';
import type {User} from '@supabase/supabase-js';
import {errorMessage} from '@/lib/errorMessage';
const db=getSupabase();
type Report={id:string;reporter_id:string;target_user_id:string|null;target_post_id:string|null;reason:string;status:'open'|'reviewing'|'resolved'|'dismissed';created_at:string};
type DeleteRequest={user_id:string;requested_at:string;status:string};
export default function AdminPanel(){
 const [user,setUser]=useState<User|null>(null);const [ready,setReady]=useState(false);const [allowed,setAllowed]=useState(false);
 const [reports,setReports]=useState<Report[]>([]);const [requests,setRequests]=useState<DeleteRequest[]>([]);const [notice,setNotice]=useState('');
 const reload=useCallback(async()=>{
  if(!db||!user)return;
  const [a,b]=await Promise.all([db.from('tpy_content_reports').select('*').order('created_at',{ascending:false}).limit(100),db.from('tpy_deletion_requests').select('*').order('requested_at',{ascending:false}).limit(50)]);
  if(a.error)setNotice(errorMessage(a.error));else setReports((a.data||[]) as Report[]);
  if(b.error)setNotice(errorMessage(b.error));else setRequests((b.data||[]) as DeleteRequest[]);
 },[user]);
 useEffect(()=>{let mounted=true;if(!db){setReady(true);return;}
  void db.auth.getUser().then(async({data,error})=>{
   if(!mounted)return;
   if(error||!data.user){setReady(true);return;}
   const me=data.user;
   const r=await db!.from('tpy_admins').select('role').eq('user_id',me.id).maybeSingle();
   if(!mounted)return;
   setUser(me);setAllowed(!!r.data&&!r.error);setReady(true);
  });return()=>{mounted=false;};
 },[]);
 useEffect(()=>{if(allowed)void reload();},[allowed,reload]);
 const update=async(r:Report,status:Report['status'])=>{
  if(!db||!user||!allowed)return;
  const q=await db.from('tpy_content_reports').update({status,reviewed_by:user.id,reviewed_at:new Date().toISOString()}).eq('id',r.id);
  if(q.error)setNotice(errorMessage(q.error));else void reload();
 };
 if(!ready)return <main className="tpy-admin"><p>Verifying moderator access…</p></main>;
 if(!allowed)return <main className="tpy-admin"><Shield size={38}/><h1>Restricted area</h1><p>This page is available only to accounts authorized by the site operator.</p><Link href="/">Return to the app</Link></main>;
 return <main className="tpy-admin"><Link href="/"><ArrowLeft size={17}/> Back to the app</Link><h1><Shield/> Moderation center</h1><p className="muted">Reports are stored in the database. Review decisions are logged here; this screen does not automatically remove reported content.</p>
  <button className="secondary" onClick={()=>void reload()}><RefreshCw size={16}/> Refresh</button>
  <section className="social-card"><h2>Content and member reports ({reports.length})</h2>
   {reports.map(r=><div key={r.id} className="tpy-admin-case"><div><b>{r.status.toUpperCase()}</b> · {new Date(r.created_at).toLocaleString()}</div><p>{r.reason}</p><small>Reported post: {r.target_post_id||'—'} · Member: {r.target_user_id||'—'}</small><div className="action-row">{(['reviewing','resolved','dismissed'] as const).map(status=><button className="secondary" key={status} disabled={r.status===status} onClick={()=>void update(r,status)}>{status}</button>)}</div></div>)}
   {!reports.length&&<p className="muted">No reports currently visible.</p>}
  </section>
  <section className="social-card"><h2>Account deletion requests ({requests.length})</h2><p className="muted">These require manual, authenticated processing; the database does not automatically delete user accounts.</p>{requests.map(r=><div className="tpy-admin-case" key={r.user_id}>User {r.user_id} · {r.status} · {new Date(r.requested_at).toLocaleDateString()}</div>)}</section>
  {notice&&<p className="tpy-inline-note" role="alert">{notice}</p>}
 </main>;
}
