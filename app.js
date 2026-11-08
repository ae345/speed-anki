(function(){
'use strict';
/* ---------- constants ---------- */
const SUBJECTS=['英語','論理・表現','国語','数学','理科','社会','情報','その他','全科目'];
const MARK='①②③④⑤⑥';
const LIB=Array.isArray(window.LIBRARY)?window.LIBRARY:[];
const PRESETS=Array.isArray(window.PRESETS)?window.PRESETS:[];
const TABS=['today','plan','decks','settings'];
const PKEY='speed-anki-profiles';
const WEIGHTS=[[1,'普通'],[2,'苦手'],[3,'とても苦手']];

/* ---------- small helpers ---------- */
const $=id=>document.getElementById(id);
const esc=v=>String(v==null?'':v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const pad=n=>String(n).padStart(2,'0');
function today(){const d=new Date();return d.getFullYear()+'-'+pad(d.getMonth()+1)+'-'+pad(d.getDate())}
function utc(s){const[a,b,c]=String(s).split('-').map(Number);return Date.UTC(a,b-1,c)}
function dayStart(t){const d=new Date(t);return new Date(d.getFullYear(),d.getMonth(),d.getDate()).getTime()}
function shift(s,n){const d=new Date(utc(s)+n*864e5);return d.getUTCFullYear()+'-'+pad(d.getUTCMonth()+1)+'-'+pad(d.getUTCDate())}
const dow=s=>new Date(utc(s)).getUTCDay();
function dayLabel(s){const[,b,c]=s.split('-').map(Number);return b+'月'+c+'日（'+'日月火水木金土'[dow(s)]+'）'}
const md=s=>{const[,b,c]=String(s).split('-').map(Number);return b+'/'+c};
const isDate=s=>/^\d{4}-\d{2}-\d{2}$/.test(s||'');
const diffDays=(a,b)=>Math.round((utc(b)-utc(a))/864e5);
function setMsg(id,text,ok){const el=$(id);if(!el)return;el.className=ok?'ok':'err';el.textContent=text}
const subjOrder=s=>{const i=SUBJECTS.indexOf(s);return i<0?50:i};
function rid(n){const a='ABCDEFGHJKLMNPQRSTUVWXYZ23456789';const r=new Uint32Array(n);crypto.getRandomValues(r);let s='';for(let i=0;i<n;i++)s+=a[r[i]%a.length];return s}
function stable(v){if(v===null||typeof v!=='object')return JSON.stringify(v===undefined?null:v);if(Array.isArray(v))return '['+v.map(stable).join(',')+']';return '{'+Object.keys(v).filter(k=>v[k]!==undefined).sort().map(k=>JSON.stringify(k)+':'+stable(v[k])).join(',')+'}'}
function guessYear(m,d){const now=new Date(),y=now.getFullYear();return (new Date(y,m-1,d)-now)/864e5< -180?y+1:y}
function parseDate(s){
  s=String(s||'').trim().replace(/[年月\/.]/g,'-').replace(/日/g,'').replace(/（.*?）|\(.*?\)/g,'').trim();
  let m=s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);if(m)return m[1]+'-'+pad(+m[2])+'-'+pad(+m[3]);
  m=s.match(/^(\d{1,2})-(\d{1,2})$/);if(m)return guessYear(+m[1],+m[2])+'-'+pad(+m[1])+'-'+pad(+m[2]);
  return '';
}
const DEVICE=(()=>{try{let d=localStorage.getItem('speed-anki-device');if(!d){d=rid(10);localStorage.setItem('speed-anki-device',d)}return d}catch(e){return rid(10)}})();

/* ---------- profiles & storage ---------- */
function loadProfiles(){try{const p=JSON.parse(localStorage.getItem(PKEY)||'null');if(p&&Array.isArray(p.list)&&p.list.length)return p}catch(e){}return {active:'default',list:[{id:'default',name:'自分',code:''}]}}
let P=loadProfiles();
const prof=()=>P.list.find(x=>x.id===P.active)||P.list[0];
const dataKey=id=>id==='default'?'speed-anki-v1':'speed-anki-v1:'+id;
function saveProfiles(){try{localStorage.setItem(PKEY,JSON.stringify(P))}catch(e){}}
function blankSettings(){return {examDate:'',weekdayMin:120,weekendMin:240,ankiMin:15,newLimit:40,holidays:[],offDays:[],subjects:[],extras:[],updatedAt:0}}
function blank(){return {decks:[],deletedDecks:{},srs:{cards:{},newCount:{},log:{}},settings:blankSettings(),setup:false,done:{},scores:[],updatedAt:0}}
function expandBuiltins(o){
  o.decks=o.decks.map(dk=>{
    if(!dk||!dk.builtin)return dk;const l=LIB.find(x=>x.id===dk.id);if(!l)return dk;
    if(!Array.isArray(dk.cards)||!dk.cards.length||(l.version||1)>(dk.version||1))return Object.assign({},dk,{title:l.title,subject:l.subject,version:l.version||1,cards:l.cards.map(c=>Object.assign({},c))});
    return dk;
  }).filter(Boolean);
}
function normalize(d){
  d=d&&typeof d==='object'?d:{};
  const o=Object.assign(blank(),d);
  o.srs=Object.assign(blank().srs,d.srs||{});
  o.settings=Object.assign(blankSettings(),d.settings||{});
  if(!Array.isArray(o.settings.subjects))o.settings.subjects=[];
  if(!Array.isArray(o.settings.extras))o.settings.extras=[];
  o.done=d.done&&typeof d.done==='object'?d.done:{};
  o.deletedDecks=d.deletedDecks||{};
  o.decks=Array.isArray(d.decks)?d.decks:[];
  o.scores=(Array.isArray(d.scores)?d.scores:[]).map(s=>Object.assign({id:s.id||('s'+utc(s.date||'2000-01-01')+'-'+String(s.title||'').length)},s));
  if(d.srs&&d.srs.newLimit!=null&&!(d.settings&&d.settings.newLimit!=null))o.settings.newLimit=d.srs.newLimit;
  if(d.examDate&&!o.settings.examDate)o.settings.examDate=d.examDate;
  delete o.plan;delete o.examDate;
  expandBuiltins(o);
  return o;
}
function load(){try{return normalize(JSON.parse(localStorage.getItem(dataKey(P.active))||'null'))}catch(e){return blank()}}
let D=load();
const S={screen:'today',tab:'today',filter:'all',run:null,confirm:null,manageDeck:null,saveErr:'',pendingImport:null,focus:null,timer:null,showPast:false,saveT:null,sched:null,schedKey:''};
function saveLocal(){try{localStorage.setItem(dataKey(P.active),JSON.stringify(D));S.saveErr=''}catch(e){S.saveErr='保存できませんでした。スマホの空き容量を確認してください。'}}
function persist(){D.updatedAt=Date.now();S.sched=null;saveLocal();schedulePush()}
function touchSettings(){D.settings.updatedAt=Date.now()}
try{if(navigator.storage&&navigator.storage.persist)navigator.storage.persist()}catch(e){}

/* ---------- sync with the PC server ---------- */
const IS_PC=['localhost','127.0.0.1'].includes(location.hostname);
const LKEY='speed-anki-link';
let LINK=(()=>{try{return JSON.parse(localStorage.getItem(LKEY)||'null')||{}}catch(e){return {}}})();
function saveLink(){try{localStorage.setItem(LKEY,JSON.stringify(LINK))}catch(e){}}
const syncInfo={state:'off',at:0,msg:''};
let pushTimer=null,pollTimer=null,busy=null,srvRev=0,srvJson=null;
function strip(d){const o=Object.assign({},d);delete o.updatedAt;o.decks=d.decks.map(dk=>dk.builtin?{id:dk.id,builtin:true,version:dk.version||1,title:dk.title,subject:dk.subject,order:dk.order||0,updatedAt:dk.updatedAt||0}:dk);return o}
function later(x,y,f){const r=Object.assign({},x||{});Object.keys(y||{}).forEach(k=>{const yv=y[k],xv=r[k];if(!xv||((yv&&yv[f])||0)>((xv&&xv[f])||0))r[k]=yv});return r}
function maxNum(x,y){const r=Object.assign({},x||{});Object.keys(y||{}).forEach(k=>{r[k]=Math.max(Number(r[k])||0,Number(y[k])||0)});return r}
function maxLog(x,y){const r=Object.assign({},x||{});Object.keys(y||{}).forEach(k=>{const a=r[k]||{},b=y[k]||{};r[k]={n:Math.max(a.n||0,b.n||0),again:Math.max(a.again||0,b.again||0),cram:Math.max(a.cram||0,b.cram||0)}});return r}
function merge(a,b){
  const o=Object.assign({},a);
  o.setup=!!(a.setup||b.setup);
  o.settings=(b.settings&&(b.settings.updatedAt||0)>(a.settings.updatedAt||0))?b.settings:a.settings;
  o.done=later(a.done,b.done,'at');
  o.srs=Object.assign({},a.srs,{cards:later(a.srs.cards,b.srs.cards,'last'),log:maxLog(a.srs.log,b.srs.log),newCount:maxNum(a.srs.newCount,b.srs.newCount)});
  o.deletedDecks=maxNum(a.deletedDecks,b.deletedDecks);
  const decks={};a.decks.forEach(d=>{decks[d.id]=d});(b.decks||[]).forEach(d=>{const x=decks[d.id];if(!x||(d.updatedAt||0)>(x.updatedAt||0))decks[d.id]=d});
  o.decks=Object.values(decks).filter(d=>!(o.deletedDecks[d.id]&&o.deletedDecks[d.id]>=(d.updatedAt||0)));
  const sc={};a.scores.concat(b.scores||[]).forEach(s=>{if(s&&s.id)sc[s.id]=s});o.scores=Object.values(sc).sort((x,y)=>x.date<y.date?-1:1);
  expandBuiltins(o);
  return o;
}
function rerenderSettings(){if(S.screen==='settings')renderSettings()}
const linked=()=>IS_PC&&!!prof().srv;
function fetchT(url,opt,ms){const ac=new AbortController();const t=setTimeout(()=>ac.abort(),ms||10000);return fetch(url,Object.assign({},opt,{signal:ac.signal})).finally(()=>clearTimeout(t))}
/* The PC's address changes when it restarts; it is published in a gist that the app reads. */
async function discover(){
  if(!window.SYNC_DISCOVERY)throw new Error('discovery');
  const r=await fetchT(window.SYNC_DISCOVERY,{headers:{Accept:'application/vnd.github+json'},cache:'no-store'},8000);
  const j=await r.json();const c=JSON.parse(((j.files||{})['server.json']||{}).content||'{}');
  if(!c.url)throw new Error('PCが起動していません');
  LINK.base=c.url;saveLink();return c.url;
}
async function api(path,opt){
  opt=opt||{};
  const headers={'Content-Type':'application/json'};
  const go=async base=>{const r=await fetchT(base+path,{method:opt.method||'GET',headers,body:opt.body?JSON.stringify(opt.body):undefined,cache:'no-store'},opt.ms||10000);let j=null;try{j=await r.json()}catch(e){}return {status:r.status,body:j}};
  if(IS_PC)return go(location.origin);
  if(LINK.base){try{const r=await go(LINK.base);if(r.status!==530&&r.status!==502&&r.status!==404)return r}catch(e){}}
  return go(await discover());
}
function syncRun(fn){busy=(busy||Promise.resolve()).then(fn,fn).catch(()=>{});return busy}
function mergeRemote(json){
  let remote;try{remote=normalize(JSON.parse(json))}catch(e){return}
  const before=stable(strip(D)),merged=merge(D,remote),after=stable(strip(merged));
  if(after!==before){D=merged;S.sched=null;saveLocal();if(S.screen==='planner')renderPreview();else if(!['study','focus','settings'].includes(S.screen))render()}
}
function syncFail(e){syncInfo.state='offline';syncInfo.msg=String((e&&e.message)||e)}
function unpaired(){syncInfo.state='offline'}
/* Phones find the PC by themselves; the person only has to tap their name once. */
async function findPeople(){
  return;
  try{const r=await api('/api/profiles');if(r.status===200){S.pairProfiles=r.body.profiles||[];S.pairErr=false}else S.pairErr=true}catch(e){S.pairErr=true}
  if(['welcome','today','settings'].includes(S.screen))render();
}
function whoPicker(){
  const list=S.pairProfiles;
  if(!list)return S.pairErr?'<p class="small">PCが見つかりませんでした。PCの電源が入っていれば、開き直すと自動でつながります。</p><button class="btn line sm" data-act="pair-list">もう一度さがす</button>':'<p class="muted small">PCをさがしています…</p>';
  return '<p class="small">名前を押すと、PCで作った計画がこのスマホに届きます。</p><div class="row">'+list.map(p=>'<button class="btn" data-act="pair-pick" data-id="'+esc(p.id)+'" data-name="'+esc(p.name)+'">'+esc(p.name)+'</button>').join('')+'</div>';
}
const whoPanel=()=>true?'':'<div class="panel"><h2>だれが使いますか？</h2>'+whoPicker()+'</div>';
async function pullNow(){
  if(!linked())return;
  const pid=prof().srv;
  try{
    const r=await api('/api/data/'+encodeURIComponent(pid));
    if(r.status===401){unpaired();return rerenderSettings()}
    if(r.status!==200)throw new Error('HTTP '+r.status);
    if(prof().srv!==pid)return;
    srvRev=r.body.rev||0;srvJson=r.body.json;
    if(r.body.json)mergeRemote(r.body.json);
    if(stable(strip(D))!==srvJson)schedulePush(0);
    syncInfo.state='ok';syncInfo.at=Date.now();
  }catch(e){syncFail(e)}
  rerenderSettings();
}
async function pushNow(){
  if(!linked())return;
  const pid=prof().srv;
  for(let attempt=0;attempt<3;attempt++){
    const json=stable(strip(D));
    if(json===srvJson)break;
    try{
      const r=await api('/api/data/'+encodeURIComponent(pid),{method:'PUT',body:{baseRev:srvRev,json}});
      if(prof().srv!==pid)return;
      if(r.status===200){srvRev=r.body.rev;srvJson=json;syncInfo.state='ok';syncInfo.at=Date.now();break}
      if(r.status===409){srvRev=r.body.rev||0;srvJson=r.body.json;if(r.body.json)mergeRemote(r.body.json);continue}
      if(r.status===401){unpaired();break}
      throw new Error('HTTP '+r.status);
    }catch(e){syncFail(e);break}
  }
  rerenderSettings();
}
function schedulePush(delay){if(!linked())return;clearTimeout(pushTimer);pushTimer=setTimeout(()=>syncRun(pushNow),delay==null?1500:delay)}
function syncStart(){
  clearInterval(pollTimer);clearTimeout(pushTimer);srvRev=0;srvJson=null;
  if(!linked()){syncInfo.state='off';rerenderSettings();return}
  syncInfo.state='connecting';syncRun(pullNow);
  pollTimer=setInterval(()=>{if(!document.hidden)syncRun(pullNow)},20000);
}
/* On the PC, the people list mirrors the server's. "自分" on the server is this PC's original profile. */
let SRV_PROFILES=null,PC_STATUS=null;
function mirrorProfiles(list){
  SRV_PROFILES=list;
  list.forEach(sp=>{
    let p=P.list.find(x=>x.srv===sp.id);
    if(!p&&sp.id==='me'){p=P.list.find(x=>x.id==='default');if(p)p.srv='me'}
    if(!p){p={id:'srv-'+sp.id,name:sp.name,srv:sp.id};P.list.push(p)}
    p.name=sp.name;
  });
  saveProfiles();
}
async function pcRefresh(){
  if(!IS_PC)return;
  try{
    const [a,b]=await Promise.all([api('/api/profiles'),api('/api/status')]);
    if(a.status===200){const wasLinked=linked();mirrorProfiles(a.body.profiles);if(!wasLinked&&linked())syncStart()}
    if(b.status===200)PC_STATUS=b.body;
  }catch(e){PC_STATUS={error:String(e.message||e)}}
  rerenderSettings();
}
const syncLabel=()=>syncInfo.state==='ok'?'<span class="ok">同期済み（'+new Date(syncInfo.at).toLocaleTimeString('ja-JP',{hour:'2-digit',minute:'2-digit'})+'）</span>':syncInfo.state==='connecting'?'<span class="muted">PCに接続しています</span>':syncInfo.state==='offline'?'<span class="err">PCにつながりません（あとで自動で同期します）</span>':'';

/* ---------- cards & spaced repetition ---------- */
function allCards(){
  const out=[];
  D.decks.slice().sort((a,b)=>(a.order||0)-(b.order||0)).forEach(d=>(d.cards||[]).forEach((c,i)=>out.push({
    key:d.id+':'+(c.id||i),deckId:d.id,deckTitle:d.title||'',subject:c.subject||d.subject||'',category:c.category||'',
    front:c.front||'',back:c.back||'',options:Array.isArray(c.options)&&c.options.length?c.options:null,answer:typeof c.answer==='number'?c.answer:-1})));
  return out;
}
const visible=()=>allCards().filter(c=>S.filter==='all'||c.subject===S.filter);
const stateOf=k=>{const s=(D.srs.cards||{})[k];return s&&typeof s==='object'&&s.due?s:null};
const newLimit=()=>{const v=Number(D.settings.newLimit);return Number.isFinite(v)?v:40};
const newToday=()=>(D.srs.newCount||{})[today()]||0;
const logOf=t=>Object.assign({n:0,again:0,cram:0},(D.srs.log||{})[t]);
function examDate(){return isDate(D.settings.examDate)?D.settings.examDate:''}
function daysLeft(){const e=examDate();return e?diffDays(today(),e):null}
function counts(cards){
  const now=Date.now();let due=0,fresh=0,learned=0;
  cards.forEach(c=>{const s=stateOf(c.key);if(!s)fresh++;else{if(s.due<=now)due++;if(s.ivl>=7)learned++}});
  return {due,fresh,learned,total:cards.length,avail:Math.min(fresh,Math.max(0,newLimit()-newToday()))};
}
const isDone=id=>{const d=D.done[id];return !!(d&&!d.off)};
function setDone(id,v){D.done[id]=v?{at:Date.now(),date:today()}:{at:Date.now(),off:true};persist()}
function streak(){let t=today(),n=0;const has=d=>{const l=logOf(d);return l.n+l.cram>0||Object.values(D.done).some(v=>v&&!v.off&&v.date===d)};if(!has(t))t=shift(t,-1);while(has(t)){n++;t=shift(t,-1)}return n}
function schedule1(prev,r){
  const now=Date.now(),s=prev?Object.assign({},prev):{ivl:0,ease:2.5,reps:0,lapses:0};
  if(r===1){s.lapses=(s.lapses||0)+1;s.reps=0;s.ivl=0;s.ease=Math.max(1.3,s.ease-0.2);s.due=now+60e3}
  else{
    if(r===2){s.ivl=s.reps===0?0:Math.max(1,Math.round(s.ivl*1.2));s.ease=Math.max(1.3,s.ease-0.15)}
    else if(r===3){s.ivl=s.reps===0?1:s.reps===1?3:Math.max(s.ivl+1,Math.round(s.ivl*s.ease))}
    else{s.ivl=s.reps===0?3:Math.max(s.ivl+2,Math.round(Math.max(s.ivl,1)*s.ease*1.3));s.ease=s.ease+0.15}
    const left=daysLeft(),cap=left!=null&&left>1?Math.min(14,left-1):14;
    s.ivl=Math.min(s.ivl,Math.max(1,cap));s.reps++;
    s.due=s.ivl===0?now+10*60e3:dayStart(now)+s.ivl*864e5;
  }
  s.last=now;return s;
}
function ivlLabel(s){const m=Math.round((s.due-Date.now())/60e3);return m<60?Math.max(1,m)+'分後':s.ivl+'日後'}
function setState(k,s){D.srs.cards=Object.assign({},D.srs.cards,{[k]:s})}
function setLog(t,l){D.srs.log=Object.assign({},D.srs.log,{[t]:l})}
function setNew(t,n){D.srs.newCount=Object.assign({},D.srs.newCount,{[t]:n})}
function mix(due,fresh){const out=[];let i=0,j=0;while(i<due.length||j<fresh.length){for(let k=0;k<3&&i<due.length;k++)out.push(due[i++]);if(j<fresh.length)out.push(fresh[j++])}return out}
function shuffle(a){a=a.slice();for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]]}return a}
function reviewState(){const all=allCards();if(!all.length)return null;const k=counts(all),lg=logOf(today());return {left:k.due+k.avail,done:k.due+k.avail===0&&lg.n>0,lg}}

