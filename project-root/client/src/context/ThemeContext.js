import React, { createContext, useContext, useEffect, useRef, useState } from "react";
import { flushSync } from 'react-dom';
import '../styles/theme-transition.css';

const ThemeContext = createContext();

export const ThemeProvider = ({ children }) => {
  const getInitialTheme = () => {
    const savedTheme = localStorage.getItem("theme");

    if (savedTheme) {
      return savedTheme;
    }

    return window.matchMedia("(prefers-color-scheme: dark)").matches
      ? "dark"
      : "light";
  };

  const [theme, setTheme] = useState(getInitialTheme);
  const transition = useRef(null);
  const busy = useRef(false);
  useEffect(()=>()=>transition.current?.skipTransition(),[]);

  useEffect(() => {
    document.body.classList.remove("light", "dark");
    document.body.classList.add(theme);
    localStorage.setItem("theme", theme);
  }, [theme]);

  const toggleTheme = (event) => {
    if (busy.current) return;
    const update=()=>setTheme(prev=>prev==='light'?'dark':'light');
    if (!document.startViewTransition || window.matchMedia('(prefers-reduced-motion: reduce)').matches) { update(); return; }
    const rect=event?.currentTarget?.getBoundingClientRect?.();
    const x=rect?rect.left+rect.width/2:window.innerWidth/2, y=rect?rect.top+rect.height/2:window.innerHeight/2;
    const radius=Math.hypot(Math.max(x,window.innerWidth-x),Math.max(y,window.innerHeight-y));
    busy.current=true;
    let current;
    try { current=document.startViewTransition(()=>flushSync(update)); }
    catch { busy.current=false;update();return; }
    transition.current=current;
    current.ready.then(()=>document.documentElement.animate({clipPath:[`circle(0px at ${x}px ${y}px)`,`circle(${radius}px at ${x}px ${y}px)`]},
      {duration:540,easing:'cubic-bezier(.2,.7,.2,1)',pseudoElement:'::view-transition-new(root)'})).catch(()=>current.skipTransition());
    current.finished.catch(()=>{}).finally(()=>{busy.current=false;transition.current=null;});
  };

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => useContext(ThemeContext) || { theme: 'light', toggleTheme: () => {} };
