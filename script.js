/* 
  ======================================================
  Project: AirCanvas - AI Hand Gesture Drawing
  Core Logic & AI Integration
  Created by: Sivashankar V P (https://github.com/SivashankarVP)
  Copyright (c) 2024 Sivashankar V P. All Rights Reserved.
  ======================================================
*/

// ════════════════════════════════════════
//  STATE
// ════════════════════════════════════════
const PALETTE = ['#00e5ff','#ff3df7','#39ff14','#5c7cfa','#ff6b6b','#ffd93d','#c77dff','#ffffff'];
let color = PALETTE[0], size = 6, glow = 60, opac = 100;
let paths = [], cur = null;
let offX = 0, offY = 0, lastX = 0, lastY = 0;
let gesture = 'idle', gbuf = [], GBUF = 7;
let camOn = false, handOn = false;
let drawing = false;
let cx = 0, cy = 0, tx = 0, ty = 0; // cursor smooth
let fps = 0, fc = 0, ft = 0;
let hands = null, mp_cam = null;
const ERASE_R = 36;
const SPARKS = [];

// ════════════════════════════════════════
//  CANVAS SETUP
// ════════════════════════════════════════
const dC = document.getElementById('draw-canvas');
const fC = document.getElementById('fx-canvas');
const sC = document.getElementById('skel-canvas');
const dX = dC.getContext('2d');
const fX = fC.getContext('2d');
const sX = sC.getContext('2d');

function resize(){
  const W = window.innerWidth, H = window.innerHeight;
  [dC,fC,sC].forEach(c=>{c.width=W;c.height=H});
  redraw();
}
window.addEventListener('resize', resize);
resize();

// ════════════════════════════════════════
//  COLORS
// ════════════════════════════════════════
function initPalette(){
  const g = document.getElementById('cgrid');
  PALETTE.forEach((c,i)=>{
    const b = document.createElement('div');
    b.className='cbtn'+(i===0?' sel':'');
    b.style.cssText=`background:${c};box-shadow:0 0 5px ${c}55`;
    b.dataset.c = c;
    b.onclick = ()=>{
      document.querySelectorAll('.cbtn').forEach(x=>x.classList.remove('sel'));
      b.classList.add('sel');
      color = c;
      updBrush();
    };
    g.appendChild(b);
  });
}

function setSize(v){
  size=parseInt(v);
  document.getElementById('szval').textContent=v+'px';
  updBrush();
}
function setGlow(v){
  glow=parseInt(v);
  document.getElementById('gwval').textContent=v+'%';
  updBrush();
}
function setOpacity(v){
  opac=parseInt(v);
  document.getElementById('opval').textContent=v+'%';
  updBrush();
}
function updBrush(){
  const d = document.getElementById('bprev-dot');
  const sz = Math.max(8, Math.min(size*1.5, 32));
  d.style.cssText=`width:${sz}px;height:${sz}px;background:${color};box-shadow:0 0 ${glow*.15}px ${color}`;
  document.getElementById('bprev-info').textContent=`${size}px · ${glow}% glow`;
}

// ════════════════════════════════════════
//  DRAWING
// ════════════════════════════════════════
function startPath(x,y){
  cur={pts:[{x,y}],color,size,glow:glow*.45,opac};
}
function extPath(x,y){
  if(!cur) return;
  const last=cur.pts[cur.pts.length-1];
  if(Math.hypot(x-last.x,y-last.y)>1.5){
    cur.pts.push({x,y});
    drawSeg(cur);
    spawnSpark(x,y,color);
  }
}
function endPath(){
  if(cur&&cur.pts.length>1) paths.push({...cur,pts:[...cur.pts]});
  cur=null;
}

function drawSeg(path){
  const pts=path.pts;
  if(pts.length<2) return;
  dX.save();
  dX.translate(offX, offY);
  dX.globalAlpha = path.opac/100;
  dX.strokeStyle=path.color;
  dX.lineWidth=path.size;
  dX.lineCap='round';
  dX.lineJoin='round';
  dX.shadowColor=path.color;
  dX.shadowBlur=path.glow * 1.5; // Enhanced neon
  dX.beginPath();
  const n=pts.length;
  if(n===2){
    dX.moveTo(pts[0].x,pts[0].y);
    dX.lineTo(pts[1].x,pts[1].y);
  } else {
    const i=n-2;
    const p0=pts[i-1]||pts[i];
    const p1=pts[i];
    const p2=pts[i+1];
    const m1x=(p0.x+p1.x)/2, m1y=(p0.y+p1.y)/2;
    const m2x=(p1.x+p2.x)/2, m2y=(p1.y+p2.y)/2;
    dX.moveTo(m1x,m1y);
    dX.quadraticCurveTo(p1.x,p1.y,m2x,m2y);
  }
  dX.stroke();
  dX.restore();
}