/* ---------- automatic planner ---------- */
const subjectsOf=()=>D.settings.subjects||[];
function deadlineOf(s){const e=isDate(s.testDate)?s.testDate:examDate();return e?shift(e,-1):shift(today(),21)}
function unitsAll(){
  const out=[];
  subjectsOf().forEach(s=>{
    const cyc=Math.max(1,Math.min(5,Number(s.cycles)||3)),w=Number(s.weight)||1;
    (s.items||[]).forEach((it,ii)=>{
      const deck=(it.decks||[]).length>0,base=Math.max(5,Number(it.min)||30);
      for(let c=1;c<=cyc;c++){
        const f=c===1?1:(deck?0.7:(c===2?0.5:0.35));
        const suffix=cyc===1?'':(c===1?'（1周目）':deck?'（'+c+'周目）':'の×だけ（'+c+'周目）');
        out.push({id:s.id+':'+it.id+':c'+c,subjectId:s.id,subject:s.name||'その他',item:it.id,ii,cycle:c,cycles:cyc,title:(it.label||'やること')+suffix,min:Math.max(5,Math.round(base*f/5)*5),decks:it.decks||[],early:!!it.early,weight:w});
      }
    });
    if((s.items||[]).length&&Number(s.finalMin)!==0)out.push({id:s.id+':final',subjectId:s.id,subject:s.name||'その他',item:'final',ii:999,cycle:99,cycles:cyc,title:'テスト前の総見直し（×が残った問題と要点）',min:Number(s.finalMin)||30,decks:[],weight:w,final:true});
  });
  (D.settings.extras||[]).forEach(x=>{if(x&&x.title)out.push({id:'x:'+x.id,subjectId:'_x',subject:x.subject||'全科目',title:x.title,min:Number(x.min)||0,decks:x.decks||[],fixedDate:isDate(x.date)?x.date:today(),extra:true,last:!!x.last,cycle:0,weight:1})});
  return out;
}
function capacity(d){
  const st=D.settings;if((st.offDays||[]).includes(d))return 0;
  if(st.dayMin&&st.dayMin[d]!=null)return Math.max(0,Number(st.dayMin[d])||0);
  const wk=dow(d)===0||dow(d)===6||(st.holidays||[]).includes(d);
  const base=wk?Number(st.weekendMin)||0:Number(st.weekdayMin)||0;
  return Math.max(0,base-(allCards().length?Number(st.ankiMin)||0:0));
}
function schedule(){
  const key=today()+'|'+D.updatedAt+'|'+P.active;
  if(S.sched&&S.schedKey===key)return S.sched;
  const t0=today(),units=unitsAll(),byId={},res={days:{},late:[],unplaced:[],totalMin:0,lastDay:t0};
  units.forEach(u=>{byId[u.id]=u});
  const doneDate=id=>{const d=D.done[id];return d&&!d.off?d.date:null};
  units.forEach(u=>{const dd=doneDate(u.id);if(dd===t0)(res.days[t0]=res.days[t0]||[]).push(u)});
  const pending=units.filter(u=>!doneDate(u.id));
  pending.filter(u=>u.extra).forEach(u=>{const d=u.fixedDate<t0?t0:u.fixedDate;(res.days[d]=res.days[d]||[]).push(Object.assign({},u,{late:u.fixedDate<t0}))});
  const subj={};subjectsOf().forEach(s=>{const dl=deadlineOf(s);subj[s.id]={dl,span:Math.max(1,diffDays(t0,dl))}});
  /* each cycle has a window: it may start at `start` and should be done by `phase` (both as fractions of the days left) */
  const phase=u=>{const s=subj[u.subjectId];if(!s)return t0;if(u.final)return s.dl;const n=u.cycles;const f=n===1?0.85:Math.min(0.95,u.cycle/n);return shift(t0,Math.floor(s.span*f))};
  const startOf=u=>{const s=subj[u.subjectId];if(!s)return t0;if(u.final)return shift(s.dl,-3);const n=u.cycles;let f=u.cycle===1?0:Math.min(0.85,(u.cycle-1)/n*1.1);if((u.decks||[]).length&&!u.early)f=u.cycle===1?Math.max(f,0.3):Math.min(0.9,f+0.05);return shift(t0,Math.floor(s.span*f))};
  const rr={},groups={};
  pending.filter(u=>!u.extra).forEach(u=>{(groups[u.cycle]=groups[u.cycle]||{});(groups[u.cycle][u.subjectId]=groups[u.cycle][u.subjectId]||[]).push(u)});
  Object.keys(groups).forEach(k=>{
    const g=groups[k],ids=Object.keys(g),credit={};ids.forEach(i=>{g[i].sort((a,b)=>a.ii-b.ii);credit[i]=0});
    const total=ids.reduce((a,i)=>a+(g[i][0].weight||1),0);let left=ids.reduce((a,i)=>a+g[i].length,0),idx=0;
    while(left>0){ids.forEach(i=>{if(g[i].length)credit[i]+=g[i][0].weight||1});let best=null;ids.forEach(i=>{if(g[i].length&&(best===null||credit[i]>credit[best]))best=i});const u=g[best].shift();credit[best]-=total;rr[u.id]=idx++;left--}
  });
  const queue=pending.filter(u=>!u.extra).map(u=>Object.assign({},u,{pdl:phase(u),start:startOf(u),rr:rr[u.id]||0})).sort((a,b)=>a.pdl<b.pdl?-1:a.pdl>b.pdl?1:(a.cycle-b.cycle)||(a.rr-b.rr));
  res.totalMin=queue.reduce((a,u)=>a+u.min,0);
  const placed={};
  const prevId=u=>u.cycle>1&&!u.final?u.subjectId+':'+u.item+':c'+(u.cycle-1):null;
  const maxDl=Object.values(subj).reduce((m,s)=>s.dl>m?s.dl:m,t0);
  /* spread the work evenly: only fill each day up to (work left ÷ time left), with a little headroom */
  let totalCap=0;for(let x=t0;x<=maxDl;x=shift(x,1))totalCap+=capacity(x);
  const ratio=Math.min(1,(res.totalMin*1.15)/(totalCap||1));
  const eff=x=>{const c=capacity(x);if(D.settings.dayMin&&D.settings.dayMin[x]!=null)return c;return c?Math.min(c,Math.max(40,Math.round(c*ratio))):0};
  let d=t0,guard=0;
  while(queue.length&&guard<500){
    const list=res.days[d]=res.days[d]||[],full=d>maxDl?capacity(d):eff(d);
    let cap=full-list.reduce((a,u)=>a+(u.min||0),0);const startLen=list.length;
    /* pass 0: only work whose window is open. pass 1: if the day is still under 60% full, pull work forward from the next 5 days. */
    for(let pass=0;pass<2;pass++){
      if(pass===1&&cap<full*0.4)break;
      const horizon=pass===0?d:shift(d,5);
      for(let i=0;i<queue.length&&cap>=10;){
        const u=queue[i],p=prevId(u);const win=u.start>t0?u.start:t0;let gap=t0;
        if(p&&byId[p]){const pd=placed[p]||doneDate(p);if(!pd){i++;continue}gap=shift(pd,2)}
        if(u.final&&d<subj[u.subjectId].dl&&queue.some(x=>x!==u&&x.subjectId===u.subjectId)){i++;continue}
        if(d<gap||win>horizon||(pass===1&&u.final)){i++;continue}
        if(D.settings.onlyDay&&D.settings.onlyDay[d]&&u.subjectId!==D.settings.onlyDay[d]){i++;continue}
        if(u.min<=cap||(list.length===startLen&&cap>=full*0.5)){
          const late=subj[u.subjectId]&&d>subj[u.subjectId].dl;
          list.push(Object.assign({},u,{late}));if(late)res.late.push(u);
          placed[u.id]=d;cap-=u.min;queue.splice(i,1);
        }else i++;
      }
    }
    if(list.length)res.lastDay=d;
    d=shift(d,1);guard++;
    if(d>shift(maxDl,45))break;
  }
  res.unplaced=queue;
  Object.keys(res.days).forEach(k=>{if(!res.days[k].length)delete res.days[k];else res.days[k].sort((a,b)=>(a.extra?0:1)-(b.extra?0:1)||subjOrder(a.subject)-subjOrder(b.subject))});
  S.sched=res;S.schedKey=key;return res;
}
const findUnit=id=>unitsAll().find(u=>u.id===id);
function resolveDecks(list){return (list||[]).map(x=>D.decks.find(d=>d.id===x||d.title===x)).filter(Boolean)}

