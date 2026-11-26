// One continuous narrative replaces the former abstract wave sculpture.
import React,{useRef,useEffect,useState} from 'react';
import {motion,useScroll,useTransform,useReducedMotion} from 'framer-motion';
import {cinematicFrame,STORY_STAGES} from './cinematicSchedule';
import './cinematic-story.css';

const copy=[
  ['Individual information.','A brief, a presentation, a photograph. Distinct files, each with a purpose.'],
  ['Everything finds its place.','Independent documents resolve into a considered collection. Order without losing individuality.'],
  ['A visible boundary.','Encrypted storage and permission checks establish where private information belongs.'],
  ['Deliberate connections.','The collection stays protected. Only the destinations you authorize are connected.'],
  ['Ready for everyday work.','Your files, permissions and shared work come together in one familiar workspace.'],
];
function StoryCard({index,progress,reduced}) {
  const x=useTransform(progress,p=>cinematicFrame(p).cards[index].x);
  const y=useTransform(progress,p=>cinematicFrame(p).cards[index].y);
  const rotate=useTransform(progress,p=>cinematicFrame(p).cards[index].angle);
  const scale=useTransform(progress,p=>cinematicFrame(p).cards[index].scale);
  const final=cinematicFrame(1).cards[index];
  return <motion.g style={{x:reduced?final.x:x,y:reduced?final.y:y,rotate:reduced?0:rotate,scale:reduced?final.scale:scale,transformOrigin:'55px 65px'}} className="story-document">
    <path d="M0 0H83L108 25V132H0ZM83 0V25H108" fill="var(--background)" stroke="currentColor" strokeWidth=".8"/>
    <text x="12" y="20" className="story-code">{['PDF / 001','DOCX / 002','IMAGE / 003','DATA / 004'][index]}</text>
    {index===0?<g><path d="M13 43H75M13 51H90M13 59H85M13 77H90M13 85H70M13 93H82" stroke="currentColor" strokeWidth=".7"/><rect x="13" y="103" width="32" height="12" fill="var(--accent)" opacity=".2"/></g>:index===1?<g><text x="13" y="54" fontSize="23" fill="currentColor">Aa.</text><path d="M13 74H85M13 83H90M13 92H65M13 110H50" stroke="currentColor" strokeWidth=".7"/></g>:index===2?<g stroke="currentColor" strokeWidth=".7" fill="none"><rect x="13" y="40" width="80" height="58"/><circle cx="68" cy="54" r="7"/><path d="M13 95L40 63L61 84L73 71L93 96M13 113H62"/></g>:<g stroke="currentColor" strokeWidth=".7"><path d="M13 42H93M13 61H93M13 80H93M13 99H93M13 42V99M40 42V99M67 42V99M93 42V99"/><rect x="42" y="63" width="23" height="15" fill="var(--accent)" opacity=".2"/></g>}
    <text x="13" y="125" className="story-code">{['Project brief','Meeting notes','Visual research','Project plan'][index]}</text>
  </motion.g>;
}
function Chapter({index,progress,reduced}) {
  const [active,setActive]=useState(reduced?4:cinematicFrame(progress.get()).stage);
  useEffect(()=>progress.on('change',value=>setActive(cinematicFrame(value).stage)),[progress]);
  const opacity=useTransform(progress,p=>{const stage=cinematicFrame(p).stage;return stage===index?1:0;});
  return <motion.div className="story-chapter" style={{opacity:reduced?(index===4?1:0):opacity}} aria-hidden={index!==(reduced?4:active)}>
    <span className="m-kicker">0{index+1} / {STORY_STAGES[index]}</span><h3>{copy[index][0]}</h3><p>{copy[index][1]}</p>
  </motion.div>;
}
export default function CinematicStory() {
  const root=useRef(null),reduced=useReducedMotion();
  const {scrollYProgress:p}=useScroll({target:root,offset:['start 15%','end 85%']});
  const protection=useTransform(p,v=>cinematicFrame(v).protect);
  const connection=useTransform(p,v=>cinematicFrame(v).connect);
  const workspace=useTransform(p,v=>cinematicFrame(v).workspace);
  const camera=useTransform(p,[0,.45,1],[-5,0,3]);
  return <section className="m-cinematic" ref={root} id="formation" aria-label="From information to a unified workspace">
    <div className="m-cinematic-sticky">
      <div className="m-cinematic-heading"><span className="m-kicker">06 / From information to intention</span><h2>A collection.<br/><em>A connected world.</em></h2><div className="story-chapters">{copy.map((_,i)=><Chapter key={i} index={i} progress={p} reduced={reduced}/>)}</div></div>
      <div className="cinematic-stage"><motion.svg viewBox="0 0 660 500" role="img" aria-label="Individual documents organize into an encrypted collection, connect to authorized destinations, and resolve into a workspace" style={{rotateY:reduced?0:camera}}>
        <defs><pattern id="cinematic-grid" width="25" height="25" patternUnits="userSpaceOnUse"><path d="M25 0H0V25" fill="none" stroke="currentColor" strokeWidth=".4" opacity=".1"/></pattern></defs>
        <rect x="5" y="5" width="650" height="490" fill="url(#cinematic-grid)" stroke="var(--border)" strokeWidth=".5"/>
        <g stroke="currentColor" fill="none" opacity=".35"><path d="M20 45V20H45M615 20H640V45M20 455V480H45M615 480H640V455"/><path d="M30 410H630" strokeDasharray="2 5"/></g>
        <motion.g style={{opacity:reduced?1:workspace}} fill="none" stroke="currentColor" strokeWidth=".7"><rect x="120" y="65" width="420" height="345" rx="5" fill="var(--background)"/><path d="M120 95H540M205 95V410M138 135H183M138 165H178M138 195H183M138 225H174M138 255H183M225 112H398"/><text x="137" y="84" className="story-code" fill="currentColor" stroke="none">TRUSTSHARE / WORKSPACE</text><circle cx="518" cy="81" r="4" fill="var(--accent)" stroke="none"/></motion.g>
        <motion.g style={{opacity:reduced?1:protection}} stroke="var(--accent)" fill="none"><motion.rect x="160" y="80" width="305" height="355" rx="8" strokeWidth="1" style={{pathLength:reduced?1:protection}}/><path d="M160 100V80H180M445 80H465V100M160 415V435H180M445 435H465V415" strokeWidth="2"/><text x="177" y="66" className="story-code" fill="var(--accent)" stroke="none">ENCRYPTED CONTENT / PERMISSION CHECK</text></motion.g>
        <motion.g fill="none" stroke="var(--accent)" strokeWidth="1" style={{opacity:reduced?1:connection}}>{['M465 160H525V135H586','M465 325H510V360H586','M160 250H100V295H65'].map(d=><motion.path key={d} d={d} style={{pathLength:reduced?1:connection}}/>)}
          {[[600,135,'TEAMMATE'],[600,360,'SHARED LINK'],[48,295,'OWNER']].map(([x,y,label])=><g key={label}><circle cx={x} cy={y} r="14" fill="var(--background)"/><path d={`M${x-5} ${y}l4 4 7-8`}/><text x={x} y={y+31} className="story-code" fill="currentColor" stroke="none" textAnchor="middle">{label}</text></g>)}
        </motion.g>
        {[0,1,2,3].map(i=><StoryCard key={i} index={i} progress={p} reduced={reduced}/>)}
        <text x="30" y="464" className="story-code" fill="currentColor">PRIVATE → ORGANIZED → CONNECTED</text><text x="630" y="464" textAnchor="end" className="story-code" fill="currentColor">TRUSTSHARE / 006</text>
      </motion.svg></div>
      <div className="m-cinematic-caption"><span>Scroll to follow the collection ↓</span><p>This is a conceptual visualization. It does not represent an autonomous AI swarm.</p></div>
    </div>
  </section>;
}
