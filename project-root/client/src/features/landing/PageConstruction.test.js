import React,{useRef} from 'react';
import '@testing-library/jest-dom';
import {act,fireEvent,render,screen} from '@testing-library/react';
import PageConstruction from './PageConstruction';
import {useReducedMotion} from 'framer-motion';
jest.mock('framer-motion',()=>({useReducedMotion:jest.fn()}));

let y,clock,frames,frameId;
function advance(milliseconds){
  act(()=>{
    const end=clock+milliseconds;
    while(clock<end){
      const step=Math.min(16,end-clock);clock+=step;jest.advanceTimersByTime(step);
      const pending=[...frames.values()];frames.clear();pending.forEach(callback=>callback(clock));
    }
  });
}
const originalHeight=window.innerHeight;
function Example(){
  const page=useRef(null);
  return <main className="m-home" ref={page}><PageConstruction page={page}/>{[0,1000,2000,3000].map(top=><section className="archive-chapter" data-top={top} key={top}><h2>Section {top}</h2><p>Source content to assemble.</p></section>)}</main>;
}
beforeEach(()=>{
  jest.useFakeTimers();y=0;clock=0;frames=new Map();frameId=0;useReducedMotion.mockReturnValue(false);
  jest.spyOn(performance,'now').mockImplementation(()=>clock);
  Object.defineProperty(window,'scrollY',{configurable:true,get:()=>y});
  Object.defineProperty(window,'innerHeight',{configurable:true,value:800});
  window.scrollTo=jest.fn(({top})=>{y=top;});
  jest.spyOn(window,'requestAnimationFrame').mockImplementation(callback=>{frames.set(++frameId,callback);return frameId;});
  jest.spyOn(window,'cancelAnimationFrame').mockImplementation(id=>frames.delete(id));
  jest.spyOn(HTMLElement.prototype,'getBoundingClientRect').mockImplementation(function(){
    if(this.matches('main'))return {top:-y,bottom:4000-y,width:600,height:4000,left:0};
    const top=Number(this.closest('[data-top]')?.dataset.top||0)-y;
    return {top,bottom:top+100,left:0,width:600,height:100};
  });
});
afterEach(()=>{jest.restoreAllMocks();jest.useRealTimers();Object.defineProperty(window,'innerHeight',{configurable:true,value:originalHeight});});

test('waits for the current build, scrolls through every viewport and finishes before twenty seconds',()=>{
  const {container}=render(<Example/>);
  advance(100);
  expect(window.scrollTo).not.toHaveBeenCalled();
  advance(19900);
  expect(y).toBe(3200);
  expect(container.querySelector('main')).toHaveAttribute('data-page-construction','complete');
  expect(Number(container.querySelector('main').dataset.constructionElapsedMs)).toBeLessThanOrEqual(20000);
  expect([...container.querySelectorAll('.page-build-target')].every(node=>node.dataset.buildFinished==='true')).toBe(true);
  fireEvent.click(screen.getByRole('button',{name:'Replay full experience'}));
  expect(y).toBe(0);
  advance(20000);
  expect(y).toBe(3200);
  expect(container.querySelector('main')).toHaveAttribute('data-page-construction','complete');
});

test('manual wheel input stops automatic scrolling without trapping the page',()=>{
  const {container}=render(<Example/>);
  fireEvent.wheel(window);
  advance(20000);
  expect(window.scrollTo).not.toHaveBeenCalled();
  expect(container.querySelector('main')).toHaveAttribute('data-page-construction','complete');
});

test('reduced motion reveals the page immediately and never scrolls it',()=>{
  useReducedMotion.mockReturnValue(true);
  const {container}=render(<Example/>);
  expect(container.querySelector('main')).toHaveAttribute('data-page-construction','complete');
  expect(window.scrollTo).not.toHaveBeenCalled();
});
