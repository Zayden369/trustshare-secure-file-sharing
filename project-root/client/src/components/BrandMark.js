import React from 'react';
import './brand-mark.css';
export default function BrandMark({className=''}) {
  return <span className={`trustshare-mark ${className}`} aria-hidden="true">t.</span>;
}
