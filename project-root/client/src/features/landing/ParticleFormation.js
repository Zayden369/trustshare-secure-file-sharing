import React, { useEffect, useRef, useState } from 'react';
import { useScroll, useReducedMotion } from 'framer-motion';
import { useTheme } from '../../context/ThemeContext';

const TAU = Math.PI * 2;
const mix = (a,b,t) => a+(b-a)*t;
const smooth = v => { const x=Math.max(0,Math.min(1,v)); return x*x*(3-2*x); };

// Deterministic formations: no per-frame randomness or React state updates.
export function formationPoint(i,count,progress,time=0,pointer={x:0,y:0}){
  const row=Math.floor(i/60),angle=(i%60)/59*TAU;
  const ring=row/Math.max(1,Math.ceil(count/60)-1), tilt=(ring-.5)*1.5;
  const a=[Math.cos(angle)*(.45+ring*.4),Math.sin(angle)*.35+tilt*.45,Math.sin(angle)*.5];
  const b=[(i%60)/59*2-1,Math.sin(angle*.65+ring*3+time*.2)*.25+(ring-.5),Math.cos(angle+ring*2)*.25];
  const c=[(i%60)/59*1.5-.75,(ring-.5)*1.4,Math.floor(ring*5)*.06];
  const phase=Math.min(1,Math.max(0,progress))*2, t=smooth(phase%1);
  const start=phase<1?a:b,end=phase<1?b:c,blend=phase===2?1:t;
  const x=mix(start[0],end[0],blend),y=mix(start[1],end[1],blend),z=mix(start[2],end[2],blend);
  const turn=.32+Math.sin(time*.16)*.1+pointer.x*.15;
  return {x:x*Math.cos(turn)+z*Math.sin(turn),y:y+pointer.y*.04,z:z};
}

export default function ParticleFormation(){
  const section=useRef(null),canvas=useRef(null),progress=useRef(0),pointer=useRef({x:0,y:0});
  const [ready,setReady]=useState(false);
  const reduced=useReducedMotion();
  const {theme}=useTheme();
  const {scrollYProgress}=useScroll({target:section,offset:['start 70%','end 20%']});
  useEffect(()=>{progress.current=scrollYProgress.get();return scrollYProgress.on('change',v=>{progress.current=v;});},[scrollYProgress]);
  useEffect(()=>{
    const node=canvas.current;
    if(!node||typeof ResizeObserver==='undefined'||typeof IntersectionObserver==='undefined')return;
    const ctx=node.getContext('2d');
    if(!ctx)return;
    let width=0,height=0,raf=0,visible=false,disposed=false;
    const desktopCount=(navigator.hardwareConcurrency||4)<4?480:900;
    let count=window.matchMedia('(max-width:700px)').matches?360:desktopCount;
    const dpr=Math.min(window.devicePixelRatio||1,1.5);
    let ink='245,245,245';
    const paint=time=>{
      if(disposed)return;
      ctx.clearRect(0,0,width,height);
      const phase=reduced?1:progress.current;
      const scale=Math.min(width*.43,height*.42);
      for(let i=0;i<count;i++){
        const p=formationPoint(i,count,phase,reduced?0:time*.001,reduced?{x:0,y:0}:pointer.current);
        const opacity=Math.max(.15,Math.min(.9,.62-p.z*.45));
        ctx.fillStyle=`rgba(${ink},${opacity})`;
        if(i%60===59)continue;
        const q=formationPoint(i+1,count,phase,reduced?0:time*.001,reduced?{x:0,y:0}:pointer.current);
        ctx.strokeStyle=i%240<60?(theme==='light'?'rgba(79,70,229,.55)':'rgba(165,180,252,.65)'):`rgba(${ink},${opacity*.5})`;
        ctx.lineWidth=.75;if(i%60===0){ctx.beginPath();ctx.moveTo(width/2+p.x*scale,height/2+p.y*scale);}ctx.lineTo(width/2+q.x*scale,height/2+q.y*scale);if(i%60===58)ctx.stroke();
      }
      if(!reduced&&visible)raf=requestAnimationFrame(paint);
    };
    const resize=()=>{
      count=window.matchMedia('(max-width:700px)').matches?450:desktopCount;
      const rect=node.getBoundingClientRect();width=rect.width;height=rect.height;
      node.width=Math.round(width*dpr);node.height=Math.round(height*dpr);ctx.setTransform(dpr,0,0,dpr,0,0);
      ink=theme==='light'?'20,20,20':'245,245,245';
      if(!raf)paint(0);
    };
    const resizeObserver=new ResizeObserver(resize);resizeObserver.observe(node);resize();
    const observer=new IntersectionObserver(entries=>{
      visible=entries[0].isIntersecting;
      cancelAnimationFrame(raf);raf=0;
      if(visible){paint(performance.now());setReady(true);}
    },{rootMargin:'80px'});
    observer.observe(node);
    return()=>{disposed=true;observer.disconnect();resizeObserver.disconnect();cancelAnimationFrame(raf);};
  },[reduced,theme]);
  return <section className="m-particle-scene" ref={section} id="formation"><div className="m-particle-heading"><span className="m-kicker">Order, from possibility</span><h2>Structure, in motion.<br/><em>Connection, by design.</em></h2></div><div className="m-particle-field" onPointerMove={e=>{const r=e.currentTarget.getBoundingClientRect();pointer.current={x:(e.clientX-r.left)/r.width-.5,y:(e.clientY-r.top)/r.height-.5};}} onPointerLeave={()=>{pointer.current={x:0,y:0};}}><svg viewBox="-1.3 -1.2 2.6 2.4" className={ready?'m-particle-fallback is-rendered':'m-particle-fallback'} aria-hidden="true">{Array.from({length:14},(_,i)=><ellipse key={i} cx="0" cy="0" rx={.4+i*.035} ry={.15+i*.035} fill="none" stroke="currentColor" strokeWidth=".003" transform={`rotate(${i*8})`}/>)}</svg><canvas ref={canvas} role="img" aria-label="Architectural data sculpture: layered orbital paths unfold into a flowing wireframe and organized file planes"/></div><div className="m-particle-caption"><span>Distributed → connected → structured</span><p>This is a conceptual visualization. It does not represent an autonomous AI swarm.</p></div></section>;
}
