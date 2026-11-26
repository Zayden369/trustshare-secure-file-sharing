import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { MemoryRouter, useNavigate } from 'react-router-dom';
import ScrollToTop from '../ScrollToTop';

function Navigation() {
  const navigate=useNavigate();
  return <><button onClick={()=>navigate('/my-files')}>Open files</button><button onClick={()=>navigate('/my-files#chapter')}>Jump to chapter</button></>;
}
test('preserves browser restoration on initial load and resets only on pathname navigation',()=>{
  const scroll=jest.spyOn(window,'scrollTo').mockImplementation(()=>{});
  render(<React.StrictMode><MemoryRouter><ScrollToTop/><Navigation/></MemoryRouter></React.StrictMode>);
  expect(scroll).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button',{name:'Open files'}));
  expect(scroll).toHaveBeenCalledTimes(1);
  expect(scroll).toHaveBeenLastCalledWith({top:0,left:0,behavior:'instant'});
  fireEvent.click(screen.getByRole('button',{name:'Jump to chapter'}));
  expect(scroll).toHaveBeenCalledTimes(1);
  scroll.mockRestore();
});

test('waits for lazy route height before restoring a saved reload position',()=>{
  const entryDescriptor=Object.getOwnPropertyDescriptor(performance,'getEntriesByType');
  const heightDescriptor=Object.getOwnPropertyDescriptor(document.documentElement,'scrollHeight');
  const readyDescriptor=Object.getOwnPropertyDescriptor(document,'readyState');
  Object.defineProperty(performance,'getEntriesByType',{configurable:true,value:()=>[{type:'reload'}]});
  Object.defineProperty(document,'readyState',{configurable:true,get:()=> 'complete'});
  let height=window.innerHeight, pending;
  Object.defineProperty(document.documentElement,'scrollHeight',{configurable:true,get:()=>height});
  const frame=jest.spyOn(window,'requestAnimationFrame').mockImplementation(callback=>{pending=callback;return 17;});
  const scroll=jest.spyOn(window,'scrollTo').mockImplementation(()=>{});
  sessionStorage.setItem('trustshare:scroll:/','1440');
  const {unmount}=render(<MemoryRouter><ScrollToTop/></MemoryRouter>);
  act(()=>pending(0));
  expect(scroll).not.toHaveBeenCalled();
  height=6000;
  fireEvent(window,new Event('resize'));
  act(()=>pending(0));
  expect(scroll).toHaveBeenCalledWith({top:1440,left:0,behavior:'instant'});
  unmount();
  sessionStorage.removeItem('trustshare:scroll:/');
  frame.mockRestore();scroll.mockRestore();
  if(entryDescriptor)Object.defineProperty(performance,'getEntriesByType',entryDescriptor);else delete performance.getEntriesByType;
  if(heightDescriptor)Object.defineProperty(document.documentElement,'scrollHeight',heightDescriptor);else delete document.documentElement.scrollHeight;
  if(readyDescriptor)Object.defineProperty(document,'readyState',readyDescriptor);else delete document.readyState;
});