/* ---------- study runs ---------- */
function startSrs(cards,taskId){
  const now=Date.now();
  const due=cards.filter(c=>{const s=stateOf(c.key);return s&&s.due<=now}).sort((a,b)=>stateOf(a.key).due-stateOf(b.key).due);
  const fresh=cards.filter(c=>!stateOf(c.key)).slice(0,Math.max(0,newLimit()-newToday()));
  const q=mix(due,fresh);if(!q.length)return false;
  S.run={mode:'srs',queue:q,total:q.length,shown:false,pick:null,done:0,right:0,history:[],missed:new Set(),taskId:taskId||null,back:S.screen};
  show('study');return true;
}
function startCram(cards,taskId){
  if(!cards.length)return;
  S.run={mode:'cram',queue:shuffle(cards),total:cards.length,shown:false,pick:null,done:0,right:0,history:[],missed:new Set(),taskId:taskId||null,back:S.screen};
  show('study');
}
function finishRun(){const r=S.run;if(r&&r.taskId&&!r.queue.length)setDone(r.taskId,true)}
function reveal(){const r=S.run;if(r&&r.queue.length&&!r.shown){r.shown=true;renderStudy()}}
function pick(i){const r=S.run;if(!r||r.shown)return;r.pick=i;r.shown=true;renderStudy()}
function recommended(){const r=S.run,c=r.queue[0];if(!c)return 3;return c.options&&r.pick!=null?(r.pick===c.answer?3:1):3}
function rate(v){
  const r=S.run;if(!r||!r.shown||!r.queue.length)return;
  const c=r.queue[0],prev=stateOf(c.key),s=schedule1(prev,v),t=today(),lgPrev=logOf(t),ncPrev=newToday();
  r.history.push({key:c.key,prev,queue:r.queue.slice(),lgPrev,ncPrev,done:r.done,right:r.right,missedHad:r.missed.has(c.key)});
  r.queue.shift();
  setState(c.key,s);setLog(t,Object.assign({},lgPrev,{n:lgPrev.n+1,again:lgPrev.again+(v===1?1:0)}));
  if(!prev)setNew(t,ncPrev+1);
  if(v===1)r.missed.add(c.key);else r.right++;
  if(s.due-Date.now()<30*60e3)r.queue.splice(Math.min(3,r.queue.length),0,c);
  r.done++;r.shown=false;r.pick=null;if(!r.queue.length)finishRun();persist();renderStudy();
}
function cram(ok){
  const r=S.run;if(!r||!r.shown||!r.queue.length)return;
  const c=r.queue[0],t=today(),lgPrev=logOf(t);
  r.history.push({key:c.key,queue:r.queue.slice(),lgPrev,done:r.done,right:r.right,missedHad:r.missed.has(c.key)});
  r.queue.shift();
  if(ok){if(!r.missed.has(c.key))r.right++}else{r.missed.add(c.key);r.queue.splice(Math.min(4,r.queue.length),0,c)}
  r.done++;r.shown=false;r.pick=null;setLog(t,Object.assign({},lgPrev,{cram:lgPrev.cram+1}));if(!r.queue.length)finishRun();persist();renderStudy();
}
function undo(){
  const r=S.run;if(!r||!r.history.length)return;
  const h=r.history.pop(),t=today();
  r.queue=h.queue;r.done=h.done;r.right=h.right;if(!h.missedHad)r.missed.delete(h.key);r.shown=false;r.pick=null;
  setLog(t,h.lgPrev);
  if(r.mode==='srs'){setState(h.key,h.prev?h.prev:{reset:Date.now(),last:Date.now()});setNew(t,h.ncPrev)}
  persist();renderStudy();
}

/* ---------- navigation ---------- */
function show(s){
  S.screen=s;S.confirm=null;
  if(TABS.includes(s))S.tab=s;
  if(s!=='study')S.run=null;
  if(s!=='focus')stopTick();
  $('app').classList.toggle('wide',s==='planner');
  render();const el=$(s);if(el)el.scrollTop=0;
}
function back(){const r=S.run;const to=r&&r.back&&r.back!=='study'?r.back:S.tab;S.run=null;show(to)}

