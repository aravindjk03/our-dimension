/* ══════════════════════════════════════════════════════════════
   THE ENCHANTED TREEHOUSE — letters
   Envelopes on threads · wax seals · ink that writes itself
   ══════════════════════════════════════════════════════════════ */
(function(OD){
"use strict";

const { TAU, clamp, lerp, rnd, TIER, Snd, Store, Days, CFG, $ } = OD;

const EMOTION = OD.EMOTION = {
  love:      { seal:0xC9455A, css:'#C9455A', word:'love',      wash:'#8E2436' },
  longing:   { seal:0x5A7FC9, css:'#5A7FC9', word:'longing',   wash:'#2F4A85' },
  gratitude: { seal:0xD9A441, css:'#D9A441', word:'gratitude', wash:'#9A6A18' },
  growth:    { seal:0x4E9E5A, css:'#4E9E5A', word:'growth',    wash:'#245C31' },
  dreams:    { seal:0x8A5AC9, css:'#8A5AC9', word:'dreams',    wash:'#4C2C85' }
};

OD.Letters = function(renderer, post, env){
  const scene = new THREE.Scene();
  scene.environment = env;
  scene.background = new THREE.Color(0x140C06);
  scene.fog = new THREE.Fog(0x140C06, 14, 46);

  const cam = new THREE.PerspectiveCamera(47, innerWidth/innerHeight, .1, 120);

  /* ── the room ─────────────────────────────────────────────── */
  const room = new THREE.Group(); scene.add(room);

  const wallMat = OD.MAT.wood.clone();
  wallMat.side = THREE.BackSide;
  wallMat.roughness = .86;
  const shell = new THREE.Mesh(new THREE.CylinderGeometry(11, 12.4, 15, 16, 1, true), wallMat);
  shell.position.y = 3; room.add(shell);

  const floor = new THREE.Mesh(new THREE.CircleGeometry(12.2, 24), OD.MAT.woodDark);
  floor.rotation.x = -Math.PI/2; floor.position.y = -4.5; room.add(floor);

  const ceil = new THREE.Mesh(new THREE.ConeGeometry(12.6, 6, 16, 1, true),
    (function(){ const m = OD.MAT.woodDark.clone(); m.side = THREE.BackSide; return m; })());
  ceil.position.y = 13.5; room.add(ceil);

  /* the round window, with night outside */
  const winGlow = new THREE.Mesh(new THREE.CircleGeometry(2.4, 32),
    new THREE.MeshBasicMaterial({ color:0x2E4A78 }));
  winGlow.position.set(0, 3.2, -10.85); room.add(winGlow);
  const winFrame = new THREE.Mesh(new THREE.TorusGeometry(2.5, .22, 8, 32), OD.MAT.woodDark);
  winFrame.position.copy(winGlow.position); room.add(winFrame);
  const moon = new THREE.Sprite(new THREE.SpriteMaterial({
    map:OD.GLOW, color:0xBFD4FF, transparent:true, opacity:.75,
    blending:THREE.AdditiveBlending, depthWrite:false }));
  moon.scale.setScalar(2.2); moon.position.set(-.9, 4.0, -10.7); room.add(moon);

  /* the writing desk */
  const desk = new THREE.Group(); desk.position.set(0, -4.5, -6.4); room.add(desk);
  const top = new THREE.Mesh(new THREE.BoxGeometry(5.2, .28, 2.6), OD.MAT.wood);
  top.position.y = 2.4; desk.add(top);
  [[-2.3,-1.0],[2.3,-1.0],[-2.3,1.0],[2.3,1.0]].forEach(p=>{
    const l = new THREE.Mesh(new THREE.CylinderGeometry(.12,.15,2.4,7), OD.MAT.woodDark);
    l.position.set(p[0],1.2,p[1]); desk.add(l);
  });
  const inkwell = new THREE.Mesh(new THREE.CylinderGeometry(.34,.40,.46,14),
    new THREE.MeshPhysicalMaterial({ color:0x14121C, roughness:.14, clearcoat:1, envMap:env, envMapIntensity:1.4 }));
  inkwell.position.set(-1.5, 2.72, 0); desk.add(inkwell);
  const quill = new THREE.Mesh(new THREE.ConeGeometry(.10, 2.3, 7),
    new THREE.MeshStandardMaterial({ color:0xF0E2CA, roughness:.8 }));
  quill.position.set(-1.35, 3.7, .12); quill.rotation.z = .42; quill.rotation.x = -.18;
  desk.add(quill);
  desk.userData.quill = quill;

  const deskGlow = new THREE.PointLight(0xFFB470, 2.0, 12, 2);
  deskGlow.position.set(0, 3.6, 0); desk.add(deskGlow);

  /* ── lighting ─────────────────────────────────────────────── */
  scene.add(new THREE.AmbientLight(0x3A2412, 1.5));
  const hearth = new THREE.PointLight(0xFFA855, 3.0, 30, 2);
  hearth.position.set(0, 2, 2); scene.add(hearth);
  const cool = new THREE.DirectionalLight(0x6E86C0, .35);
  cool.position.set(0, 4, -10); scene.add(cool);

  /* fairy lights strung round the ceiling */
  const fairies = [];
  for(let i=0;i<(TIER==='mobile'?18:34);i++){
    const s = new THREE.Sprite(new THREE.SpriteMaterial({
      map:OD.GLOW, color: i%5===0 ? 0xFFD9A8 : 0xFFC070, transparent:true,
      opacity:.9, blending:THREE.AdditiveBlending, depthWrite:false }));
    const a = i/(TIER==='mobile'?18:34)*TAU*2;
    const r = 9.4 - (i%3)*.5;
    s.position.set(Math.cos(a)*r, 7.5 + Math.sin(a*3)*1.2 - (i%2)*.6, Math.sin(a)*r);
    s.scale.setScalar(.7);
    s.userData = { ph: Math.random()*TAU };
    fairies.push(s); room.add(s);
  }

  /* dust in the lamplight */
  (function motes(){
    const n = TIER==='mobile'?70:160;
    const p = new Float32Array(n*3), sd = new Float32Array(n);
    for(let i=0;i<n;i++){
      p[i*3]=rnd(-9,9); p[i*3+1]=rnd(-4,10); p[i*3+2]=rnd(-9,9); sd[i]=Math.random()*100;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(p,3));
    g.setAttribute('aSeed', new THREE.BufferAttribute(sd,1));
    const m = new THREE.ShaderMaterial({
      transparent:true, depthWrite:false, blending:THREE.AdditiveBlending,
      uniforms:{ uT:{value:0}, uMap:{value:OD.SPRITE}, uPR:{value:renderer.getPixelRatio()} },
      vertexShader:`attribute float aSeed; uniform float uT,uPR; varying float vA;
        void main(){ vec3 p=position;
          p.y += sin(uT*.16+aSeed)*.9; p.x += cos(uT*.12+aSeed*1.4)*.7;
          vA = .25+.55*abs(sin(uT*.5+aSeed*2.));
          vec4 mv=modelViewMatrix*vec4(p,1.);
          gl_PointSize=2.0*uPR*(150./-mv.z); gl_Position=projectionMatrix*mv; }`,
      fragmentShader:`uniform sampler2D uMap; varying float vA;
        void main(){ vec4 t=texture2D(uMap,gl_PointCoord);
          gl_FragColor=vec4(1.,.84,.6,t.a*vA*.6); if(gl_FragColor.a<.01) discard; }`
    });
    const pts = new THREE.Points(g,m); room.add(pts);
    room.userData.motes = m;
  })();

  /* ── envelopes ────────────────────────────────────────────── */
  const envGroup = new THREE.Group(); scene.add(envGroup);
  let letters = [], nodes = [];
  let focused = null;

  const chainMat = new THREE.MeshStandardMaterial({ color:0x8A8A94, roughness:.42, metalness:.85, envMap:env, envMapIntensity:1.3 });

  function isLocked(l){
    return !!(l.unlock_date && new Date(l.unlock_date).getTime() > Date.now());
  }

  function makeEnvelope(l, i, total){
    const g = new THREE.Group();
    const em = EMOTION[l.emotion] || EMOTION.love;

    // thread
    const threadH = 3.2 + (i%4)*1.1;
    const thread = new THREE.Mesh(
      new THREE.CylinderGeometry(.012,.012,threadH,4),
      new THREE.MeshBasicMaterial({ color:0xD9B87A, transparent:true, opacity:.5 }));
    thread.position.y = threadH/2;
    g.add(thread);

    // the envelope body
    const paper = new THREE.Mesh(new THREE.BoxGeometry(1.9, 1.25, .07), OD.MAT.paper);
    g.add(paper);
    // flap
    const flap = new THREE.Mesh(new THREE.BoxGeometry(1.9, .62, .05), OD.MAT.paper);
    flap.position.set(0, .30, .05);
    flap.rotation.x = -.06;
    g.add(flap);
    g.userData.flap = flap;

    if(isLocked(l)){
      const ring1 = new THREE.Mesh(new THREE.TorusGeometry(.20,.045,6,14), chainMat);
      ring1.position.set(0,.06,.10); g.add(ring1);
      const lock = new THREE.Mesh(new THREE.BoxGeometry(.28,.32,.12), chainMat);
      lock.position.set(0,-.20,.12); g.add(lock);
      for(let c=-2;c<=2;c++){
        if(!c) continue;
        const link = new THREE.Mesh(new THREE.TorusGeometry(.10,.028,5,10), chainMat);
        link.position.set(c*.22, .24, .11);
        link.rotation.y = c%2 ? Math.PI/2 : 0;
        g.add(link);
      }
      g.userData.chains = true;
    } else {
      const seal = new THREE.Mesh(new THREE.CylinderGeometry(.24,.26,.07,16),
        new THREE.MeshPhysicalMaterial({ color:em.seal, roughness:.34, clearcoat:.7,
          envMap:env, envMapIntensity:1.1 }));
      seal.rotation.x = Math.PI/2;
      seal.position.set(0,-.02,.11);
      g.add(seal);
      g.userData.seal = seal;
      const glow = new THREE.Sprite(new THREE.SpriteMaterial({
        map:OD.GLOW, color:em.seal, transparent:true, opacity:l.read?.18:.45,
        blending:THREE.AdditiveBlending, depthWrite:false }));
      glow.scale.setScalar(1.5); glow.position.set(0,-.02,.16);
      g.add(glow);
      g.userData.glow = glow;
    }

    // hang them in a loose double ring
    const a = (i/Math.max(total,1))*TAU + (i%2 ? .18 : 0);
    const r = 5.2 + (i%3)*1.5;
    g.position.set(Math.cos(a)*r, 2.4 - (i%4)*1.1, Math.sin(a)*r);
    g.rotation.y = -a + Math.PI/2;
    g.userData.home = g.position.clone();
    g.userData.homeRot = g.rotation.clone();
    g.userData.letter = l;
    g.userData.ph = Math.random()*TAU;
    g.userData.locked = isLocked(l);
    return g;
  }

  function rebuild(){
    nodes.forEach(n=>envGroup.remove(n));
    nodes = [];
    letters.forEach((l,i)=>{
      const n = makeEnvelope(l, i, letters.length);
      nodes.push(n); envGroup.add(n);
    });
    refreshCount();
  }

  function refreshCount(){
    const unread = letters.filter(l=>!l.read && !isLocked(l)).length;
    const el = $('#lettersBadge');
    if(el){ el.textContent = unread ? unread : ''; el.classList.toggle('on', unread>0); }
  }

  const stopWatch = Store.watch('letters', list=>{
    list.sort((a,b)=>(a.created||0)-(b.created||0));
    letters = list;
    rebuild();
  }, 'created', 'asc');

  /* ══════════════════════════════════════════════════════════
     READING — the letter itself lives in HTML so the words are
     always legible, over a watercolour wash in its own colour.
     ══════════════════════════════════════════════════════════ */
  function washCanvas(hex){
    const c = document.createElement('canvas');
    c.width = c.height = 256;
    const g = c.getContext('2d');
    g.fillStyle = '#00000000'; g.clearRect(0,0,256,256);
    const col = hex.replace('#','');
    const r = parseInt(col.slice(0,2),16), gg = parseInt(col.slice(2,4),16), b = parseInt(col.slice(4,6),16);
    for(let i=0;i<26;i++){
      const x = Math.random()*256, y = Math.random()*256, rad = rnd(30,110);
      const grd = g.createRadialGradient(x,y,0,x,y,rad);
      const a = rnd(.03,.10);
      grd.addColorStop(0, `rgba(${r},${gg},${b},${a})`);
      grd.addColorStop(1, `rgba(${r},${gg},${b},0)`);
      g.fillStyle = grd;
      g.beginPath(); g.arc(x,y,rad,0,TAU); g.fill();
    }
    return c.toDataURL();
  }

  let writing = null;

  function readLetter(l){
    const em = EMOTION[l.emotion] || EMOTION.love;
    const wash = washCanvas(em.wash);
    const body = String(l.body||'');

    OD.Sheet.open(`
      <article class="letter" style="--seal:${em.css}">
        <div class="letter-wash" style="background-image:url('${wash}')"></div>
        <div class="letter-inner">
          <div class="letter-meta">
            <span class="dot" style="background:${em.css}"></span>
            <span>${OD.esc(em.word)}</span>
            <span class="sep">·</span>
            <span>${OD.esc(Days.fmt(l.created))}</span>
          </div>
          <h2 class="letter-title">${OD.esc(l.title||'Untitled')}</h2>
          <div class="letter-body" id="letterBody"></div>
          <div class="letter-sign">— ${OD.esc(l.from==='her'?CFG.her.pet:CFG.him.pet)}</div>
          <div class="rowbtn">
            <button class="btn" id="sealBtn">seal it back up</button>
          </div>
        </div>
      </article>
    `, { wide:true, onClose:()=>{ if(writing){ writing.kill(); writing=null; } } });

    const target = $('#letterBody');
    const paras = body.split(/\n{2,}/).filter(s=>s.trim());
    target.innerHTML = paras.map(p=>'<p></p>').join('');
    const pEls = Array.prototype.slice.call(target.querySelectorAll('p'));

    // the ink writes itself, with a nib you can hurry along
    let ci = 0, pi = 0;
    const speed = OD.REDUCED ? 0 : 20;
    const cursor = document.createElement('span');
    cursor.className = 'nib';

    function finish(){
      if(writing){ writing.kill(); writing = null; }
      pEls.forEach((el,i)=>{ el.textContent = paras[i]; });
      if(cursor.parentNode) cursor.parentNode.removeChild(cursor);
      target.classList.add('done');
    }

    if(speed === 0){ finish(); }
    else {
      pEls[0].appendChild(cursor);
      writing = gsap.to({}, {
        duration: 0.001, repeat: -1, repeatDelay: speed/1000,
        onRepeat(){
          if(pi >= paras.length){ finish(); return; }
          const txt = paras[pi];
          const step = 1 + (Math.random()<.22 ? 1 : 0);
          ci = Math.min(txt.length, ci + step);
          pEls[pi].textContent = txt.slice(0, ci);
          pEls[pi].appendChild(cursor);
          if(ci % 3 === 0) Snd.ink();
          if(ci >= txt.length){ pi++; ci = 0; if(pi < paras.length) pEls[pi].appendChild(cursor); }
        }
      });
    }

    target.addEventListener('click', finish, { once:true });
    $('#sealBtn').addEventListener('click', ()=>{ OD.Sheet.close(); unfocus(); });

    if(!l.read) Store.patch('letters', l.id, Object.assign({}, l, { read:true }));
  }

  /* ── focus / open an envelope ─────────────────────────────── */
  function focus(node){
    if(focused) return;
    focused = node;
    const l = node.userData.letter;
    Snd.snap();

    envGroup.children.forEach(n=>{
      if(n === node) return;
      gsap.to(n.scale, { x:.6, y:.6, z:.6, duration:.7, ease:'power2.out' });
      n.children.forEach(ch=>{
        if(ch.material && 'opacity' in ch.material){
          ch.material.transparent = true;
          gsap.to(ch.material, { opacity: .18, duration:.7 });
        }
      });
    });

    const front = new THREE.Vector3();
    cam.getWorldDirection(front);
    const dest = cam.position.clone().addScaledVector(front, 4.6);

    gsap.to(node.position, { x:dest.x, y:dest.y, z:dest.z, duration:.8, ease:'power3.out' });
    gsap.to(node.rotation, { x:0, y:Math.atan2(cam.position.x-dest.x, cam.position.z-dest.z), z:0,
      duration:.8, ease:'power3.out' });
    gsap.to(node.scale, { x:1.55, y:1.55, z:1.55, duration:.8, ease:'power3.out' });

    if(node.userData.locked){
      const when = Days.fmt(l.unlock_date);
      const days = Math.ceil((new Date(l.unlock_date).getTime() - Date.now())/86400000);
      gsap.delayedCall(.85, ()=>{
        OD.Sheet.open(`
          <div class="eyebrow">chained shut</div>
          <h2>${OD.esc(l.title||'A letter')}</h2>
          <p class="lead">This one opens on <b>${OD.esc(when)}</b>.</p>
          <p class="counting">${days} ${days===1?'day':'days'} to go.</p>
        `, { onClose: unfocus });
      });
      return;
    }
    gsap.delayedCall(.85, ()=>OD.toast('tap the seal'));
  }

  function breakSeal(node){
    const l = node.userData.letter;
    const seal = node.userData.seal;
    if(!seal || node.userData.opened) return;
    node.userData.opened = true;
    Snd.seal();
    OD.buzz([12,20,30]);

    // the wax cracks, softens and lets go
    gsap.to(seal.scale, { x:1.35, y:.3, z:1.35, duration:.5, ease:'power2.in' });
    gsap.to(seal.material, { opacity:0, duration:.5, onStart(){ seal.material.transparent = true; } });
    if(node.userData.glow) gsap.to(node.userData.glow.material, { opacity:0, duration:.4 });

    // the flap swings open
    gsap.to(node.userData.flap.rotation, { x:-2.5, duration:.85, delay:.28, ease:'power2.inOut' });
    gsap.delayedCall(.5, ()=>Snd.paper());

    gsap.delayedCall(1.15, ()=>readLetter(l));
  }

  function unfocus(){
    if(!focused) return;
    const node = focused; focused = null;
    node.userData.opened = false;
    const seal = node.userData.seal;
    if(seal){
      gsap.to(seal.scale, { x:1,y:1,z:1, duration:.5 });
      gsap.to(seal.material, { opacity:1, duration:.5 });
    }
    if(node.userData.glow) gsap.to(node.userData.glow.material, { opacity:.18, duration:.5 });
    gsap.to(node.userData.flap.rotation, { x:-.06, duration:.5 });
    gsap.to(node.position, { x:node.userData.home.x, y:node.userData.home.y, z:node.userData.home.z,
      duration:.9, ease:'power2.inOut' });
    gsap.to(node.rotation, { x:node.userData.homeRot.x, y:node.userData.homeRot.y, z:node.userData.homeRot.z,
      duration:.9, ease:'power2.inOut' });
    gsap.to(node.scale, { x:1,y:1,z:1, duration:.9, ease:'power2.inOut' });
    envGroup.children.forEach(n=>{
      if(n===node) return;
      gsap.to(n.scale, { x:1,y:1,z:1, duration:.7 });
      n.children.forEach(ch=>{
        if(ch.material && 'opacity' in ch.material){
          const base = ch === n.userData.glow ? (n.userData.letter.read?.18:.45)
                     : (ch.geometry && ch.geometry.type==='CylinderGeometry' && ch.material.color && ch.material.color.getHex()===0xD9B87A ? .5 : 1);
          gsap.to(ch.material, { opacity: base, duration:.7 });
        }
      });
    });
    refreshCount();
  }

  /* ── writing a new one ────────────────────────────────────── */
  function compose(){
    if(!Store.writable && !Store.db){
      /* still allowed — it just stays on this device */
    }
    const me = Store.side || 'him';
    const opts = Object.keys(EMOTION).map(k=>
      `<button type="button" class="emo" data-e="${k}" style="--c:${EMOTION[k].css}">
         <span class="wax"></span>${EMOTION[k].word}</button>`).join('');
    OD.Sheet.open(`
      <div class="eyebrow">a new letter · from ${OD.esc(me==='her'?CFG.her.pet:CFG.him.pet)}</div>
      <h2>Write it down</h2>
      <label class="fl"><input id="ltTitle" type="text" maxlength="60" autofocus
        placeholder="What do you want to call it?"></label>
      <label class="fl"><textarea id="ltBody" rows="9"
        placeholder="Leave a blank line between paragraphs. The ink will write itself when it is read."></textarea></label>
      <div class="fieldlabel">seal it with</div>
      <div class="emos">${opts}</div>
      <div class="fieldlabel">chain it shut until (optional)</div>
      <label class="fl"><input id="ltDate" type="date"></label>
      <div class="rowbtn">
        <button class="btn primary" id="ltSave">seal the envelope</button>
      </div>
    `, { wide:true });

    let emotion = 'love';
    const emos = OD.$$('.emo');
    emos.forEach(b=>{
      if(b.dataset.e === emotion) b.classList.add('on');
      b.addEventListener('click', ()=>{
        emos.forEach(x=>x.classList.remove('on'));
        b.classList.add('on'); emotion = b.dataset.e; Snd.carve();
      });
    });

    $('#ltSave').addEventListener('click', async ()=>{
      const title = $('#ltTitle').value.trim();
      const bodyTxt = $('#ltBody').value.trim();
      if(!bodyTxt){ OD.toast('it needs something in it'); return; }
      const when = $('#ltDate').value;
      const rec = {
        title: title || 'Untitled',
        body: bodyTxt,
        emotion,
        from: me,
        created: Date.now(),
        unlock_date: when ? new Date(when + 'T00:00:00').getTime() : null,
        read: false
      };
      await Store.put('letters', Store.newId(), rec);
      Snd.seal();
      OD.Sheet.close();
      OD.toast(rec.unlock_date ? 'sealed and chained' : 'sealed, and hanging up there');
    });
  }

  /* ── camera / input ───────────────────────────────────────── */
  const orbit = { th:0, ph:1.30, d:13.5, wth:0, wph:1.30, wd:13.5, tgt:new THREE.Vector3(0,1.6,0) };
  function apply(){
    const s=Math.sin(orbit.ph), c=Math.cos(orbit.ph);
    cam.position.set(
      orbit.tgt.x + orbit.d*s*Math.sin(orbit.th),
      orbit.tgt.y + orbit.d*c,
      orbit.tgt.z + orbit.d*s*Math.cos(orbit.th));
    cam.lookAt(orbit.tgt);
  }
  apply();

  const ray = new THREE.Raycaster(), pt = new THREE.Vector2();
  let dragging=false, lx=0, ly=0, moved=0, T=0;

  function down(x,y){ dragging=true; lx=x; ly=y; moved=0; }
  function move(x,y){
    if(!dragging) return;
    const dx=x-lx, dy=y-ly; lx=x; ly=y; moved+=Math.abs(dx)+Math.abs(dy);
    if(focused) return;
    orbit.wth -= dx*.005;
    orbit.wph = clamp(orbit.wph - dy*.004, .55, 1.75);
  }
  function up(x,y){
    dragging=false;
    if(moved>9) return;
    pt.set((x/innerWidth)*2-1, -(y/innerHeight)*2+1);
    ray.setFromCamera(pt, cam);

    if(focused){
      const hits = ray.intersectObjects(focused.children, true);
      if(hits.length){
        if(focused.userData.locked) return;
        breakSeal(focused);
      } else unfocus();
      return;
    }
    if(ray.intersectObject(desk.userData.quill, false).length ||
       ray.intersectObject(inkwell, false).length){ compose(); return; }

    const hits = ray.intersectObjects(envGroup.children, true);
    if(hits.length){
      let o = hits[0].object;
      while(o && !o.userData.letter) o = o.parent;
      if(o) focus(o);
    }
  }
  function zoom(d){ if(!focused) orbit.wd = clamp(orbit.wd + d*.014, 7, 22); }

  function update(dt){
    T += dt;
    if(room.userData.motes) room.userData.motes.uniforms.uT.value = T;
    fairies.forEach(f=>{
      f.material.opacity = .55 + .45*Math.abs(Math.sin(T*1.1 + f.userData.ph));
      f.scale.setScalar(.6 + .18*Math.abs(Math.sin(T*1.6 + f.userData.ph)));
    });
    hearth.intensity = 2.6 + Math.sin(T*7.3)*.22 + Math.sin(T*13.1)*.12;

    envGroup.children.forEach(n=>{
      if(n === focused) return;
      const u = n.userData;
      n.rotation.z = Math.sin(T*.8 + u.ph)*.08 + tiltX*.5;
      n.rotation.x = Math.cos(T*.62 + u.ph)*.05 + tiltY*.4;
      n.position.y = u.home.y + Math.sin(T*.7 + u.ph)*.13;
    });

    orbit.th = lerp(orbit.th, orbit.wth, dt*3);
    orbit.ph = lerp(orbit.ph, orbit.wph, dt*3);
    orbit.d  = lerp(orbit.d,  orbit.wd,  dt*3);
    if(!dragging && !focused) orbit.wth += dt*.035;
    apply();
  }

  /* envelopes answer to the tilt of a phone */
  let tiltX = 0, tiltY = 0;
  function onTilt(e){
    if(e.gamma == null) return;
    tiltX = clamp(e.gamma/45, -1, 1) * .22;
    tiltY = clamp((e.beta-45)/45, -1, 1) * .16;
  }

  function enter(){
    Snd.bed('wind', .10);
    window.addEventListener('deviceorientation', onTilt);
    if(!letters.length){
      gsap.delayedCall(1.0, ()=>OD.toast('nothing hanging yet — tap the quill on the desk'));
    } else {
      const unread = letters.filter(l=>!l.read && !isLocked(l)).length;
      OD.toast(unread ? (unread===1?'one unread letter':unread+' unread letters')
                      : 'tap an envelope · the quill writes a new one');
    }
  }
  function exit(){
    Snd.bed('wind', 0);
    window.removeEventListener('deviceorientation', onTilt);
    if(focused) unfocus();
  }
  function resize(){ cam.aspect = innerWidth/innerHeight; cam.updateProjectionMatrix(); }

  return {
    scene, cam, update, enter, exit, resize, down, move, up, zoom, compose,
    get count(){ return letters.length; },
    dispose(){ stopWatch && stopWatch(); }
  };
};

})(window.OD);
