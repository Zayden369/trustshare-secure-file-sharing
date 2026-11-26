import React, { useRef, useState } from 'react';
import { motion, useScroll, useTransform, useReducedMotion } from 'framer-motion';
import { FileText, Folder, LockKeyhole, Download, Eye } from 'lucide-react';

function useSceneProgress(ref){
  return useScroll({target:ref,offset:['start 85%','end 25%']}).scrollYProgress;
}

export function TechnicalProtection(){
  const ref=useRef(null), reduced=useReducedMotion(), progress=useSceneProgress(ref);
  const pathLength=useTransform(progress,[0,1],[0,1]);
  const x=useTransform(progress,[0,.65],[0,reduced?0:26]);
  return <figure className="m-technical" ref={ref}><svg viewBox="0 0 500 300" role="img" aria-label="A file enters server-managed encryption, encrypted storage, and authorized access"><g className="m-fine-grid"><path d="M0 60H500M0 120H500M0 180H500M0 240H500M80 20V270M160 20V270M240 20V270M320 20V270M400 20V270"/></g><path className="m-wire-dim" d="M90 150H195M325 150H430"/><motion.path className="m-wire-lit" d="M90 150H195M325 150H430" style={{pathLength:reduced?1:pathLength}}/><motion.g style={{x}}><path className="m-wire-lit" d="M45 115H78L94 131V185H45ZM78 115V132H94M56 145H82M56 156H82M56 167H73"/></motion.g><g className="m-wire-lit"><path d="M205 91L237 72H322V188L290 207H205ZM205 91H290V207M290 91L322 72M290 188H322"/><rect x="216" y="105" width="62" height="86"/><path d="M237 148V135a10 10 0 0 1 20 0v13M232 148H262V171H232Z"/></g><circle className="m-wire-lit" cx="430" cy="150" r="24"/><path className="m-wire-lit" d="M419 150l8 8 15-18"/><text x="35" y="232">SOURCE FILE</text><text x="214" y="250">ENCRYPTED STORAGE</text><text x="382" y="208">AUTHORIZED</text><text x="382" y="222">ACCESS</text></svg><figcaption>File bytes are encrypted before storage. Access is checked before content is served.</figcaption></figure>;
}

export function SharingPath(){
  const ref=useRef(null), reduced=useReducedMotion(), progress=useSceneProgress(ref);
  const [download,setDownload]=useState(false);
  const pathLength=useTransform(progress,[0,1],[0,1]);
  return <figure className="m-sharing-visual" ref={ref}><div className="m-diagram-heading"><span>Access, on your terms</span><LockKeyhole size={14}/></div><svg viewBox="0 0 500 260" role="img" aria-label="A shared file connects an owner with authorized recipients"><path className="m-wire-dim" d="M90 130H220Q250 130 250 100V70H390M250 130V190H390"/><motion.path className="m-wire-lit" d="M90 130H220Q250 130 250 100V70H390M250 130V190H390" style={{pathLength:reduced?1:pathLength}}/><g className="m-wire-lit"><rect x="35" y="100" width="65" height="55" rx="3"/><path d="M30 164H105M48 115H87M48 124H76"/><circle cx="402" cy="70" r="25"/><circle cx="402" cy="190" r="25"/><path d="M393 70l6 6 12-13M393 190l6 6 12-13"/><rect x="229" y="110" width="42" height="42" rx="2"/><path d="M240 124H259M240 132H259M240 140H252"/></g><text x="35" y="193">OWNER</text><text x="338" y="29">PERMITTED RECIPIENTS</text><text x="330" y="124">{download?'VIEW + DOWNLOAD':'VIEW ONLY'}</text><text x="337" y="241">EXPIRATION / PASSWORD</text></svg><div className="m-sharing-options" role="group" aria-label="Illustrative sharing permission"><button aria-pressed={!download} onClick={()=>setDownload(false)}><Eye size={14}/>View only</button><button aria-pressed={download} onClick={()=>setDownload(true)}><Download size={14}/>Download allowed</button></div><figcaption>Explore permission states. This illustration does not create a share or change access.</figcaption></figure>;
}

function OrganizingRow({index,name,type,progress,reduced}){
  const x=useTransform(progress,[0,.85],[reduced?0:(index%2?35:-30),0]);
  const y=useTransform(progress,[0,.85],[reduced?0:(index-2)*13,0]);
  const rotate=useTransform(progress,[0,.85],[reduced?0:(index%2?4:-4),0]);
  return <motion.div className="m-organizing-row" style={{x,y,rotate}}><span>{type==='Folder'?<Folder size={17}/>:<FileText size={17}/>} {name}</span><span>{type}</span><LockKeyhole size={13}/></motion.div>;
}
export function WorkspaceAssembly(){
  const ref=useRef(null),reduced=useReducedMotion(),progress=useSceneProgress(ref);
  return <figure className="m-organizer" ref={ref}><div className="m-diagram-heading"><span>A place for everything</span><span>Organization concept</span></div><div className="m-organizer-table"><div className="m-organizer-header"><span>Name</span><span>Type</span><span>Access</span></div>{[['Documents','Folder'],['Working files','Folder'],['Notes','Document'],['Project brief','Document']].map(([name,type],i)=><OrganizingRow key={name} name={name} type={type} index={i} progress={progress} reduced={reduced}/>)}</div><figcaption>Folders, grid and list views, search, and filters. Familiar ways to find your next file.</figcaption></figure>;
}
