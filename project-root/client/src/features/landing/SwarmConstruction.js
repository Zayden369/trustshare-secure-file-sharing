import React,{useEffect,useRef,useState} from 'react';
import {useReducedMotion} from 'framer-motion';
import {CONSTRUCTION_DURATION,AGENT_LABELS,constructionFrame} from './constructionSchedule';
import './swarm-construction.css';

const sampleFiles=['Project brief.pdf','Meeting notes.docx','Research outline.txt'];
export default function SwarmConstruction({agentCount}) {
  const root=useRef(null),stage=useRef(null),started=useRef(null),completed=useRef(false),skipRef=useRef(null);
  const reduced=useReducedMotion();
  const [done,setDone]=useState(false);
  useEffect(()=>{
    const node=root.current,scene=stage.current;
    if(!node||!scene)return;
    let raf=0,timer=0,visible=false,disposed=false;
    let size={width:scene.clientWidth,height:scene.clientHeight};
    const resize=typeof ResizeObserver==='undefined'?null:new ResizeObserver(entries=>{
      const rect=entries[0].contentRect;size={width:rect.width,height:rect.height};
    });
    resize?.observe(scene);
    const finish=()=>{completed.current=true;scene.dataset.complete='true';node.dataset.constructionState='complete';
      node.dataset.completedAt=String(Date.now());cancelAnimationFrame(raf);clearTimeout(timer);
      scene.querySelectorAll('[data-build]').forEach(el=>{el.style.setProperty('--build','1');});setDone(true);};
    skipRef.current=finish;
    const count=agentCount||((navigator.hardwareConcurrency||4)<4?6:window.innerWidth<600?5:window.innerWidth<1000?10:16);
    const cursors=Array.from(scene.querySelectorAll('[data-agent]'));
    const parts=Array.from(scene.querySelectorAll('[data-build]'));
    const paint=()=>{
      if(disposed||completed.current)return;
      const elapsed=Date.now()-started.current;
      if(elapsed>=CONSTRUCTION_DURATION){finish();return;}
      const frame=constructionFrame(elapsed,count);
      parts.forEach(el=>{const task=frame.tasks.find(t=>t.id===el.dataset.build);el.style.setProperty('--build',String(task?.progress??1));});
      cursors.forEach((el,i)=>{const a=frame.agents[i];el.style.opacity=String(a?.opacity||0);if(!a)return;
        el.style.transform=`translate3d(${a.x*size.width/100-2}px,${a.y*size.height/100-2}px,0)`;el.dataset.working=String(a.working);});
      node.dataset.elapsedMs=String(elapsed);
      if(visible&&!document.hidden)raf=requestAnimationFrame(paint);
    };
    const resume=()=>{cancelAnimationFrame(raf);if(started.current&&!completed.current)paint();};
    const activate=()=>{if(completed.current)return;if(started.current===null){started.current=Date.now();node.dataset.activatedAt=String(started.current);}
      node.dataset.constructionState='building';clearTimeout(timer);timer=setTimeout(finish,Math.max(0,CONSTRUCTION_DURATION-(Date.now()-started.current)));paint();};
    if(reduced||typeof IntersectionObserver==='undefined'){finish();resize?.disconnect();return()=>{skipRef.current=null;};}
    if(completed.current){finish();resize?.disconnect();return()=>{skipRef.current=null;};}
    const observer=new IntersectionObserver(entries=>{visible=entries[0].isIntersecting;if(visible){activate();resume();}else cancelAnimationFrame(raf);},{threshold:.12});
    observer.observe(node);document.addEventListener('visibilitychange',resume);
    return()=>{disposed=true;observer.disconnect();resize?.disconnect();clearTimeout(timer);cancelAnimationFrame(raf);document.removeEventListener('visibilitychange',resume);skipRef.current=null;};
  },[reduced,agentCount]);
  return <section className="construction" ref={root} id="construction" aria-labelledby="construction-heading">
    <div className="construction-intro"><div><span className="m-kicker">06 / A coordinated workspace</span><h2 id="construction-heading">Considered details.<br/><em>Working together.</em></h2></div><p>One interface, assembled with intention. A conceptual construction of the workspace you’re about to enter.</p></div>
    <div className="construction-toolbar"><span role="status">{done?'Workspace assembled':'Constructing the workspace'}</span><a href="#product" onClick={()=>skipRef.current?.()}>Skip to the workspace ↗</a></div>
    <div className="construction-stage" ref={stage} data-complete="false" aria-hidden="true">
      <div className="construction-shell" data-build="shell"/>
      <aside className="construction-sidebar" data-build="sidebar"><b>t.</b><span>TrustShare</span><div data-build="navigation">{['Dashboard','My Files','Sharing','Activity','Analytics'].map((s,i)=><p key={s}><i>{String(i+1).padStart(2,'0')}</i>{s}</p>)}</div></aside>
      <div className="construction-navbar" data-build="navbar"><span>⌕</span> Search your workspace <span>t.</span></div>
      <div className="construction-heading" data-build="heading"><small>Your private archive</small><h3>Space for your next idea.</h3></div>
      <span className="construction-control" data-build="controls">↑ Upload file</span>
      {['files','shares','storage'].map((label,i)=><div key={label} className={'construction-metric metric-'+i} data-build={'metric-'+label}><small>{['Documents','Shared links','Storage'][i]}</small><strong>{['03','02','24.6 MB'][i]}</strong><span>Illustrative preview</span></div>)}
      {sampleFiles.map((file,i)=><div className={'construction-file file-'+i} key={file} data-build={['file-brief','file-notes','file-plan'][i]}><svg viewBox="0 0 32 40"><path d="M4 1h16l8 8v30H4zM20 1v9h8M9 19h14M9 25h14M9 31h9"/></svg><span>{file}<small>{['PDF document','Word document','Text document'][i]}</small></span><i>⌑</i></div>)}
      <div className="construction-chart" data-build="chart"><span>Weekly activity / Example</span><svg viewBox="0 0 200 90"><path className="chart-grid" d="M0 20h200M0 45h200M0 70h200"/><path className="chart-line" d="M0 70L25 52 50 58 75 26 100 38 125 18 150 25 175 10 200 16"/></svg></div>
      <div className="construction-storage" data-build="storage"><span>A place for everything.</span><div/><small>Organize · protect · share</small></div>
      <div className="construction-detail" data-build="details">PRIVATE ARCHIVE / TRUSTSHARE <span>Built around your files.</span></div>
      <div className="construction-guides"><i/><i/><i/></div>
      {AGENT_LABELS.map((label,i)=><div key={label} data-agent={i} className="construction-cursor"><svg viewBox="0 0 24 30"><path d="M2 1L21 19 12 19 8 28z"/></svg><span>{label}</span><i/></div>)}
    </div><p className="construction-caption">Illustrative documents and metrics. Animated cursors are a conceptual visualization, not autonomous AI agents.</p>
  </section>;
}
