// FILE: /js/facetoface_stt_media.js
const API_BASE = "https://italky-api.onrender.com";

export async function recordUntilSilence({
  maxMs = 45000,
  silenceMs = 2000,
  rmsThreshold = 0.012,   // çok hassassa 0.02 yap
  onTick = (msLeft)=>{},
} = {}){
  const stream = await navigator.mediaDevices.getUserMedia({ audio:true });
  const mr = new MediaRecorder(stream, { mimeType: pickMime() });

  const chunks = [];
  mr.ondataavailable = (e)=>{ if(e.data && e.data.size) chunks.push(e.data); };

  // VAD (ses var/yok)
  const ctx = new (window.AudioContext || window.webkitAudioContext)();
  const src = ctx.createMediaStreamSource(stream);
  const analyser = ctx.createAnalyser();
  analyser.fftSize = 2048;
  src.connect(analyser);

  const buf = new Uint8Array(analyser.fftSize);

  let startedAt = Date.now();
  let lastLoudAt = Date.now();
  let tickTimer = null;
  let vadTimer = null;

  const stopAll = async ()=>{
    try{ mr.stop(); }catch{}
    try{ stream.getTracks().forEach(t=>t.stop()); }catch{}
    try{ await ctx.close(); }catch{}
    if(tickTimer) clearInterval(tickTimer);
    if(vadTimer) clearInterval(vadTimer);
  };

  const done = new Promise((resolve, reject)=>{
    mr.onstop = ()=> resolve(new Blob(chunks, { type: mr.mimeType || "audio/webm" }));
    mr.onerror = (e)=> reject(e);
  });

  mr.start(250);

  tickTimer = setInterval(()=>{
    const left = maxMs - (Date.now() - startedAt);
    onTick(Math.max(0,left));
    if(left <= 0){
      stopAll();
    }
  }, 250);

  vadTimer = setInterval(()=>{
    analyser.getByteTimeDomainData(buf);
    // RMS
    let sum = 0;
    for(let i=0;i<buf.length;i++){
      const v = (buf[i]-128)/128;
      sum += v*v;
    }
    const rms = Math.sqrt(sum / buf.length);

    if(rms > rmsThreshold){
      lastLoudAt = Date.now();
    }

    if(Date.now() - lastLoudAt >= silenceMs){
      stopAll();
    }
  }, 120);

  return await done;
}

export async function sttBlob(blob, lang){
  const fd = new FormData();
  fd.append("file", blob, "speech.webm");
  if(lang) fd.append("lang", lang);

  const r = await fetch(`${API_BASE}/api/stt`, { method:"POST", body: fd });
  if(!r.ok) throw new Error(await r.text());
  const j = await r.json();
  return String(j.text || "").trim();
}

function pickMime(){
  const c = [
    "audio/webm;codecs=opus",
    "audio/webm",
    "audio/ogg;codecs=opus",
    "audio/ogg",
  ];
  for(const m of c){
    if(MediaRecorder.isTypeSupported(m)) return m;
  }
  return "";
}
