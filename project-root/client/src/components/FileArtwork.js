import React from 'react';
import './file-artwork.css';
export default function FileArtwork({name='',mimetype='',compact=false}) {
  const ext=String(name||'').split('.').pop().toLowerCase();
  mimetype=String(mimetype||'');
  const type=mimetype.startsWith('video/')||['mp4','mov','webm'].includes(ext)?'video':['csv','xls','xlsx'].includes(ext)?'grid':mimetype.startsWith('image/')?'image':ext==='pdf'?'pdf':'document';
  return <svg className={`file-artwork ${compact?'is-compact':''}`} viewBox="0 0 100 100" aria-hidden="true">
    <path className="file-artwork-shadow" d="M26 14h47l13 14v64H26z"/>
    <path className="file-artwork-paper" d="M19 8h44l17 17v61H19zM63 8v18h17"/>
    {type==='video'?<><rect x="27" y="35" width="45" height="30"/><path d="M44 42l15 9-15 8z"/><path d="M28 73h43"/></>:type==='grid'?<><path d="M27 35h45v37H27zM27 45h45M27 54h45M27 63h45M42 35v37M57 35v37"/><path d="M28 22h24"/></>:type==='image'?<><rect x="27" y="35" width="45" height="35"/><path d="M28 63l13-15 10 11 8-7 12 14"/><circle cx="61" cy="44" r="3"/></>:<><path d="M28 36h33M28 43h43M28 50h43M28 57h30M28 72h20"/>{type==='pdf'&&<text x="28" y="27">PDF</text>}</>}
  </svg>;
}
