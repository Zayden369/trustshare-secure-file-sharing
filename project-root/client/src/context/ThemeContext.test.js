import React from 'react';
import '@testing-library/jest-dom';
import {act,fireEvent,render,screen} from '@testing-library/react';
import {ThemeProvider,useTheme} from './ThemeContext';
const Switch=()=>{const {theme,toggleTheme}=useTheme();return <button onClick={toggleTheme}>{theme}</button>;};
beforeEach(()=>{localStorage.clear();window.matchMedia=jest.fn(()=>({matches:false}));delete document.startViewTransition;});
afterEach(()=>{delete document.startViewTransition;});
test('fallback persists theme without moving the page',()=>{
  const scroll=jest.spyOn(window,'scrollTo').mockImplementation(()=>{});
  render(<ThemeProvider><Switch/></ThemeProvider>);fireEvent.click(screen.getByRole('button'));
  expect(document.body).toHaveClass('dark');expect(localStorage.getItem('theme')).toBe('dark');expect(scroll).not.toHaveBeenCalled();scroll.mockRestore();
});
test('an unavailable transition API cannot leave the control locked',()=>{
  document.startViewTransition=()=>{throw Error('Unsupported transition');};
  render(<ThemeProvider><Switch/></ThemeProvider>);fireEvent.click(screen.getByRole('button'));fireEvent.click(screen.getByRole('button'));
  expect(screen.getByRole('button')).toHaveTextContent('light');
});
test('rapid clicks cannot overlap a transition',async()=>{
  let finish;
  document.documentElement.animate=jest.fn();
  document.startViewTransition=jest.fn(update=>{update();return {ready:Promise.resolve(),finished:new Promise(resolve=>{finish=resolve;}),skipTransition:jest.fn()};});
  render(<ThemeProvider><Switch/></ThemeProvider>);
  fireEvent.click(screen.getByRole('button'));fireEvent.click(screen.getByRole('button'));
  expect(document.startViewTransition).toHaveBeenCalledTimes(1);
  await act(async()=>{finish();});
  expect(document.documentElement.animate).toHaveBeenCalledWith(expect.anything(),expect.objectContaining({duration:540}));
});