function redraw(){
  dX.clearRect(0,0,dC.width,dC.height);
  dX.save();
  dX.translate(offX, offY);
  for(const p of paths) drawFull(p);
  if(cur) drawFull(cur);
  dX.restore();
}

function drawFull(path){
  const pts=path.pts;
  if(pts.length<2) return;
  dX.save();
  dX.globalAlpha=path.opac/100;
  dX.strokeStyle=path.color;
  dX.lineWidth=path.size;
  dX.lineCap='round';
  dX.lineJoin='round';
  dX.shadowColor=path.color;
  dX.shadowBlur=path.glow * 1.5; // Enhanced neon
  dX.beginPath();
  dX.moveTo(pts[0].x,pts[0].y);
  for(let i=1;i<pts.length-1;i++){
    const mx=(pts[i].x+pts[i+1].x)/2;
    const my=(pts[i].y+pts[i+1].y)/2;
    dX.quadraticCurveTo(pts[i].x,pts[i].y,mx,my);
  }
  dX.lineTo(pts[pts.length-1].x,pts[pts.length-1].y);
  dX.stroke();
  dX.restore();
}

function erase(x,y){
  dX.save();
  dX.translate(offX, offY);
  dX.globalCompositeOperation='destination-out';
  dX.beginPath();
  dX.arc(x - offX, y - offY, ERASE_R, 0, Math.PI*2);
  dX.fillStyle='rgba(0,0,0,1)';
  dX.fill();
  dX.restore();
}

function undo(){
  if(paths.length){paths.pop();redraw();toast('Undone');}
}
function clearAll(){
  paths=[];cur=null;dX.clearRect(0,0,dC.width,dC.height);toast('Canvas cleared');
}
function saveImg(){
  const tmp=document.createElement('canvas');
  tmp.width=dC.width;tmp.height=dC.height;
  const t=tmp.getContext('2d');
  t.save();t.scale(-1,1);t.translate(-tmp.width,0);
  t.drawImage(document.getElementById('webcam'),0,0,tmp.width,tmp.height);
  t.restore();
  t.drawImage(dC,0,0);
  const a=document.createElement('a');
  a.download='aircanvas-'+Date.now()+'.png';
  a.href=tmp.toDataURL('image/png');
  a.click();
  toast('Saved!');
}

// ════════════════════════════════════════
//  SPARKS / FX
// ════════════════════════════════════════
function spawnSpark(x,y,c){
  if(Math.random()>.35) return;
  SPARKS.push({x,y,vx:(Math.random()-.5)*3,vy:(Math.random()-.5)*3,life:1,color:c,r:Math.random()*2+1});
}
function tickSparks(){
  fX.clearRect(0,0,fC.width,fC.height);
  for(let i=SPARKS.length-1;i>=0;i--){
    const s=SPARKS[i];
    s.x+=s.vx;s.y+=s.vy;s.life-=.06;s.vy+=.08;
    if(s.life<=0){SPARKS.splice(i,1);continue;}
    fX.save();
    fX.globalAlpha=s.life*.6;
    fX.fillStyle=s.color;
    fX.shadowColor=s.color;fX.shadowBlur=6;
    fX.beginPath();fX.arc(s.x,s.y,s.r,0,Math.PI*2);fX.fill();
    fX.restore();
  }
}

// ════════════════════════════════════════
//  GESTURE DETECTION
// ════════════════════════════════════════
function fingerUp(lm,tip,pip){
  return lm[tip].y < lm[pip].y - 0.01;
}
function detectGesture(lm){
  const iUp = fingerUp(lm,8,6);
  const mUp = fingerUp(lm,12,10);
  const rUp = fingerUp(lm,16,14);
  const pUp = fingerUp(lm,20,18);
  
  // Move detection (Thumb + Index pinch)
  const dist = Math.hypot(lm[4].x - lm[8].x, lm[4].y - lm[8].y);
  if(dist < 0.05) return 'move';

  if(iUp&&mUp&&rUp&&pUp) return 'erase';
  if(iUp&&mUp&&!rUp&&!pUp) return 'pause';
  if(iUp&&!mUp&&!rUp&&!pUp) return 'draw';
  return 'idle';
}
function bufGesture(g){
  gbuf.push(g);if(gbuf.length>GBUF)gbuf.shift();
}
function stableGesture(){
  if(!gbuf.length) return 'idle';
  const cnt={};
  for(const g of gbuf) cnt[g]=(cnt[g]||0)+1;
  return Object.entries(cnt).sort((a,b)=>b[1]-a[1])[0][0];
}

