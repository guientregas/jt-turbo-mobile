const express=require('express');
const fs=require('fs');
const path=require('path');
const crypto=require('crypto');
const {Pool}=require('pg');

const app=express();
const PORT=process.env.PORT||3000;
const DB=process.env.DB_FILE||path.join(__dirname,'data','db.json');
const pool=process.env.DATABASE_URL?new Pool({connectionString:process.env.DATABASE_URL,ssl:process.env.DATABASE_URL.includes('localhost')?false:{rejectUnauthorized:false}}):null;
fs.mkdirSync(path.dirname(DB),{recursive:true});

let db={sessions:{},whatsapp:{events:[],contacts:{}},telemetry:[]};
try{if(fs.existsSync(DB))db={...db,...JSON.parse(fs.readFileSync(DB,'utf8'))}}catch(e){console.error('DB:',e.message)}
function save(){fs.writeFileSync(DB,JSON.stringify(db,null,2))}
async function initDb(){if(!pool)return;await pool.query(`CREATE TABLE IF NOT EXISTS jt_state (session_id text PRIMARY KEY, payload jsonb NOT NULL, updated_at timestamptz NOT NULL DEFAULT now())`)}
async function persistSession(sid,payload){if(pool){await pool.query(`INSERT INTO jt_state(session_id,payload,updated_at) VALUES($1,$2,now()) ON CONFLICT(session_id) DO UPDATE SET payload=EXCLUDED.payload,updated_at=now()`,[sid,payload])}else save()}
async function loadSession(sid){if(pool){const r=await pool.query('SELECT payload FROM jt_state WHERE session_id=$1',[sid]);return r.rows[0]?.payload||null}return db.sessions[sid]||null}

const env={
 token:process.env.WA_ACCESS_TOKEN||'',
 phoneNumberId:process.env.WA_PHONE_NUMBER_ID||'',
 verifyToken:process.env.WA_VERIFY_TOKEN||'jt-turbo-verify',
 graphVersion:process.env.WA_GRAPH_VERSION||'v23.0',
 appSecret:process.env.WA_APP_SECRET||'',
 apiKey:process.env.JT_API_KEY||''
};

app.use((req,res,next)=>{
 res.setHeader('Access-Control-Allow-Origin',process.env.CORS_ORIGIN||'*');
 res.setHeader('Access-Control-Allow-Headers','Content-Type,x-hub-signature-256,x-jt-api-key');
 res.setHeader('Access-Control-Allow-Methods','GET,POST,OPTIONS');
 if(req.method==='OPTIONS')return res.sendStatus(204);
 if(env.apiKey && req.path.startsWith('/api/') && req.get('x-jt-api-key')!==env.apiKey)return res.status(401).json({ok:false,error:'API key inválida'});
 next();
});
app.use(express.json({limit:'5mb',verify:(req,res,buf)=>{req.rawBody=buf}}));
const hits=new Map();
app.use((req,res,next)=>{if(!req.path.startsWith('/api/')&&!req.path.startsWith('/webhook/'))return next();const now=Date.now(),key=(req.ip||'unknown')+':'+req.path,old=hits.get(key)||{t:now,n:0};if(now-old.t>60000){old.t=now;old.n=0}old.n++;hits.set(key,old);if(old.n>120)return res.status(429).json({ok:false,error:'Muitas requisições, tente novamente em instantes'});next()});

app.get('/health',(req,res)=>res.json({
 ok:true,version:'V24',time:new Date().toISOString(),
 whatsappConfigured:!!(env.token&&env.phoneNumberId),
 apiKeyProtected:!!env.apiKey,
 database:pool?'postgres':'file-fallback'
}));

