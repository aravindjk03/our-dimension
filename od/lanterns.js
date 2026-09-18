/* ══════════════════════════════════════════════════════════════
   WISH LANTERNS
   A persistent ceiling of light, shared by every world, plus the
   launch pad where a wish is written, lit and let go.
   ══════════════════════════════════════════════════════════════ */
(function(OD){
"use strict";

const { TAU, clamp, lerp, rnd, Q, TIER, Snd, Store, Days, CFG, $ } = OD;

const ROSE = 0xF3A0B8, GOLD = 0xF6C177;
const MAX_RENDERED = TIER==='mobile' ? 110 : 260;

/* a small paper-lantern silhouette, drawn once */
const LANTERN_TEX = (function(){
  const c = document.createElement('canvas'); c.width=64; c.height=96;
  const g = c.getContext('2d');
  // body
  const grd = g.createLinearGradient(0,10,0,86);
  grd.addColorStop(0,'rgba(255,240,215,.30)');
  grd.addColorStop(.38,'rgba(255,226,175,.95)');
  grd.addColorStop(1,'rgba(255,170,90,.55)');
  g.fillStyle = grd;
  g.beginPath();
  g.moveTo(32,8);
  g.bezierCurveTo(58,18, 58,58, 44,84);
  g.lineTo(20,84);
  g.bezierCurveTo(6,58, 6,18, 32,8);
  g.closePath(); g.fill();
  // ribs
  g.strokeStyle='rgba(180,110,50,.30)'; g.lineWidth=1.4;
  for(let i=1;i<4;i++){
    g.beginPath(); g.moveTo(9+i*3.2, 22+i*4); g.lineTo(55-i*3.2, 22+i*4); g.stroke();
  }
  // the flame inside
  const f = g.createRadialGradient(32,70,0,32,70,16);
  f.addColorStop(0,'rgba(255,255,240,1)'); f.addColorStop(1,'rgba(255,180,90,0)');
  g.fillStyle=f; g.beginPath(); g.arc(32,70,16,0,TAU); g.fill();
  const t = new THREE.CanvasTexture(c);
  t.encoding = THREE.sRGBEncoding;
  return t;
})();

/* ── deterministic sky placement so a wish keeps its spot ──── */
function placeOf(wish, i, opts){
  if(typeof wish.x === 'number') return new THREE.Vector3(wish.x, wish.y, wish.z);
  const r = OD.rng((i+1)*2654435761 ^ (wish.released_at||0));
  const ang = r()*TAU;
  const rad = opts.radius * (0.25 + 0.75*Math.sqrt(r()));
  return new THREE.Vector3(
    Math.cos(ang)*rad,
    opts.high + r()*opts.high*0.85,
    Math.sin(ang)*rad
  );
}

/* ══════════════════════════════════════════════════════════════
   THE SKY — attach to any scene
   ══════════════════════════════════════════════════════════════ */
OD.LanternSky = function(scene, opts){
  opts = Object.assign({ radius:150, high:70 }, opts||{});
  const group = new THREE.Group();
  scene.add(group);

  let wishes = [];
  let sprites = [];
  let cascading = 0;

  function rebuild(){
    sprites.forEach(s=>{ group.remove(s); s.material.dispose(); });
    sprites = [];
    const list = wishes.slice(-MAX_RENDERED);
    list.forEach((w, i)=>{
      const idx = wishes.indexOf(w);
      const landmark = ((idx+1) % 50) === 0;
      const col = w.author === 'her' ? ROSE : GOLD;
      const m = new THREE.SpriteMaterial({
        map: LANTERN_TEX, color: col, transparent:true,
        opacity: landmark ? 1 : .88,
        blending: THREE.AdditiveBlending, depthWrite:false
      });
      const s = new THREE.Sprite(m);
      const base = placeOf(w, idx, opts);
      const size = landmark ? 8.4 : 4.6;
      s.scale.set(size*0.66, size, 1);
      s.position.copy(base);
      s.userData = {
        wish: w, base, landmark,
        ph: (idx*1.618)%TAU,
        sway: rnd(.5,1.4),
        drift: rnd(.12,.34)
      };
      group.add(s);
      sprites.push(s);
    });
  }

  const stop = Store.watch('wishes', list=>{
    list.sort((a,b)=>(a.released_at||0)-(b.released_at||0));
    wishes = list;
    rebuild();
  }, 'released_at', 'asc');

  return {
    group,
    get wishes(){ return wishes; },
    get count(){ return wishes.length; },
    sprites(){ return sprites; },
    update(dt, T){
      const casc = cascading;
      sprites.forEach(s=>{
        const u = s.userData;
        const sway = Math.sin(T*u.drift + u.ph)*u.sway;
        const bob  = Math.cos(T*u.drift*.7 + u.ph*1.3)*u.sway*.7;
        s.position.set(
          u.base.x + sway,
          lerp(u.base.y, 12, casc) + bob,
          u.base.z + Math.cos(T*u.drift*.9 + u.ph)*u.sway
        );
        s.material.opacity = (u.landmark?1:.88) * (0.72 + 0.28*Math.abs(Math.sin(T*.7 + u.ph)));
      });
    },
    /* every lantern comes down at once, then goes back up */
    cascade(onLow){
      const o = { v:0 };
      Snd.chime(396);
      gsap.to(o, { v:1, duration:4.5, ease:'power2.inOut',
        onUpdate(){ cascading = o.v; },
        onComplete(){
          if(onLow) onLow();
          Snd.chime(528);
          gsap.to(o, { v:0, duration:6.0, delay:4.0, ease:'power2.inOut',
            onUpdate(){ cascading = o.v; } });
        }});
    },
    add(wish){
      wishes.push(wish);
      rebuild();
    },
    dispose(){ stop && stop(); }
  };
};

/* ══════════════════════════════════════════════════════════════
   THE LAUNCH PAD
   ══════════════════════════════════════════════════════════════ */
OD.Lanterns = function(renderer, post, env, mood){
  const scene = new THREE.Scene();
  scene.environment = env;
  const cam = new THREE.PerspectiveCamera(48, innerWidth/innerHeight, .3, 1200);
  cam.position.set(0, 7, 20);

  const night = mood.night > .5;
  scene.fog = new THREE.Fog(new THREE.Color(mood.mid).lerp(new THREE.Color(mood.bot),.5), 90, 400);

  /* sky */
  const sky = new THREE.Mesh(
    new THREE.SphereGeometry(500, 40, 26),
    new THREE.ShaderMaterial({
      side:THREE.BackSide, depthWrite:false,
      uniforms:{ uTop:{value:new THREE.Color(mood.top)}, uMid:{value:new THREE.Color(mood.mid)},
        uBot:{value:new THREE.Color(mood.bot)}, uNight:{value:mood.night}, uT:{value:0} },
      vertexShader:`varying vec3 vP; void main(){ vP=normalize(position);
        gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
      fragmentShader:`
        varying vec3 vP; uniform vec3 uTop,uMid,uBot; uniform float uNight,uT;
        float h21(vec2 p){ return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453); }
        void main(){
          float y=clamp(vP.y*.5+.5,0.,1.);
          vec3 c=mix(uBot,uMid,smoothstep(.30,.55,y));
          c=mix(c,uTop,smoothstep(.54,.95,y));
          if(uNight>.02){
            vec2 g=floor(vP.xz*300.+vP.y*110.);
            float st=h21(g);
            c+=vec3(smoothstep(.9975,1.,st)*(.5+.5*sin(uT*1.6+st*40.))*uNight)*1.7;
          }
          gl_FragColor=vec4(c,1.);
        }`
    })
  );
  scene.add(sky);

  scene.add(new THREE.AmbientLight(new THREE.Color(mood.mid), night?.55:.85));
  const key = new THREE.DirectionalLight(mood.sun, night?.4:1.2);
  key.position.set(-40,40,30); scene.add(key);

  /* the platform */
  const pad = new THREE.Mesh(
    new THREE.CylinderGeometry(7.5, 7.9, 1.1, 28),
    new THREE.MeshStandardMaterial({ color:0x8A8272, roughness:.95,
      normalMap:OD.MAT.rockNormal, normalScale:new THREE.Vector2(.7,.7), envMapIntensity:.5 })
  );
  pad.position.y = -1;
  scene.add(pad);

  const rim = new THREE.Mesh(
    new THREE.TorusGeometry(7.6, .18, 8, 40),
    new THREE.MeshStandardMaterial({ color:0xC9956B, roughness:.5, metalness:.3,
      emissive:0x3A2410, envMapIntensity:1.2 })
  );
  rim.rotation.x = Math.PI/2; rim.position.y = -.42; scene.add(rim);

  /* the stand, the candle, the matchbox */
  const stand = new THREE.Mesh(new THREE.CylinderGeometry(.22,.30,2.4,9), OD.MAT.woodDark);
  stand.position.y = .75; scene.add(stand);

  const box = new THREE.Mesh(new THREE.BoxGeometry(1.0,.34,.66), OD.MAT.wood);
  box.position.set(2.2,-.25,1.2); box.rotation.y=.4; scene.add(box);

  /* the lantern on the stand */
  const lantern = new THREE.Group();
  lantern.position.set(0, 2.5, 0);
  scene.add(lantern);

  const paperMat = new THREE.MeshStandardMaterial({
    map: OD.MAT.paperMap, color:0xFFE9C6, roughness:.9, metalness:0,
    transparent:true, opacity:.9, side:THREE.DoubleSide,
    emissive:0x000000, emissiveIntensity:1
  });
  const body = new THREE.Mesh(new THREE.CylinderGeometry(1.0, .82, 1.9, 14, 1, true), paperMat);
  lantern.add(body);
  const capTop = new THREE.Mesh(new THREE.TorusGeometry(1.0,.06,6,18), OD.MAT.woodDark);
  capTop.rotation.x=Math.PI/2; capTop.position.y=.95; lantern.add(capTop);
  const capBot = new THREE.Mesh(new THREE.TorusGeometry(.82,.06,6,18), OD.MAT.woodDark);
  capBot.rotation.x=Math.PI/2; capBot.position.y=-.95; lantern.add(capBot);

  const flame = new THREE.Sprite(new THREE.SpriteMaterial({
    map:OD.GLOW, color:0xFFC070, transparent:true, opacity:0,
    blending:THREE.AdditiveBlending, depthWrite:false }));
  flame.scale.set(1.2,1.8,1); flame.position.y=-.5; lantern.add(flame);
  const flameLight = new THREE.PointLight(0xFFB060, 0, 24, 2);
  flameLight.position.y=-.4; lantern.add(flameLight);

  // the text, painted onto the paper as a shadow from the inside
  const textCanvas = document.createElement('canvas');
  textCanvas.width = 512; textCanvas.height = 256;
  const textTex = new THREE.CanvasTexture(textCanvas);
  textTex.encoding = THREE.sRGBEncoding;

  function paintText(str){
    const g = textCanvas.getContext('2d');
    g.clearRect(0,0,512,256);
    g.fillStyle = 'rgba(255,233,198,1)';
    g.fillRect(0,0,512,256);
    g.fillStyle = 'rgba(96,52,20,.72)';
    g.font = '30px Caveat, cursive';
    g.textAlign = 'center';
    const words = String(str||'').split(/\s+/);
    const lines = [];
    let line = '';
    words.forEach(w=>{
      const t = line ? line+' '+w : w;
      if(g.measureText(t).width > 430){ lines.push(line); line = w; }
      else line = t;
    });
    if(line) lines.push(line);
    const shown = lines.slice(0,5);
    shown.forEach((l,i)=> g.fillText(l, 256, 100 + i*34 - (shown.length-1)*17));
    textTex.needsUpdate = true;
    paperMat.map = textTex;
    paperMat.needsUpdate = true;
  }

  const sky2 = OD.LanternSky(scene, { radius:140, high:56 });

  /* ── state ── */
  let T = 0, lit = false, released = false, draft = '';
  let inFlight = null;
  let orbit = { th:.2, ph:1.18, d:22, wth:.2, wph:1.18, wd:22, tgt:new THREE.Vector3(0,3,0) };

  function apply(){
    const s=Math.sin(orbit.ph), c=Math.cos(orbit.ph);
    cam.position.set(
      orbit.tgt.x + orbit.d*s*Math.sin(orbit.th),
      orbit.tgt.y + orbit.d*c,
      orbit.tgt.z + orbit.d*s*Math.cos(orbit.th)
    );
    cam.lookAt(orbit.tgt);
  }
  apply();

  /* ── the composer ── */
  function compose(){
    if(released) reset();
    const who = Store.who;
    const colour = who && Store.side==='her' ? 'rose' : 'gold';
    OD.Sheet.open(`
      <div class="eyebrow">a wish · ${OD.esc(who?who.pet:'you')}</div>
      <h2>What do you want?</h2>
      <p class="lead">Two hundred characters, then a match. It goes up and it stays up —
      you will both be able to see it from anywhere in this world, for as long as this world exists.</p>
      <label class="fl">
        <textarea id="wishText" maxlength="200" rows="4" autofocus
          placeholder="I wish…"></textarea>
        <span class="count"><span id="wishCount">0</span>/200</span>
      </label>
      <div class="rowbtn">
        <button class="btn primary ${colour}" id="lightBtn" disabled>strike the match</button>
      </div>
    `);
    const ta = $('#wishText'), cnt = $('#wishCount'), btn = $('#lightBtn');
    ta.addEventListener('input', ()=>{
      cnt.textContent = ta.value.length;
      btn.disabled = ta.value.trim().length < 2;
      draft = ta.value;
      paintText(ta.value);
    });
    btn.addEventListener('click', ()=>{
      draft = ta.value.trim();
      OD.Sheet.close();
      light();
    });
  }

  function light(){
    if(lit) return;
    lit = true;
    paintText(draft);
    Snd.match();
    gsap.fromTo(flame.material, { opacity:0 }, { opacity:1, duration:.5, ease:'power2.out' });
    gsap.to(flameLight, { intensity:3.4, duration:.7 });
    gsap.to(paperMat, { emissiveIntensity:1, duration:.1 });
    paperMat.emissive.setHex(0x4A2A0E);
    gsap.fromTo(lantern.scale, { x:.86, y:.7, z:.86 }, { x:1, y:1, z:1, duration:1.1, ease:'elastic.out(1,.6)' });
    OD.buzz(24);
    OD.toast(OD.COARSE ? 'swipe up to let it go' : 'press Release, or swipe up');
  }

  async function release(){
    if(!lit || released) return;
    released = true;
    Snd.whoosh();
    OD.buzz([10,40,10]);

    const w = {
      text: draft.slice(0,200),
      author: Store.side || 'him',
      released_at: Date.now()
    };
    const dest = placeOf({ released_at:w.released_at }, sky2.count, { radius:140, high:56 });
    w.x = dest.x; w.y = dest.y; w.z = dest.z;

    inFlight = { t:0, from: lantern.position.clone(), to: dest };

    const id = Store.newId();
    await Store.put('wishes', id, w);
    w.id = id;

    gsap.delayedCall(6.5, ()=>{
      lantern.visible = false;
      OD.toast('it is up there now');
      reset();
    });
  }

  function reset(){
    inFlight = null;
    released = false; lit = false; draft='';
    lantern.visible = true;
    lantern.position.set(0,2.5,0);
    lantern.scale.setScalar(1);
    lantern.rotation.set(0,0,0);
    flame.material.opacity = 0;
    flameLight.intensity = 0;
    paperMat.emissive.setHex(0x000000);
    paperMat.map = OD.MAT.paperMap;
    paperMat.needsUpdate = true;
  }

  function readWish(w){
    const who = w.author==='her' ? CFG.her : CFG.him;
    OD.Sheet.open(`
      <div class="eyebrow">${OD.esc(who.pet)} · ${OD.esc(Days.fmt(w.released_at))}</div>
      <blockquote class="wishq ${w.author==='her'?'rose':'gold'}">${OD.esc(w.text)}</blockquote>
    `, { bare:false });
  }

  /* ── input ── */
  const ray = new THREE.Raycaster(), pt = new THREE.Vector2();
  let dragging=false, lx=0, ly=0, moved=0, sy=0;

  function down(x,y){ dragging=true; lx=x; ly=y; sy=y; moved=0; }
  function move(x,y){
    if(!dragging) return;
    const dx=x-lx, dy=y-ly; lx=x; ly=y; moved+=Math.abs(dx)+Math.abs(dy);
    orbit.wth -= dx*.005;
    orbit.wph = clamp(orbit.wph - dy*.004, .25, 1.55);
  }
  function up(x,y){
    dragging=false;
    // a firm upward swipe releases
    if(lit && !released && (sy - y) > 90 && Math.abs(moved) > 90){ release(); return; }
    if(moved > 9) return;
    pt.set((x/innerWidth)*2-1, -(y/innerHeight)*2+1);
    ray.setFromCamera(pt, cam);
    if(!released && ray.intersectObjects(lantern.children, true).length){
      lit ? release() : compose();
      return;
    }
    const hit = ray.intersectObjects(sky2.sprites(), false);
    if(hit.length) readWish(hit[0].object.userData.wish);
  }
  function zoom(d){ orbit.wd = clamp(orbit.wd + d*.03, 10, 90); }

  function update(dt){
    T += dt;
    sky.material.uniforms.uT.value = T;
    sky2.update(dt, T);

    if(!lit && !released){
      lantern.position.y = 2.5 + Math.sin(T*1.2)*.07;
      lantern.rotation.y += dt*.22;
    }
    if(lit && !released){
      flame.scale.set(1.1 + Math.sin(T*11)*.12, 1.7 + Math.sin(T*9)*.18, 1);
      flameLight.intensity = 3.0 + Math.sin(T*13)*.7;
      lantern.rotation.z = Math.sin(T*1.5)*.03;
    }
    if(inFlight){
      inFlight.t += dt;
      const k = clamp(inFlight.t/6.2, 0, 1);
      const e = k*k*(3-2*k);
      const wob = Math.sin(inFlight.t*1.3)*1.6*(1-e*.5);
      lantern.position.lerpVectors(inFlight.from, inFlight.to, e);
      lantern.position.x += wob;
      lantern.position.z += Math.cos(inFlight.t*1.1)*1.4;
      lantern.rotation.z = Math.sin(inFlight.t*1.6)*.12;
      const sc = lerp(1, .35, e);
      lantern.scale.setScalar(sc);
      flameLight.intensity = lerp(3.2, .4, e);
    }

    orbit.th = lerp(orbit.th, orbit.wth, dt*3);
    orbit.ph = lerp(orbit.ph, orbit.wph, dt*3);
    orbit.d  = lerp(orbit.d,  orbit.wd,  dt*3);
    if(!dragging && !inFlight) orbit.wth += dt*.02;
    apply();
    sky.position.copy(cam.position);
  }

  function enter(){
    Snd.bed('wind', .26);
    reset();
    const occ = Days.occasion();
    OD.toast(sky2.count
      ? sky2.count + (sky2.count===1 ? ' wish up there' : ' wishes up there') + ' · tap the lantern to add one'
      : 'tap the lantern to write the first one');
    if(occ && occ.kind==='anniversary'){
      gsap.delayedCall(2.5, ()=>{
        OD.toast('every wish is coming down to say something');
        sky2.cascade(()=>OD.toast('…' + occ.label));
      });
    }
  }
  function exit(){ Snd.bed('wind', 0); }
  function resize(){ cam.aspect = innerWidth/innerHeight; cam.updateProjectionMatrix(); }

  return {
    scene, cam, update, enter, exit, resize,
    down, move, up, zoom,
    release, compose,
    cascade: ()=>sky2.cascade(),
    get count(){ return sky2.count; }
  };
};

})(window.OD);