// ════════════════════════════════════════
//  HAND SKELETON
// ════════════════════════════════════════
const CONN=[[0,1],[1,2],[2,3],[3,4],[0,5],[5,6],[6,7],[7,8],[5,9],[9,10],[10,11],[11,12],[9,13],[13,14],[14,15],[15,16],[13,17],[17,18],[18,19],[19,20],[0,17]];
const TIPS=[4,8,12,16,20];

function drawSkeleton(lm,g){
  sX.clearRect(0,0,sC.width,sC.height);
  const W=sC.width,H=sC.height;
  const m=(l)=>({x:(1-l.x)*W,y:l.y*H});

  // connections
  sX.save();
  sX.strokeStyle='rgba(255,255,255,0.2)';
  sX.lineWidth=1.5;
  for(const[a,b] of CONN){
    const pa=m(lm[a]),pb=m(lm[b]);
    sX.beginPath();sX.moveTo(pa.x,pa.y);sX.lineTo(pb.x,pb.y);sX.stroke();
  }

  // dots
  for(let i=0;i<21;i++){
    const p=m(lm[i]);
    const isTip=TIPS.includes(i);
    const isIndex=i===8;
    sX.beginPath();
    if(isIndex&&g==='draw'){
      sX.arc(p.x,p.y,6,0,Math.PI*2);
      sX.fillStyle=color;
      sX.shadowColor=color;sX.shadowBlur=22;
    } else if(isTip){
      sX.arc(p.x,p.y,4,0,Math.PI*2);
      sX.fillStyle='rgba(255,255,255,0.75)';
      sX.shadowBlur=0;
    } else {
      sX.arc(p.x,p.y,2.5,0,Math.PI*2);
      sX.fillStyle='rgba(255,255,255,0.3)';
      sX.shadowBlur=0;
    }
    sX.fill();
  }

  // eraser circle
  if(g==='erase'){
    const palm=m(lm[9]);
    sX.beginPath();
    sX.arc(palm.x,palm.y,ERASE_R,0,Math.PI*2);
    sX.strokeStyle='rgba(255,107,107,.75)';
    sX.lineWidth=2;
    sX.shadowColor='#ff6b6b';sX.shadowBlur=10;
    sX.stroke();
  }
  sX.restore();
}

// ════════════════════════════════════════
//  GESTURE UI
// ════════════════════════════════════════
const GDATA={
  draw: {e:'☝️',n:'DRAWING',d:'index finger to draw'},
  erase:{e:'🖐️',n:'ERASING',d:'palm sweeps to erase'},
  move: {e:'🤌',n:'MOVING',d:'pinch to pan canvas'},
  pause:{e:'✌️',n:'PAUSED',d:'two fingers · pen lifted'},
  idle: {e:'✊',n:'IDLE',d:'close fist to rest'},
};
function updGestureUI(g){
  const d=GDATA[g]||GDATA.idle;
  document.getElementById('gbar').dataset.g=g;
  document.getElementById('gemoji').textContent=d.e;
  document.getElementById('gname').textContent=d.n;
  document.getElementById('gdesc').textContent=d.d;
}

// ════════════════════════════════════════
//  CURSOR ANIMATION
// ════════════════════════════════════════
const curEl=document.getElementById('cur');
function animCursor(){
  cx+=(tx-cx)*.22;cy+=(ty-cy)*.22;
  curEl.style.left=cx+'px';curEl.style.top=cy+'px';
  requestAnimationFrame(animCursor);
}
animCursor();

