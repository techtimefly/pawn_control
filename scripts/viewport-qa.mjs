// Disposable loopback-only browser QA; never reads .env or production data.
import {createApp} from '../server.mjs';
import {mkdtempSync} from 'node:fs';
import {readFile} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
const app=createApp({dataDir:mkdtempSync(join(tmpdir(),'pawn-viewport-')),authRequired:false,username:'viewport_fixture',poll:false,fetcher:async()=>new Response('{}',{status:404})});
const streams=new Set();
const handler=app.server.listeners('request')[0];app.server.removeListener('request',handler);
app.server.on('request',async(req,res)=>{
  if(req.url==='/qa/reconnect'&&req.method==='POST'){for(const stream of streams)stream.end();res.writeHead(200);res.end('disconnected');return;}
  if(req.url==='/api/events'){streams.add(res);res.on('close',()=>streams.delete(res));}
  if(req.url==='/qa'){res.writeHead(200,{'Content-Type':'text/html'});res.end(await readFile(new URL('./viewport-qa.html',import.meta.url)));}
  else handler(req,res);
});
app.server.listen(3317,'127.0.0.1',()=>console.log('Disposable QA: http://127.0.0.1:3317/qa'));