function verifyMeta(req){
 if(!env.appSecret)return true;
 const sig=req.get('x-hub-signature-256')||'';
 if(!sig.startsWith('sha256='))return false;
 const expected='sha256='+crypto.createHmac('sha256',env.appSecret).update(req.rawBody||'').digest('hex');
 try{return crypto.timingSafeEqual(Buffer.from(sig),Buffer.from(expected))}catch(e){return false}
}
function normPhone(v){let d=String(v||'').replace(/\D/g,'');if(d.length===10||d.length===11)d='55'+d;return d}
function findOrder(phone){
 phone=normPhone(phone);
 for(const sid of Object.keys(db.sessions)){
  const s=db.sessions[sid];
  const o=(s.orders||[]).find(x=>normPhone(x.phone)===phone&&x.status!=='done');
  if(o)return{sid,o};
 }
 return null;
}
function parseAddressText(text){
 const t=String(text||'').trim();
 return{address:t,number:(t.match(/(?:n[ºo]?|número)\s*(\d+[A-Za-z-]?)/i)||[])[1]||''};
}
async function graphSend(payload){
 if(!env.token||!env.phoneNumberId)throw new Error('WhatsApp Cloud API não configurada no servidor');
 const url=`https://graph.facebook.com/${env.graphVersion}/${env.phoneNumberId}/messages`;
 const r=await fetch(url,{method:'POST',headers:{Authorization:`Bearer ${env.token}`,'Content-Type':'application/json'},body:JSON.stringify({...payload,messaging_product:'whatsapp'})});
 const data=await r.json();if(!r.ok)throw new Error(data?.error?.message||'Falha na API do WhatsApp');return data;
}
const sendText=(to,text)=>graphSend({to:normPhone(to),type:'text',text:{preview_url:false,body:text}});
const sendTemplate=(to,name,language='pt_BR',components=[])=>graphSend({to:normPhone(to),type:'template',template:{name,language:{code:language},components}});
const sendLocation=(to,lat,lng,name,address)=>graphSend({to:normPhone(to),type:'location',location:{latitude:Number(lat),longitude:Number(lng),name:name||'J&T Turbo',address:address||''}});
async function sendFlow(phone,order){
 return sendText(phone,`Olá, ${order?.client||'tudo bem'}! 🚚\nSou da J&T Turbo e estou preparando sua entrega.\n\nEnvie seu endereço completo e depois compartilhe sua localização atual 📍.\nAssim que receber, o ponto será registrado automaticamente na rota.`);
}

app.get('/webhook/whatsapp',(req,res)=>{
 const mode=req.query['hub.mode'],token=req.query['hub.verify_token'],challenge=req.query['hub.challenge'];
 if(mode==='subscribe'&&token===env.verifyToken)return res.status(200).send(challenge);
 res.sendStatus(403);
});
app.post('/webhook/whatsapp',(req,res)=>{
 if(!verifyMeta(req))return res.sendStatus(401);
 res.sendStatus(200);
 setImmediate(async()=>{
  try{
   for(const entry of(req.body?.entry||[]))for(const change of(entry.changes||[])){
    const value=change.value||{};
    for(const m of(value.messages||[])){
     const phone=normPhone(m.from);
     db.whatsapp.events.unshift({id:m.id,phone,type:m.type,receivedAt:new Date().toISOString(),text:m.text?.body||'',location:m.location||null});
     db.whatsapp.events=db.whatsapp.events.slice(0,1000);
     const match=findOrder(phone);if(!match)continue;
     const{sid,o}=match;
     o.updatedAt=new Date().toISOString();
     if(m.type==='location'&&m.location){
      o.lat=Number(m.location.latitude);o.lng=Number(m.location.longitude);
      o.locationSource='whatsapp';o.locationAt=o.updatedAt;
      await sendText(phone,`📍 Localização recebida, ${o.name||'obrigado'}! Já registrei na rota.`).catch(()=>{});
     }else if(m.type==='text'&&m.text?.body){
      const parsed=parseAddressText(m.text.body);
      if(!o.address){o.address=parsed.address;if(parsed.number)o.number=parsed.number;o.addressSource='whatsapp'}
      else if(!o.notes)o.notes=m.text.body;
      await sendText(phone,'✅ Recebi. Agora envie sua localização atual pelo WhatsApp.').catch(()=>{});
     }
     db.sessions[sid].orders=db.sessions[sid].orders||[];
    }
   }
   save();
  }catch(e){console.error('Webhook:',e.message)}
 });
});

