import Link from 'next/link';

type BrandProps={compact?:boolean;className?:string};
/** Original feline-heart logo. Kept as vectors for crisp scaling and accessibility. */
export function BrandMark({size=48}:{size?:number}){
 return <svg width={size} height={size} viewBox="0 0 64 64" role="img" aria-label="The Pussy Is Yours brand emblem" xmlns="http://www.w3.org/2000/svg">
  <defs><linearGradient id="tpyCatGlow" x1="0" y1="0" x2="64" y2="64" gradientUnits="userSpaceOnUse"><stop stopColor="#ff89c5"/><stop offset="1" stopColor="#ed3294"/></linearGradient></defs>
  <path d="M11 5 23 15C29 13 35 13 41 15L53 5 55 27C58 33 56 44 51 49L41 58H23L13 49C8 44 6 33 9 27Z" fill="url(#tpyCatGlow)"/>
  <path d="M18 29c2 12 8 20 14 24 6-4 12-12 14-24" fill="none" stroke="#270e27" strokeWidth="4.5" strokeLinecap="round"/>
  <path d="M18 24c4 0 7 2 9 5M46 24c-4 0-7 2-9 5" fill="none" stroke="#270e27" strokeWidth="4" strokeLinecap="round"/>
  <path d="M30 31 32 33 34 31" fill="none" stroke="#270e27" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round"/>
 </svg>;
}
export default function Brand({compact=false,className=''}:BrandProps){
 return <Link href="/" className={`tpy-brand ${className}`} aria-label="The Pussy Is Yours home">
  <BrandMark size={compact?34:48}/>{!compact&&<span className="tpy-brand-name"><span>The</span><b>Pussy</b><span>Is Yours</span></span>}
 </Link>;
}
