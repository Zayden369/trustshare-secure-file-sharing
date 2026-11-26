import React, { useRef } from 'react';
import { Link } from 'react-router-dom';
import { motion, useMotionValue, useReducedMotion, useScroll, useSpring, useTransform } from 'framer-motion';
import { ArrowUpRight, ArrowRight, Sun, Moon } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { ArchiveDocument } from './ArchiveArtwork';
import LivingArchive from './LivingArchive';
import ArchiveJourney from './ArchiveJourney';
import CinematicStory from './CinematicStory';
import WorkspacePreview from './WorkspacePreview';
import SwarmConstruction from './SwarmConstruction';
import PageConstruction from './PageConstruction';
import './landing.css';
import './living-archive.css';

function ArchiveHero() {
  const ref=useRef(null), reduced=useReducedMotion();
  const px=useMotionValue(0), py=useMotionValue(0);
  const x=useSpring(px,{stiffness:70,damping:24}), y=useSpring(py,{stiffness:70,damping:24});
  const {scrollYProgress}=useScroll({target:ref,offset:['start start','end start']});
  const depth=useTransform(scrollYProgress,[0,1],[1,1.1]);
  return <section className="m-hero" ref={ref} onPointerMove={e=>{if(reduced)return;const r=e.currentTarget.getBoundingClientRect();px.set((e.clientX-r.left-r.width/2)*.012);py.set((e.clientY-r.top-r.height/2)*.01);}} onPointerLeave={()=>{px.set(0);py.set(0);}}>
    <div className="m-hero-topline"><span>A private archive. A connected workspace.</span><span>Designed around your files.</span></div>
    <motion.div className="m-hero-architecture" style={{x:reduced?0:x,y:reduced?0:y,scale:reduced?1:depth}}><LivingArchive/></motion.div>
    <div className="m-hero-copy"><span className="m-kicker">The space between private and shared.</span><h1><span>Keep it</span><br/><em>close.</em><br/><span className="m-hero-last">Let work flow.</span></h1></div>
    <div className="m-hero-aside"><p>One considered place for your files.<br/>Protected in storage.<br/>Shared on your terms.</p><a className="m-button" href="#system">Enter the archive<ArrowRight size={17}/></a></div>
    <div className="m-hero-baseline"><span>01 — The private archive</span><a href="#system">Follow a file ↓</a><span>TrustShare / Introduction</span></div>
  </section>;
}

export default function Landing(){
  const page=useRef(null);
  const {user}=useAuth();
  const {theme,toggleTheme}=useTheme();
  return <main className="m-home" ref={page}><a className="m-skip" href="#system">Skip introduction</a><header className="m-nav"><Link className="m-wordmark" to="/" aria-label="TrustShare home"><span className="m-mark" aria-hidden="true">t.</span>TrustShare</Link><nav aria-label="Main navigation"><a href="#system">The platform</a><a href="#product">The workspace</a></nav><div className="m-nav-actions"><button onClick={toggleTheme} aria-label={theme==='dark'?'Switch to light theme':'Switch to dark theme'}>{theme==='dark'?<Sun size={17}/>:<Moon size={17}/>}</button><Link to="/login">Sign in</Link><Link to={user?'/dashboard':'/signup'} className="m-nav-start">{user?'Open dashboard':'Get started'}<ArrowUpRight size={14}/></Link></div></header><PageConstruction page={page}/>
    <ArchiveHero/><ArchiveJourney/><CinematicStory/><SwarmConstruction/>
    <section className="m-product" id="product"><div className="m-product-intro"><span className="m-kicker">07 / The workspace</span><h2>From possibility<br/><em>to everyday work.</em></h2><p>Keep your files, sharing and activity in one place. A clear workspace for the work that matters.</p></div><WorkspacePreview authenticated={Boolean(user)}/></section>
    <section className="m-closing"><svg className="archive-closing-document" viewBox="0 0 240 280" aria-hidden="true"><path d="M10 35V10H35M205 10H230V35M10 245V270H35M205 270H230V245" fill="none" stroke="currentColor" strokeWidth=".6"/><ArchiveDocument x={56} y={45}/><text x="120" y="246" textAnchor="middle">PRIVATE ARCHIVE / 001</text></svg><span className="m-kicker">Your next workspace</span><h2>Keep what matters.<br/><em>Share on your terms.</em></h2><div><Link className="m-button" to={user?'/dashboard':'/signup'}>{user?'Open dashboard':'Create account'}<ArrowUpRight size={17}/></Link><Link className="m-text-link" to="/login">Sign in<ArrowUpRight size={15}/></Link></div></section><footer className="m-footer"><Link className="m-wordmark" to="/">TrustShare</Link><span>Your files. Your security. Your control.</span><div><a href="#system">Platform</a><Link to="/login">Sign in</Link></div></footer>
  </main>;
}
