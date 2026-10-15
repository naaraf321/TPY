import type {Metadata} from 'next';
import SocialApp from '@/components/SocialApp';
export const metadata:Metadata={title:'Friends',robots:{index:false,follow:false}};
export default function Page(){return <SocialApp initialTab='friends'/>;}