/* ---------- decks ---------- */
const userDecks=()=>D.decks.filter(d=>!d.builtin);
function libGroups(){const g=[];LIB.forEach(d=>{const k=d.group||d.subject||'その他';let x=g.find(y=>y.name===k);if(!x){x={name:k,decks:[]};g.push(x)}x.decks.push(d)});return g}
function installLib(id){
  const l=LIB.find(x=>x.id===id);if(!l)return;
  const deck={id:l.id,title:l.title,subject:l.subject,order:l.order||0,builtin:true,version:l.version||1,updatedAt:Date.now(),cards:(l.cards||[]).map(c=>Object.assign({},c))};
  const i=D.decks.findIndex(d=>d.id===id);if(i>=0)D.decks[i]=deck;else D.decks.push(deck);
  delete D.deletedDecks[id];
}
function removeDeck(id){
  D.decks=D.decks.filter(d=>d.id!==id);D.deletedDecks[id]=Date.now();
  Object.keys(D.srs.cards).forEach(k=>{if(k.indexOf(id+':')===0)D.srs.cards[k]={reset:Date.now(),last:Date.now()}});
  persist();
}
function createDeck(title,subject){const deck={id:'u'+Date.now().toString(36)+rid(3),title:title||'自分のカード',subject:subject||'',order:100+D.decks.length,updatedAt:Date.now(),cards:[]};D.decks.push(deck);persist();return deck}
function targetDeck(){let d=userDecks().find(x=>x.id===S.manageDeck);if(!d){d=createDeck('自分のカード',$('nd-subject').value);S.manageDeck=d.id}return d}
function addCards(list){const d=targetDeck(),base=Date.now().toString(36);list.forEach((c,i)=>d.cards.push({id:'c'+base+'-'+i,front:c.front,back:c.back}));d.updatedAt=Date.now();persist()}

/* ---------- timer for paper tasks ---------- */
function tick(){const el=$('timer-num');if(!el||!S.timer)return;const sec=Math.floor((S.timer.acc+(S.timer.start?Date.now()-S.timer.start:0))/1000);el.textContent=pad(Math.floor(sec/60))+':'+pad(sec%60)}
function stopTick(){if(S.timer&&S.timer.iv){clearInterval(S.timer.iv);S.timer.iv=null}}
function toggleTimer(){const t=S.timer;if(!t)return;if(t.start){t.acc+=Date.now()-t.start;t.start=null;stopTick()}else{t.start=Date.now();t.iv=setInterval(tick,1000)}renderFocus()}

/* ---------- shared render bits ---------- */
function installTip(){
  const standalone=(window.matchMedia&&window.matchMedia('(display-mode: standalone)').matches)||navigator.standalone;
  if(standalone||window.innerWidth>900)return '';
  return '<div class="panel"><h2>ホーム画面に追加すると、アプリのように使えます</h2><ol class="steps"><li>iPhoneは Safari で開き、共有ボタン（四角から矢印）を押す</li><li>「ホーム画面に追加」を選ぶ</li><li>ホーム画面の「暗記帳」アイコンから開く</li></ol><p class="muted small">Androidは Chrome のメニューから「ホーム画面に追加」を選びます。</p></div>';
}
function countdown(){const left=daysLeft();return left==null?'':'<p class="count">'+(left>0?'テストまで あと<b>'+left+'</b>日':left===0?'今日から本番':'テスト期間')+'</p>'}
function taskRow(u,prefix){
  const d=isDone(u.id),dk=resolveDecks(u.decks);
  const bits=[];if(u.min)bits.push('目安'+u.min+'分');if(dk.length)bits.push('カード'+dk.reduce((a,x)=>a+(x.cards||[]).length,0)+'枚');if(u.late)bits.push('締め切りを過ぎています');
  return '<li class="task'+(d?' done':'')+(u.late?' late':'')+'"><button class="check" data-act="toggle" data-id="'+esc(u.id)+'" aria-label="'+(d?'完了を取り消す':'完了にする')+'" aria-pressed="'+d+'">'+(d?'✓':'')+'</button><button class="body" data-act="open" data-id="'+esc(u.id)+'"><strong>'+(prefix?esc(u.subject)+'　':'')+esc(u.title)+'</strong>'+(bits.length?'<span>'+esc(bits.join('・'))+'</span>':'')+'</button><span class="go">'+(d?'':(dk.length?'回す':'始める'))+'</span></li>';
}
function todayOrder(list){const g=groupBySubject(list);const out=[];g.forEach(x=>x.items.slice().sort((a,b)=>(a.last?1:0)-(b.last?1:0)).forEach(u=>out.push(u)));return out}
function groupBySubject(list){const g={};list.forEach(t=>{(g[t.subject]=g[t.subject]||[]).push(t)});return Object.keys(g).sort((a,b)=>subjOrder(a)-subjOrder(b)).map(k=>({subject:k,items:g[k]}))}
function scheduleWarning(r){
  if(r.unplaced.length)return '<div class="notice">時間が足りず、'+r.unplaced.length+'件のやることがテストまでに入りきりません。「計画の設定」で使える時間を増やすか、周回数を減らしてください。</div>';
  if(r.late.length)return '<div class="notice">'+r.late.length+'件が、その科目のテスト前日を過ぎてしまいます。時間を増やすか、周回数を減らすと間に合います。</div>';
  return '';
}

