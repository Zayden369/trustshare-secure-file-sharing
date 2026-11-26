import React, { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion, useScroll, useTransform, useReducedMotion } from 'framer-motion';
import { ArrowUpRight, ArrowRight, Sun, Moon, FileText, KeyRound, Database, UserCheck } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import DashboardOverviewView from '../dashboard/components/DashboardOverview';
import './landing.css';
import ParticleFormation from './ParticleFormation';
import { TechnicalProtection, SharingPath, WorkspaceAssembly } from './StoryVisuals';

// Presentation-only empty state. These placeholders are never account metrics.
function DashboardOverview(){
  const analytics={total_files:'—',total_share_links:'—',active_share_links:'—',total_downloads:'—',total_notifications:'—',unread_notifications:'—',total_share_views:'—',encrypted_files:'—',storage:{used_gb:'—',quota_gb:'—',percent:0}};
  return <DashboardOverviewView dashboardData={{analytics,files:[],notifications:[]}}/>;
}

export function Vault() {
  return <div className="m-vault-stage" aria-hidden="true"><div className="m-vault-ground"/><div className="m-vault-object"><div className="m-vault-rear"/><div className="m-vault-edge"/><div className="m-vault-door"><div className="m-vault-recess"><div className="m-vault-inscription">TRUSTSHARE<br/><span>PRIVATE WORKSPACE / 01</span></div><div className="m-vault-dial"><i/><i/><i/><i/><b/></div><div className="m-vault-hinge m-vault-hinge-top"/><div className="m-vault-hinge m-vault-hinge-bottom"/><span className="m-vault-seal">SECURE BY DESIGN</span></div></div></div><span className="m-art-caption">Encrypted storage. Deliberate access.</span></div>;
}

const stages = [
  { icon: FileText, name: 'Your file', detail: 'Documents, media, and project files. Organized in a workspace you control.' },
  { icon: KeyRound, name: 'Protection', detail: 'File bytes are encrypted with AES-256 before storage. The server manages encryption and authorized decryption.' },
  { icon: Database, name: 'Storage', detail: 'Encrypted content is stored separately from file metadata, with per-file key handling.' },
  { icon: UserCheck, name: 'Access', detail: 'Authentication and file permissions are checked before content is served.' },
];

export function ProtectionDiagram() {
  const ref = useRef(null);
  const [selected, setSelected] = useState(0);
  const reduced = useReducedMotion();
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start 85%', 'end 25%'] });
  const pathLength = useTransform(scrollYProgress, [0,1], [0,1]);
  return <div ref={ref} className="m-diagram"><div className="m-diagram-heading"><span>File lifecycle</span><span>01 — 04</span></div><div className="m-diagram-track"><svg viewBox="0 0 400 80" preserveAspectRatio="none" aria-hidden="true"><path d="M45 40H355"/><motion.path d="M45 40H355" className="m-diagram-progress" style={{ pathLength: reduced ? 1 : pathLength }}/></svg><div className="m-diagram-nodes">{stages.map(({icon: Icon,name},i)=><button key={name} aria-pressed={selected===i} onClick={()=>setSelected(i)}><Icon size={23} strokeWidth={1}/><span>{name}</span><small>0{i+1}</small></button>)}</div></div><p aria-live="polite">{stages[selected].detail}</p><div className="m-diagram-foot">Select a stage to explore <ArrowUpRight size={13}/></div></div>;
}

export function EditorialScene({ id, number, eyebrow, title, children, visual, reverse=false }) {
  const ref=useRef(null);
  const reduced=useReducedMotion();
  const {scrollYProgress}=useScroll({target:ref,offset:['start end','end start']});
  const y=useTransform(scrollYProgress,[0,.5,1],[reduced?0:25,0,reduced?0:-25]);
  return <section id={id} ref={ref} className={`m-scene ${reverse?'m-scene-reverse':''}`}><div className="m-scene-copy"><span className="m-kicker">{number} / {eyebrow}</span><h2>{title}</h2><div className="m-prose">{children}</div></div><motion.div className="m-scene-art" style={{y}}>{visual}</motion.div></section>;
}

