import React, {useEffect, useRef, useState} from 'react';
import {useReducedMotion} from 'framer-motion';
import {AGENT_LABELS} from './constructionSchedule';
import {activateRegions, advanceConstruction, viewportTour, INTRO_DEADLINE} from './pageConstructionSchedule';
import './page-construction.css';

const registry = [
  ['.m-nav', '.m-wordmark, nav > a, .m-nav-actions > *'],
  ['.m-hero', '.m-hero-topline, .m-kicker, h1 > span, h1 > em, .m-hero-architecture, .m-hero-aside > p, .m-button, .m-hero-baseline'],
  ['.archive-journey', '.archive-journey-stage'],
  ['.archive-chapter', '.m-kicker, h2, p, .archive-chapter-note'],
  ['.m-cinematic', '.m-cinematic-heading, .cinematic-stage, .m-cinematic-caption'],
  ['.construction', '.construction-intro > *, .construction-toolbar, .construction-stage, .construction-caption'],
  ['.m-product', '.m-product-intro > *, .archive-product-chrome, .archive-product-sidebar, .archive-product-search, .archive-product-heading, .archive-product-panels > *, .archive-product-label, .m-preview-note'],
  ['.m-closing', '.archive-closing-document, .m-kicker, h2, .m-button, .m-text-link'],
  ['.m-footer', '.m-wordmark, span, div > *'],
];

