import axios from 'axios';
import api,{setAuthTokens} from './api';
jest.mock('axios',()=>{
  const client=jest.fn(async config=>({data:{ok:true},config}));
  client.interceptors={request:{use:jest.fn()},response:{use:jest.fn()}};
  return {__esModule:true,default:{create:()=>client,post:jest.fn()}};
});
const refresh=api.interceptors.response.use.mock.calls[0][1];
const unauthorized=()=>({config:{url:'/api/files/',headers:{}},response:{status:401}});
beforeEach(()=>{localStorage.clear();sessionStorage.clear();axios.post.mockReset();api.mockClear();});
test('remembered and tab-only logins clear conflicting account credentials',()=>{
  localStorage.setItem('access_token','old');
  setAuthTokens('new','refresh',false);
  expect(localStorage.getItem('access_token')).toBeNull();
  expect(sessionStorage.getItem('access_token')).toBe('new');
  setAuthTokens('remembered','long',true);
  expect(sessionStorage.getItem('access_token')).toBeNull();
  expect(localStorage.getItem('refresh_token')).toBe('long');
});
test('parallel unauthorized requests share one rotation and both retry',async()=>{
  setAuthTokens('expired','old-refresh',true);
  let resolve;
  axios.post.mockReturnValue(new Promise(done=>{resolve=done;}));
  const first=refresh(unauthorized()),second=refresh(unauthorized());
  resolve({data:{access_token:'new-access',refresh_token:'new-refresh'}});
  await Promise.all([first,second]);
  expect(axios.post).toHaveBeenCalledTimes(1);expect(api).toHaveBeenCalledTimes(2);
  expect(localStorage.getItem('refresh_token')).toBe('new-refresh');
});
test('a late refresh cannot resurrect a logged-out session',async()=>{
  setAuthTokens('expired','old-refresh',true);
  let resolve;axios.post.mockReturnValue(new Promise(done=>{resolve=done;}));
  const result=refresh(unauthorized());localStorage.clear();
  resolve({data:{access_token:'new-access',refresh_token:'new-refresh'}});
  await expect(result).rejects.toHaveProperty('response.status',401);
  expect(localStorage.getItem('access_token')).toBeNull();
});
test('a late refresh cannot replace a newly selected account',async()=>{
  setAuthTokens('account-a','refresh-a',true);
  let resolve;axios.post.mockReturnValue(new Promise(done=>{resolve=done;}));
  const result=refresh(unauthorized());setAuthTokens('account-b','refresh-b',true);
  resolve({data:{access_token:'new-a',refresh_token:'new-refresh-a'}});
  await expect(result).rejects.toHaveProperty('response.status',401);
  expect(localStorage.getItem('access_token')).toBe('account-b');
});
