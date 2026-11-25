import React from 'react';
import './archive-empty.css';
export default function ArchiveEmpty({title,children,variant='archive',action}) {
  return <div className={`archive-empty archive-empty--${variant}`}><svg viewBox="0 0 100 78" aria-hidden="true"><path d="M8 20V8h12M80 8h12v12M8 58v12h12M80 70h12V58"/><path d={variant==='incoming'?'M16 36h25m-9-8 9 8-9 8M51 19h19l11 11v30H51zM70 19v11h11':'M25 21h20l7 8h25v32H25zM25 35h52M35 43h31M35 50h21'}/></svg><div><h3>{title}</h3><p>{children}</p>{action}</div></div>;
}
