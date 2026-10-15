import {ImageResponse} from 'next/og';
export const size={width:1200,height:630};
export const contentType='image/png';
export default function Image(){
 return new ImageResponse(<div style={{width:'100%',height:'100%',display:'flex',alignItems:'center',justifyContent:'center',flexDirection:'column',background:'linear-gradient(125deg,#171219 10%,#362432 100%)',color:'#f8e3dc',fontFamily:'Georgia,serif'}}>
  <div style={{display:'flex',border:'3px solid #cf9d9f',width:115,height:115,borderRadius:32,alignItems:'center',justifyContent:'center',fontSize:84,marginBottom:30}}>P</div>
  <div style={{display:'flex',fontSize:72,letterSpacing:2}}>The Pussy Is Yours</div>
  <div style={{display:'flex',fontSize:26,letterSpacing:9,marginTop:27,color:'#c9afb4'}}>DISCOVER · CONNECT · BELONG</div>
 </div>,size);
}
