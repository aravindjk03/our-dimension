/* ══════════════════════════════════════════════════════════════
   OUR DIMENSION — the shell
   boot · identity · world switching · input · the heads-up layer
   ══════════════════════════════════════════════════════════════ */
(function(OD){
"use strict";

const { clamp, lerp, TAU, Q, TIER, COARSE, REDUCED, Snd, Store, Days, CFG, $, $$ } = OD;

/* ── renderer ─────────────────────────────────────────────── */
const canvas = $('#gl');
const renderer = new THREE.WebGLRenderer({
  canvas, antialias: TIER !== 'mobile', alpha:false, powerPreference:'high-performance'
});
renderer.setPixelRatio(Q.dpr);
renderer.setSize(innerWidth, innerHeight, false);
renderer.outputEncoding = THREE.LinearEncoding;   // the composite does the encoding
renderer.toneMapping = THREE.NoToneMapping;       // and the tone mapping
renderer.autoClear = true;

/* GSAP clamps its timeline after any frame longer than 500ms, on the theory
   that a long frame is a lag spike rather than real elapsed time. On a
   backgrounded tab — where rAF is throttled to near zero — that stops every
   animation advancing at all, and a timed sequence never finishes. Turn it
   off: our own loop already clamps dt, so nothing here fears a big delta. */
gsap.ticker.lagSmoothing(0);

const post = OD.Post(renderer);
post.resize(innerWidth, innerHeight);

OD.buildMaterials();

const MOOD = OD.skyMood();
const ENV_WARM = OD.makeEnv(renderer, 'warm');
const ENV_WORLD = OD.makeEnv(renderer, MOOD.env);

/* ── worlds ───────────────────────────────────────────────── */
const worlds = {};
let active = null;
let activeKey = null;

function world(key){
  if(worlds[key]) return worlds[key];
  switch(key){
    case 'hub':      worlds.hub = OD.Hub(renderer, post, ENV_WORLD, MOOD); break;
    case 'letters':  worlds.letters = OD.Letters(renderer, post, ENV_WARM); break;
    case 'campfire': worlds.campfire = OD.Campfire(renderer, post, ENV_WORLD); break;
    case 'tower':    worlds.tower = OD.Tower(renderer, post, ENV_WORLD); break;
    case 'lanterns': worlds.lanterns = OD.Lanterns(renderer, post, ENV_WORLD, MOOD); break;
    case 'cave':     worlds.cave = OD.Cave(renderer, post, ENV_WORLD, MOOD); break;
  }
  return worlds[key];
}

const HUB_KEYS = { hub:1, tree:1 };

/* which action button belongs to which world */
const ACTION = {
  letters:  { icon:'✎', label:'write a letter',  fn:()=>world('letters').compose() },
  tower:    { icon:'✦', label:'add a memory',    fn:()=>world('tower').addMemory() },
  lanterns: { icon:'✷', label:'release a wish',  fn:()=>world('lanterns').compose() },
  campfire: { icon:'✽', label:"today's question", fn:()=>world('campfire').openQuestion() },
  tree:     { icon:'◎', label:'read the rings',  fn:()=>Nav.rings() },
  cave:     { icon:'❋', label:'add to the vault', fn:()=>{
                const c = world('cave');
                if(!c.unlocked){ OD.toast('the door is still shut'); return; }
                c.addItem();
              } },
  hub:      null
};

function setChrome(key){
  const isHub = !!HUB_KEYS[key];
  $('#compass').classList.toggle('on', key !== 'hub');
  $('#counter').classList.toggle('on', key === 'tree');
  $('#stagebar').classList.toggle('on', key === 'tree');
  $('#labels').classList.toggle('off', !isHub);
  $('#dock').classList.add('on');
  $$('#dock .dk').forEach(b=> b.classList.toggle('cur', b.dataset.k === key ||
      (key==='tree' && b.dataset.k==='tree')));

  const a = ACTION[key];
  const btn = $('#action');
  if(a){
    btn.classList.add('on');
    btn.querySelector('.ai').textContent = a.icon;
    btn.querySelector('.al').textContent = a.label;
    btn.onclick = ()=>{ Snd.wake(); a.fn(); };
  } else {
    btn.classList.remove('on');
    btn.onclick = null;
  }
}

/* ── navigation ───────────────────────────────────────────── */
const Nav = OD.Nav = {
  go(key){
    OD.Sheet.close();

    // inside the hub: just fly
    if(HUB_KEYS[key] && activeKey === 'hub-world'){
      world('hub').flyTo(key);
      setChrome(key);
      hubView = key;
      return;
    }
    // coming back to the hub from a sub-world
    if(HUB_KEYS[key]){
      swapTo('hub-world', ()=>{
        world('hub').flyTo(key);
        hubView = key;
        setChrome(key);
      });
      return;
    }
    // hub → a place: fly there first, then step inside
    if(activeKey === 'hub-world'){
      world('hub').flyTo(key);
      setChrome('hub');
      gsap.delayedCall(1.9, ()=> swapTo(key, ()=>setChrome(key)));
    } else {
      swapTo(key, ()=>setChrome(key));
    }
  },

  rings(){
    const d = Days.count();
    const stage = world('hub').Tree.stageOf(d);
    const years = Math.floor(d/365.25);
    const start = Days.start;
    const rows = [{ t:'The first day', s:Days.fmtShort(start) }];
    for(let y=1;y<=years;y++){
      rows.push({ t: y===1 ? 'One year' : y+' years',
                  s: Days.fmtShort(new Date(start.getFullYear()+y, start.getMonth(), start.getDate())) });
    }
    const next = new Date(start.getFullYear()+years+1, start.getMonth(), start.getDate());
    rows.push({ t:(years+1)+' years', s: Math.ceil((next-Date.now())/86400000)+' days away' });

    OD.Sheet.open(`
      <div class="eyebrow">the trunk, in cross-section</div>
      <h2>Every ring is a year</h2>
      ${ringImg(years, d)}
      <ul class="miles">${rows.map(r=>
        `<li><b>${OD.esc(r.t)}</b><span>${OD.esc(r.s)}</span></li>`).join('')}</ul>
      <p class="hand">${OD.esc(world('hub').Tree.name(stage))}.</p>
      <div class="rowbtn"><button class="btn" id="growBtn">watch it grow</button></div>
    `, { wide:true });
    const gb = $('#growBtn');
    if(gb) gb.addEventListener('click', ()=>{ OD.Sheet.close(); timelapse(); });
  }
};

function ringImg(years, days){
  const W=480,H=200;
  const c=document.createElement('canvas'); c.width=W*2; c.height=H*2;
  const g=c.getContext('2d'); g.scale(2,2);
  const grd=g.createLinearGradient(0,0,W,H);
  grd.addColorStop(0,'#2A1B10'); grd.addColorStop(1,'#140E08');
  g.fillStyle=grd; g.fillRect(0,0,W,H);
  const cx=W/2, cy=H/2, n=Math.max(years,1);
  for(let i=n;i>=0;i--){
    const t=(i+1)/(n+1), rx=t*W*.46, ry=t*H*.42;
    g.beginPath();
    for(let a=0;a<=72;a++){
      const th=a/72*TAU;
      const w=1+OD.fbm(Math.cos(th)*2+i, i*.7, Math.sin(th)*2)*.10;
      const x=cx+Math.cos(th)*rx*w, y=cy+Math.sin(th)*ry*w;
      a?g.lineTo(x,y):g.moveTo(x,y);
    }
    g.closePath();
    g.strokeStyle = i===0 ? 'rgba(243,160,184,.9)' : `rgba(201,149,107,${(0.20+0.52*(1-t)).toFixed(3)})`;
    g.lineWidth = i===0 ? 2.2 : 1.1;
    g.stroke();
  }
  g.fillStyle='rgba(255,217,168,.9)';
  g.font='300 12px Jost, sans-serif'; g.textAlign='right';
  g.fillText(days.toLocaleString()+' days', W-14, H-13);
  return `<img class="rings" alt="A cross-section of the trunk, one ring for every year" src="${c.toDataURL()}">`;
}

function timelapse(){
  const hub = world('hub');
  const real = Days.count();
  const o = { d:1 };
  OD.toast('from the first day to this one');
  gsap.to(o, { d: real, duration: 9, ease:'power1.inOut',
    onUpdate(){
      const st = hub.Tree.stageOf(Math.round(o.d));
      hub.Tree.build(st);
      $('#stageName').textContent = hub.Tree.name(st);
      $('#stageEra').textContent  = hub.Tree.era(st);
      $('#cd').textContent = Math.round(o.d).toLocaleString();
    },
    onComplete(){ syncStage(); OD.toast('…and here we are'); }
  });
}

/* ── world swapping ───────────────────────────────────────── */
let hubView = 'tree';
let swapping = false;

function swapTo(key, after){
  if(swapping) return;
  swapping = true;
  post.fadeTo(0x05030A, 1, .55);
  gsap.delayedCall(.58, ()=>{
    if(active && active.exit) active.exit();
    if(key === 'hub-world'){
      active = world('hub'); activeKey = 'hub-world';
    } else {
      active = world(key); activeKey = key;
      if(active.enter) active.enter();
    }
    if(after) after();
    post.fadeTo(0x05030A, 0, .9);
    gsap.delayedCall(.9, ()=>{ swapping = false; });
  });
}

/* ── the tree counter ─────────────────────────────────────── */
let lastSec = -1;
function tickCounter(){
  const p = Days.parts();
  $('#cd').textContent = p.d.toLocaleString();
  $('#ch').textContent = String(p.h).padStart(2,'0');
  $('#cm').textContent = String(p.m).padStart(2,'0');
  $('#cs').textContent = String(p.s).padStart(2,'0');
  if(p.s !== lastSec){
    lastSec = p.s;
    const el = $('#cs');
    gsap.fromTo(el, { opacity:.12, letterSpacing:'.26em' },
                    { opacity:1, letterSpacing:'0em', duration:.55, ease:'power2.out' });
  }
}

function syncStage(){
  const hub = world('hub');
  const st = hub.Tree.stageOf(Days.count());
  hub.Tree.build(st);
  $('#stageName').textContent = hub.Tree.name(st);
  $('#stageEra').textContent = hub.Tree.era(st) + ' · ' + hub.MOOD.name + ' · ' + hub.SEASON;
}

/* ══════════════════════════════════════════════════════════
   INPUT — one set of handlers, routed to whichever world is up
   ══════════════════════════════════════════════════════════ */
let portal = null;

/* On the portal, dragging upward gathers the chocolate the same way the wheel
   does, so the gesture works on a phone with no scrollbar in sight. */
let pDrag = false, pLastY = 0, pMoved = 0;

canvas.addEventListener('pointerdown', e=>{
  Snd.wake();
  if(activeKey === 'portal'){
    portal.onMove(e.clientX, e.clientY);
    pDrag = true; pLastY = e.clientY; pMoved = 0;
    return;
  }
  if(active && active.down) active.down(e.clientX, e.clientY);
});
canvas.addEventListener('pointermove', e=>{
  if(activeKey === 'portal'){
    portal.onMove(e.clientX, e.clientY);
    if(pDrag){
      const dy = e.clientY - pLastY;
      pLastY = e.clientY;
      pMoved += Math.abs(dy);
      portal.scroll(-dy * 3.2);          // pull upward to draw it up
    }
    return;
  }
  if(active && active.move) active.move(e.clientX, e.clientY);
});
window.addEventListener('pointerup', e=>{
  if(activeKey === 'portal'){
    if(pDrag && pMoved < 6) portal.crack();   // a plain tap still nudges it
    pDrag = false;
    return;
  }
  if(active && active.up) active.up(e.clientX, e.clientY);
});
canvas.addEventListener('pointercancel', ()=>{
  if(active && active.up) active.up(-9999,-9999);
});
canvas.addEventListener('wheel', e=>{
  if(activeKey === 'portal'){ e.preventDefault(); portal.scroll(e.deltaY); return; }
  if(active && active.zoom){ e.preventDefault(); active.zoom(e.deltaY); }
}, { passive:false });

/* two thumbs on the tree is a hug */
canvas.addEventListener('touchstart', e=>{
  if(activeKey !== 'hub-world' || e.touches.length !== 2) return;
  const a=e.touches[0], b=e.touches[1];
  world('hub').pulse((a.clientX+b.clientX)/2, (a.clientY+b.clientY)/2);
  OD.toast('felt that');
}, { passive:true });

canvas.addEventListener('dblclick', e=>{
  if(activeKey === 'hub-world' && hubView === 'tree')
    world('hub').pulse(e.clientX, e.clientY);
});

let shakeAt = 0;
window.addEventListener('devicemotion', e=>{
  const a = e.accelerationIncludingGravity; if(!a) return;
  const mag = Math.abs(a.x||0)+Math.abs(a.y||0)+Math.abs(a.z||0);
  if(mag > 34 && Date.now()-shakeAt > 4000){
    shakeAt = Date.now();
    if(activeKey === 'hub-world') world('hub').shakeLeaves();
  }
});

window.addEventListener('resize', ()=>{
  renderer.setSize(innerWidth, innerHeight, false);
  post.resize(innerWidth, innerHeight);
  if(portal){ portal.cam.aspect = innerWidth/innerHeight; portal.cam.updateProjectionMatrix(); }
  Object.keys(worlds).forEach(k=>{ if(worlds[k].resize) worlds[k].resize(); });
});

/* ══════════════════════════════════════════════════════════
   WHO YOU ARE
   The world asks once and then remembers, which means it never asks
   again and there is no way to correct it. So it says so, always, and
   lets you change sides.
   ══════════════════════════════════════════════════════════ */
function paintWho(){
  const chip = $('#who');
  const me = Store.who;
  if(!chip) return;
  if(!me){ chip.classList.remove('on'); return; }
  chip.style.setProperty('--me', me.css);
  chip.querySelector('.wname').textContent = me.pet;
  chip.classList.add('on');
  chip.title = 'You are ' + me.pet + ' — tap to change';
}

function whoSheet(){
  const me = Store.who, them = Store.other;
  if(!me) return;
  OD.Sheet.open(`
    <div class="eyebrow">this device</div>
    <h2>The world thinks you are ${OD.esc(me.pet)}</h2>
    <p class="lead">That is what decides which side of the daily question is
    yours, what colour your wishes rise in, and who the letters are addressed
    to. If it has you wrong, put it right.</p>
    <div class="rowbtn">
      <button class="btn primary" id="switchSide">no — I am ${OD.esc(them.pet)}</button>
    </div>
  `);
  const b = $('#switchSide');
  if(b) b.addEventListener('click', ()=>{
    Store.setSide(Store.side === 'her' ? 'him' : 'her');
    paintWho();
    OD.Sheet.close();
    OD.toast('you are ' + Store.who.pet + ' now', 3200);
  });
}

/* counts on the dock, so it reads as a place with things in it */
function wireCounts(){
  Store.watch('memories', list=>{
    const el = $('#towerBadge');
    if(el){ el.textContent = list.length || ''; el.classList.toggle('on', list.length>0); }
  });
  Store.watch('wishes', list=>{
    const el = $('#wishBadge');
    if(el){ el.textContent = list.length || ''; el.classList.toggle('on', list.length>0); }
  });
  Store.watch('vault', list=>{
    const el = $('#vaultBadge');
    if(el){ el.textContent = list.length || ''; el.classList.toggle('on', list.length>0); }
  });
}

/* ── chrome wiring ────────────────────────────────────────── */
$('#who').addEventListener('click', ()=>{ Snd.wake(); whoSheet(); });
$('#compass').addEventListener('click', ()=>{ Snd.wake(); Nav.go('hub'); });
$('#sound').addEventListener('click', ()=>{
  const on = Snd.toggle();
  const b = $('#sound');
  b.classList.toggle('on', on);
  b.querySelector('.sl').textContent = on ? 'sound on' : 'sound off';
  if(on){
    if(activeKey === 'portal') Snd.bed('workshop', .32);
    else if(activeKey === 'campfire'){ Snd.bed('fire', .30); Snd.bed('wind', .10); }
    else Snd.bed('wind', .20);
  }
});

$$('#dock .dk').forEach(b=>{
  b.addEventListener('click', ()=>{ Snd.wake(); Nav.go(b.dataset.k); });
});

/* ── main loop ────────────────────────────────────────────── */
const portalBar = $('#portalBar');
let last = performance.now();
function frame(now){
  requestAnimationFrame(frame);
  const dt = Math.min((now-last)/1000, .05);
  last = now;

  if(activeKey === 'portal'){
    portal.update(dt);
    if(portalBar) portalBar.style.setProperty('--p', portal.form.toFixed(3));
    post.render(portal.scene, portal.cam, dt);
    return;
  }
  if(!active) return;
  active.update(dt);
  if(activeKey === 'hub-world'){
    world('hub').positionLabels();
    if(hubView === 'tree') tickCounter();
  }
  post.render(active.scene, active.cam, dt);
}

/* ══════════════════════════════════════════════════════════
   THE DOOR
   Claiming to be PAPA is not enough — anyone with the link could.
   So it asks one thing only she would know, and the answer is not
   stored anywhere a stranger could read it off the page.
   ══════════════════════════════════════════════════════════ */
const HER_ANSWERS = ['avi', 'headache'];
const flatten = s => String(s||'').toLowerCase().replace(/[^a-z]/g, '');

function askAtTheDoor(){
  const gate  = $('#gate');
  const who   = $('#gateWho');
  const ask   = $('#gateAsk');
  const miss  = $('#askMiss');
  const input = $('#askInput');

  $('#gateHer').innerHTML = `<b>${OD.esc(CFG.her.pet)}</b><span>${OD.esc(CFG.her.name)}</span>`;
  $('#gateHim').innerHTML = `<b>${OD.esc(CFG.him.pet)}</b><span>${OD.esc(CFG.him.name)}</span>`;
  $('#askTitle').textContent = 'Then one thing only ' + CFG.her.pet + ' would know.';
  $('#askLabel').textContent = 'What do you call ' + CFG.him.name + '?';

  gate.hidden = false;
  requestAnimationFrame(()=>gate.classList.add('in'));

  return new Promise(resolve=>{
    let settled = false;

    function enter(side){
      if(settled) return;
      settled = true;
      Store.pick(side);
      gate.classList.remove('in');
      gsap.delayedCall(.85, ()=>{ gate.hidden = true; resolve(); });
    }
    function showAsk(){
      who.hidden = true;
      ask.hidden = false;
      miss.classList.remove('on');
      input.value = '';
      setTimeout(()=>{ try{ input.focus(); }catch(e){} }, 140);
    }
    function backToWho(){
      ask.hidden = true;
      who.hidden = false;
      miss.classList.remove('on');
    }
    function tryAnswer(){
      const v = flatten(input.value);
      if(HER_ANSWERS.indexOf(v) >= 0){ Snd.chime(528); enter('her'); return; }
      ask.classList.add('wrong');
      miss.textContent = v ? 'that is not what she calls him' : 'say it';
      miss.classList.add('on');
      OD.buzz([40,60,40]);
      setTimeout(()=>ask.classList.remove('wrong'), 460);
      try{ input.select(); }catch(e){}
    }

    $('#gateHim').addEventListener('click', ()=>{ Snd.wake(); enter('him'); });
    $('#gateHer').addEventListener('click', ()=>{ Snd.wake(); showAsk(); });
    $('#askGo').addEventListener('click', ()=>{ Snd.wake(); tryAnswer(); });
    $('#askBack').addEventListener('click', backToWho);
    input.addEventListener('keydown', e=>{
      if(e.key === 'Enter'){ e.preventDefault(); tryAnswer(); }
    });
  });
}

/* ══════════════════════════════════════════════════════════
   BOOT
   ══════════════════════════════════════════════════════════ */
async function start(){
  // the shared store may be slow or absent; never let it hold the door
  let side = null;
  try{
    side = await Promise.race([
      Store.boot().catch(()=>null),
      new Promise(r=>setTimeout(()=>r(null), 3000))
    ]);
  }catch(e){}

  const ld = $('#loading'); if(ld) ld.remove();
  $('#ofLine').textContent = CFG.line;

  /* The door always asks, every time. It is the first thing that happens and
     it is what makes everything past it personal. */
  await askAtTheDoor();

  const who = Store.who;
  $('#portalLine').textContent = COARSE
    ? 'Draw it back together' + (who ? ', ' + who.pet : '')
    : 'Scroll to draw it back together';
  $('#portalHint').textContent = COARSE ? 'drag upward' : 'or drag upward';
  $('#portalSub').textContent = who ? 'made for you, ' + who.pet + ', specifically'
                                    : 'made for you, specifically';

  portal = OD.Portal(renderer, post, ENV_WARM);
  activeKey = 'portal';
  portal.begin();
  post.bloom = .85;
  Snd.bed('workshop', .32);

  portal.done = ()=>{
    // straight into the world, no second fade
    const hub = world('hub');
    active = hub; activeKey = 'hub-world';
    hubView = 'tree';
    syncStage();
    post.uniforms.uExposure.value = 1.08;
    post.uniforms.uAberr.value = .0016;
    post.bloom = .72;
    post.fadeTo(0xFFE9C6, 0, 2.2);
    setChrome('tree');
    paintWho();
    wireCounts();
    document.body.classList.remove('hammer');
    Snd.bed('workshop', 0);
    Snd.bed('wind', .20);
    gsap.delayedCall(.9, ()=>{
      OD.toast(who ? 'welcome to our world, ' + who.pet : 'welcome to our world', 3600);
    });
    gsap.delayedCall(4.6, ()=>{
      OD.toast(COARSE ? 'swipe to look around · tap a place to fly'
                      : 'drag to look around · click a place to fly', 4200);
    });
  };

  requestAnimationFrame(frame);
  gsap.delayedCall(2.2, ()=>{ if(!Snd.enabled) OD.toast('sound makes this much better ↗', 4600); });
}

start();

})(window.OD);