export default function PageConstruction({page}) {
  const reduced = useReducedMotion();
  const [run, setRun] = useState(0), [percent, setPercent] = useState(0);
  const controls = useRef(null), overlay = useRef(null), finish = useRef(null);
  useEffect(() => {
    const root = page.current;
    if (!root) return;
    let raf = 0, disposed = false, complete = false, lastPercent = -1, deadline = 0;
    let automatic = !reduced && (run>0 || (window.scrollY < 2 && !window.location.hash)), travel = null, maximum = 0;
    const began = performance.now();
    let windowStarted = began, tour;
    const cursors = [...overlay.current.querySelectorAll('.page-agent')];
    const regions = [];
    registry.forEach(([selector, targets]) => root.querySelectorAll(selector).forEach((node, index) => {
      const region = {node, top:0, started:null, tasks:[]};
      [...node.querySelectorAll(targets)].forEach((target, i) => {
        const graphic = target.matches('svg, .m-hero-architecture, .archive-journey-stage, .cinematic-stage, .construction-stage');
        const essential = !!target.closest('.m-nav') || target.matches('a, button');
        const task = {id:`${selector}-${index}-${i}`, target, progress:0, lastPaint:-1, weight:graphic ? 3 : 1, duration:i===0 ? 380 : graphic ? 1800 : 1000 + i*45, delay:i*55, after:i ? `${selector}-${index}-0` : null, rect:null};
        target.classList.add('page-build-target');
        delete target.dataset.buildFinished;
        target.dataset.buildKind = essential ? 'outline' : graphic ? 'graphic' : 'type';
        target.style.setProperty('--assembled', '0');
        region.tasks.push(task);
      });
      regions.push(region);
    }));
    const measure = () => {
      maximum = Math.max(0, root.getBoundingClientRect().bottom + window.scrollY - window.innerHeight);
      regions.forEach(region => {
        region.top = region.node.getBoundingClientRect().top + window.scrollY;
        region.tasks.forEach(task => {
          const r = task.target.getBoundingClientRect();
          task.rect = {x:r.left, y:r.top+window.scrollY, width:r.width, height:r.height};
        });
      });
    };
    const hideCursors = () => cursors.forEach(cursor => {cursor.style.opacity='0';});
    const finishAll = () => {
      complete = true; cancelAnimationFrame(raf); clearTimeout(deadline); hideCursors();
      regions.forEach(region => region.tasks.forEach(task => {
        task.progress=1; task.target.style.setProperty('--assembled','1'); task.target.dataset.buildFinished='true';
      }));
      root.dataset.pageConstruction='complete'; root.dataset.autoScroll='complete';
      root.dataset.constructionElapsedMs=String(Math.round(performance.now()-began));
      delete root.dataset.constructionWindowMs;
      root.dispatchEvent(new Event('trustshare:finish-construction'));
      setPercent(100);
    };
    finish.current = finishAll;
    const paint = () => {
      if (disposed || complete) return;
      const time = performance.now();
      if (automatic && travel) {
        const p = Math.min(1, (time-travel.started)/tour.travel), eased = p*p*(3-2*p);
        window.scrollTo({top:travel.from+(travel.to-travel.from)*eased, behavior:'instant'});
        hideCursors();
        if(p<1){raf=requestAnimationFrame(paint);return;}
        travel=null; windowStarted=time; measure();
      }
      const top = window.scrollY, height = window.innerHeight;
      activateRegions(regions, top, height, top>=maximum-2, time);
      const frame = advanceConstruction(regions, time);
      regions.forEach(region => region.tasks.forEach(task => {
        if(task.lastPaint!==task.progress){
          task.target.style.setProperty('--assembled', String(task.progress));
          if(task.progress===1) task.target.dataset.buildFinished='true';
          task.lastPaint=task.progress;
        }
      }));
      if(frame.percent!==lastPercent){lastPercent=frame.percent;setPercent(frame.percent);}
      const visible = frame.working.filter(task=>task.rect.width>0 && task.rect.height>0 && task.rect.y+task.rect.height>top && task.rect.y<top+height);
      const budget = window.innerWidth<700 ? 6 : window.innerWidth<1050 ? 10 : (navigator.hardwareConcurrency||4)<4 ? 12 : 24;
      cursors.forEach((cursor,i)=>{
        const task=visible[i];
        if(!task || i>=budget){cursor.style.opacity='0';return;}
        // Cursor follows the exact advancing reveal edge / outline of its assigned target.
        const r=task.rect, p=task.progress, line=Math.min(3,Math.floor(p*4));
        const graphic=task.target.dataset.buildKind==='graphic';
        const x=r.x + r.width*(.12+.88*p);
        const y=r.y-top + (graphic ? r.height*(1-p) : Math.min(r.height-6,(line+.4)*r.height/4));
        cursor.style.transform=`translate3d(${Math.min(window.innerWidth-95,Math.max(4,x))}px,${y}px,0)`;
        cursor.style.opacity=String(Math.min(1,p*10,(1-p)*10));
        cursor.querySelector('span').textContent=AGENT_LABELS[i%AGENT_LABELS.length];
        cursor.dataset.task=task.id;
      });
      if(frame.percent===100 && (!automatic || top>=maximum-2)){finishAll();return;}
      const visiblePending = regions.some(region=>region.started!==null && region.tasks.some(task=>task.progress<1 && task.rect.y+task.rect.height>top && task.rect.y<top+height)) ||
        regions.some(region=>region.node.dataset.constructionState==='building' && region.tasks.some(task=>task.target.matches('.construction-stage') && task.rect.y+task.rect.height>top && task.rect.y<top+height));
      if(automatic && !visiblePending && time-windowStarted>=tour.hold){
        const next=tour.positions.find(position=>position>top+2) ?? maximum;
        if(next<=top+2){finishAll();return;}
        travel={from:top,to:Math.min(next,maximum),started:time};
      }
      const pending=regions.some(region=>region.started!==null && region.tasks.some(task=>task.progress<1));
      if(!document.hidden && (pending || automatic)) raf=requestAnimationFrame(paint);
    };
    const resume=()=>{cancelAnimationFrame(raf);if(!complete)paint();};
    const update=()=>{if(!travel)measure();if(!automatic)resume();};
    const stopAutomatic=()=>{automatic=false;travel=null;root.dataset.autoScroll='stopped';};
    const onKey=event=>{if(['ArrowUp','ArrowDown','PageUp','PageDown','Home','End',' ','Escape'].includes(event.key))stopAutomatic();};
    root.dataset.pageConstruction='building';
    delete root.dataset.constructionElapsedMs;
    measure();
    if(reduced){finishAll();return()=>{finish.current=null;};}
    tour=viewportTour(maximum+window.innerHeight,window.innerHeight);
    const longest=Math.max(1,...regions.flatMap(region=>region.tasks.map(task=>task.delay+task.duration+(region.tasks.find(item=>item.id===task.after)?.duration||0))));
    const scale=Math.min(1,tour.hold*.8/longest);
    regions.forEach(region=>region.tasks.forEach(task=>{task.duration*=scale;task.delay*=scale;}));
    root.dataset.constructionWindowMs=String(tour.hold*.8);
    root.dataset.autoScroll=automatic?'playing':'stopped';
    root.dispatchEvent(new Event('trustshare:replay-construction'));
    deadline=setTimeout(()=>{if(automatic){measure();window.scrollTo({top:maximum,behavior:'instant'});}finishAll();},Math.max(0,INTRO_DEADLINE-(performance.now()-began)));
    // Layout is measured on scroll/resize, never inside the animation frame.
    window.addEventListener('scroll',update,{passive:true});
    window.addEventListener('resize',update);
    document.addEventListener('visibilitychange',resume);
    window.addEventListener('wheel',stopAutomatic,{passive:true});
    window.addEventListener('touchstart',stopAutomatic,{passive:true});
    window.addEventListener('pointerdown',stopAutomatic,{passive:true});
    window.addEventListener('keydown',onKey);
    const resize = typeof ResizeObserver==='undefined' ? null : new ResizeObserver(update);
    resize?.observe(root);
    paint();
    return()=>{
      disposed=true;cancelAnimationFrame(raf);clearTimeout(deadline);resize?.disconnect();
      window.removeEventListener('scroll',update);window.removeEventListener('resize',update);document.removeEventListener('visibilitychange',resume);
      window.removeEventListener('wheel',stopAutomatic);window.removeEventListener('touchstart',stopAutomatic);window.removeEventListener('pointerdown',stopAutomatic);window.removeEventListener('keydown',onKey);
      delete root.dataset.constructionWindowMs;
      finish.current=null;
      regions.forEach(region=>region.tasks.forEach(task=>{task.target.classList.remove('page-build-target');delete task.target.dataset.buildFinished;task.target.style.removeProperty('--assembled');}));
    };
  }, [page, reduced, run]);
  const replay=()=>{
    finish.current?.();setPercent(0);
    window.scrollTo({top:0,behavior:'instant'});setRun(value=>value+1);
  };
  const skip=()=>{
    finish.current?.();
  };
  return <>
    <div className="page-construction-agents" ref={overlay} aria-hidden="true">{Array.from({length:24},(_,i)=><div className="page-agent" key={i}><svg viewBox="0 0 24 30"><path d="M2 1L21 19 12 19 8 28z"/></svg><span>{AGENT_LABELS[i%16]}</span></div>)}</div>
    <aside className="page-construction-controls" ref={controls} aria-label="Homepage animation controls">
      <div><span aria-live="off">{percent===100?'Experience assembled':`Constructing experience — ${percent}%`}</span><i style={{'--progress':`${percent}%`}}/></div>
      {percent<100 && <button onClick={skip}>Skip animation</button>}
      <button onClick={replay}>Replay full experience</button>
    </aside>
  </>;
}