app.post('/api/whatsapp/send-flow',async(req,res)=>{try{const{phone,order}=req.body||{};if(!phone)return res.status(400).json({ok:false,error:'phone obrigatório'});res.json({ok:true,result:await sendFlow(phone,order||{})})}catch(e){res.status(500).json({ok:false,error:e.message})}});
app.post('/api/whatsapp/send-message',async(req,res)=>{try{const{phone,text}=req.body||{};if(!phone||!text)return res.status(400).json({ok:false,error:'phone e text obrigatórios'});res.json({ok:true,result:await sendText(phone,text)})}catch(e){res.status(500).json({ok:false,error:e.message})}});
app.post('/api/whatsapp/send-template',async(req,res)=>{try{const{phone,name,language,components}=req.body||{};if(!phone||!name)return res.status(400).json({ok:false,error:'phone e name obrigatórios'});res.json({ok:true,result:await sendTemplate(phone,name,language||'pt_BR',components||[])})}catch(e){res.status(500).json({ok:false,error:e.message})}});
app.post('/api/whatsapp/send-location',async(req,res)=>{try{const{phone,lat,lng,name,address}=req.body||{};if(!phone||lat==null||lng==null)return res.status(400).json({ok:false,error:'phone, lat e lng obrigatórios'});res.json({ok:true,result:await sendLocation(phone,lat,lng,name,address)})}catch(e){res.status(500).json({ok:false,error:e.message})}});
app.post('/api/whatsapp/send-batch',async(req,res)=>{try{const items=Array.isArray(req.body?.items)?req.body.items:[];const results=[];for(const x of items){try{results.push({phone:x.phone,ok:true,result:await sendText(x.phone,x.text)})}catch(e){results.push({phone:x.phone,ok:false,error:e.message})}}res.json({ok:true,results})}catch(e){res.status(500).json({ok:false,error:e.message})}});
app.get('/api/whatsapp/events',(req,res)=>{const since=req.query.since?Number(req.query.since):0;res.json({ok:true,events:db.whatsapp.events.filter(e=>!since||Date.parse(e.receivedAt)>since).slice(0,200)})});
app.get('/api/whatsapp/config',(req,res)=>res.json({ok:true,configured:!!(env.token&&env.phoneNumberId),webhookPath:'/webhook/whatsapp',graphVersion:env.graphVersion}));

function mergeById(existing,incoming){
 const map=new Map((existing||[]).map(x=>[String(x.id),x]));
 for(const x of(incoming||[])){
  if(!x||x.id==null)continue;
  const old=map.get(String(x.id));
  const nt=Date.parse(x.updatedAt||x.deliveredAt||x.createdAt||0)||0;
  const ot=old?Date.parse(old.updatedAt||old.deliveredAt||old.createdAt||0)||0:0;
  if(!old||nt>=ot)map.set(String(x.id),x);
 }
 return Array.from(map.values());
}
app.post('/api/sync',async(req,res)=>{
 try{
  const x=req.body||{},sid=String(x.sessionId||'default');
  const old=await loadSession(sid)||{orders:[],history:[]};
  const mergedOrders=mergeById(old.orders,x.orders);
  const mergedHistory=mergeById(old.history,x.history);
  const syncedAt=new Date().toISOString();
  db.sessions[sid]={...old,orders:mergedOrders,history:mergedHistory,syncedAt,clientVersion:x.clientVersion||old.clientVersion||'unknown'};
  await persistSession(sid,db.sessions[sid]);
  res.json({ok:true,syncedAt,orders:mergedOrders,history:mergedHistory,counts:{orders:mergedOrders.length,history:mergedHistory.length}});
 }catch(e){res.status(500).json({ok:false,error:e.message})}
});
app.get('/api/session/:id',async(req,res)=>{
 const s=await loadSession(String(req.params.id))||{orders:[],history:[]};
 res.json({ok:true,session:s});
});
app.post('/api/telemetry',(req,res)=>{
 const x=req.body||{};db.telemetry.unshift({...x,receivedAt:new Date().toISOString()});
 db.telemetry=db.telemetry.slice(0,5000);save();res.json({ok:true});
});

app.get('/api/route',async(req,res)=>{
 const a=req.query.a,b=req.query.b;
 if(!a||!b)return res.status(400).json({ok:false,error:'a e b obrigatórios'});
 try{
  const u='https://router.project-osrm.org/route/v1/driving/'+a+';'+b+'?overview=full&geometries=geojson&steps=true';
  const r=await fetch(u);res.status(r.status).json(await r.json());
 }catch(e){res.status(502).json({ok:false,error:e.message})}
});
app.get('/api/route/matrix',async(req,res)=>{
 const points=String(req.query.points||'').trim();
 if(!points)return res.status(400).json({ok:false,error:'points obrigatório'});
 try{
  const u='https://router.project-osrm.org/table/v1/driving/'+points+'?annotations=duration,distance';
  const r=await fetch(u);res.status(r.status).json(await r.json());
 }catch(e){res.status(502).json({ok:false,error:e.message})}
});

app.get('/',(req,res)=>res.json({ok:true,service:'jt-turbo-api',version:'V24.1'}));
initDb().then(()=>app.listen(PORT,'0.0.0.0',()=>console.log(`J&T Turbo V24.1 server listening on ${PORT}`))).catch(e=>{console.error('DB init:',e);process.exit(1)});