export default function Landing(){
  const {user}=useAuth();
  const {theme,toggleTheme}=useTheme();
  const reduced=useReducedMotion();
  return <main className="m-home"><a className="m-skip" href="#system">Skip introduction</a><header className="m-nav"><Link className="m-wordmark" to="/" aria-label="TrustShare home"><span className="m-mark" aria-hidden="true">t.</span>TrustShare</Link><nav aria-label="Main navigation"><a href="#system">The platform</a><a href="#product">The workspace</a></nav><div className="m-nav-actions"><button onClick={toggleTheme} aria-label={`Switch to ${theme==='dark'?'light':'dark'} theme`}>{theme==='dark'?<Sun size={17}/>:<Moon size={17}/>}</button><Link to="/login">Sign in</Link><Link to={user?'/dashboard':'/signup'} className="m-nav-start">{user?'Open dashboard':'Get started'}<ArrowUpRight size={14}/></Link></div></header>
    <section className="m-hero"><div className="m-hero-copy"><motion.div initial={reduced?false:{opacity:0,y:15}} animate={{opacity:1,y:0}} transition={{duration:.7}}><span className="m-kicker">A considered space for your digital life.</span><h1>Your files.<br/><em>Under your<br className="m-headline-break"/> control.</em></h1><p>Secure storage. Deliberate sharing.<br/>A little more clarity in everything you do.</p><div className="m-hero-actions"><a className="m-button" href="#system">Explore TrustShare<ArrowRight size={17}/></a><Link className="m-text-link" to="/login">Sign in<ArrowUpRight size={15}/></Link></div></motion.div></div><Vault/><div className="m-hero-baseline"><span>Private by intention. Connected by choice.</span><a href="#system">Scroll to explore ↓</a><span>TrustShare / Introduction</span></div></section>
    <EditorialScene id="system" number="02" eyebrow="Understand the system" title={<>A place for everything.<br/><em>A boundary around it.</em></>} visual={<ProtectionDiagram/>}><p>TrustShare brings encrypted file storage, organization, and controlled sharing into one workspace.</p><p>Every file has a path. From the moment it arrives to the people who can access it, the important boundaries stay visible.</p></EditorialScene>
    <EditorialScene id="protection" number="03" eyebrow="Protection, in layers" reverse title={<>A quiet layer.<br/><em>A clear boundary.</em></>} visual={<TechnicalProtection/>}><p>Content is encrypted before it reaches storage. Per-file key handling and permission checks keep the stages of access deliberate.</p><p>Encryption and authorized decryption are managed by the server. Your workspace stays usable, without disguising how protection works.</p></EditorialScene>
    <EditorialScene id="sharing" number="04" eyebrow="Connected by choice" title={<>Open the conversation.<br/><em>Choose the access.</em></>} visual={<SharingPath/>}><p>Share with teammates or create an external link. Choose permissions, set an expiration, and add a password where needed.</p><p>The right file. The right people. A boundary you can revisit.</p></EditorialScene>
    <EditorialScene id="organization" number="05" eyebrow="A little more order" reverse title={<>Less looking.<br/><em>More finding.</em></>} visual={<WorkspaceAssembly/>}><p>Folders, search, sorting, and a choice of views. The tools you already understand, arranged around the way you work.</p><p>From the scattered to the structured. Without making everyday actions complicated.</p></EditorialScene>
    <ParticleFormation/>
    <section className="m-product" id="product"><div className="m-product-intro"><span className="m-kicker">The real workspace</span><h2>Less to navigate.<br/><em>More room to work.</em></h2><p>Files, sharing, activity, and insights. A connected view of your work, with familiar controls.</p></div><div className="m-product-stage" inert=""><div className="m-product-chrome"><span>TrustShare</span><span>Dashboard / Empty-state preview</span><span>Workspace</span></div><div className="m-product-render"><DashboardOverview/></div></div><p className="m-preview-note">Actual dashboard component, shown in its empty state. <Link to={user?'/dashboard':'/login'}>Open your live workspace <ArrowUpRight size={13}/></Link></p></section>
    <section className="m-closing"><span className="m-kicker">Your next workspace</span><h2>Keep what matters.<br/><em>Share on your terms.</em></h2><div><Link className="m-button" to={user?'/dashboard':'/signup'}>{user?'Open dashboard':'Create account'}<ArrowUpRight size={17}/></Link><Link className="m-text-link" to="/login">Sign in<ArrowUpRight size={15}/></Link></div></section><footer className="m-footer"><Link className="m-wordmark" to="/">TrustShare</Link><span>Your files. Your security. Your control.</span><div><a href="#system">Platform</a><Link to="/login">Sign in</Link></div></footer>
  </main>;
}
