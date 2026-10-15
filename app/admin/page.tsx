import type {Metadata} from 'next';
import AdminPanel from '@/components/AdminPanel';
export const metadata:Metadata={title:'Moderation center',robots:{index:false,follow:false}};
export default function Admin(){return <AdminPanel/>;}
