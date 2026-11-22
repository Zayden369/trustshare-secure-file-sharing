import React from 'react';
import '../styles/boot.css';

export default function BootScreen({message = 'Preparing your workspace'}) {
  return <div className="trustshare-boot" role="status" aria-live="polite"><span className="trustshare-boot-mark" aria-hidden="true">t.</span><div><strong>TrustShare</strong><span>{message}</span></div><i aria-hidden="true"/></div>;
}
