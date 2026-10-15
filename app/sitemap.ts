import type {MetadataRoute} from 'next';
import {createClient} from '@supabase/supabase-js';
export default async function sitemap():Promise<MetadataRoute.Sitemap>{
 if(process.env.NEXT_PUBLIC_ALLOW_INDEXING!=='true')return [];
 const base=(process.env.NEXT_PUBLIC_SITE_URL||'https://thepussyisyours.com').replace(/\/$/,'');
 const pages:MetadataRoute.Sitemap=[{url:base,changeFrequency:'weekly',priority:1},{url:`${base}/seo`,changeFrequency:'monthly',priority:.6},{url:`${base}/privacy`,changeFrequency:'monthly',priority:.4},{url:`${base}/terms`,changeFrequency:'monthly',priority:.4}];
 const url=process.env.NEXT_PUBLIC_SUPABASE_URL;const key=process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY||process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
 if(!url||!key)return pages;
 try{
  const db=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
  const {data,error}=await db.from('tgy_posts').select('id,created_at').eq('visibility','public').order('created_at',{ascending:false}).limit(300);
  if(!error)for(const p of data||[])pages.push({url:`${base}/p/${p.id}`,lastModified:new Date(p.created_at),changeFrequency:'weekly',priority:.5});
 }catch{/* Fail closed: static pages remain in sitemap. */}
 return pages;
}