// ════════════════════════════════════════
//  MEDIAPIPE RESULTS
// ════════════════════════════════════════
function onResults(res){
  // fps
  fc++;const now=performance.now();
  if(now-ft>1000){fps=Math.round(fc*1000/(now-ft));document.getElementById('fps').textContent=fps+' fps';fc=0;ft=now;}

  tickSparks();

  if(res.multiHandLandmarks&&res.multiHandLandmarks.length){
    const lm=res.multiHandLandmarks[0];
    handOn=true;
    document.getElementById('hdot').classList.remove('off');
    document.getElementById('htxt').textContent='Hand Detected';
    document.getElementById('nohand').style.display='none';

    const raw=detectGesture(lm);
    bufGesture(raw);
    gesture=stableGesture();
    updGestureUI(gesture);

    const W=dC.width,H=dC.height;
    const ix=(1-lm[8].x)*W, iy=lm[8].y*H;
    
    // Pan Logic
    if(gesture === 'move'){
      if(lastX !== 0 && lastY !== 0){
        offX += (ix - lastX);
        offY += (iy - lastY);
        redraw();
      }
      curEl.className='moving';
    }
    lastX = ix; lastY = iy;

    tx=ix;ty=iy;
    curEl.style.display='block';

    if(gesture==='draw'){
      curEl.className='drawing';
      if(!drawing){startPath(ix - offX, iy - offY);drawing=true;}
      else extPath(ix - offX, iy - offY);
    } else {
      if(drawing){endPath();drawing=false;}
      if(gesture !== 'move') curEl.className=gesture==='erase'?'erasing':'';
    }

    if(gesture==='erase'){
      const px=(1-lm[9].x)*W,py=lm[9].y*H;
      erase(px,py);
      tx=px;ty=py;
    }

    drawSkeleton(lm,gesture);

  } else {
    handOn=false;
    document.getElementById('hdot').classList.add('off');
    document.getElementById('htxt').textContent='No Hand';
    if(camOn) document.getElementById('nohand').style.display='block';
    if(drawing){endPath();drawing=false;}
    curEl.style.display='none';
    gbuf=[];gesture='idle';updGestureUI('idle');
    sX.clearRect(0,0,sC.width,sC.height);
  }
}

// ════════════════════════════════════════
//  CAMERA
// ════════════════════════════════════════
async function startCam(){
  const vid=document.getElementById('webcam');
  try{
    mp_cam=new Camera(vid,{
      onFrame:async()=>{if(hands)await hands.send({image:vid});},
      width:1280,height:720
    });
    await mp_cam.start();
    camOn=true;
    document.getElementById('cam-btn').classList.add('on');
    document.getElementById('cdot').classList.remove('off');
    document.getElementById('ctxt').textContent='Camera ON';
  } catch(e){
    alert('Camera access denied. Please allow camera permissions and reload.');
  }
}

async function toggleCam(){
  if(camOn){
    if(mp_cam){mp_cam.stop();mp_cam=null;}
    camOn=false;
    document.getElementById('cam-btn').classList.remove('on');
    document.getElementById('cdot').classList.add('off');
    document.getElementById('ctxt').textContent='Camera OFF';
    document.getElementById('nohand').style.display='none';
    document.getElementById('hdot').classList.add('off');
    document.getElementById('htxt').textContent='No Hand';
    sX.clearRect(0,0,sC.width,sC.height);
    curEl.style.display='none';
    gbuf=[];gesture='idle';updGestureUI('idle');
  } else {
    await startCam();
  }
}

function showHelp(){
  document.getElementById('modal-wrap').classList.remove('gone');
  document.getElementById('go-btn').textContent='Continue Drawing →';
}

async function startApp(){
  document.getElementById('modal-wrap').classList.add('gone');
  if(!camOn) await startCam();
}

// ════════════════════════════════════════
//  INIT
// ════════════════════════════════════════
function setupMediaPipe(){
  hands=new Hands({locateFile:f=>`https://cdn.jsdelivr.net/npm/@mediapipe/hands/${f}`});
  hands.setOptions({
    maxNumHands:1,
    modelComplexity:1,
    minDetectionConfidence:0.75,
    minTrackingConfidence:0.65
  });
  hands.onResults(onResults);
  document.getElementById('loader').classList.add('gone');
}

// TOAST
function toast(msg){
  const t=document.getElementById('toast');
  t.textContent=msg;t.classList.add('show');
  clearTimeout(t._t);t._t=setTimeout(()=>t.classList.remove('show'),2200);
}

// KEYBOARD SHORTCUTS
document.addEventListener('keydown',e=>{
  if((e.ctrlKey||e.metaKey)&&e.key==='z'){e.preventDefault();undo();}
  if((e.ctrlKey||e.metaKey)&&e.key==='s'){e.preventDefault();saveImg();}
  if(e.key==='Delete'||e.key==='Backspace'){clearAll();}
});

initPalette();
updBrush();
window.addEventListener('load',()=>setTimeout(setupMediaPipe,400));
