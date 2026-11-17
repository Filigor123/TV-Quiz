import assert from 'node:assert/strict';
import worker from '../relay/worker.mjs';
import {createDatabase} from './relay-test-server.mjs';
const DB=createDatabase();
async function call(path,method='GET',token='',body){
 const result=await worker.fetch(new Request('https://relay.test'+path,{method,headers:{Origin:'https://filigor123.github.io',...(token?{Authorization:'Bearer '+token}:{}),'Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body)}),{DB});
 return {status:result.status,body:await result.json()};
}
try{
 const room=(await call('/api/rooms','POST')).body, path='/api/rooms/'+room.id;
 const other=(await call('/api/rooms','POST')).body;
 const a=(await call(path+'/players','POST')).body,b=(await call(path+'/players','POST')).body;
 assert.equal((await call(path+'/events')).status,401);
 assert.equal((await call(path+'/events','GET',other.token)).status,401);
 assert.equal((await call(path,'DELETE',a.token)).status,403);
 assert.equal((await call(path+'/players/'+b.id,'DELETE',a.token)).status,403);
 assert.equal((await call(path+'/messages','POST',a.token,{messages:[{to:b.id,nonce:'1',data:{type:'fake'}}]})).status,403);
 const message={messages:[{to:'host',nonce:'1',data:{type:'answer',answer:2}}]};
 assert.equal((await call(path+'/messages','POST',a.token,message)).status,200);
 assert.equal((await call(path+'/messages','POST',a.token,message)).status,200);
 const events=(await call(path+'/events','GET',room.token)).body.events;
 assert.equal(events.filter(e=>e.kind==='data').length,1,'retry is idempotent');
 assert.equal((await call(path+'/events','GET',b.token)).body.events.length,0,'players cannot read each other');
 await call(path+'/messages','POST',room.token,{messages:[{to:b.id,nonce:'2',data:{type:'question',text:'test'}}]});
 assert.equal((await call(path+'/events','GET',b.token)).body.events.length,1);
 assert.equal((await call(path+'/messages','POST',a.token,{messages:[{to:'host',nonce:'3',data:{text:'x'.repeat(70000)}}]})).status,413);
 await DB.prepare('UPDATE rooms SET expires_at=0 WHERE id=?').bind(room.id).run();
 assert.equal((await call(path+'/events','GET',room.token)).status,410);
 assert.equal((await DB.prepare('SELECT COUNT(*) AS n FROM players WHERE room_id=?').bind(room.id).first()).n,0);
 assert.equal((await DB.prepare('SELECT COUNT(*) AS n FROM messages WHERE room_id=?').bind(room.id).first()).n,0);
 console.log('PASS relay API: room/role isolation, bearer auth, idempotent delivery, payload cap, expiry and cascade deletion.');
}finally{DB.close()}
