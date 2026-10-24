export function parseAuthRequired(value) {
  if(value===undefined||value===true||value==='true')return true;
  if(value===false||value==='false')return false;
  throw new Error('AUTH_REQUIRED must be true or false (defaults to true when omitted).');
}

export function authenticationConfig({authRequired,password,token}) {
  authRequired=parseAuthRequired(authRequired);
  if(!authRequired)return {authRequired,password:undefined,token:undefined};
  if(typeof password!=='string'||password.startsWith('replace-')||password.length<16||password.length>1024)
    throw new Error('AUTH_REQUIRED=true requires CONTROL_PASSWORD (16–1024 characters; replace example values).');
  if(typeof token!=='string'||token.startsWith('replace-')||token.length<24)
    throw new Error('AUTH_REQUIRED=true requires OVERLAY_TOKEN (24+ characters; replace example values).');
  return {authRequired,password,token};
}
