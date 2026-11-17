// Read optional private-preview credentials from stdin, never from argv or a file.
import assert from 'node:assert/strict';
import readline from 'node:readline';
if(process.stdin.isTTY)process.stdin.setRawMode(true);
const lines=readline.createInterface({input:process.stdin});
let input='';for await(const line of lines){input=line;break;}lines.close();if(process.stdin.isTTY)process.stdin.setRawMode(false);process.stdin.pause();
const config=JSON.parse(input||'{}');
const base='https://tv-quiz-rooms.cleverpineapple8.chatgpt.site';
const origin='https://filigor123.github.io';
async function call(path,method='GET',token='',body){
 const response=await fetch(base+path,{method,headers:{Origin:origin,'Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{}),...(config.previewToken?{'OAI-Sites-Authorization':'Bearer '+config.previewToken}:{})},body:body===undefined?undefined:JSON.stringify(body),signal:AbortSignal.timeout(15000),redirect:'error'});
 assert.equal(response.headers.get('access-control-allow-origin'),origin,'GitHub Pages CORS');
 return {status:response.status,body:await response.json()};
}
const room=(await call('/api/rooms','POST'));
assert.equal(room.status,201);
const path='/api/rooms/'+room.body.id;
try{
 const preflight=await call(path+'/events','OPTIONS');assert.equal(preflight.status,200);
 const player=await call(path+'/players','POST');assert.equal(player.status,201);
 assert.equal((await call(path+'/events')).status,401);
 assert.equal((await call(path,'DELETE',player.body.token)).status,403);
 assert.equal((await call(path+'/messages','POST',player.body.token,{messages:[{to:'host',nonce:'smoke-1',data:{type:'join',name:'HTTPS smoke',avatar:'🙂'}}]})).status,200);
 const hostEvents=(await call(path+'/events','GET',room.body.token)).body.events;
 assert.equal(hostEvents.filter(e=>e.kind==='connect').length,1);
 assert.equal(hostEvents.find(e=>e.kind==='data').data.name,'HTTPS smoke');
 await call(path+'/messages','POST',room.body.token,{messages:[{to:player.body.id,nonce:'smoke-2',data:{type:'state',phase:'lobby'}}]});
 const phoneEvents=(await call(path+'/events','GET',player.body.token)).body.events;
 assert.equal(phoneEvents[0].data.phase,'lobby');
}finally{assert.equal((await call(path,'DELETE',room.body.token)).status,200);}
assert.equal((await call(path+'/events','GET',room.body.token)).status,404);
console.log('PASS deployed Worker/D1: create/join, two-way messages, CORS, role isolation and deletion ('+(config.previewToken?'private preview':'anonymous public access')+').');
