import React, { useRef } from 'react';
import { motion, useReducedMotion, useScroll, useTransform } from 'framer-motion';
import { ArchiveDocument } from './ArchiveArtwork';

const chapters = [
  ['system', '01 / Arrival', 'One file.', 'A world of possibilities.', 'Bring your documents, media and project files into a workspace with a clear place for everything.', 'The project brief begins its journey.'],
  ['protection', '02 / Protection', 'A private file.', 'A visible boundary.', 'File content is encrypted with AES-256 before storage. Per-file key handling and authorized decryption are managed by the server.', 'Encryption → storage → permission check'],
  ['sharing', '03 / Connection', 'Share the work.', 'Keep the control.', 'Share with a teammate or create an external link. Choose access permissions, an expiration and a password where needed.', 'One source. Deliberate destinations.'],
  ['organization', '04 / Organization', 'Everything finds', 'its place.', 'Folders, search, sorting and familiar views turn a collection of files into a workspace you can navigate.', 'From an individual file to a working collection.'],
  ['intelligence', '05 / Perspective', 'Find the meaning.', 'See the bigger picture.', 'Ask the assistant about supported documents, generate a summary, and explore your real workspace activity and analytics.', 'AI assistance and activity, within the workspace.'],
];
function useChapter(target) {
  return useScroll({target, offset:['start 75%', 'end 75%']}).scrollYProgress;
}
export default function ArchiveJourney() {
  const r1=useRef(null),r2=useRef(null),r3=useRef(null),r4=useRef(null),r5=useRef(null);
  const refs=[r1,r2,r3,r4,r5];
  const p1=useChapter(r1), p2=useChapter(r2), p3=useChapter(r3), p4=useChapter(r4), p5=useChapter(r5);
  const reduced=useReducedMotion();
  const fileY=useTransform([p1,p4],([a,d])=>-65*(1-a)-45*d);
  const fileScale=useTransform(p4,[0,1],[1,.77]);
  const boundary=useTransform(p2,[0,.8],[0,1]);
  const network=useTransform([p3,p4],([c,d])=>c*(1-d));
  const collection=useTransform(p4,[0,1],[0,1]);
  const insight=useTransform(p5,[0,1],[0,1]);
  const aperture=useTransform(p1,[0,1],[.7,.12]);
  return <section className="archive-journey" aria-label="The journey of a file">
    <div className="archive-journey-stage" aria-hidden="true"><div className="archive-stage-heading"><span>The file / in motion</span><span>TrustShare — 001</span></div>
      <svg className="archive-system" viewBox="0 0 600 560" fill="none"><defs><pattern id="archive-grid" width="36" height="36" patternUnits="userSpaceOnUse"><path d="M36 0H0V36" stroke="currentColor" strokeOpacity=".07" strokeWidth=".5"/></pattern></defs><rect width="600" height="560" fill="url(#archive-grid)"/>
        <motion.g style={{opacity:reduced?.15:aperture}} stroke="currentColor" strokeWidth=".7">{[0,1,2,3,4,5].map(i=><rect key={i} x={125+i*9} y={55+i*9} width={350-i*18} height={430-i*18}/>)}</motion.g>
        <g stroke="currentColor" strokeWidth=".8"><motion.g style={{opacity:reduced?1:network}}><path d="M300 275H110V135H65M300 275H490V135H535M300 275H110V410H65M300 275H490V410H535"/>{[[65,135],[535,135],[65,410],[535,410]].map(([x,y],i)=><g key={i}><circle cx={x} cy={y} r="20" fill="var(--background)"/><path d={`M${x-6} ${y+5}V${y-4}H${x+6}V${y+5}Z`}/><text x={x} y={y+44} textAnchor="middle">{i<2?'Teammate':'Shared link'}</text></g>)}</motion.g></g>
        <motion.g style={{opacity:reduced?1:collection}} stroke="currentColor" strokeWidth=".7"><path d="M82 355H518V456H82ZM82 355V340H205L220 355M82 405H518M120 375H350M120 427H295"/><text x="97" y="328">PROJECTS / DOCUMENTS</text><text x="450" y="382">PDF</text><text x="450" y="432">DOCX</text><motion.path d="M95 490H510M95 485V440M160 478L220 463L280 473L340 447L400 455L490 419" style={{opacity:reduced?1:insight}}/></motion.g>
        <motion.g style={{opacity:reduced?1:boundary}} stroke="currentColor" strokeWidth=".8"><rect x="198" y="151" width="204" height="257" rx="3" strokeDasharray="3 5"/><path d="M198 174V151H221M379 151H402V174M402 385V408H379M221 408H198V385" strokeWidth="2"/><text x="300" y="135" textAnchor="middle">AES-256 / CONTENT ENCRYPTION</text></motion.g>
        <motion.g style={{y:reduced?-45:fileY,scale:reduced?.77:fileScale,transformOrigin:'300px 275px'}}><ArchiveDocument x={236} y={190}/></motion.g>
        <g stroke="currentColor" opacity=".35"><path d="M20 20H45M20 20V45M580 20H555M580 20V45M20 540H45M20 540V515M580 540H555M580 540V515"/></g>
      </svg><div className="archive-stage-footer"><span className="archive-status-dot"/>Project brief.pdf<span>Explanatory visualization</span></div>
    </div>
    <div className="archive-chapters">{chapters.map(([id,kicker,title,serif,copy,note],i)=><article className="archive-chapter" id={id} ref={refs[i]} key={id}><span className="m-kicker">{kicker}</span><h2>{title}<br/><em>{serif}</em></h2><p>{copy}</p><div className="archive-chapter-note"><span>0{i+1}</span>{note}</div></article>)}</div>
  </section>;
}
