import type {Metadata} from 'next';
export const metadata:Metadata={title:'Discover a different kind of social world',description:'A location-based community experience with neighborhood discovery, public stories, friend connections and private conversations.'};
export default function SEOPage(){return <main className="tpy-info-page" style={{maxWidth:800,margin:'40px auto',padding:'20px 24px',lineHeight:1.85}}>
 <a href="/">← Home</a><p className="eyebrow">DISCOVER · CONNECT · BELONG</p><h1>The Pussy Is Yours</h1>
 <p>Explore nearby communities through an interactive street map, choose a public identity, publish posts and stories, and keep in touch with friends through private messaging.</p>
 <h2>Discover people near you</h2><p>Browse approximate neighborhood markers. Our map never displays precise GPS coordinates publicly, and members can hide their map pin.</p>
 <h2>Share at your pace</h2><p>Publish text, photographs and videos for everyone, confirmed friends, or yourself. React to posts, leave comments, and save moments worth keeping.</p>
 <h2>Built for meaningful connections</h2><p>Manage follow lists, send friend requests, exchange messages and voice notes, and control account and notification settings. Voice and video calls are not part of the product.</p>
 <p>Some functionality remains in controlled testing. Review our <a href="/privacy">privacy disclosure</a> and <a href="/terms">terms</a> before joining.</p>
 </main>}
