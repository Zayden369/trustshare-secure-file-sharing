import React from 'react';
import './file-artwork.css';
export function fileArtworkKind(name='',mime=''){
 const ext=String(name||'').split('.').pop().toLowerCase();
 if(['ppt','pptx','odp'].includes(ext))return 'slides';
 if(['csv','xls','xlsx','ods'].includes(ext))return 'grid';
 if(['mp4','mov','webm','mkv','avi'].includes(ext)||String(mime).startsWith('video/'))return 'video';
 if(['png','jpg','jpeg','gif','svg','webp'].includes(ext)||String(mime).startsWith('image/'))return 'image';
 if(['mp3','wav','ogg','flac'].includes(ext)||String(mime).startsWith('audio/'))return 'audio';
 if(['zip','rar','7z','tar','gz'].includes(ext))return 'archive';
 if(['json','js','jsx','ts','tsx','py','html','css','sh'].includes(ext))return 'code';
 return ext==='pdf'?'pdf':['doc','docx','rtf','odt'].includes(ext)?'word':'document';
}
export default function FileArtwork({name='',mimetype='',compact=false}){
 const type=fileArtworkKind(name,mimetype);
 const landscape=['slides','video','image'].includes(type);
 return <svg data-kind={type} className={`file-artwork ${compact?'is-compact':''}`} viewBox="0 0 100 100" aria-hidden="true">
 {landscape?<><rect className="art-layer" x="12" y="24" width="74" height="53" rx="2"/><rect className="file-artwork-paper" x="8" y="19" width="74" height="53" rx="2"/>{type==='slides'?<><path className="art-signal" d="M18 30h29M18 38h16"/><rect x="18" y="47" width="22" height="15"/><path className="art-signal" d="M49 62V51h7v11m5 0V43h7v19"/></>:type==='video'?<><path className="art-signal art-play" d="M38 32l19 12-19 12z"/><path d="M17 63h57"/><circle className="art-signal" cx="33" cy="63" r="2"/></>:<><circle className="art-signal" cx="61" cy="34" r="5"/><path className="art-signal" d="M17 61l17-20 15 16 9-9 16 13z"/></>}</>:
 type==='audio'?<><circle className="file-artwork-paper" cx="48" cy="48" r="33"/><circle cx="48" cy="48" r="12"/><path className="art-signal art-wave" d="M17 48h7l4-12 6 25 7-34 7 43 6-32 5 18 5-8h15"/></>:
 type==='archive'?<><path className="file-artwork-paper" d="M14 28l35-15 35 15v43L49 88 14 71zM14 28l35 17 35-17M49 45v43"/><path className="art-signal" d="M43 23l14 7-14 7 14 7M42 59h14v9H42z"/></>:
 <><path className="art-layer" d="M27 15h47l12 14v63H27z"/><path className="file-artwork-paper" d="M19 8h44l17 17v61H19zM63 8v18h17"/>{type==='grid'?<><path d="M27 34h45v39H27zM27 44h45M27 54h45M27 64h45M42 34v39M57 34v39"/><rect className="art-signal" x="42" y="44" width="15" height="10"/></>:type==='code'?<><path className="art-signal" d="M39 37L28 48l11 11M58 37l11 11-11 11M53 31L44 65"/><path d="M29 75h27"/></>:<><text className="art-signal" x="28" y="30">{type==='pdf'?'PDF':type==='word'?'W':'T.'}</text><path d="M28 42h43M28 49h43M28 56h30M28 70h20"/>{type==='word'&&<path className="art-signal" d="M28 61h36"/>}</>}</>}
 </svg>;
}
