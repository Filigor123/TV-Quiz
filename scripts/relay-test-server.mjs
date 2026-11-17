import {DatabaseSync} from 'node:sqlite';
import fs from 'node:fs';
import http from 'node:http';
import worker from '../relay/worker.mjs';
export function createDatabase(){
 const sqlite=new DatabaseSync(':memory:');sqlite.exec('PRAGMA foreign_keys=ON');
 sqlite.exec(fs.readFileSync(new URL('../relay/drizzle/0000_rooms.sql',import.meta.url),'utf8'));
 function statement(sql,args=[]){return {bind:(...values)=>statement(sql,values),async first(){return sqlite.prepare(sql).get(...args)||null},async all(){return {results:sqlite.prepare(sql).all(...args)}},async run(){const r=sqlite.prepare(sql).run(...args);return {meta:{changes:Number(r.changes),last_row_id:Number(r.lastInsertRowid)}}}};}
 return {prepare:sql=>statement(sql),async batch(statements){sqlite.exec('BEGIN');try{const results=[];for(const s of statements)results.push(await s.run());sqlite.exec('COMMIT');return results}catch(e){sqlite.exec('ROLLBACK');throw e}},close:()=>sqlite.close()};
}
export async function startRelay(){
 const DB=createDatabase();
 const server=http.createServer(async(req,res)=>{
  try{
   const chunks=[];for await(const chunk of req)chunks.push(chunk);
   const body=Buffer.concat(chunks);
   const result=await worker.fetch(new Request('http://localhost'+req.url,{method:req.method,headers:req.headers,body:body.length?body:undefined}),{DB});
   res.writeHead(result.status,Object.fromEntries(result.headers));res.end(Buffer.from(await result.arrayBuffer()));
  }catch(error){res.writeHead(500).end(String(error));}
 });
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 return {DB,url:'http://127.0.0.1:'+server.address().port,async close(){await new Promise(resolve=>server.close(resolve));DB.close()}};
}
