// Peer-compatible HTTPS transport. No WebRTC or third-party signalling required.
(() => {
 'use strict';
 const base = 'https://tv-quiz-rooms.cleverpineapple8.chatgpt.site';
 class Events {
  constructor(){this.handlers={};}
  on(name,fn){(this.handlers[name]||(this.handlers[name]=[])).push(fn);return this;}
  emit(name,...args){for(const fn of this.handlers[name]||[])fn(...args);}
 }
 class Connection extends Events {
  constructor(owner,id){super();this.owner=owner;this.peer=id;this.open=true;this.lastSeen=Date.now();}
  send(data){if(this.open)this.owner.enqueue(this.owner.isHost?this.peer:'host',data);}
  close(){if(!this.open)return;this.open=false;this.owner.peers.delete(this.peer);this.emit('close');if(this.owner.room&&!this.owner.destroyed)void this.owner.request('/players/'+(this.owner.isHost?this.peer:this.owner.id),'DELETE').catch(()=>{});}
 }
 class RelayPeer extends Events {
  constructor(isHost){
   super();this.isHost=isHost;this.id='';this.room='';this.token='';this.destroyed=false;this.peers=new Map();this.cursor=0;this.queue=[];this.sending=false;this.sequence=0;this.failures=0;
   this.onPageHide=()=>this.destroy();window.addEventListener('pagehide',this.onPageHide);
   if(isHost)this.create();else setTimeout(()=>{if(!this.destroyed)this.emit('open')},0);
  }
  async request(path,method='GET',body){
   const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),10000);
   try{
    const response=await fetch(base+(this.room?'/api/rooms/'+this.room:'/api/rooms')+path,{method,headers:{'Content-Type':'application/json',...(this.token?{Authorization:'Bearer '+this.token}:{})},body:body===undefined?undefined:JSON.stringify(body),signal:controller.signal,cache:'no-store',keepalive:method==='DELETE'});
    const result=await response.json();
    if(!response.ok){const error=new Error(result.error||'network');error.type=result.error||'network';error.permanent=response.status>=400&&response.status<500;throw error;}
    return result;
   }finally{clearTimeout(timeout);}
  }
  async create(){
   try{const result=await this.request('','POST');this.id=this.room=result.id;this.token=result.token;if(this.destroyed){void this.request('','DELETE').catch(()=>{});return;}this.emit('open',this.id);this.poll();}
   catch(error){if(!this.destroyed)this.fail(error);}
  }
  connect(room){
   this.room=room;const connection=new Connection(this,room);connection.open=false;this.peers.set(room,connection);
   this.request('/players','POST').then(result=>{
    this.id=result.id;this.token=result.token;
    if(this.destroyed){void this.request('/players/'+this.id,'DELETE').catch(()=>{});return;}
    connection.open=true;connection.emit('open');this.poll();
   }).catch(error=>{if(!this.destroyed)this.fail(error);});
   return connection;
  }
  async poll(){
   if(this.destroyed)return;
   try{
    const result=await this.request('/events?after='+this.cursor);
    if(this.destroyed)return;this.failures=0;
    for(const event of result.events){
     if(this.destroyed)return;
     this.cursor=event.id;
     if(this.isHost){
      if(event.kind==='connect'){
       const connection=new Connection(this,event.sender);this.peers.set(event.sender,connection);this.emit('connection',connection);
      }else if(event.kind==='close'){
       const connection=this.peers.get(event.sender);if(connection){connection.open=false;this.peers.delete(event.sender);connection.emit('close');}
      }else this.receive(this.peers.get(event.sender),event.data);
     }else if(event.kind==='data')this.receive(this.peers.get(this.room),event.data);
    }
    const now=Date.now();
    for(const connection of this.peers.values())if(now-connection.lastSeen>30000){connection.close();if(!this.isHost){this.fail({type:'network',message:'Host stopped responding'});return;}}
    if(!this.lastPulse||now-this.lastPulse>5000){this.lastPulse=now;for(const connection of this.peers.values())connection.send({__transport:'ping'});}
   }catch(error){if(this.destroyed)return;if(error.permanent||++this.failures>=3){this.fail(error);return;}}
   this.pollTimer=setTimeout(()=>this.poll(),this.failures?1500:400);
  }
  receive(connection,data){if(!connection)return;connection.lastSeen=Date.now();if(data.__transport!=='ping')connection.emit('data',data);}
  enqueue(to,data){
   // Serialize now: callers may subsequently mutate their game state.
   this.queue.push({to,data:JSON.parse(JSON.stringify(data)),nonce:'m-'+(++this.sequence)});
   if(!this.sending){this.sending=true;this.sendTimer=setTimeout(()=>this.flush(),0);}
  }
  async flush(){
   while(this.queue.length&&!this.destroyed){
    const messages=this.queue.slice(0,24);let sent=false;
    for(let attempt=0;attempt<3&&!this.destroyed;attempt++){
     try{await this.request('/messages','POST',{messages});sent=true;break;}
     catch(error){if(error.permanent||attempt===2){this.fail(error);return;}await new Promise(resolve=>setTimeout(resolve,700));}
    }
    if(sent)this.queue.splice(0,messages.length);
   }
   this.sending=false;
  }
  fail(error){
   if(this.destroyed)return;
   this.emit('error',{type:error.type||'network',message:error.message});this.destroy();
  }
  destroy(){
   if(this.destroyed)return;this.destroyed=true;clearTimeout(this.pollTimer);clearTimeout(this.sendTimer);this.queue=[];window.removeEventListener('pagehide',this.onPageHide);
   for(const connection of this.peers.values()){connection.open=false;connection.emit('close');}this.peers.clear();
   if(this.token&&this.room)void this.request(this.isHost?'':'/players/'+this.id,'DELETE').catch(()=>{});
  }
 }
 window.QuizTransport=Object.freeze({
  host:()=>new RelayPeer(true),
  player:hostId=>hostId.startsWith('r1-')?new RelayPeer(false):new Peer(QuizPeerId.create())
 });
})();
