import React from 'react';
import {render,screen,fireEvent,waitFor} from '@testing-library/react';
import '@testing-library/jest-dom';
import RegistrationVerification from './RegistrationVerification';
import {authAPI} from '../utils/api';
jest.mock('../utils/api',()=>({authAPI:{sendRegistrationCode:jest.fn(),verifyRegistrationCode:jest.fn()}}));
beforeEach(()=>jest.clearAllMocks());
test('a complete pasted code is verified by the server before showing verified status',async()=>{
  const verified=jest.fn();
  authAPI.sendRegistrationCode.mockResolvedValue({data:{challenge_id:'challenge',resend_after:60}});
  authAPI.verifyRegistrationCode.mockResolvedValue({data:{verification_token:'proof',email:'owned@gmail.com',expires_in:300}});
  render(<RegistrationVerification email="owned@gmail.com" onVerified={verified}/>);
  fireEvent.click(screen.getByRole('button',{name:'Send verification code'}));
  const input=await screen.findByLabelText('Six-digit email code');
  expect(screen.queryByRole('status')).not.toBeInTheDocument();
  fireEvent.change(input,{target:{value:'123456'}});
  fireEvent.click(screen.getByRole('button',{name:'Verify email'}));
  await waitFor(()=>expect(verified).toHaveBeenLastCalledWith(expect.objectContaining({token:'proof',email:'owned@gmail.com'})));
  expect(authAPI.verifyRegistrationCode).toHaveBeenCalledWith('challenge','123456');
  expect(screen.getByRole('status')).toHaveTextContent('Email verified');
});
test('delivery failures remain visible and never create verified state',async()=>{
  authAPI.sendRegistrationCode.mockRejectedValue({response:{data:{detail:'Email unavailable'}}});
  render(<RegistrationVerification email="owned@gmail.com" onVerified={jest.fn()}/>);
  fireEvent.click(screen.getByRole('button',{name:'Send verification code'}));
  expect(await screen.findByRole('alert')).toHaveTextContent('Email unavailable');
  expect(screen.queryByRole('status')).not.toBeInTheDocument();
});
