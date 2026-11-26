import React from 'react';
import {render,screen,waitFor,fireEvent} from '@testing-library/react';
import '@testing-library/jest-dom';
import {AuthProvider,useAuth} from './AuthContext';
import {authAPI} from '../utils/api';
jest.mock('../utils/api',()=>({authAPI:{me:jest.fn(),login:jest.fn(),logout:jest.fn()},setAuthTokens:jest.fn()}));
function Probe(){const {user,loading,login,logout}=useAuth();return <><span>{loading?'Checking session':user?.name||'Signed out'}</span><button onClick={()=>login('other@gmail.com','password')}>Login</button><button onClick={logout}>Logout</button></>;}
beforeEach(()=>{jest.clearAllMocks();localStorage.clear();sessionStorage.clear();});
test('a cached profile without a token cannot restore a session',async()=>{
  localStorage.setItem('user',JSON.stringify({name:'Forged admin',role:'admin'}));
  render(<AuthProvider><Probe/></AuthProvider>);
  expect(await screen.findByText('Signed out')).toBeInTheDocument();expect(authAPI.me).not.toHaveBeenCalled();
});
test('restoration waits for server confirmation and rejects invalid sessions',async()=>{
  localStorage.setItem('access_token','invalid');authAPI.me.mockRejectedValue(new Error('revoked'));
  render(<AuthProvider><Probe/></AuthProvider>);
  expect(await screen.findByText('Signed out')).toBeInTheDocument();
  expect(localStorage.getItem('access_token')).toBeNull();
});
test('a remembered account changed in another tab is revalidated',async()=>{
  localStorage.setItem('access_token','account-a');authAPI.me.mockResolvedValueOnce({data:{name:'Account A'}}).mockResolvedValueOnce({data:{name:'Account B'}});
  render(<AuthProvider><Probe/></AuthProvider>);
  await screen.findByText('Account A');localStorage.setItem('access_token','account-b');
  fireEvent(window,new StorageEvent('storage',{key:'access_token',newValue:'account-b'}));
  expect(await screen.findByText('Account B')).toBeInTheDocument();expect(authAPI.me).toHaveBeenCalledTimes(2);
});
test('MFA pending login clears the previous account without setting new credentials',async()=>{
  localStorage.setItem('access_token','account-a');authAPI.me.mockResolvedValue({data:{name:'Account A'}});authAPI.login.mockResolvedValue({data:{mfa_required:true,mfa_token:'pending'}});
  render(<AuthProvider><Probe/></AuthProvider>);await screen.findByText('Account A');
  fireEvent.click(screen.getByText('Login'));
  await waitFor(()=>expect(screen.getByText('Signed out')).toBeInTheDocument());
  expect(localStorage.getItem('access_token')).toBeNull();
});