/* ---------- screens ---------- */
function renderWelcome(){
  let h='<div class="top"><h1>スピード暗記帳</h1></div>'+whoPanel();
  h+='<div class="panel"><p>テストの日と範囲を入れると、アプリが毎日のやることを自動で組みます。やり残しが出ても、次に開いたときに組み直されます。毎日「今日」を開いて、上から押していけば終わります。</p></div>';
  h+='<div class="panel"><h2>どうやって始めますか？</h2>'+PRESETS.map((p,i)=>'<button class="btn big" data-act="setup-preset" data-i="'+i+'">'+esc(p.title)+'</button><p class="muted small">'+esc(p.note||'')+'</p>').join('');
  h+='<button class="btn line" data-act="setup-blank">自分で範囲を入れて始める</button>';
  h+='</div>';
  h+=installTip();
  $('welcome').innerHTML=h;
}
function renderToday(){
  const t=today(),r=schedule(),list=r.days[t]||[],rv=reviewState();
  const total=list.length+(rv?1:0),doneN=list.filter(x=>isDone(x.id)).length+(rv&&rv.done?1:0);
  const mins=list.filter(x=>!isDone(x.id)).reduce((a,x)=>a+(x.min||0),0)+(rv&&!rv.done&&rv.left?Number(D.settings.ankiMin)||0:0);
  let h='<div class="top"><div><p class="muted small">'+dayLabel(t)+(P.list.length>1?'・'+esc(prof().name):'')+'</p><h1>今日やること</h1></div>'+countdown()+'</div>';
  if(S.saveErr)h+='<div class="notice">'+esc(S.saveErr)+'</div>';
  h+=whoPanel();
  if(!subjectsOf().length&&!(D.settings.extras||[]).length&&!rv){
    h+='<div class="panel"><h2>まだ範囲が入っていません</h2><p class="small">「計画」タブの「計画の設定」で、テストの日と科目ごとの範囲を入れてください。PCで開くと編集しやすいです。</p><button class="btn" data-act="planner">計画の設定を開く</button></div>';
    $('today').innerHTML=h;return;
  }
  h+='<div class="panel"><div class="dayhead"><strong>'+doneN+' / '+total+' 完了</strong><span class="muted small">'+(mins?'残り約'+mins+'分':'')+'</span></div><div class="meter"><i style="width:'+(total?Math.round(doneN/total*100):0)+'%"></i></div>'+(total&&doneN===total?'<p class="ok" style="font-size:15px">今日の分は全部終わりました。おつかれさまでした。</p>':'')+'</div>';
  const ord=todayOrder(list),nx=ord.find(x=>!isDone(x.id));
  if(nx)h+='<button class="btn big go" data-act="next" data-id="'+esc(nx.id)+'">次をやる：'+esc(nx.title)+'</button>';
  else if(rv&&rv.left)h+='<button class="btn big go" data-act="review">次をやる：暗記カードの復習（'+rv.left+'枚）</button>';
  groupBySubject(ord).forEach(g=>{h+='<p class="subj">'+esc(g.subject)+'</p><ul class="tasks">'+g.items.map(x=>taskRow(x)).join('')+'</ul>'});
  if(rv)h+='<p class="subj">毎日の暗記</p><ul class="tasks"><li class="task'+(rv.done?' done':'')+'"><span class="check" aria-hidden="true" style="'+(rv.done?'background:var(--good);border-color:var(--good)':'')+'">'+(rv.done?'✓':'')+'</span><button class="body" data-act="review"><strong>暗記カードの復習</strong><span>'+(rv.left?'今日の分 '+rv.left+'枚':'今日の分は終わりました')+(rv.lg.n?'・今日'+rv.lg.n+'回':'')+'</span></button><span class="go">'+(rv.left?'回す':'')+'</span></li></ul>';
  if(!list.length){const next=Object.keys(r.days).filter(d=>d>t).sort()[0];h+='<p class="muted small">今日の計画はありません。'+(next?'次は'+dayLabel(next)+'です。':'')+'</p>'}
  h+=scheduleWarning(r);
  h+='<p class="muted small">やり残した分は、次に開いたときに自動で後ろの日に組み直されます。</p>';
  $('today').innerHTML=h;
}
function renderPlan(){
  const t=today(),r=schedule();
  let h='<div class="top"><div><p class="muted small">自動で組んだ計画'+(P.list.length>1?'・'+esc(prof().name):'')+'</p><h1>計画</h1></div>'+countdown()+'</div>';
  h+='<div class="panel"><div class="row" style="justify-content:space-between"><span class="small">範囲や時間を変えると、すぐに組み直されます。</span><button class="btn" data-act="planner">計画の設定</button></div></div>';
  h+=scheduleWarning(r);
  const units=unitsAll(),doneN=units.filter(u=>isDone(u.id)).length;
  if(units.length)h+='<div class="panel"><div class="dayhead"><strong>全体 '+doneN+' / '+units.length+' 完了</strong><span class="muted small">'+(r.lastDay>t?'最後のやること：'+dayLabel(r.lastDay):'')+'</span></div><div class="meter"><i style="width:'+Math.round(doneN/units.length*100)+'%"></i></div></div>';
  const days=Object.keys(r.days).sort();
  if(!days.length)h+='<div class="panel"><p class="small">まだ計画がありません。「計画の設定」で範囲を入れてください。</p></div>';
  days.forEach(d=>{h+='<p class="subj"'+(d===t?' style="color:var(--sheet)"':'')+'>'+dayLabel(d)+(d===t?'　今日':'')+'<span class="muted" style="font-weight:400">　'+r.days[d].reduce((a,u)=>a+(u.min||0),0)+'分</span></p><ul class="tasks">'+r.days[d].map(u=>taskRow(u,true)).join('')+'</ul>'});
  const past={};Object.keys(D.done).forEach(id=>{const v=D.done[id];if(v&&!v.off&&v.date&&v.date<t){(past[v.date]=past[v.date]||[]).push(id)}});
  const pd=Object.keys(past).sort().reverse();
  if(pd.length){
    h+=S.showPast?'<p class="subj">これまでに終わったこと</p>'+pd.map(d=>'<div class="panel" style="gap:4px"><strong class="small">'+dayLabel(d)+'</strong>'+past[d].map(id=>{const u=findUnit(id);return '<span class="small muted">'+esc(u?u.subject+'　'+u.title:'（削除したやること）')+'</span>'}).join('')+'</div>').join(''):'<button class="btn text" data-act="past">これまでに終わったこと（'+pd.length+'日分）を見る</button>';
  }
  $('plan').innerHTML=h;
}
function field(k,f,label,type,val,opt){
  opt=opt||{};
  const attrs=' data-k="'+k+'" data-f="'+f+'"'+(opt.si!=null?' data-si="'+opt.si+'"':'')+(opt.ii!=null?' data-ii="'+opt.ii+'"':'');
  const input='<input type="'+type+'"'+attrs+' value="'+esc(val==null?'':val)+'"'+(opt.ph?' placeholder="'+esc(opt.ph)+'"':'')+(type==='number'?' min="0" step="'+(opt.step||5)+'" inputmode="numeric"':'')+(opt.aria?' aria-label="'+esc(opt.aria)+'"':'')+'>';
  return label?'<label>'+label+input+'</label>':input;
}
function selectField(k,f,label,val,options,opt){
  opt=opt||{};
  const attrs=' data-k="'+k+'" data-f="'+f+'"'+(opt.si!=null?' data-si="'+opt.si+'"':'')+(opt.ii!=null?' data-ii="'+opt.ii+'"':'');
  const s='<select'+attrs+(opt.aria?' aria-label="'+esc(opt.aria)+'"':'')+'>'+options.map(([v,l])=>'<option value="'+esc(v)+'"'+(String(v)===String(val)?' selected':'')+'>'+esc(l)+'</option>').join('')+'</select>';
  return label?'<label>'+label+s+'</label>':s;
}
function renderPlanner(){
  const st=D.settings,deckOpts=[['','カードなし']].concat(D.decks.map(d=>[d.id,d.title]));
  let h='<div class="top"><div><p class="muted small">'+(P.list.length>1?esc(prof().name)+'の計画・':'')+'PCの大きい画面だと編集しやすいです。変更はすぐ保存されます。</p><h1>計画の設定</h1></div><button class="btn line" data-act="tab" data-tab="plan">計画に戻る</button></div>';
  h+='<div class="planner"><div style="display:grid;gap:16px;min-width:0">';
  h+='<div class="panel"><h2>テストと使える時間</h2><div class="grid4">'+field('g','examDate','テストの初日','date',st.examDate)+field('g','weekdayMin','平日に使える時間（分）','number',st.weekdayMin)+field('g','weekendMin','休日に使える時間（分）','number',st.weekendMin)+field('g','ankiMin','そのうち毎日の暗記（分）','number',st.ankiMin)+'</div>';
  h+='<div class="grid2">'+field('g','holidays','休日あつかいの日（祝日など）','text',(st.holidays||[]).map(md).join('、'),{ph:'例：11/23'})+field('g','offDays','勉強しない日','text',(st.offDays||[]).map(md).join('、'),{ph:'例：11/14、11/21'})+field('g','newLimit','1日に増やす新しいカード（枚）','number',st.newLimit,{step:1})+'</div><p class="muted small">日付は「11/23、11/24」のように「、」で区切ります。</p></div>';
  h+='<div class="panel"><div class="top"><h2>科目と範囲</h2><button class="btn line sm" data-act="pl-add-subj">科目を追加</button></div><p class="muted small">範囲を「1回でやる量」に分けて行にします。アプリがそれを1周目、2周目（×の問題だけ）、3周目に分けて、テストまでの毎日に自動で配ります。苦手な科目ほど、毎日の中で多めに出てきます。</p>';
  st.subjects.forEach((s,si)=>{
    const dk='subj:'+si;
    h+='<div class="subjcard"><div class="subjhead">'+field('s','name','科目','text',s.name,{si})+selectField('s','weight','苦手度',s.weight||1,WEIGHTS,{si})+selectField('s','cycles','周回数',s.cycles||3,[[1,'1周'],[2,'2周'],[3,'3周'],[4,'4周']],{si})+field('s','testDate','この科目のテスト日','date',s.testDate||'',{si})+'<button class="btn text sm'+(S.confirm===dk?' danger':'')+'" data-act="pl-del-subj" data-si="'+si+'">'+(S.confirm===dk?'本当に削除':'削除')+'</button></div>';
    h+='<div class="items">'+(s.items||[]).map((it,ii)=>'<div class="itemrow">'+field('i','label','','text',it.label,{si,ii,aria:'やること',ph:'例：教科書p.40〜55の例題'})+field('i','min','','number',it.min,{si,ii,aria:'分'})+selectField('i','deck','',(it.decks||[])[0]||'',deckOpts,{si,ii,aria:'カードのデッキ'})+'<button class="btn text sm" data-act="pl-del-item" data-si="'+si+'" data-ii="'+ii+'" aria-label="この行を削除">×</button></div>').join('')+'</div>';
    h+='<div class="row"><button class="btn line sm" data-act="pl-add-item" data-si="'+si+'">行を追加</button><span class="muted small">1行＝1回分。右の数字は1周目にかかる分数です。デッキを選ぶと、その日はカードを回すやることになります。</span></div>';
    h+='<div class="gen"><label>番号でまとめて作る<input type="text" id="gen-pre-'+si+'" placeholder="例：本冊"></label><label>最初<input type="number" id="gen-from-'+si+'" inputmode="numeric"></label><label>最後<input type="number" id="gen-to-'+si+'" inputmode="numeric"></label><label>1回の数<input type="number" id="gen-per-'+si+'" inputmode="numeric" value="25"></label><label>1つあたり分<input type="number" id="gen-mpu-'+si+'" inputmode="numeric" step="0.5" value="2"></label><button class="btn line sm" data-act="pl-gen" data-si="'+si+'">行を作る</button></div><span id="gen-msg-'+si+'" class="small"></span>';
    h+='</div>';
  });
  if(!st.subjects.length)h+='<p class="small">まだ科目がありません。「科目を追加」から入れてください。</p>';
  h+='</div>';
  h+='<div class="panel"><div class="top"><h2>日付を決めたやること</h2><button class="btn line sm" data-act="pl-add-extra">追加</button></div><p class="muted small">「範囲表をもらう」のように、その日にやると決まっているもの。終わらなければ次の日に回ります。</p>';
  h+=(st.extras||[]).map((x,ii)=>'<div class="itemrow" style="grid-template-columns:150px minmax(0,1fr) 84px auto">'+field('x','date','','date',x.date,{ii,aria:'日付'})+field('x','title','','text',x.title,{ii,aria:'やること'})+field('x','min','','number',x.min,{ii,aria:'分'})+'<button class="btn text sm" data-act="pl-del-extra" data-ii="'+ii+'" aria-label="削除">×</button></div>'+'<div style="margin:-2px 0 6px">'+selectField('x','subject','',x.subject||'全科目',SUBJECTS.map(s=>[s,s]),{ii,aria:'科目'})+'</div>').join('');
  h+='<label>まとめて貼る（1行に「日付｜科目｜やること｜分」）<textarea id="pl-extra-text" style="min-height:60px" placeholder="11/10｜英語｜単語テストの範囲を覚える｜20"></textarea></label><div class="row"><button class="btn line sm" data-act="pl-extra-import">読み込む</button><span id="pl-extra-msg"></span></div></div>';
  h+='</div><div class="preview" id="pl-preview"></div></div>';
  $('planner').innerHTML=h;renderPreview();
}
function renderPreview(){
  const el=$('pl-preview');if(!el)return;
  const r=schedule(),t=today(),days=Object.keys(r.days).filter(d=>d>=t).sort();
  const avail=(()=>{let a=0,d=t;const end=examDate()||shift(t,21);while(d<end){a+=capacity(d);d=shift(d,1)}return a})();
  let h='<div class="panel"><h2>この設定で組んだ計画</h2>';
  h+=scheduleWarning(r)||(days.length?'<div class="okbox">テストまでに全部入りました。'+(r.lastDay?'最後のやることは'+dayLabel(r.lastDay)+'です。':'')+'</div>':'');
  h+='<div class="nums"><div class="num"><span>残りのやること</span><b>'+(r.totalMin/60).toFixed(1)+'<small>時間</small></b></div><div class="num"><span>使える時間</span><b>'+(avail/60).toFixed(1)+'<small>時間</small></b></div><div class="num"><span>余裕</span><b>'+(avail?Math.round((avail-r.totalMin)/avail*100):0)+'<small>%</small></b></div></div>';
  h+='<div>'+days.slice(0,21).map(d=>'<div class="pv-day"><b>'+dayLabel(d)+(d===t?' 今日':'')+'　'+r.days[d].reduce((a,u)=>a+(u.min||0),0)+'分</b><span>'+r.days[d].map(u=>esc(u.subject+'：'+u.title)).join('／')+'</span></div>').join('')+'</div>'+(days.length>21?'<p class="muted small">ほか'+(days.length-21)+'日分は「計画」タブで見られます。</p>':'');
  h+='</div>';
  el.innerHTML=h;
}
function renderDecks(){
  let h='<div class="top"><h1>暗記</h1>'+countdown()+'</div>';
  const subs=[...new Set(allCards().map(c=>c.subject).filter(Boolean))];
  if(subs.length>1)h+='<div class="chips" role="group" aria-label="科目で絞り込む">'+['all'].concat(subs).map(s=>'<button class="chip" data-filter="'+esc(s)+'" aria-pressed="'+(S.filter===s)+'">'+(s==='all'?'全科目':esc(s))+'</button>').join('')+'</div>';
  const cards=visible(),k=counts(cards),lg=logOf(today()),st=streak();
  h+='<div class="panel"><div class="nums"><div class="num"><span>今日の復習</span><b>'+k.due+'<small>枚</small></b></div><div class="num"><span>新しいカード</span><b>'+k.avail+'<small>枚</small></b></div><div class="num"><span>定着</span><b>'+k.learned+'<small> / '+k.total+'</small></b></div></div>';
  h+=k.total?(k.due+k.avail?'<button class="btn big" data-act="srs-all">今日の暗記を始める</button>':'<p class="small">今日の分は終わりました。もっと回すなら「全部回す」へ。</p>'):'<p class="small">まだカードがありません。「デッキを追加」か「カードの追加と管理」から入れてください。</p>';
  h+='<p class="muted small">今日 '+(lg.n+lg.cram)+'回'+(lg.n?'（正答率 '+Math.round((lg.n-lg.again)/lg.n*100)+'%）':'')+(st?'・'+st+'日連続':'')+'</p></div>';
  const rows=D.decks.slice().sort((a,b)=>(a.order||0)-(b.order||0)).map(d=>{const cs=cards.filter(c=>c.deckId===d.id);if(!cs.length&&S.filter!=='all')return '';const ck=counts(cs);
    return '<li class="deck"><div style="min-width:0"><strong>'+esc(d.title||d.id)+'</strong><span class="muted small">復習 '+ck.due+'・新規 '+ck.fresh+'・定着 '+ck.learned+' / '+ck.total+'</span></div><div class="acts"><button class="btn" data-act="srs" data-deck="'+esc(d.id)+'"'+(ck.due+Math.min(ck.fresh,k.avail)?'':' disabled')+'>学習</button><button class="btn line" data-act="cram" data-deck="'+esc(d.id)+'"'+(ck.total?'':' disabled')+'>全部回す</button></div></li>'}).join('');
  h+='<div class="panel"><h2>デッキ</h2>'+(rows?'<ul class="decks">'+rows+'</ul>':'<p class="muted small">デッキがありません。</p>')+'<p class="muted small">「学習」は忘れかけたころに出す復習、「全部回す」はデッキを最後まで一気に回します（復習の予定は変えません）。</p><div class="row"><button class="btn line" data-act="library">デッキを追加</button><button class="btn line" data-act="manage">カードの追加と管理</button></div></div>';
  $('decks').innerHTML=h;
}
function renderSyncPanel(){
  const st=PC_STATUS||{},tun=st.tunnel||{};
  if(IS_PC){
    let h='<p class="small">'+(st.error?'<span class="err">サーバーの状態を読めませんでした。</span>':tun.state==='up'?'<span class="ok">サーバーは動いていて、外からもつながります。</span>':tun.state==='missing'?'<span class="err">cloudflared が見つからないため、外からはつながりません。</span>':'<span class="muted">外からつながる道を準備しています。</span>')+'</p>';
    if(tun.url)h+='<p class="muted small">外からのアドレス：'+esc(tun.url)+'（PCを再起動すると変わりますが、アプリが自動で探します）</p>';
    h+='<p class="small">スマホは、アプリを開いて名前を押すだけでつながります。番号などは要りません。</p>';
    h+='<p class="small">'+syncLabel()+'</p>';
    return h;
  }
  if(!linked())return whoPicker();
  return '<p class="small">'+(syncLabel()||'<span class="muted">準備しています</span>')+'</p><p class="muted small">「'+esc(prof().name)+'」としてPCと同期しています。開いている間は20秒ごとに確かめます。</p><div class="row"><button class="btn line sm" data-act="sync-now">今すぐ同期</button><button class="btn text sm'+(S.confirm==='unlink'?' danger':'')+'" data-act="unlink">'+(S.confirm==='unlink'?'本当にやめる（このスマホのデータは残ります）':'PCとつなぐのをやめる')+'</button></div>';
}
function renderSettings(){
  let h='<div class="top"><h1>設定</h1></div>';
  // people
  h+='<div class="panel"><h2>使う人</h2><p class="muted small">PCでは、自分と弟の両方を切り替えて計画をいじれます。それぞれのデータは別々です。</p><ul class="mlist">'+P.list.map(p=>{const k='prof:'+p.id;return '<li><div><strong>'+esc(p.name)+'</strong>'+(p.id===P.active?'　<span class="ok">使用中</span>':'')+(p.srv?'<br><span class="muted small">PCと同期</span>':'')+'</div><div class="row">'+(p.id!==P.active?'<button class="btn line sm" data-act="prof-switch" data-id="'+esc(p.id)+'">切り替える</button>':'')+(p.id!=='default'&&p.id!==P.active?'<button class="btn text sm'+(S.confirm===k?' danger':'')+'" data-act="prof-del" data-id="'+esc(p.id)+'">'+(S.confirm===k?'本当に外す':'外す')+'</button>':'')+'</div></li>'}).join('')+'</ul>';
  h+='<form id="prof-form" class="grid2"><label>使う人を追加（名前）<input type="text" id="prof-name" maxlength="20" placeholder="例：弟"></label><div class="row" style="align-self:end"><button class="btn line sm" type="submit">追加する</button><span id="prof-msg"></span></div></form>'+(IS_PC?'<p class="muted small">ここで追加した人は、PCのサーバーに登録されます。その人のスマホをつなぐと、PCで作った計画がそのスマホに届きます。</p>':'');
  h+='<label>名前を変える<input type="text" id="prof-rename" maxlength="20" value="'+esc(prof().name)+'"></label></div>';
  // sync
  if(IS_PC)h+='<div class="panel"><h2>このPC（同期サーバー）</h2>'+renderSyncPanel()+'</div>';
  // scores
  h+='<div class="panel"><h2>テストの点数</h2><form id="score-form" class="grid2"><label>日付<input type="date" id="sc-date" value="'+today()+'"></label><label>科目<select id="sc-subject">'+SUBJECTS.filter(s=>s!=='全科目').map(s=>'<option>'+s+'</option>').join('')+'</select></label><label>テスト名<input type="text" id="sc-title" maxlength="40" placeholder="例：前回の期末"></label><label>点数<input type="number" id="sc-score" min="0" step="0.5"></label><label>満点<input type="number" id="sc-max" min="1" step="0.5" value="100"></label><div class="row"><button class="btn line" type="submit">記録する</button><span id="sc-msg"></span></div></form>'+(D.scores.length?'<ul class="mlist">'+D.scores.slice().reverse().map(s=>{const k='score:'+s.id;return '<li><div>'+esc(md(s.date))+'　'+esc(s.subject)+'　'+esc(s.title)+'　<strong>'+esc(s.score)+' / '+esc(s.max)+'</strong></div><button class="btn text sm'+(S.confirm===k?' danger':'')+'" data-act="del-score" data-id="'+esc(s.id)+'">'+(S.confirm===k?'本当に削除':'削除')+'</button></li>'}).join('')+'</ul>':'')+'</div>';
  // backup
  h+='<div class="panel"><h2>バックアップ</h2><p class="muted small">機種変更の前や、ときどき書き出しておくと安心です。テキストでコピーしたものをClaudeに貼ると、進み具合を分析してもらえます。</p><div class="row"><button class="btn line" data-act="export-file">ファイルに書き出す</button><button class="btn line" data-act="export-copy">テキストでコピー</button></div><label>バックアップを読み込む（ファイル）<input type="file" id="imp-file" accept="application/json,.json,text/plain"></label><label>バックアップを読み込む（テキストを貼る）<textarea id="imp-text" style="min-height:60px"></textarea></label><div class="row"><button class="btn line" data-act="import-text">貼ったテキストを読み込む</button></div><div id="imp-msg"></div></div>';
  h+=installTip();
  $('settings').innerHTML=h;
}
function renderLibrary(){
  let h='<div class="top"><h1>デッキを追加</h1><button class="btn line" data-act="tab" data-tab="decks">戻る</button></div>';
  h+=libGroups().map(g=>'<div class="panel"><h2>'+esc(g.name)+'</h2><ul class="decks">'+g.decks.map(l=>{const ins=D.decks.find(d=>d.id===l.id),key='lib:'+l.id;
    return '<li class="deck"><div style="min-width:0"><strong>'+esc(l.title)+'</strong><span class="muted small">'+(l.cards||[]).length+'枚'+(ins?'・入れ済み':'')+'</span></div><div class="acts">'+(!ins?'<button class="btn" data-act="lib-add" data-id="'+esc(l.id)+'">入れる</button>':'<button class="btn text'+(S.confirm===key?' danger':'')+'" data-act="lib-remove" data-id="'+esc(l.id)+'">'+(S.confirm===key?'本当に外す（進み具合も消えます）':'外す')+'</button>')+'</div></li>'}).join('')+'</ul></div>').join('');
  h+='<div class="panel"><h2>自分でデッキを作る</h2><p class="muted small">「カードの追加と管理」で、名前を付けたデッキを作り、カードを追加できます。</p><button class="btn line" data-act="manage">カードの追加と管理へ</button></div>';
  $('library').innerHTML=h;
}
function renderFocus(){
  const u=findUnit(S.focus);
  if(!u){$('focus').innerHTML='<div class="panel"><p>このやることは見つかりませんでした。計画の設定で消された可能性があります。</p><button class="btn" data-act="tab" data-tab="today">今日へ戻る</button></div>';return}
  if(!S.timer||S.timer.id!==u.id)S.timer={id:u.id,acc:0,start:null,iv:null};
  const dk=resolveDecks(u.decks),d=isDone(u.id),run=!!S.timer.start;
  let h='<div class="bar"><button class="btn text" data-act="tab" data-tab="'+esc(S.tab)+'">戻る</button><span></span></div>';
  h+='<div class="panel" style="gap:16px"><span class="subj" style="margin:0">'+esc(u.subject)+'</span><h2 style="font-size:21px;overflow-wrap:anywhere">'+esc(u.title)+'</h2>'+(u.min?'<p class="muted small">目安 '+u.min+'分</p>':'');
  if(dk.length)h+='<button class="btn big" data-act="focus-cards">カードを全部回す（'+dk.reduce((a,x)=>a+(x.cards||[]).length,0)+'枚）</button><p class="muted small">最後まで回すと、自動で「終わった」になります。</p>';
  h+='<div><p class="timer" id="timer-num">00:00</p><p class="hint">'+(run?'計測中':'タイマーは使わなくても大丈夫です')+'</p></div><div class="row" style="justify-content:center"><button class="btn line" data-act="timer">'+(run?'一時停止':(S.timer.acc?'再開':'タイマーを始める'))+'</button></div>';
  h+=d?'<button class="btn big line" data-act="focus-undone">「終わった」を取り消す</button>':'<button class="btn big go" data-act="focus-done">終わった！</button>';
  h+='</div>';
  $('focus').innerHTML=h;tick();
}
function renderStudy(){
  const el=$('study'),r=S.run;
  if(!r){show(S.tab);return}
  const c=r.queue[0];
  if(!c){
    const missN=r.missed.size;
    el.innerHTML='<div class="screen" style="padding-left:0;padding-right:0"><div class="panel"><h2>'+(r.mode==='srs'?'今日の分が終わりました':'全部回しました')+'</h2><p>'+(r.mode==='srs'?r.done+'回解きました。「もう一度」は'+missN+'枚でした。次は忘れかけたころに出てきます。':r.total+'枚を回しました。1回目で正解したのは'+r.right+'枚、間違えたのは'+missN+'枚です。')+'</p>'+(r.taskId?'<p class="ok">計画のやることを「終わった」にしました。</p>':'')+'<div class="row">'+(missN?'<button class="btn" data-act="cram-missed">間違えた'+missN+'枚だけ回す</button>':'')+'<button class="btn '+(r.taskId?'big go':'line')+'" data-act="run-back">'+(r.taskId?'次へ':'戻る')+'</button></div></div></div>';
    return;
  }
  const total=r.done+r.queue.length,p=total?Math.round(r.done/total*100):0,s=stateOf(c.key);
  let h='<div class="bar"><button class="btn text" data-act="run-back">終える</button><span class="small muted">'+(r.mode==='srs'?'学習':'全部回す')+'・残り'+r.queue.length+'枚</span><button class="btn text" data-act="undo"'+(r.history.length?'':' disabled')+'>1つ戻す</button></div><div class="prog"><i style="width:'+p+'%"></i></div>';
  h+='<div class="cardwrap"><div class="wcard"><div class="meta"><span>'+esc(c.category||'')+'</span>'+(r.mode==='srs'&&!s?'<span class="tag">はじめて</span>':'')+'</div><p class="front">'+esc(c.front)+'</p>';
  if(c.options)h+='<div class="opts">'+c.options.map((o,i)=>{const cls=r.shown?(i===c.answer?' right':(r.pick===i?' wrong':'')):'';return '<button class="opt'+cls+'" data-pick="'+i+'"'+(r.shown?' disabled':'')+'><b>'+MARK[i]+'</b><span>'+esc(o)+'</span></button>'}).join('')+'</div>';
  if(r.shown){const head=c.options?(r.pick===c.answer?'<b style="font-size:18px">○ 正解！</b><br>':'<b style="color:var(--again);font-size:18px">× ざんねん。正解は '+MARK[c.answer]+'</b><br>'):'';h+='<div class="answer">'+head+esc(c.back)+'</div>'}
  h+='</div></div><div class="controls">';
  if(!r.shown)h+=c.options?'<p class="hint">正しいと思うものを押す</p>':'<p class="hint">頭の中で答えてから押す</p><button class="btn big" data-act="reveal">答えを見る</button>';
  else if(r.mode==='srs'){if(c.options){const ok=r.pick===c.answer;h+='<button class="btn big go" data-rate="'+(ok?3:1)+'">'+(ok?'次へ':'次へ（あとでもう一度出ます）')+'</button>'}else h+='<div class="rate two"><button class="r1" data-rate="1">× まちがえた<small>あとでもう一度</small></button><button class="r3 rec" data-rate="3">○ できた<small>次へ</small></button></div>'}
  else if(c.options){const ok=r.pick===c.answer;h+='<button class="btn big go" data-cram="'+(ok?1:0)+'">'+(ok?'次へ':'次へ（あとでもう一度出ます）')+'</button>'}else{h+='<div class="rate two"><button class="r1" data-cram="0">× まちがえた<small>あとでもう一度</small></button><button class="r3 rec" data-cram="1">○ できた<small>次へ</small></button></div>'}
  el.innerHTML=h+'</div>';
}
function renderManage(){
  const ud=userDecks();
  if(!S.manageDeck||!ud.find(d=>d.id===S.manageDeck))S.manageDeck=ud.length?ud[0].id:'__new';
  $('m-deck').innerHTML=ud.length?ud.map(d=>'<option value="'+esc(d.id)+'"'+(d.id===S.manageDeck?' selected':'')+'>'+esc(d.title)+'（'+d.cards.length+'枚）</option>').join(''):'<option value="__new">自分のカード（追加すると作られます）</option>';
  const d=ud.find(x=>x.id===S.manageDeck);
  $('m-count').textContent=d?d.cards.length+'枚':'';
  if(!d){$('m-list').innerHTML='<p class="muted small">カードを追加すると「自分のカード」デッキができます。名前を付けたいときは、先に上でデッキを作ってください。</p>';return}
  const delKey='deck:'+d.id;
  $('m-list').innerHTML=(d.cards.length?'<ul class="mlist">'+d.cards.slice().reverse().map(c=>{const k='card:'+c.id;return '<li><div>'+esc(c.front)+'\n<span class="muted">'+esc(c.back)+'</span></div><button class="btn text'+(S.confirm===k?' danger':'')+'" data-act="del-card" data-id="'+esc(c.id)+'">'+(S.confirm===k?'本当に削除':'削除')+'</button></li>'}).join('')+'</ul>':'<p class="muted small">このデッキにはまだカードがありません。</p>')+'<div class="row"><button class="btn text'+(S.confirm===delKey?' danger':'')+'" data-act="del-deck">'+(S.confirm===delKey?'本当にデッキを削除（進み具合も消えます）':'このデッキを削除')+'</button></div>';
}
function render(){
  if(!D.setup&&S.screen!=='welcome'&&S.screen!=='planner'&&S.screen!=='settings')S.screen='welcome';
  ['welcome','today','plan','planner','decks','settings','library','focus','study','manage'].forEach(s=>{$(s).hidden=S.screen!==s});
  $('tabs').hidden=S.screen==='welcome'||S.screen==='study';
  TABS.forEach(t=>{const b=$('tab-'+t);if(t===S.tab)b.setAttribute('aria-current','page');else b.removeAttribute('aria-current')});
  ({welcome:renderWelcome,today:renderToday,plan:renderPlan,planner:renderPlanner,decks:renderDecks,settings:renderSettings,library:renderLibrary,focus:renderFocus,study:renderStudy,manage:renderManage})[S.screen]();
}

