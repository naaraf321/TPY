import type {Metadata} from 'next';
import SocialApp from '@/components/SocialApp';
export const metadata:Metadata={title:'Messages',robots:{index:false,follow:false}};
export default function Page(){return <SocialApp initialTab='messages'/>;}
