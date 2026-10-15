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