/* ---------- planner edits ---------- */
const NUMF=['weekdayMin','weekendMin','ankiMin','newLimit','min','weight','cycles','finalMin'];
function applyField(t){
  const st=D.settings,k=t.dataset.k,f=t.dataset.f,si=Number(t.dataset.si),ii=Number(t.dataset.ii);
  let v=t.value;
  if(NUMF.includes(f))v=Math.max(0,Number(v)||0);
  if(f==='holidays'||f==='offDays')v=String(v).split(/[、,，\s]+/).map(parseDate).filter(Boolean);
  if(k==='g')st[f]=v;
  else if(k==='s'&&st.subjects[si])st.subjects[si][f]=v;
  else if(k==='i'&&st.subjects[si]&&st.subjects[si].items[ii]){const it=st.subjects[si].items[ii];if(f==='deck')it.decks=v?[v]:[];else it[f]=v}
  else if(k==='x'&&st.extras[ii])st.extras[ii][f]=v;
  touchSettings();
  clearTimeout(S.saveT);S.saveT=setTimeout(()=>{persist();renderPreview()},400);
}
function structural(fn){fn(D.settings);touchSettings();persist();renderPlanner()}
const newId=()=>Date.now().toString(36)+rid(3);

/* ---------- backup ---------- */
function backupText(){return JSON.stringify({app:'speed-anki',version:3,exportedAt:new Date().toISOString(),data:strip(D)})}
function parseBackup(text){const o=JSON.parse(text),d=o&&o.data?o.data:o;if(!d||!Array.isArray(d.decks)||!d.srs)throw new Error('bad');return normalize(d)}
function askImport(text){
  try{S.pendingImport=parseBackup(text)}catch(e){S.pendingImport=null;$('imp-msg').innerHTML='<p class="err">バックアップとして読み込めませんでした。書き出したファイルかテキストをそのまま使ってください。</p>';return}
  const n=S.pendingImport.decks.reduce((a,d)=>a+(d.cards||[]).length,0);
  $('imp-msg').innerHTML='<p class="small">デッキ'+S.pendingImport.decks.length+'個・カード'+n+'枚・科目'+S.pendingImport.settings.subjects.length+'つのバックアップです。今のデータはすべて置き換わります。</p><div class="row"><button class="btn" data-act="import-confirm">このバックアップで置き換える</button><button class="btn text" data-act="import-cancel">やめる</button></div>';
}
async function exportFile(){
  const text=backupText(),name='anki-backup-'+today()+'.json';
  try{const file=new File([text],name,{type:'application/json'});if(navigator.canShare&&navigator.canShare({files:[file]})&&window.innerWidth<900){await navigator.share({files:[file],title:'暗記帳のバックアップ'});return}}catch(e){if(e&&e.name==='AbortError')return}
  const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([text],{type:'application/json'}));a.download=name;document.body.appendChild(a);a.click();setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove()},1500);
}
function copyText(t,ok,ng){if(navigator.clipboard&&navigator.clipboard.writeText)navigator.clipboard.writeText(t).then(ok,ng);else ng()}
function parseExtraLines(text){
  const out=[],bad=[];
  String(text||'').split(/\r?\n/).forEach((raw,i)=>{const l=raw.trim();if(!l||l[0]==='#')return;const p=l.split(/\t|｜|\|/).map(x=>x.trim());const date=parseDate(p[0]);if(!date||p.length<3||!p[2]){bad.push(i+1);return}const dk=p[4]?D.decks.find(d=>d.id===p[4]||d.title===p[4]):null;out.push({id:newId()+i,date,subject:p[1]||'全科目',title:p[2],min:parseInt(p[3],10)||0,decks:dk?[dk.id]:[]})});
  return {out,bad};
}
function applyPreset(p){
  (p.decks||[]).forEach(id=>installLib(id));
  D.planId=p.id;D.planVersion=p.version||1;
  const s=JSON.parse(JSON.stringify(p.settings));s.updatedAt=Date.now();
  D.settings=Object.assign(blankSettings(),s);D.setup=true;persist();
}
function switchProfile(id){
  clearTimeout(S.saveT);if(S.saveT){persist()}
  P.active=id;saveProfiles();D=load();S.sched=null;S.run=null;S.focus=null;S.timer=null;S.filter='all';S.manageDeck=null;
  syncStart();show(D.setup?'today':'welcome');
}
function pickPerson(id,name){
  prof().srv=id;if(name)prof().name=name;saveProfiles();S.pairProfiles=null;
  if(!D.setup)D.setup=true;saveLocal();syncStart();
  if(S.screen==='welcome')show('today');else render();
}

