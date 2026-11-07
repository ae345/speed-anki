'use strict';
/* スピード暗記帳 — PC sync server.
   Serves the app, stores each person's data, and opens a Cloudflare quick tunnel so phones can reach it from anywhere.
   The tunnel URL is published to a secret GitHub gist so the app can find it after the PC restarts. */
const http=require('http'),fs=require('fs'),path=require('path'),crypto=require('crypto'),{spawn,execFile}=require('child_process');

const PORT=Number(process.env.PORT)||18787;
const ROOT=path.resolve(__dirname,'..');
const DIR=__dirname;
const DATA=path.join(DIR,'data');
const LOG=path.join(DIR,'server.log');
const CONFIG=path.join(DIR,'config.json');
const ORIGINS=['https://ae345.github.io'];
const MAX_BODY=2*1024*1024;
const CLOUDFLARED=[process.env.CLOUDFLARED,'C:\\Program Files (x86)\\cloudflared\\cloudflared.exe','C:\\Program Files\\cloudflared\\cloudflared.exe','cloudflared'].filter(Boolean).find(p=>p==='cloudflared'||fs.existsSync(p));

fs.mkdirSync(DATA,{recursive:true});
function log(...a){const line=new Date().toISOString()+' '+a.join(' ')+'\n';try{fs.appendFileSync(LOG,line)}catch(e){}process.stdout.write(line)}
function readJSON(f,def){try{return JSON.parse(fs.readFileSync(f,'utf8'))}catch(e){return def}}
function writeJSON(f,v){const tmp=f+'.'+process.pid+'.tmp';fs.writeFileSync(tmp,JSON.stringify(v,null,1));fs.renameSync(tmp,f)}

/* ---------- state ---------- */
const PF=path.join(DATA,'profiles.json'),KF=path.join(DATA,'keys.json');
let profiles=readJSON(PF,null);if(!Array.isArray(profiles)||!profiles.length){profiles=[{id:'me',name:'自分'}];writeJSON(PF,profiles)}
let keys=readJSON(KF,{});
let config=readJSON(CONFIG,{});
const pairCodes=new Map();// code -> expires
const tunnel={url:'',state:'starting',published:'',error:''};
const dataFile=id=>path.join(DATA,id+'.json');
const validId=id=>/^[a-z0-9_-]{1,40}$/i.test(id||'');

