import React, { useEffect, useRef, useState } from 'react';
import { useScroll, useReducedMotion } from 'framer-motion';
import { useTheme } from '../../context/ThemeContext';

const TAU = Math.PI * 2;
const mix = (a,b,t) => a+(b-a)*t;
const smooth = v => { const x=Math.max(0,Math.min(1,v)); return x*x*(3-2*x); };

// Deterministic formations: no per-frame randomness or React state updates.
export function formationPoint(i,count,progress,time=0,pointer={x:0,y:0}){
  const u=(i+.5)/count, v=(i*.61803398875)%1, angle=v*TAU, phi=((i*.754877666)%1)*TAU;
  const cloudR=.7+((i*.41421356)%1)*.5;
  const cloud=[Math.cos(angle)*cloudR,Math.sin(angle)*cloudR*.75,Math.sin(phi)*.6];
  const radius=.63+.22*Math.cos(phi);
  const ring=[Math.cos(angle)*radius,Math.sin(angle)*radius,Math.sin(phi)*.22];
  const sy=u*1.8-.9;
  const halfWidth=sy<.15?.73:(.95-sy)*.91;
  const shield=[(v*2-1)*halfWidth,sy,Math.sin(phi)*.12];
  const t1=smooth(progress/.45),t2=smooth((progress-.45)/.55);
  let x=mix(mix(cloud[0],ring[0],t1),shield[0],t2);
  let y=mix(mix(cloud[1],ring[1],t1),shield[1],t2);
  const z=mix(mix(cloud[2],ring[2],t1),shield[2],t2);
  const turn=Math.sin(time*.16)*.16+pointer.x*.12;
  const rx=x*Math.cos(turn)+z*Math.sin(turn);
  const rz=-x*Math.sin(turn)+z*Math.cos(turn);
  y+=Math.sin(time*.24+v*TAU)*.009+pointer.y*.025;
  const perspective=2.6/(2.6+rz);
  return {x:rx*perspective,y:y*perspective,z:rz};
}

export default function ParticleFormation(){
  const section=useRef(null),canvas=useRef(null),progress=useRef(0),pointer=useRef({x:0,y:0});
  const [ready,setReady]=useState(false);
  const reduced=useReducedMotion();
  const {theme}=useTheme();
  const {scrollYProgress}=useScroll({target:section,offset:['start 85%','end 25%']});
  useEffect(()=>scrollYProgress.on('change',v=>{progress.current=v;}),[scrollYProgress]);
  useEffect(()=>{
    const node=canvas.current;
    if(!node||typeof ResizeObserver==='undefined'||typeof IntersectionObserver==='undefined')return;
    const ctx=node.getContext('2d');
    if(!ctx)return;
    let width=0,height=0,raf=0,visible=false,disposed=false;
    const mobile=window.matchMedia('(max-width:700px)').matches;
    const count=mobile?450:((navigator.hardwareConcurrency||4)<4?800:1800);
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
        const radius=.55+(1-p.z)*.36;
        ctx.beginPath();ctx.arc(width/2+p.x*scale,height/2+p.y*scale,radius,0,TAU);ctx.fill();
      }
      if(!reduced&&visible)raf=requestAnimationFrame(paint);
    };
    const resize=()=>{
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
  return <section className="m-particle-scene" ref={section} id="formation"><div className="m-particle-heading"><span className="m-kicker">06 / Order, from possibility</span><h2>Many individual files.<br/><em>One considered whole.</em></h2></div><div className="m-particle-field" onPointerMove={e=>{const r=e.currentTarget.getBoundingClientRect();pointer.current={x:(e.clientX-r.left)/r.width-.5,y:(e.clientY-r.top)/r.height-.5};}} onPointerLeave={()=>{pointer.current={x:0,y:0};}}><svg viewBox="-1.3 -1.2 2.6 2.4" className={ready?'m-particle-fallback is-rendered':'m-particle-fallback'} aria-hidden="true">{Array.from({length:220},(_,i)=>{const p=formationPoint(i,220,1);return <circle key={i} cx={p.x} cy={p.y} r=".006" fill="currentColor"/>;})}</svg><canvas ref={canvas} role="img" aria-label="Monochrome particles coordinate from a dispersed field into a ring and a shield formation"/></div><div className="m-particle-caption"><span>Distributed → connected → structured</span><p>This is a conceptual visualization. It does not represent an autonomous AI swarm.</p></div></section>;
}
