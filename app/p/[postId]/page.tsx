import type {Metadata} from 'next';
import SocialApp from '@/components/SocialApp';
import {createClient} from '@supabase/supabase-js';
type Params={params:Promise<{postId:string}>};
export async function generateMetadata({params}:Params):Promise<Metadata>{
 const {postId}=await params;
 const url=process.env.NEXT_PUBLIC_SUPABASE_URL;
 const key=process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY||process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
 let description='Explore a community post on The Pussy Is Yours.';
 if(url&&key&&/^[0-9a-f-]{36}$/.test(postId)){
  // Public, anonymous API key reads ONLY public posts through Supabase RLS.
  const db=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
  const {data}=await db.from('tgy_posts').select('body,visibility').eq('id',postId).eq('visibility','public').maybeSingle();
  if(data?.body)description=data.body.slice(0,155);
 }
 return {title:'Community post',description,openGraph:{title:'Community post | The Pussy Is Yours',description,type:'article'},robots:{index:false,follow:false}};
}
export default async function PostPage({params}:Params){const {postId}=await params;return <SocialApp initialPostId={postId}/>;}
