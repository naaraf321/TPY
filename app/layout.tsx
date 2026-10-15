import './globals.css';
import type {Metadata, Viewport} from 'next';
const ORIGIN=process.env.NEXT_PUBLIC_SITE_URL?.startsWith('https://')?process.env.NEXT_PUBLIC_SITE_URL:'https://thepussyisyours.com';
const indexable=process.env.NEXT_PUBLIC_ALLOW_INDEXING==='true';
export const metadata:Metadata={
 title:{default:'The Pussy Is Yours — Discover. Connect. Belong.',template:'%s | The Pussy Is Yours'},
 description:'Discover people through nearby neighborhoods. Share photos, stories and posts. Connect with friends and private chats.',
 metadataBase:new URL(ORIGIN),
 applicationName:'The Pussy Is Yours',
 keywords:['social discovery','social network','nearby people','stories','friends','community'],
 icons:{icon:'/brand-mark.svg',shortcut:'/brand-mark.svg'},
 manifest:'/manifest.webmanifest',
 robots:{index:indexable,follow:indexable},
 openGraph:{title:'The Pussy Is Yours',description:'Discover. Connect. Belong.',url:ORIGIN,siteName:'The Pussy Is Yours',locale:'en_US',type:'website'},
 twitter:{card:'summary_large_image',title:'The Pussy Is Yours',description:'Discover. Connect. Belong.'},
};
export const viewport:Viewport={width:'device-width',initialScale:1,themeColor:'#171419'};
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="en"><body>{children}</body></html>;}
