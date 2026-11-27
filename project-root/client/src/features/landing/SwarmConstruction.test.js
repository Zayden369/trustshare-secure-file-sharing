import React from 'react';
import '@testing-library/jest-dom';
import {act,fireEvent,render,screen} from '@testing-library/react';
import SwarmConstruction from './SwarmConstruction';
import {useReducedMotion} from 'framer-motion';
jest.mock('framer-motion',()=>({useReducedMotion:jest.fn()}));
let observe;
beforeEach(()=>{
  jest.useFakeTimers();useReducedMotion.mockReturnValue(false);
  window.IntersectionObserver=class {constructor(callback){observe=callback;}observe(){}disconnect(){}};
});
afterEach(()=>{jest.useRealTimers();delete window.IntersectionObserver;});
test('starts on entry and completes on its deadline after leaving the viewport',()=>{
  const {container}=render(<SwarmConstruction/>);
  const scene=container.querySelector('section');
  act(()=>jest.advanceTimersByTime(20000));
  expect(scene.dataset.constructionState).toBeUndefined();
  act(()=>observe([{isIntersecting:true}]));
  act(()=>jest.advanceTimersByTime(3500));
  act(()=>observe([{isIntersecting:false}]));
  act(()=>jest.advanceTimersByTime(10000));
  expect(screen.getByRole('status')).toHaveTextContent('Workspace assembled');
  expect(Number(scene.dataset.completedAt)-Number(scene.dataset.activatedAt)).toBe(13500);
  act(()=>observe([{isIntersecting:true}]));
  expect(scene.dataset.constructionState).toBe('complete');
});
test('skip completes immediately without changing the workspace destination',()=>{
  render(<SwarmConstruction/>);
  const skip=screen.getByRole('link',{name:/skip/i});
  expect(skip).toHaveAttribute('href','#product');fireEvent.click(skip);
  expect(screen.getByRole('status')).toHaveTextContent('Workspace assembled');
});
test('reduced motion presents the complete interface immediately',()=>{
  useReducedMotion.mockReturnValue(true);render(<SwarmConstruction/>);
  expect(screen.getByRole('status')).toHaveTextContent('Workspace assembled');
});

test('the homepage tour shares its window budget and can finish or replay the nested scene',()=>{
  const {container}=render(<div className="m-home" data-construction-window-ms="600"><SwarmConstruction/></div>);
  const page=container.querySelector('.m-home');
  act(()=>observe([{isIntersecting:true}]));
  act(()=>jest.advanceTimersByTime(600));
  expect(screen.getByRole('status')).toHaveTextContent('Workspace assembled');
  act(()=>page.dispatchEvent(new Event('trustshare:replay-construction')));
  expect(screen.getByRole('status')).toHaveTextContent('Constructing');
  act(()=>page.dispatchEvent(new Event('trustshare:finish-construction')));
  expect(screen.getByRole('status')).toHaveTextContent('Workspace assembled');
});
test('consecutive replays keep one cursor set and each deadline',()=>{
  const {container}=render(<SwarmConstruction/>);
  act(()=>observe([{isIntersecting:true}]));
  for(let run=0;run<3;run++){
    act(()=>jest.advanceTimersByTime(13500));
    expect(screen.getByRole('status')).toHaveTextContent('Workspace assembled');
    expect(container.querySelectorAll('[data-agent]')).toHaveLength(16);
    fireEvent.click(screen.getByRole('button',{name:/replay construction/i}));
    act(()=>observe([{isIntersecting:true}]));
    expect(screen.getByRole('status')).toHaveTextContent('Constructing');
  }
});
