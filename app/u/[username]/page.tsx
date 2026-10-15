import type {Metadata} from 'next';
import SocialApp from '@/components/SocialApp';
type Params={params:Promise<{username:string}>};
export async function generateMetadata({params}:Params):Promise<Metadata>{
 const {username}=await params;
 // Do not expose private profile details to search engines while sign-in is required.
 return {title:`@${username} · The Pussy Is Yours`,description:'Sign in to connect with this member on The Pussy Is Yours.',robots:{index:false,follow:false}};
}
export default async function MemberPage({params}:Params){const {username}=await params;return <SocialApp initialUsername={decodeURIComponent(username)}/>;}
