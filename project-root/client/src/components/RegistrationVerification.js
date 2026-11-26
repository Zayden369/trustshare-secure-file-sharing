import React,{useEffect,useState,useRef} from 'react';
import {authAPI} from '../utils/api';

export default function RegistrationVerification({email,onVerified,existing}){
  const alive=useRef(true);
  useEffect(()=>{alive.current=true;return()=>{alive.current=false;};},[]);
  const [expires,setExpires]=useState(existing?.expires||0);
  useEffect(()=>{if(!expires)return;const t=setTimeout(()=>{setExpires(0);setVerified(false);onVerified(null);setError('Email verification expired. Request a new code.');},Math.max(0,expires-Date.now()));return()=>clearTimeout(t);},[expires,onVerified]);
  const [challenge,setChallenge]=useState(null),[code,setCode]=useState(''),[error,setError]=useState(''),[busy,setBusy]=useState(false),[remaining,setRemaining]=useState(0),[verified,setVerified]=useState(!!existing&&existing.expires>Date.now());
  useEffect(()=>{if(!remaining)return;const timer=setTimeout(()=>setRemaining(v=>v-1),1000);return()=>clearTimeout(timer);},[remaining]);
  const send=async()=>{setBusy(true);setError('');try{const {data}=await authAPI.sendRegistrationCode(email);if(!alive.current)return;setChallenge(data.challenge_id);setCode('');setRemaining(data.resend_after);setVerified(false);onVerified(null);}catch(e){if(!alive.current)return;const retry=Number(e.response?.headers?.['retry-after']);if(retry>0)setRemaining(Math.min(3600,retry));setError(typeof e.response?.data?.detail==='string'?e.response.data.detail:'Could not send the verification email. Please try again.');}finally{if(alive.current)setBusy(false);}};
  const verify=async()=>{setBusy(true);setError('');try{const {data}=await authAPI.verifyRegistrationCode(challenge,code);if(!alive.current)return;setVerified(true);setExpires(Date.now()+data.expires_in*1000);onVerified({token:data.verification_token,email:data.email,expires:Date.now()+data.expires_in*1000});}catch(e){if(!alive.current)return;const retry=Number(e.response?.headers?.['retry-after']);if(retry>0)setRemaining(Math.min(3600,retry));setError(typeof e.response?.data?.detail==='string'?e.response.data.detail:'Verification failed. Please try again.');}finally{if(alive.current)setBusy(false);}};
  return <div className="registration-verification">
    {verified?<p role="status" style={{color:'var(--success)'}}>✓ Email verified. Complete your account within five minutes.</p>:<>
      <button type="button" className="ap-btn" onClick={send} disabled={busy||remaining>0||!email}>{busy?'Please wait…':remaining?`Resend in ${remaining}s`:challenge?'Resend code':'Send verification code'}</button>
      {challenge&&<div style={{marginTop:16}}><label htmlFor="registration-code">Six-digit email code</label><input id="registration-code" className="ap-in" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} value={code} onChange={e=>setCode(e.target.value.replace(/\D/g,'').slice(0,6))} aria-describedby="registration-code-help" style={{letterSpacing:'.45em',fontSize:24,marginBlock:12}}/><p id="registration-code-help">Check your inbox and spam folder. You can paste the complete code. It expires in five minutes.</p><button type="button" className="ap-btn" disabled={busy||code.length!==6} onClick={verify}>Verify email</button></div>}
    </>}
    {error&&<p role="alert" className="ap-err">{error}</p>}
  </div>;
}
