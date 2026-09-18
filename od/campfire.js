/* ══════════════════════════════════════════════════════════════
   THE CAMPFIRE — one question a day, answered alone, revealed
   only once you have both spoken.
   ══════════════════════════════════════════════════════════════ */
(function(OD){
"use strict";

const { TAU, clamp, lerp, rnd, TIER, Snd, Store, Days, CFG, $ } = OD;

OD.Campfire = function(renderer, post, env){
  const scene = new THREE.Scene();
  scene.environment = env;
  scene.background = new THREE.Color(0x060810);
  scene.fog = new THREE.FogExp2(0x070A14, .017);

  const cam = new THREE.PerspectiveCamera(50, innerWidth/innerHeight, .1, 400);

  /* ── night sky ────────────────────────────────────────────── */
  const sky = new THREE.Mesh(
    new THREE.SphereGeometry(300, 36, 24),
    new THREE.ShaderMaterial({
      side:THREE.BackSide, depthWrite:false,
      uniforms:{ uT:{value:0} },
      vertexShader:`varying vec3 vP; void main(){ vP=normalize(position);
        gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
      fragmentShader:`
        varying vec3 vP; uniform float uT;
        float h21(vec2 p){ return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453); }
        void main(){
          float y=clamp(vP.y*.5+.5,0.,1.);
          vec3 c = mix(vec3(0.04,0.05,0.10), vec3(0.02,0.03,0.07), smoothstep(.3,.9,y));
          c = mix(vec3(0.10,0.07,0.06), c, smoothstep(.28,.52,y));
          vec2 g=floor(vP.xz*340.+vP.y*120.);
          float st=h21(g);
          c += vec3(smoothstep(.9972,1.,st)*(.45+.55*sin(uT*1.4+st*40.)))*2.0;
          float band = smoothstep(.1,.85,y)*smoothstep(.55,.0,abs(vP.x*.7+vP.z*.3));
          c += vec3(.16,.14,.22)*band*.5;
          gl_FragColor=vec4(c,1.);
        }`
    })
  );
  scene.add(sky);

  /* ── the clearing ─────────────────────────────────────────── */
  const ground = new THREE.Mesh(
    new THREE.CircleGeometry(30, 40),
    new THREE.MeshStandardMaterial({ color:0x1E2418, roughness:1,
      normalMap:OD.MAT.rockNormal, normalScale:new THREE.Vector2(.9,.9) })
  );
  ground.rotation.x = -Math.PI/2; ground.position.y = -1.2;
  scene.add(ground);

  const trees = [];
  for(let i=0;i<(TIER==='mobile'?16:28);i++){
    const a = i/(TIER==='mobile'?16:28)*TAU + rnd(-.08,.08);
    const r = rnd(13, 25);
    const h = rnd(7, 15);
    const t = new THREE.Group();
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(.22,.4,h,6), OD.MAT.bark);
    trunk.position.y = h/2; t.add(trunk);
    const crown = new THREE.Mesh(new THREE.ConeGeometry(rnd(1.6,3.0), rnd(4,7), 6),
      new THREE.MeshStandardMaterial({ color:0x16220F, roughness:1, envMapIntensity:.2 }));
    crown.position.y = h*.86; t.add(crown);
    t.position.set(Math.cos(a)*r, -1.2, Math.sin(a)*r);
    t.userData = { ph: Math.random()*TAU, sway: rnd(.006,.018) };
    trees.push(t); scene.add(t);
  }

  /* ── the fire ─────────────────────────────────────────────── */
  const fire = new THREE.Group(); scene.add(fire);
  for(let i=0;i<7;i++){
    const log = new THREE.Mesh(new THREE.CylinderGeometry(.19,.19,2.1,7), OD.MAT.woodDark);
    const a=i/7*TAU;
    log.position.set(Math.cos(a)*.55, -.75, Math.sin(a)*.55);
    log.rotation.set(Math.PI/2.5, a, 0);
    fire.add(log);
  }
  const ember = new THREE.Mesh(new THREE.SphereGeometry(.62, 14, 10),
    new THREE.MeshBasicMaterial({ color:0xFF6A18 }));
  ember.position.y = -.7; fire.add(ember);

  const flameSprites = [];
  for(let i=0;i<5;i++){
    const s = new THREE.Sprite(new THREE.SpriteMaterial({
      map:OD.GLOW, color: i<2?0xFFE0A0:0xFF8A32, transparent:true,
      opacity:.85, blending:THREE.AdditiveBlending, depthWrite:false }));
    s.position.set(rnd(-.2,.2), rnd(-.2,.9), rnd(-.2,.2));
    s.userData = { ph:Math.random()*TAU, sc: rnd(1.1,2.4), base:s.position.clone() };
    fire.add(s); flameSprites.push(s);
  }
  const fireLight = new THREE.PointLight(0xFF8A3C, 6.0, 46, 2);
  fireLight.position.y = .3; scene.add(fireLight);
  scene.add(new THREE.AmbientLight(0x141C2A, 1.1));
  const moonL = new THREE.DirectionalLight(0x8098C8, .35);
  moonL.position.set(-20, 30, -14); scene.add(moonL);

  /* embers rising */
  const EN = TIER==='mobile'?70:170;
  const ePos = new Float32Array(EN*3), eSeed = new Float32Array(EN);
  for(let i=0;i<EN;i++){
    ePos[i*3]=rnd(-.7,.7); ePos[i*3+1]=rnd(-.6,1); ePos[i*3+2]=rnd(-.7,.7);
    eSeed[i]=Math.random();
  }
  const eGeo = new THREE.BufferGeometry();
  eGeo.setAttribute('position', new THREE.BufferAttribute(ePos,3));
  eGeo.setAttribute('aSeed', new THREE.BufferAttribute(eSeed,1));
  const eMat = new THREE.ShaderMaterial({
    transparent:true, depthWrite:false, blending:THREE.AdditiveBlending,
    uniforms:{ uT:{value:0}, uMap:{value:OD.SPRITE}, uPR:{value:renderer.getPixelRatio()} },
    vertexShader:`
      attribute float aSeed; uniform float uT,uPR; varying float vA;
      void main(){
        float life = fract(uT*0.16 + aSeed);
        vec3 p = position;
        p.y += life*13.0;
        p.x += sin(uT*1.4 + aSeed*30.0)*life*2.6;
        p.z += cos(uT*1.1 + aSeed*22.0)*life*2.6;
        vA = (1.0-life)*(1.0-life);
        vec4 mv=modelViewMatrix*vec4(p,1.0);
        gl_PointSize = (1.0+aSeed*2.2)*uPR*(150.0/-mv.z);
        gl_Position=projectionMatrix*mv;
      }`,
    fragmentShader:`uniform sampler2D uMap; varying float vA;
      void main(){ vec4 t=texture2D(uMap,gl_PointCoord);
        gl_FragColor=vec4(1.0,0.52,0.16,t.a*vA); if(gl_FragColor.a<.01) discard; }`
  });
  scene.add(new THREE.Points(eGeo, eMat));

  /* ── the question lantern ─────────────────────────────────── */
  const lantern = new THREE.Group();
  lantern.position.set(0, 9.5, 0);
  scene.add(lantern);

  const lanternMat = new THREE.MeshStandardMaterial({
    color:0xFFE4B8, roughness:.85, transparent:true, opacity:.94,
    emissive:0x6A3C10, emissiveIntensity:1, side:THREE.DoubleSide
  });
  const petals = [];
  for(let i=0;i<4;i++){
    const p = new THREE.Mesh(new THREE.PlaneGeometry(1.15, 1.6), lanternMat);
    const a = i/4*TAU;
    p.position.set(Math.cos(a)*.58, 0, Math.sin(a)*.58);
    p.rotation.y = -a + Math.PI/2;
    p.userData = { a, home:p.rotation.x };
    lantern.add(p); petals.push(p);
  }
  const lanternGlow = new THREE.Sprite(new THREE.SpriteMaterial({
    map:OD.GLOW, color:0xFFC070, transparent:true, opacity:.75,
    blending:THREE.AdditiveBlending, depthWrite:false }));
  lanternGlow.scale.setScalar(3.4);
  lantern.add(lanternGlow);
  const lanternLight = new THREE.PointLight(0xFFC070, 1.6, 18, 2);
  lantern.add(lanternLight);

  /* ── archive lanterns + wish sky ──────────────────────────── */
  const wishSky = OD.LanternSky(scene, { radius:80, high:30 });
  const archive = new THREE.Group(); scene.add(archive);
  let archiveRows = [];

  function rebuildArchive(rows){
    archiveRows = rows.filter(r => r.answer_her || r.answer_him)
                      .sort((a,b)=> a.id < b.id ? -1 : 1);
    while(archive.children.length) archive.remove(archive.children[0]);
    archiveRows.forEach((r,i)=>{
      const both = r.answer_her && r.answer_him;
      const col = both ? 0xFFD9A8 : (r.answer_her ? 0xF3A0B8 : 0xF6C177);
      const s = new THREE.Sprite(new THREE.SpriteMaterial({
        map:OD.GLOW, color:col, transparent:true, opacity:.7,
        blending:THREE.AdditiveBlending, depthWrite:false }));
      // newest hangs lowest and closest
      const age = archiveRows.length - i;
      const rr = OD.rng(i*2654435761 + 7);
      const ang = rr()*TAU;
      const rad = 10 + rr()*22;
      s.position.set(Math.cos(ang)*rad, 14 + age*1.25 + rr()*3, Math.sin(ang)*rad);
      s.scale.setScalar(both ? 2.2 : 1.6);
      s.userData = { row:r, ph:Math.random()*TAU, base:s.position.clone() };
      archive.add(s);
    });
  }
  const stopArchive = Store.watch('questions', rebuildArchive);

  /* ══════════════════════════════════════════════════════════
     THE DAILY RITUAL
     ══════════════════════════════════════════════════════════ */
  const todayKey = Days.key();
  const QN = OD.questionFor(new Date());
  let today = null;
  let unsub = null;

  function mySide(){ return Store.side || 'him'; }
  function myField(){ return 'answer_' + mySide(); }
  function theirField(){ return 'answer_' + (mySide()==='her'?'him':'her'); }
  function theirName(){ return mySide()==='her' ? CFG.him.pet : CFG.her.pet; }
  function myName(){ return mySide()==='her' ? CFG.her.pet : CFG.him.pet; }

  function watchToday(){
    if(Store.db){
      try{
        unsub = Store.db.doc('questions/'+todayKey).onSnapshot(
          snap => { today = snap.exists ? Object.assign({id:todayKey}, snap.data()) : null; render(); },
          () => { render(); });
        return;
      }catch(e){}
    }
    Store.get('questions', todayKey).then(r=>{ today = r; render(); });
  }

  /* the visible state of the lantern follows the state of the day */
  function render(){
    const mine  = today && today[myField()];
    const their = today && today[theirField()];
    const both  = mine && their;

    if(QN.special){
      lanternMat.color.setHex(0xFFE9B0);
      lanternMat.emissive.setHex(0x8A5A10);
      lanternGlow.material.color.setHex(0xFFD070);
    }
    lanternGlow.material.opacity = both ? .95 : (mine ? .45 : .75);
    const badge = $('#fireBadge');
    if(badge){
      badge.classList.toggle('on', !mine);
      badge.textContent = mine ? '' : '1';
    }
  }

  function openQuestion(){
    if(!Store.ready){ OD.toast('one moment'); return; }
    Snd.chime(QN.special ? 639 : 528);
    // the lantern comes down and opens like a flower
    gsap.to(lantern.position, { y:3.4, duration:1.5, ease:'power2.inOut' });
    petals.forEach((p,i)=>{
      gsap.to(p.rotation, { x: -1.05, duration:1.1, delay:.55 + i*.09, ease:'back.out(1.5)' });
    });
    gsap.delayedCall(1.5, showSheet);
  }

  function closeLantern(){
    petals.forEach((p,i)=> gsap.to(p.rotation, { x:0, duration:.7, delay:i*.05, ease:'power2.inOut' }));
    gsap.to(lantern.position, { y:9.5, duration:1.6, delay:.4, ease:'power2.inOut' });
  }

  function frozenNote(){
    const t = Days.midnight();
    const left = t - Date.now();
    const h = Math.floor(left/3600000), m = Math.floor(left/60000)%60;
    return h > 0 ? `${h}h ${m}m until the next one` : `${m}m until the next one`;
  }

  function showSheet(){
    const mine  = today && today[myField()];
    const their = today && today[theirField()];
    const both  = mine && their;

    const head = `
      <div class="eyebrow">${QN.special ? 'a golden one · ' + OD.esc(QN.occasion) : 'tier ' + QN.tier + ' · ' + OD.esc(Days.fmtShort(new Date()))}</div>
      <blockquote class="qtext ${QN.special?'gold':''}">${OD.esc(QN.text)}</blockquote>`;

    if(both){
      OD.Sheet.open(head + `
        <div class="twoup">
          <div class="ans her">
            <div class="who">${OD.esc(CFG.her.pet)}</div>
            <p>${OD.esc(today.answer_her)}</p>
          </div>
          <div class="ans him">
            <div class="who">${OD.esc(CFG.him.pet)}</div>
            <p>${OD.esc(today.answer_him)}</p>
          </div>
        </div>
        <p class="counting">${OD.esc(frozenNote())}</p>
      `, { wide:true, onClose: closeLantern });
      Snd.chime(639);
      return;
    }

    if(mine){
      OD.Sheet.open(head + `
        <div class="ans ${mySide()}">
          <div class="who">${OD.esc(myName())} · sealed</div>
          <p>${OD.esc(mine)}</p>
        </div>
        <p class="waiting">Waiting for ${OD.esc(theirName())} to speak.</p>
        <p class="counting">${OD.esc(frozenNote())}</p>
      `, { wide:true, onClose: closeLantern });
      return;
    }

    /* not answered yet — carve it into the log */
    OD.Sheet.open(head + `
      <div class="log">
        <textarea id="ansText" maxlength="500" rows="5" autofocus
          placeholder="Say it properly. It cannot be edited afterwards."></textarea>
        <div class="notches"><span id="ansCount">0</span>/500</div>
      </div>
      ${their ? `<p class="waiting">${OD.esc(theirName())} has already answered. You will both see it the moment you submit.</p>`
              : `<p class="waiting">Neither of you has answered. Whoever goes first stays hidden until the other does.</p>`}
      <div class="rowbtn">
        <button class="btn primary iron" id="ansBtn" disabled>press the branding iron</button>
      </div>
    `, { wide:true, onClose: closeLantern });

    const ta = $('#ansText'), cnt = $('#ansCount'), btn = $('#ansBtn');
    let lastLen = 0;
    ta.addEventListener('input', ()=>{
      cnt.textContent = ta.value.length;
      btn.disabled = ta.value.trim().length < 2;
      if(ta.value.length > lastLen && ta.value.length % 2 === 0) Snd.carve();
      lastLen = ta.value.length;
    });
    btn.addEventListener('click', ()=>submit(ta.value.trim()));
  }

  async function submit(text){
    if(!text) return;
    const btn = $('#ansBtn');
    if(btn){ btn.disabled = true; btn.textContent = 'pressing…'; }
    Snd.seal();
    OD.buzz([18,40,90]);

    const rec = Object.assign({
      question: QN.text,
      tier: QN.tier,
      special: !!QN.special,
      answer_her: null, answer_him: null,
      submitted_her: null, submitted_him: null
    }, today || {});
    rec[myField()] = text.slice(0,500);
    rec['submitted_' + mySide()] = Date.now();
    rec.frozen_until = Days.midnight();
    delete rec.id;

    await Store.put('questions', todayKey, rec);
    today = Object.assign({ id:todayKey }, rec);

    // frost creeps over it
    const sheet = $('#sheet');
    sheet.classList.add('frozen');
    gsap.delayedCall(1.6, ()=>{
      sheet.classList.remove('frozen');
      render();
      showSheet();
      OD.toast('your heart has spoken');
    });
  }

  function readArchive(row){
    const both = row.answer_her && row.answer_him;
    OD.Sheet.open(`
      <div class="eyebrow">${OD.esc(Days.fmt(row.id))}</div>
      <blockquote class="qtext">${OD.esc(row.question||'')}</blockquote>
      <div class="twoup">
        <div class="ans her"><div class="who">${OD.esc(CFG.her.pet)}</div>
          <p>${row.answer_her ? OD.esc(row.answer_her) : '<i>Some words take time.</i>'}</p></div>
        <div class="ans him"><div class="who">${OD.esc(CFG.him.pet)}</div>
          <p>${row.answer_him ? OD.esc(row.answer_him) : '<i>Some words take time.</i>'}</p></div>
      </div>
    `, { wide:true });
    if(both) Snd.chime(528);
  }

  /* ── camera / input ───────────────────────────────────────── */
  const orbit = { th:.3, ph:1.28, d:15, wth:.3, wph:1.28, wd:15, tgt:new THREE.Vector3(0,2.2,0) };
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
    orbit.wth -= dx*.005;
    orbit.wph = clamp(orbit.wph - dy*.004, .40, 1.52);
  }
  function up(x,y){
    dragging=false;
    if(moved>9) return;
    pt.set((x/innerWidth)*2-1, -(y/innerHeight)*2+1);
    ray.setFromCamera(pt, cam);
    if(ray.intersectObjects(lantern.children, true).length){ openQuestion(); return; }
    const a = ray.intersectObjects(archive.children, false);
    if(a.length){ readArchive(a[0].object.userData.row); return; }
    const w = ray.intersectObjects(wishSky.sprites(), false);
    if(w.length){
      const wi = w[0].object.userData.wish;
      const who = wi.author==='her'?CFG.her:CFG.him;
      OD.Sheet.open(`<div class="eyebrow">${OD.esc(who.pet)} · ${OD.esc(Days.fmt(wi.released_at))}</div>
        <blockquote class="wishq ${wi.author==='her'?'rose':'gold'}">${OD.esc(wi.text)}</blockquote>`);
    }
  }
  function zoom(d){ orbit.wd = clamp(orbit.wd + d*.02, 7, 40); }

  function update(dt){
    T += dt;
    sky.material.uniforms.uT.value = T;
    eMat.uniforms.uT.value = T;
    wishSky.update(dt, T);

    const f = .84 + Math.sin(T*8.7)*.10 + Math.sin(T*19.3)*.06 + Math.sin(T*3.1)*.04;
    fireLight.intensity = 5.0 + f*2.6;
    ember.material.color.setRGB(1, .30 + f*.14, .06);
    flameSprites.forEach((s,i)=>{
      const u=s.userData;
      const k = .8 + Math.abs(Math.sin(T*(4+i) + u.ph))*.5;
      s.scale.set(u.sc*k*.7, u.sc*k*1.35, 1);
      s.position.set(u.base.x + Math.sin(T*3.2+u.ph)*.14, u.base.y + k*.2, u.base.z + Math.cos(T*2.8+u.ph)*.14);
    });

    trees.forEach(t=>{ t.rotation.z = Math.sin(T*.6 + t.userData.ph)*t.userData.sway; });

    lantern.rotation.y += dt*.35;
    lanternGlow.scale.setScalar(3.2 + Math.sin(T*1.6)*.35);
    lanternLight.intensity = 1.4 + Math.sin(T*2.2)*.3;

    archive.children.forEach(s=>{
      const u=s.userData;
      s.position.y = u.base.y + Math.sin(T*.4 + u.ph)*.5;
      s.position.x = u.base.x + Math.cos(T*.3 + u.ph)*.6;
      s.material.opacity = .55 + .35*Math.abs(Math.sin(T*.8 + u.ph));
    });

    orbit.th = lerp(orbit.th, orbit.wth, dt*3);
    orbit.ph = lerp(orbit.ph, orbit.wph, dt*3);
    orbit.d  = lerp(orbit.d,  orbit.wd,  dt*3);
    if(!dragging) orbit.wth += dt*.016;
    apply();
    sky.position.copy(cam.position);
  }

  function enter(){
    Snd.bed('fire', .30);
    Snd.bed('wind', .10);
    if(!unsub) watchToday();
    render();
    gsap.delayedCall(1.0, ()=>{
      const mine = today && today[myField()];
      OD.toast(mine ? 'tap a lantern in the sky to read an old one'
                    : "today's question is hanging above the fire");
    });
  }
  function exit(){ Snd.bed('fire', 0); Snd.bed('wind', 0); }
  function resize(){ cam.aspect = innerWidth/innerHeight; cam.updateProjectionMatrix(); }

  return {
    scene, cam, update, enter, exit, resize, down, move, up, zoom,
    openQuestion,
    get answered(){ return !!(today && today[myField()]); },
    dispose(){ unsub && unsub(); stopArchive && stopArchive(); wishSky.dispose(); }
  };
};

})(window.OD);