/* ---------- events ---------- */
document.addEventListener('click',async e=>{
  const b=e.target.closest('button');if(!b)return;
  const a=b.dataset.act;
  if(b.dataset.filter){S.filter=b.dataset.filter;return renderDecks()}
  if(b.dataset.pick!==undefined)return pick(Number(b.dataset.pick));
  if(b.dataset.rate)return rate(Number(b.dataset.rate));
  if(b.dataset.cram!==undefined)return cram(b.dataset.cram==='1');
  if(!a)return;
  const si=Number(b.dataset.si),ii=Number(b.dataset.ii);
  switch(a){
    case 'tab':return show(b.dataset.tab);
    case 'planner':return show('planner');
    case 'library':return show('library');
    case 'manage':return show('manage');
    case 'past':S.showPast=true;return renderPlan();
    case 'toggle':setDone(b.dataset.id,!isDone(b.dataset.id));return render();
    case 'open':S.focus=b.dataset.id;return show('focus');
    case 'next':{const u=findUnit(b.dataset.id);if(!u)return;const ids=resolveDecks(u.decks).map(d=>d.id);const cards=allCards().filter(c=>ids.includes(c.deckId));if(cards.length)return startCram(cards,u.id);S.focus=u.id;return show('focus')}
    case 'review':if(!startSrs(allCards()))show('decks');return;
    case 'focus-cards':{const u=findUnit(S.focus);if(!u)return;const ids=resolveDecks(u.decks).map(d=>d.id);return startCram(allCards().filter(c=>ids.includes(c.deckId)),u.id)}
    case 'focus-done':setDone(S.focus,true);return show(S.tab);
    case 'focus-undone':setDone(S.focus,false);return renderFocus();
    case 'timer':return toggleTimer();
    case 'reveal':return reveal();
    case 'undo':return undo();
    case 'run-back':return back();
    case 'srs-all':return startSrs(visible());
    case 'srs':return startSrs(visible().filter(c=>c.deckId===b.dataset.deck));
    case 'cram':return startCram(visible().filter(c=>c.deckId===b.dataset.deck));
    case 'cram-missed':{if(!S.run)return;const keys=S.run.missed,bk=S.run.back;startCram(allCards().filter(c=>keys.has(c.key)));if(S.run)S.run.back=bk;return}
    case 'setup-preset':{const p=PRESETS[Number(b.dataset.i)];if(p){applyPreset(p);show('today')}return}
    case 'setup-blank':D.setup=true;D.settings.updatedAt=Date.now();persist();return show('planner');
    case 'pl-add-subj':return structural(st=>st.subjects.push({id:'s'+newId(),name:'',weight:1,cycles:3,testDate:'',items:[{id:'i'+newId(),label:'',min:30,decks:[]}]}));
    case 'pl-del-subj':{const k='subj:'+si;if(S.confirm!==k){S.confirm=k;return renderPlanner()}S.confirm=null;return structural(st=>st.subjects.splice(si,1))}
    case 'pl-add-item':return structural(st=>st.subjects[si].items.push({id:'i'+newId(),label:'',min:30,decks:[]}));
    case 'pl-del-item':return structural(st=>st.subjects[si].items.splice(ii,1));
    case 'pl-add-extra':return structural(st=>st.extras.push({id:newId(),date:today(),subject:'全科目',title:'',min:15}));
    case 'pl-del-extra':return structural(st=>st.extras.splice(ii,1));
    case 'pl-extra-import':{const r=parseExtraLines(($('pl-extra-text')||{}).value);if(!r.out.length){setMsg('pl-extra-msg','読み込める行がありません。「11/10｜英語｜やること｜20」の形で書いてください。');return}structural(st=>{st.extras=st.extras.concat(r.out)});setMsg('pl-extra-msg',r.out.length+'件追加しました。'+(r.bad.length?'読めなかった行（'+r.bad.join(', ')+'行目）は飛ばしました。':''),true);return}
    case 'pl-gen':{
      const pre=($('gen-pre-'+si).value||'').trim(),from=parseInt($('gen-from-'+si).value,10),to=parseInt($('gen-to-'+si).value,10),per=parseInt($('gen-per-'+si).value,10)||25,mpu=Number($('gen-mpu-'+si).value)||2;
      if(!(from>=0)||!(to>=from)){setMsg('gen-msg-'+si,'最初と最後の番号を入れてください。');return}
      const rows=[];for(let x=from;x<=to;x+=per){const y=Math.min(to,x+per-1);rows.push({id:'i'+newId()+rows.length,label:(pre?pre+' ':'')+x+(y>x?'〜'+y:''),min:Math.max(5,Math.round((y-x+1)*mpu/5)*5),decks:[]})}
      structural(st=>{const s=st.subjects[si];s.items=s.items.filter(it=>String(it.label||'').trim()).concat(rows)});setMsg('gen-msg-'+si,rows.length+'行作りました。',true);return;
    }
    case 'prof-switch':return switchProfile(b.dataset.id);
    case 'prof-del':{const k='prof:'+b.dataset.id;if(S.confirm!==k){S.confirm=k;return renderSettings()}S.confirm=null;const gone=P.list.find(p=>p.id===b.dataset.id);
      if(IS_PC&&gone&&gone.srv&&gone.srv!=='me'){try{await api('/api/profiles/'+encodeURIComponent(gone.srv),{method:'POST',body:{delete:true}})}catch(x){}}
      P.list=P.list.filter(p=>p.id!==b.dataset.id);saveProfiles();try{localStorage.removeItem(dataKey(b.dataset.id))}catch(x){}return renderSettings()}
    case 'pair-pick':return pickPerson(b.dataset.id,b.dataset.name);
    case 'pair-list':{S.pairProfiles=null;S.pairErr=false;render();return findPeople()}
    case 'sync-now':syncInfo.state='connecting';renderSettings();await syncRun(pullNow);await syncRun(pushNow);return renderSettings();
    case 'unlink':{if(S.confirm!=='unlink'){S.confirm='unlink';return renderSettings()}S.confirm=null;LINK={};saveLink();P.list.forEach(p=>{delete p.srv});saveProfiles();syncStart();S.pairProfiles=null;renderSettings();return findPeople()}
    case 'del-score':{const k='score:'+b.dataset.id;if(S.confirm!==k){S.confirm=k;return renderSettings()}S.confirm=null;D.scores=D.scores.filter(s=>s.id!==b.dataset.id);persist();return renderSettings()}
    case 'lib-add':installLib(b.dataset.id);persist();return renderLibrary();
    case 'lib-remove':{const k='lib:'+b.dataset.id;if(S.confirm!==k){S.confirm=k;return renderLibrary()}S.confirm=null;removeDeck(b.dataset.id);return renderLibrary()}
    case 'del-card':{const k='card:'+b.dataset.id;if(S.confirm!==k){S.confirm=k;return renderManage()}S.confirm=null;const d=userDecks().find(x=>x.id===S.manageDeck);if(d){d.cards=d.cards.filter(c=>c.id!==b.dataset.id);d.updatedAt=Date.now();persist()}return renderManage()}
    case 'del-deck':{const k='deck:'+S.manageDeck;if(S.confirm!==k){S.confirm=k;return renderManage()}S.confirm=null;removeDeck(S.manageDeck);S.manageDeck=null;return renderManage()}
    case 'export-file':return exportFile();
    case 'export-copy':{const t=backupText();return copyText(t,()=>{$('imp-msg').innerHTML='<p class="ok">コピーしました。メモアプリやClaudeに貼れます。</p>'},()=>{const ta=$('imp-text');ta.value=t;ta.focus();ta.select();$('imp-msg').innerHTML='<p class="small">自動でコピーできなかったので、上の欄に表示しました。長押しして「すべて選択」→「コピー」してください。</p>'})}
    case 'import-text':return askImport($('imp-text').value);
    case 'import-confirm':{if(!S.pendingImport)return;D=S.pendingImport;D.setup=true;D.settings.updatedAt=Date.now();S.pendingImport=null;persist();return show('settings')}
    case 'import-cancel':S.pendingImport=null;$('imp-msg').innerHTML='';return;
  }
});
document.addEventListener('input',e=>{const t=e.target;if(t.dataset&&t.dataset.k)applyField(t)});
document.addEventListener('change',e=>{
  const t=e.target;
  if(t.dataset&&t.dataset.k){applyField(t);if(t.dataset.f==='holidays'||t.dataset.f==='offDays'){clearTimeout(S.saveT);persist();renderPlanner()}return}
  if(t.id==='prof-rename'){const v=t.value.trim();if(v){prof().name=v;saveProfiles();if(IS_PC&&prof().srv)api('/api/profiles/'+encodeURIComponent(prof().srv),{method:'POST',body:{name:v}}).catch(()=>{})}return}
  if(t.id==='m-deck'){S.manageDeck=t.value;S.confirm=null;return renderManage()}
  if(t.id==='imp-file'&&t.files&&t.files[0]){const fr=new FileReader();fr.onload=()=>askImport(String(fr.result||''));fr.readAsText(t.files[0]);t.value=''}
});
document.addEventListener('keydown',e=>{
  if(e.ctrlKey||e.metaKey||e.altKey)return;
  const tag=((e.target&&e.target.tagName)||'').toLowerCase();
  if(tag==='input'||tag==='textarea'||tag==='select')return;
  if(S.screen!=='study'||!S.run)return;
  const r=S.run,c=r.queue[0];
  if(e.key==='Escape'){e.preventDefault();return back()}
  if(e.key==='z'||e.key==='Z'||e.key==='Backspace'){e.preventDefault();return undo()}
  if(!c)return;
  if(!r.shown){
    if(c.options&&/^[1-9]$/.test(e.key)&&Number(e.key)<=c.options.length){e.preventDefault();return pick(Number(e.key)-1)}
    if(!c.options&&(e.key===' '||e.key==='Enter')){e.preventDefault();return reveal()}
    return;
  }
  if(r.mode==='srs'){if(/^[1-4]$/.test(e.key)){e.preventDefault();return rate(Number(e.key))}if(e.key===' '||e.key==='Enter'){e.preventDefault();return rate(recommended())}}
  else{if(e.key==='1'||e.key==='ArrowLeft'){e.preventDefault();return cram(false)}if(e.key==='2'||e.key==='ArrowRight'||e.key===' '||e.key==='Enter'){e.preventDefault();return cram(true)}}
});
document.addEventListener('submit',e=>{
  e.preventDefault();
  const id=e.target.id;
  if(id==='nd-form'){const title=$('nd-title').value.trim();if(!title){setMsg('nd-msg','デッキの名前を書いてください。');return}const d=createDeck(title,$('nd-subject').value);S.manageDeck=d.id;$('nd-title').value='';setMsg('nd-msg','「'+title+'」を作りました。',true);renderManage()}
  if(id==='one-form'){const front=$('m-front').value.trim(),bk=$('m-back').value.trim();if(!front||!bk){setMsg('m-msg','表と裏の両方を書いてください。');return}addCards([{front,back:bk}]);$('m-front').value='';$('m-back').value='';setMsg('m-msg','追加しました。',true);renderManage()}
  if(id==='bulk-form'){
    const lines=$('b-text').value.split(/\r?\n/).map(l=>l.trim()).filter(Boolean),list=[],bad=[];
    lines.forEach((l,i)=>{const p=l.split(/\t|｜|\|/);const f=(p[0]||'').trim(),bk=p.slice(1).join(' / ').trim();if(p.length>=2&&f&&bk)list.push({front:f,back:bk});else bad.push(i+1)});
    if(!list.length){setMsg('b-msg','追加できる行がありません。表と裏を「｜」で区切ってください。');return}
    addCards(list);$('b-text').value='';setMsg('b-msg',list.length+'枚追加しました。'+(bad.length?'区切りのない行（'+bad.slice(0,10).join(', ')+(bad.length>10?' など':'')+'行目）は飛ばしました。':''),true);renderManage();
  }
  if(id==='score-form'){
    const score=Number($('sc-score').value),max=Number($('sc-max').value),date=$('sc-date').value;
    if(!isDate(date)||!(max>0)||!(score>=0)||score>max){setMsg('sc-msg','日付と、0から満点までの点数を入れてください。');return}
    D.scores.push({id:'s'+newId(),date,subject:$('sc-subject').value,title:$('sc-title').value.trim()||'テスト',score,max});persist();renderSettings();setMsg('sc-msg','記録しました。',true);
  }
  if(id==='prof-form'){
    const name=$('prof-name').value.trim();if(!name){setMsg('prof-msg','名前を書いてください。');return}
    if(IS_PC){
      api('/api/profiles',{method:'POST',body:{name}}).then(r=>{
        if(r.status!==200){setMsg('prof-msg','サーバーに追加できませんでした。');return}
        mirrorProfiles(r.body.profiles);const p=P.list.find(x=>x.srv===r.body.id);if(p)switchProfile(p.id);
      }).catch(()=>setMsg('prof-msg','サーバーに追加できませんでした。'));
      return;
    }
    const pid='p'+newId();P.list.push({id:pid,name});saveProfiles();switchProfile(pid);
  }
});

/* ---------- start ---------- */
$('nd-subject').innerHTML=SUBJECTS.filter(s=>s!=='全科目').map(s=>'<option>'+s+'</option>').join('');
if(PRESETS[0]&&(!D.setup||((!D.planId||D.planId===PRESETS[0].id)&&(D.planVersion||0)<(PRESETS[0].version||1))))applyPreset(PRESETS[0]);
S.screen=D.setup?'today':'welcome';
document.addEventListener('visibilitychange',()=>{if(!document.hidden){S.sched=null;if(['today','plan','decks'].includes(S.screen))render();syncRun(pullNow)}});
render();
syncStart();
findPeople();
if(IS_PC){pcRefresh();setInterval(()=>{if(!document.hidden&&S.screen==='settings')pcRefresh()},15000)}
if('serviceWorker' in navigator){window.addEventListener('load',()=>{navigator.serviceWorker.register('sw.js').catch(()=>{})})}
window.__speedAnki={schedule:()=>schedule(),data:()=>D};
})();
