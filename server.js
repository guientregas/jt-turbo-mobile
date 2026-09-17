const express = require('express');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const app = express();
app.use(express.json({limit:'2mb'}));
app.use(express.static(path.join(__dirname,'public')));

const PORT = process.env.PORT || 3000;
const DB = path.join(__dirname,'data','db.json');
fs.mkdirSync(path.dirname(DB), {recursive:true});
let db = { sessions:{}, whatsapp:{events:[], contacts:{}} };
try { if(fs.existsSync(DB)) db={...db,...JSON.parse(fs.readFileSync(DB,'utf8'))}; } catch(e){ console.error(e.message); }
function save(){ fs.writeFileSync(DB, JSON.stringify(db,null,2)); }
const env = {
  token: process.env.WA_ACCESS_TOKEN || '',
  phoneNumberId: process.env.WA_PHONE_NUMBER_ID || '',
  verifyToken: process.env.WA_VERIFY_TOKEN || 'jt-turbo-verify',
  graphVersion: process.env.WA_GRAPH_VERSION || 'v23.0',
  appSecret: process.env.WA_APP_SECRET || ''
};

app.get('/health',(req,res)=>res.json({ok:true,whatsappConfigured:!!(env.token&&env.phoneNumberId)}));

// Meta webhook verification
app.get('/webhook/whatsapp',(req,res)=>{
  const mode=req.query['hub.mode'], token=req.query['hub.verify_token'], challenge=req.query['hub.challenge'];
  if(mode==='subscribe' && token===env.verifyToken) return res.status(200).send(challenge);
  res.sendStatus(403);
});

function normPhone(v){let d=String(v||'').replace(/\D/g,''); if(d.length===10||d.length===11)d='55'+d; return d;}
function findOrder(phone){
  phone=normPhone(phone);
  for(const sid of Object.keys(db.sessions)){
    const s=db.sessions[sid]; const o=(s.orders||[]).find(x=>normPhone(x.phone)===phone && x.status!=='done');
    if(o) return {sid,o};
  }
  return null;
}
function parseAddressText(text){
  const t=String(text||'').trim();
  const m=t.match(/(?:rua|r\.|avenida|av\.|alameda|travessa|tv\.|quadra|q\.?d\.?)\s+(.+)/i);
  return {address:t,number:(t.match(/(?:n[ºo]?|número)\s*(\d+[A-Za-z-]?)/i)||[])[1]||''};
}
async function sendText(to,text){
  if(!env.token||!env.phoneNumberId) throw new Error('WhatsApp Cloud API não configurada no servidor');
  const url=`https://graph.facebook.com/${env.graphVersion}/${env.phoneNumberId}/messages`;
  const r=await fetch(url,{method:'POST',headers:{Authorization:`Bearer ${env.token}`,'Content-Type':'application/json'},body:JSON.stringify({messaging_product:'whatsapp',to:normPhone(to),type:'text',text:{preview_url:false,body:text}})});
  const data=await r.json(); if(!r.ok) throw new Error(data?.error?.message||'Falha na API do WhatsApp'); return data;
}
async function sendFlow(phone,order){
  const text = `Olá, ${order?.client||'tudo bem'}! 🚚\nSou da J&T Turbo e estou preparando sua entrega.\n\nPara confirmar: por favor envie aqui seu endereço completo (rua/avenida, número e complemento) e depois compartilhe sua localização atual 📍.\n\nAssim que receber, vou registrar tudo automaticamente para o entregador.`;
  return sendText(phone,text);
}

// Incoming WhatsApp events. Location/text are attached to the matching order by phone.
app.post('/webhook/whatsapp',(req,res)=>{
  res.sendStatus(200);
  setImmediate(async()=>{
    try{
      const body=req.body||{};
      for(const entry of (body.entry||[])) for(const change of (entry.changes||[])){
        const value=change.value||{};
        for(const m of (value.messages||[])){
          const phone=normPhone(m.from); const ev={id:m.id,phone,type:m.type,receivedAt:new Date().toISOString(),text:m.text?.body||'',location:m.location||null};
          db.whatsapp.events.unshift(ev); db.whatsapp.events=db.whatsapp.events.slice(0,500);
          const match=findOrder(phone);
          if(!match) { save(); continue; }
          const {sid,o}=match;
          if(m.type==='location' && m.location){
            o.lat=Number(m.location.latitude); o.lng=Number(m.location.longitude); o.locationSource='whatsapp'; o.locationAt=new Date().toISOString();
            await sendText(phone,`📍 Localização recebida, ${o.client||'obrigado'}! Já registrei na rota.\n\nSe ainda não informou o endereço completo, envie rua, número e complemento.`).catch(()=>{});
          } else if(m.type==='text' && m.text?.body){
            const parsed=parseAddressText(m.text.body);
            if(!o.address) { o.address=parsed.address; if(parsed.number)o.number=parsed.number; o.addressSource='whatsapp'; }
            else if(!o.notes) o.notes=m.text.body;
            await sendText(phone,`✅ Recebi seu endereço. Agora, por favor, envie sua localização atual pelo WhatsApp: 📎 → Localização → Enviar sua localização atual.`).catch(()=>{});
          }
          db.sessions[sid]=db.sessions[sid];
        }
      }
      save();
    }catch(e){console.error('Webhook:',e.message)}
  });
});

app.post('/api/whatsapp/send-flow',async(req,res)=>{
  try{const {phone,order}=req.body||{}; if(!phone)return res.status(400).json({ok:false,error:'phone obrigatório'}); const r=await sendFlow(phone,order||{}); res.json({ok:true,result:r});}
  catch(e){res.status(500).json({ok:false,error:e.message});}
});
app.get('/api/whatsapp/events',(req,res)=>{
  const since=req.query.since?Number(req.query.since):0;
  res.json({ok:true,events:db.whatsapp.events.filter(e=>!since || Date.parse(e.receivedAt)>since).slice(0,100)});
});
app.post('/api/whatsapp/session',(req,res)=>{const {sessionId,orders}=req.body||{}; if(!sessionId)return res.status(400).json({ok:false}); db.sessions[sessionId]={orders:orders||[]}; save(); res.json({ok:true});});
app.get('/api/whatsapp/config',(req,res)=>res.json({ok:true,configured:!!(env.token&&env.phoneNumberId),webhookPath:'/webhook/whatsapp'}));

app.get(/.*/,(req,res)=>res.sendFile(path.join(__dirname,'public','index.html')));
app.listen(PORT,'0.0.0.0',()=>console.log(`J&T Turbo server listening on ${PORT}`));
