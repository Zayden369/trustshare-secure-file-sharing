import React,{useRef} from 'react';
import {motion,useReducedMotion,useScroll,useTransform} from 'framer-motion';


/** A document, its boundary and its authorized destinations share one coordinate system. */
export default function LivingArchive(){
  const ref=useRef(null),reduced=useReducedMotion();
  const {scrollYProgress}=useScroll({target:ref,offset:['start end','end start']});
  const turn=useTransform(scrollYProgress,[0,1],[-12,18]);
  const spread=useTransform(scrollYProgress,[0,.6,1],[0,20,60]);
  return <svg ref={ref} className="living-archive" viewBox="0 0 640 640" fill="none" role="img" aria-label="Living archive: a document connects to protected destinations through layered orbital architecture">
    <defs><linearGradient id="archive-surface" x1="0" y1="0" x2="1" y2="1"><stop stopColor="var(--surface-primary)"/><stop offset="1" stopColor="var(--surface-secondary)"/></linearGradient></defs>
    <g className="living-guides"><path d="M50 500H590M320 40V600M100 530L555 140M70 180L550 490"/><circle cx="320" cy="320" r="258" strokeDasharray="2 12"/></g>
    <motion.g style={{rotate:reduced?0:turn,transformOrigin:'320px 320px'}}>
      <g className="living-orbits"><ellipse cx="320" cy="340" rx="245" ry="100" transform="rotate(-32 320 340)"/><ellipse cx="320" cy="340" rx="238" ry="125" transform="rotate(34 320 340)"/><ellipse cx="320" cy="340" rx="140" ry="240" transform="rotate(24 320 340)"/></g>
      {[0,1,2].map(i=><motion.g key={i} style={{y:reduced?i*12:spread}}><path d={`M${174+i*9} ${282+i*34}L${343+i*4} ${198+i*34}L${474+i*6} ${276+i*34}L${297+i*4} ${370+i*34}Z`} fill="url(#archive-surface)" stroke="var(--border-strong)"/><path d={`M${184+i*9} ${288+i*34}L${296+i*4} ${352+i*34}L${461+i*6} ${274+i*34}`} stroke="var(--border)"/></motion.g>)}
      <g className="living-document" transform="translate(260 188) rotate(-8)"><path d="M0 0H78L105 28V145H0Z" fill="var(--surface-primary)" stroke="var(--text-secondary)"/><path d="M78 0V28H105M18 65H85M18 77H85M18 89H67M18 113H46" stroke="var(--text-muted)"/><text x="17" y="45">PROJECT / 001</text><path d="M17 16h22" stroke="var(--accent)" strokeWidth="3"/></g>
      <path className="living-boundary" d="M232 166H378V365H232Z" strokeDasharray="4 7"/>
      <g className="living-network"><path d="M236 300L106 252M372 290L520 224M330 390L438 490"/>{[[106,252],[520,224],[438,490]].map(([x,y],i)=><g key={i}><circle cx={x} cy={y} r="17" fill="var(--background)"/><circle cx={x} cy={y} r="4" fill="var(--accent)"/><text x={x} y={y+34} textAnchor="middle">{['SOURCE','AUTHORIZED','WORKSPACE'][i]}</text></g>)}</g>
    </motion.g>
    <g className="living-labels"><text x="60" y="80">LIVING ARCHIVE / T.01</text><text x="60" y="566">ONE FILE. DELIBERATE CONNECTIONS.</text><path d="M60 90H125M60 547H580"/></g>
  </svg>;
}