/* ---------- helpers ---------- */
function isLocal(req){const a=req.socket.remoteAddress||'';return (a==='127.0.0.1'||a==='::1'||a==='::ffff:127.0.0.1')&&!req.headers['cf-connecting-ip']&&!req.headers['x-forwarded-for']&&!req.headers['cf-ray']}
function authed(req){if(isLocal(req))return true;const k=req.headers['x-key'];return typeof k==='string'&&Object.prototype.hasOwnProperty.call(keys,k)}
function cors(req,res){
  const o=req.headers.origin;
  if(o&&(ORIGINS.includes(o)||/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(o))){
    res.setHeader('Access-Control-Allow-Origin',o);res.setHeader('Vary','Origin');
    res.setHeader('Access-Control-Allow-Headers','Content-Type, X-Key');res.setHeader('Access-Control-Allow-Methods','GET, PUT, POST, OPTIONS');res.setHeader('Access-Control-Max-Age','600');
  }
}
function send(res,code,obj){const b=JSON.stringify(obj);res.writeHead(code,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});res.end(b)}
function body(req){return new Promise((ok,ng)=>{let n=0;const ch=[];req.on('data',c=>{n+=c.length;if(n>MAX_BODY){ng(new Error('too big'));req.destroy()}else ch.push(c)});req.on('end',()=>{try{ok(ch.length?JSON.parse(Buffer.concat(ch).toString('utf8')):{})}catch(e){ng(e)}});req.on('error',ng)})}
const MIME={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.json':'application/json','.webmanifest':'application/manifest+json','.png':'image/png','.svg':'image/svg+xml','.css':'text/css','.md':'text/markdown; charset=utf-8'};

/* ---------- api ---------- */
async function api(req,res,p){
  const local=isLocal(req);
  if(p==='/api/hello'&&req.method==='GET')return send(res,200,{ok:true,app:'speed-anki',local,authed:authed(req)});
  if(p==='/api/pair'&&req.method==='POST'){
    const b=await body(req);const code=String(b.code||'').replace(/\D/g,'');const exp=pairCodes.get(code);
    if(!exp||exp<Date.now())return send(res,403,{error:'bad_code'});
    pairCodes.delete(code);const key=crypto.randomBytes(24).toString('hex');keys[key]={created:new Date().toISOString(),name:String(b.device||'').slice(0,40)};writeJSON(KF,keys);
    log('paired a device');return send(res,200,{key,profiles});
  }
  if(!authed(req))return send(res,401,{error:'unauthorized'});
  if(p==='/api/pair-code'&&req.method==='GET'){
    if(!local)return send(res,403,{error:'local_only'});
    for(const [c,e] of pairCodes)if(e<Date.now())pairCodes.delete(c);
    let code;do{code=String(crypto.randomInt(0,1000000)).padStart(6,'0')}while(pairCodes.has(code));
    const exp=Date.now()+10*60e3;pairCodes.set(code,exp);return send(res,200,{code,exp});
  }
  if(p==='/api/status'&&req.method==='GET')return send(res,200,{tunnel,devices:Object.keys(keys).length,profiles,local,gist:config.gistId||''});
  if(p==='/api/profiles'&&req.method==='GET')return send(res,200,{profiles});
  if(p==='/api/profiles'&&req.method==='POST'){
    if(!local)return send(res,403,{error:'local_only'});
    const b=await body(req);const name=String(b.name||'').trim().slice(0,20);if(!name)return send(res,400,{error:'name'});
    const id='p'+crypto.randomBytes(4).toString('hex');profiles.push({id,name});writeJSON(PF,profiles);return send(res,200,{profiles,id});
  }
  const m=p.match(/^\/api\/profiles\/([^/]+)$/);
  if(m&&req.method==='POST'){
    if(!local)return send(res,403,{error:'local_only'});
    const b=await body(req),pr=profiles.find(x=>x.id===m[1]);if(!pr)return send(res,404,{error:'not_found'});
    if(b.delete){if(pr.id==='me')return send(res,400,{error:'cannot_delete'});profiles=profiles.filter(x=>x.id!==pr.id);writeJSON(PF,profiles);try{fs.renameSync(dataFile(pr.id),dataFile(pr.id)+'.deleted-'+Date.now())}catch(e){}return send(res,200,{profiles})}
    const name=String(b.name||'').trim().slice(0,20);if(name){pr.name=name;writeJSON(PF,profiles)}return send(res,200,{profiles});
  }
  const dm=p.match(/^\/api\/data\/([^/]+)$/);
  if(dm){
    const id=dm[1];if(!validId(id)||!profiles.find(x=>x.id===id))return send(res,404,{error:'no_profile'});
    const cur=readJSON(dataFile(id),{rev:0,json:null});
    if(req.method==='GET')return send(res,200,{rev:cur.rev,json:cur.json});
    if(req.method==='PUT'){
      const b=await body(req);
      if(Number(b.baseRev)!==cur.rev)return send(res,409,{rev:cur.rev,json:cur.json});
      if(typeof b.json!=='string')return send(res,400,{error:'json'});
      const next={rev:cur.rev+1,json:b.json,updatedAt:new Date().toISOString()};writeJSON(dataFile(id),next);
      return send(res,200,{rev:next.rev});
    }
  }
  if(p==='/api/keys/forget'&&req.method==='POST'&&local){keys={};writeJSON(KF,keys);return send(res,200,{ok:true})}
  return send(res,404,{error:'not_found'});
}

/* ---------- static files ---------- */
function serveStatic(req,res,p){
  if(req.method!=='GET'&&req.method!=='HEAD'){res.writeHead(405);return res.end()}
  let rel=decodeURIComponent(p).replace(/^\/+/,'');if(!rel)rel='index.html';
  const full=path.resolve(ROOT,rel);
  const inside=full.startsWith(ROOT+path.sep);
  const hidden=rel.split(/[\\/]/).some(s=>s.startsWith('.'))||full.startsWith(DIR+path.sep)||full===DIR;
  if(!inside||hidden){res.writeHead(404);return res.end('not found')}
  fs.stat(full,(err,st)=>{
    if(err||!st.isFile()){res.writeHead(404);return res.end('not found')}
    res.writeHead(200,{'Content-Type':MIME[path.extname(full).toLowerCase()]||'application/octet-stream','Cache-Control':'no-cache'});
    if(req.method==='HEAD')return res.end();
    fs.createReadStream(full).pipe(res);
  });
}

const server=http.createServer(async(req,res)=>{
  try{
    cors(req,res);
    if(req.method==='OPTIONS'){res.writeHead(204);return res.end()}
    const p=new URL(req.url,'http://x').pathname;
    if(p.startsWith('/api/'))return await api(req,res,p);
    return serveStatic(req,res,p);
  }catch(e){log('error',e&&e.message);if(!res.headersSent)send(res,400,{error:'bad_request'})}
});
server.on('error',e=>{log('server error',e.message);if(e.code==='EADDRINUSE'){log('port '+PORT+' already in use; another server is probably running');process.exit(1)}});
server.listen(PORT,'127.0.0.1',()=>{log('listening on http://localhost:'+PORT);startTunnel()});

/* ---------- tunnel + gist ---------- */
function gh(args){return new Promise((ok,ng)=>execFile('gh',args,{windowsHide:true,maxBuffer:1e6},(e,out,err)=>e?ng(new Error((err||e.message).trim())):ok(out)))}
async function ensureGist(){
  if(config.gistId)return config.gistId;
  const tmp=path.join(DIR,'server.json.tmp');fs.writeFileSync(tmp,JSON.stringify({url:'',updated:''}));
  try{
    const out=await gh(['gist','create',tmp,'--filename','server.json','--desc','speed-anki server address']);
    const id=(out.trim().match(/([0-9a-f]{20,})\s*$/)||[])[1];if(!id)throw new Error('no gist id in: '+out);
    config.gistId=id;writeJSON(CONFIG,config);log('created gist',id);return id;
  }finally{try{fs.unlinkSync(tmp)}catch(e){}}
}
async function publish(url){
  try{
    const id=await ensureGist();
    const payload=JSON.stringify({files:{'server.json':{content:JSON.stringify({url,updated:new Date().toISOString()})}}});
    await new Promise((ok,ng)=>{const c=execFile('gh',['api','-X','PATCH','gists/'+id,'--input','-'],{windowsHide:true},(e,o,er)=>e?ng(new Error((er||e.message).trim())):ok());c.stdin.end(payload)});
    tunnel.published=url;tunnel.error='';log('published tunnel url to gist');
  }catch(e){tunnel.error='gist: '+e.message;log('publish failed',e.message);setTimeout(()=>publish(url),60e3)}
}
let tunnelProc=null,restarts=0;
function startTunnel(){
  if(!CLOUDFLARED){tunnel.state='missing';log('cloudflared not found');return}
  tunnel.state='starting';tunnel.url='';
  const proc=spawn(CLOUDFLARED,['tunnel','--no-autoupdate','--url','http://localhost:'+PORT],{windowsHide:true});
  tunnelProc=proc;
  const onData=d=>{const s=d.toString();const m=s.match(/https:\/\/[a-z0-9-]+\.trycloudflare\.com/);if(m&&m[0]!==tunnel.url){tunnel.url=m[0];tunnel.state='up';restarts=0;log('tunnel up',m[0]);publish(m[0])}};
  proc.stdout.on('data',onData);proc.stderr.on('data',onData);
  proc.on('exit',code=>{tunnel.state='down';log('tunnel exited',code);if(tunnelProc!==proc)return;const wait=Math.min(300,10*Math.pow(2,restarts++));setTimeout(startTunnel,wait*1000)});
}
function shutdown(){try{tunnelProc&&tunnelProc.kill()}catch(e){}process.exit(0)}
process.on('SIGINT',shutdown);process.on('SIGTERM',shutdown);
