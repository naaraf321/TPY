'use client';
import {useEffect,useRef,useState} from 'react';
import type {Person} from '@/lib/data';
import type {Map as LeafletMap,LayerGroup} from 'leaflet';
import 'leaflet/dist/leaflet.css';

type Props={people:Person[];center:[number,number];ownLocation:[number,number]|null;onSelect:(person:Person)=>void};
const tiles=process.env.NEXT_PUBLIC_MAP_TILE_URL||'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
const attribution=process.env.NEXT_PUBLIC_MAP_ATTRIBUTION||'&copy; OpenStreetMap contributors';
const backupTiles='https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png';

// Leaflet animations can produce NaN coordinates when a mobile map is hidden
// (zero-sized container). GPS and database positions must also be finite.
const validPoint=(lat:number,lng:number)=>Number.isFinite(lat)&&Number.isFinite(lng)&&lat>=-90&&lat<=90&&lng>=-180&&lng<=180;
const visibleSize=(node:HTMLElement|null)=>{
 if(!node)return false;
 const rect=node.getBoundingClientRect();
 return rect.width>0&&rect.height>0;
};

/** Identical buildings / GPS positions do not imply the same user. Markers cluster visually,
 * while every account retains its own distinct ID. We never infer someone's floor. */
export default function StreetMap({people,center,ownLocation,onSelect}:Props){
 const host=useRef<HTMLDivElement>(null);
 const mapRef=useRef<LeafletMap|null>(null);
 const layerRef=useRef<LayerGroup|null>(null);
 const peopleRef=useRef(people);peopleRef.current=people;
 const onSelectRef=useRef(onSelect);onSelectRef.current=onSelect;
 const ownRef=useRef(ownLocation);ownRef.current=ownLocation;
 const [ready,setReady]=useState(false);
 const [failure,setFailure]=useState('');
 useEffect(()=>{
  let cancelled=false;
  let activeMap:LeafletMap|null=null;
  let disposeResize:(()=>void)|null=null;
  import('leaflet').then(L=>{
   if(cancelled||!host.current)return;
   activeMap=L.map(host.current,{zoomControl:false,scrollWheelZoom:true,worldCopyJump:true,preferCanvas:true});
   mapRef.current=activeMap;
   const leafletMap=activeMap;
   // The tile error event catches blocked/unavailable providers instead of showing a blank panel.
   let failedTiles=0;
   let fallbackStarted=false;
   let fallbackErrors=0;
   const initial=L.tileLayer(tiles,{maxZoom:19,attribution,crossOrigin:true});
   initial.on('tileerror',()=>{
    failedTiles++;
    if(failedTiles>=3&&!fallbackStarted){
     fallbackStarted=true;
     setFailure('Primary map tiles are unavailable. Switching to a backup street map…');
     const backup=L.tileLayer(backupTiles,{maxZoom:20,maxNativeZoom:19,attribution:'&copy; OpenStreetMap contributors &copy; CARTO',subdomains:'abcd'});
     backup.on('tileload',()=>{setFailure('');initial.remove();});
     backup.on('tileerror',()=>{fallbackErrors++;if(fallbackErrors>=3)setFailure('Map tiles cannot load. Check your internet connection, browser extensions, and tile-provider access.');});
     backup.addTo(leafletMap);
    }
   });
   initial.addTo(leafletMap);
   L.control.zoom({position:'bottomright'}).addTo(leafletMap);
   const start=validPoint(center[0],center[1])?center:validPoint(ownRef.current?.[0]??NaN,ownRef.current?.[1]??NaN)?ownRef.current!:[20,0] as [number,number];
   leafletMap.setView(start,ownRef.current&&validPoint(ownRef.current[0],ownRef.current[1])?15:4,{animate:false});
   const layer=L.layerGroup().addTo(leafletMap);layerRef.current=layer;
   const render=()=>{
    layer.clearLayers();
    const used=new Set<string>();
    const points=peopleRef.current.filter(p=>validPoint(p.lat,p.lng));
    // Group markers closer than 36 pixels at this zoom, instead of stacking them.
    for(const person of points){
     if(used.has(person.id))continue;
     const centerPixel=leafletMap.project([person.lat,person.lng],leafletMap.getZoom());
     const group=points.filter(p=>!used.has(p.id)&&centerPixel.distanceTo(leafletMap.project([p.lat,p.lng],leafletMap.getZoom()))<36);
     group.forEach(p=>used.add(p.id));
     const icon=group.length>1
       ?L.divIcon({className:'tgy-cluster',html:`<span>${group.length}</span>`,iconSize:[37,37],iconAnchor:[18,18]})
       :L.divIcon({className:'tgy-pin',html:'<span class="tgy-map-dot"></span>',iconSize:[23,23],iconAnchor:[11,11]});
     const marker=L.marker([person.lat,person.lng],{icon,title:group.length>1?`${group.length} people in this area`:'Person nearby'}).addTo(layer);
     marker.on('click',()=>{
      if(group.length===1){onSelectRef.current(group[0]);return;}
      if(leafletMap.getZoom()<15){leafletMap.setView([person.lat,person.lng],Math.min(17,leafletMap.getZoom()+3),{animate:false});return;}
      const popup=document.createElement('div');popup.className='map-people-popup';
      const heading=document.createElement('strong');heading.textContent=`${group.length} members nearby`;popup.appendChild(heading);
      for(const p of group){
       const item=document.createElement('button');item.type='button';item.textContent=p.name==='Nearby member'?'View member':p.name;
       item.addEventListener('click',()=>{leafletMap.closePopup();onSelectRef.current(p);});popup.appendChild(item);
      }
      L.popup().setLatLng([person.lat,person.lng]).setContent(popup).openOn(leafletMap);
     });
    }
    if(ownRef.current&&validPoint(ownRef.current[0],ownRef.current[1])){
     const pos=ownRef.current;
     L.circle(pos,{radius:100,color:'#5888f6',fillColor:'#5888f6',fillOpacity:0.07,weight:1}).addTo(layer);
     L.marker(pos,{icon:L.divIcon({className:'tgy-pin tgy-pin-me',html:'<span class="tgy-map-dot"></span>',iconSize:[28,28],iconAnchor:[14,14]}),title:'Your exact position (visible to you only)'}).addTo(layer);
    }
   };
   // Save as property locally for follow-up effects without importing Leaflet twice.
   (leafletMap as LeafletMap & {tgyRender?:()=>void}).tgyRender=render;
   leafletMap.on('zoomend moveend',render);render();
   const observer=new ResizeObserver(()=>{if(!cancelled&&visibleSize(host.current)){leafletMap.invalidateSize({pan:false});render();}});observer.observe(host.current!);
   disposeResize=()=>observer.disconnect();
   setReady(true);setTimeout(()=>{if(!cancelled&&visibleSize(host.current))leafletMap.invalidateSize({pan:false});},80);
  }).catch(()=>{if(!cancelled)setFailure('Street map could not load. Install leaflet and verify your internet connection.');});
  return()=>{cancelled=true;disposeResize?.();activeMap?.remove();mapRef.current=null;layerRef.current=null;};
 // Construct map once, update coordinates separately.
 // eslint-disable-next-line react-hooks/exhaustive-deps
 },[]);
 useEffect(()=>{
  const map=mapRef.current;
  // In the Home page, the discovery sidebar is display:none on mobile.
  // Never call Leaflet camera animations on a zero-width map, or on invalid GPS.
  if(!ready||!map||!visibleSize(host.current)||!validPoint(center[0],center[1]))return;
  const existingZoom=map.getZoom();
  if(!Number.isFinite(existingZoom))return;
  const zoom=ownLocation&&validPoint(ownLocation[0],ownLocation[1])?Math.max(15,existingZoom):Math.max(4,existingZoom);
  map.setView(center,Math.min(18,zoom),{animate:false});
 },[center[0],center[1],ownLocation?.[0],ownLocation?.[1],ready]);
 useEffect(()=>{(mapRef.current as (LeafletMap & {tgyRender?:()=>void})|null)?.tgyRender?.();},[people,ownLocation,ready]);
 return <div className="street-map" aria-label="Interactive street map of roads and mapped building footprints"><div ref={host} className="street-map-canvas"/>
  {!ready&&!failure&&<div className="street-map-status">Loading streets…</div>}
  {failure&&<div className="street-map-status">{failure}</div>}
  <div className="street-map-hint">Public pins show nearby areas, not precise homes or floors. Zoom in for streets and buildings.</div>
 </div>;
}
