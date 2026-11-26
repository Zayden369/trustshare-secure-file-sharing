import React, { useId } from 'react';
import './archive-artwork.css';

/** The etched document is carried from the aperture into the workspace. */
export function ArchiveDocument({ x = 0, y = 0, width = 128 }) {
  return <svg x={x} y={y} width={width} height={width * 1.32} viewBox="0 0 128 169" overflow="visible" aria-hidden="true">
    <path d="M1 1H93L127 35V168H1Z" className="archive-paper"/>
    <path d="M93 1V35H127M18 95H109M18 106H91M18 117H102M18 128H75" className="archive-rule"/>
    <path d="M20 24H37V48H20ZM24 30H32M24 35H32" fill="none" stroke="currentColor" strokeWidth=".8"/>
    <text x="18" y="76" className="archive-doc-title">Project brief</text><text x="18" y="151" className="archive-doc-code">DOCUMENT / 001</text>
  </svg>;
}

/** Custom native SVG, without a texture download or WebGL dependency. */
export default function ArchiveArtwork({ className = '', document = true }) {
  const id = useId().replace(/:/g, '');
  return <svg className={`archive-aperture ${className}`} viewBox="0 0 760 760" fill="none" aria-hidden="true">
    <defs><linearGradient id={`${id}-metal`} x1="160" y1="60" x2="650" y2="650" gradientUnits="userSpaceOnUse"><stop stopColor="#777"/><stop offset=".22" stopColor="#222"/><stop offset=".53" stopColor="#424242"/><stop offset="1" stopColor="#111"/></linearGradient><linearGradient id={`${id}-edge`} x1="200" y1="0" x2="550" y2="700" gradientUnits="userSpaceOnUse"><stop stopColor="#ddd"/><stop offset=".35" stopColor="#454545"/><stop offset=".7" stopColor="#aaa"/><stop offset="1" stopColor="#303030"/></linearGradient></defs>
    <g className="archive-construction" stroke="currentColor" strokeWidth=".5"><path d="M0 681H760M100 0V760M660 0V760M0 92H760M0 700L760 560M0 734L760 594"/><path d="M155 80L640 40L705 650L210 708Z" strokeDasharray="3 8"/></g>
    <path d="M170 97L592 60L677 113L715 630L238 705L184 650Z" fill="#0b0b0b" stroke="#4e4e4e"/>
    <path d="M170 97L592 60L637 623L218 681Z" fill={`url(#${id}-metal)`} stroke={`url(#${id}-edge)`}/>
    {Array.from({length:9},(_,i)=><path key={i} d={`M${183+i*4} ${111+i*4}L${581-i*4} ${77+i*5}L${622-i*5} ${607-i*3}L${232+i*3} ${659-i*5}Z`} stroke={i===6?'#aaa':'#414141'} strokeWidth={i===6?1:.6}/>)}
    <path d="M227 154L555 127L590 579L269 621Z" fill="#080808" stroke="#696969"/><path d="M241 170L542 145L574 566L281 605Z" fill="#111" stroke="#272727"/><path d="M242 170L364 209L391 552L281 605Z" fill="#181818" stroke="#363636"/><path d="M542 145L471 199L499 538L574 566Z" fill="#0c0c0c" stroke="#313131"/><path d="M364 209L471 199L499 538L391 552Z" fill="#090909" stroke="#222"/>
    <g stroke="#8a8a8a" strokeWidth="1">{[234,490].map(y=><g key={y}><path d={`M210 ${y}L235 ${y-2}L239 ${y+43}L214 ${y+45}Z`} fill="#303030"/><path d={`M216 ${y+7}L231 ${y+6}M218 ${y+35}L233 ${y+34}`}/></g>)}</g>
    <path d="M555 127L590 579" stroke="#e4e4e4" strokeWidth="1.1"/>
    <path d="M174 101L590 64L672 115L711 628" stroke="#b4b4b4" strokeOpacity=".48" strokeWidth=".7"/>
    <path d="M185 650L239 701L710 627M218 681L239 701M592 60L677 113" stroke="#aaa" strokeOpacity=".3" strokeWidth=".6"/>
    <path d="M176 102L209 130L613 95L590 66Z" fill="#fff" fillOpacity=".045"/>
    <g fill="#9a9a9a" fontFamily="monospace" fontSize="8" letterSpacing="2"><text transform="translate(252 140) rotate(-5)">TRUSTSHARE / PRIVATE ARCHIVE</text><text x="278" y="656" transform="rotate(-7 278 656)">CONTROLLED ACCESS · 001</text></g>
    {document && <g transform="translate(365 304) rotate(-5)"><ArchiveDocument width={128}/></g>}
    <g stroke="currentColor" strokeWidth=".6" opacity=".45"><path d="M614 230H713M669 219V241M282 694V739M272 720H292"/><circle cx="669" cy="230" r="4"/></g>
  </svg>;
}
