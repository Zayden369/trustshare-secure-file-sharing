import React, { useRef } from 'react';
import { motion, useReducedMotion, useScroll, useTransform } from 'framer-motion';
import { FileText, FolderOpen, LayoutDashboard, Share2, Search, ArrowUpRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { RecentFilesPanel } from '../dashboard/components/DashboardOverview';
import FileCard from '../myFiles/components/FileCard';
import '../dashboard/dashboard.css';
import '../myFiles/my-files.css';

// Editorial example documents. Never queried, uploaded, or presented as account data.
const files=[
  {id:'example-brief',original_name:'Project brief.pdf',mimetype:'application/pdf',size:245760,created_at:'2026-01-01T12:00:00Z',encrypted:true},
  {id:'example-notes',original_name:'Meeting notes.docx',mimetype:'application/vnd.openxmlformats-officedocument.wordprocessingml.document',size:18432,created_at:'2026-01-01T12:00:00Z',encrypted:true},
  {id:'example-plan',original_name:'Research outline.txt',mimetype:'text/plain',size:4096,created_at:'2026-01-01T12:00:00Z',encrypted:true},
];
export default function WorkspacePreview({authenticated}) {
  const ref=useRef(null),reduced=useReducedMotion();
  const {scrollYProgress}=useScroll({target:ref,offset:['start 90%','center center']});
  const rotateX=useTransform(scrollYProgress,[0,1],[7,0]);
  const scale=useTransform(scrollYProgress,[0,1],[.96,1]);
  return <div className="archive-workspace-preview" ref={ref}>
    <motion.div className="archive-product-window" style={{rotateX:reduced?0:rotateX,scale:reduced?1:scale}}>
      <div className="archive-product-chrome"><span>TrustShare</span><span>Workspace preview / Illustrative documents</span><span>↗</span></div>
      <div className="archive-product-interface" inert="" aria-hidden="true"><aside className="archive-product-sidebar"><span className="archive-product-brand">t.</span>{[[LayoutDashboard,'Dashboard'],[FolderOpen,'My Files'],[Share2,'Sharing']].map(([Icon,label])=><div key={label}><Icon size={14}/><span>{label}</span></div>)}</aside>
        <div className="archive-product-content"><div className="archive-product-search"><Search size={13}/>Search files, people, activity</div><div className="archive-product-heading"><div><small>Your private archive</small><h3>A place for your next idea.</h3></div><FileText size={24} strokeWidth={1}/></div><div className="archive-product-panels"><div className="dashboard-view"><RecentFilesPanel files={files}/></div><FileCard file={files[0]} viewMode="grid"/></div><div className="archive-product-label">Organize. Protect. Share.<span>Familiar controls. Considered details.</span></div></div>
      </div>
    </motion.div>
    <p className="m-preview-note">Live file-list and file-card components, with illustrative documents. <Link to={authenticated?'/dashboard':'/login'}>Open your live workspace<ArrowUpRight size={13}/></Link></p>
  </div>;
}
