/* ══════════════════════════════════════════════════════════════
   THE CRYSTAL TOWER — the timeline, set into crystal.
   Bottom is the beginning. The top is open, and unfinished.
   ══════════════════════════════════════════════════════════════ */
(function(OD){
"use strict";

const { TAU, clamp, lerp, rnd, TIER, Snd, Store, Days, CFG, $ } = OD;

const H_BOTTOM = 0, H_TOP = 74;

OD.Tower = function(renderer, post, env){
  const scene = new THREE.Scene();
  scene.environment = env;
  scene.background = OD.sc(0x0A0C16);
  scene.fog = new THREE.FogExp2(0x0A0C16, .0125);

  const cam = new THREE.PerspectiveCamera(52, innerWidth/innerHeight, .1, 500);

  /* ── light ────────────────────────────────────────────────── */
  scene.add(new THREE.AmbientLight(OD.sc(0x3A4266), 1.5));
  const above = new THREE.DirectionalLight(OD.sc(0xFFF0DC), 1.6);
  above.position.set(6, 60, 10); scene.add(above);
  const under = new THREE.PointLight(OD.sc(0x8A5AC9), 3.0, 60, 2);
  under.position.set(0, 4, 0); scene.add(under);
  const crown = new THREE.PointLight(OD.sc(0xFFE7C4), 3.4, 60, 2);
  crown.position.set(0, H_TOP, 0); scene.add(crown);

  /* the colour of the crystal at a given height */
  const AMETHYST = OD.sc(0x8A5AC9);
  const QUARTZ   = OD.sc(0xE9A8C4);
  const DIAMOND  = OD.sc(0xFFF4E2);
  function crystalColor(t){
    return t < .5 ? AMETHYST.clone().lerp(QUARTZ, t/.5)
                  : QUARTZ.clone().lerp(DIAMOND, (t-.5)/.5);
  }

  /* ── the spiral wall ──────────────────────────────────────── */
  const walls = new THREE.Group(); scene.add(walls);
  const RADIUS = 9.5;
  const TURNS = 3.2;
  const SEGS = TIER==='mobile' ? 90 : 160;

  const crystalMat = new THREE.MeshPhysicalMaterial({
    color: OD.sc(0xFFFFFF), vertexColors:true, roughness:.10, metalness:0,
    transmission: OD.tr(.82), thickness:2.2, ior:1.62, transparent:true, opacity:.94,
    clearcoat:1, clearcoatRoughness:.08, envMap:env, envMapIntensity:2.4,
    side:THREE.DoubleSide
  });

  (function buildWall(){
    const pos=[], col=[], idx=[];
    const rows = SEGS, cols = 2;
    for(let i=0;i<=rows;i++){
      const t = i/rows;
      const a = t*TAU*TURNS;
      const y = lerp(H_BOTTOM, H_TOP, t);
      const c = crystalColor(t);
      for(let j=0;j<=cols;j++){
        const jj = j/cols;
        const rr = RADIUS + Math.sin(a*3.1 + jj*2)*0.55 + jj*1.4;
        pos.push(Math.cos(a)*rr, y + jj*2.2, Math.sin(a)*rr);
        col.push(c.r, c.g, c.b);
      }
    }
    for(let i=0;i<rows;i++) for(let j=0;j<cols;j++){
      const a = i*(cols+1)+j, b = a+1, cIdx = a+(cols+1), d = cIdx+1;
      idx.push(a,b,cIdx, b,d,cIdx);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos,3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(col,3));
    g.setIndex(idx);
    g.computeVertexNormals();
    walls.add(new THREE.Mesh(g, crystalMat));
  })();

  /* the ramp you climb */
  (function buildRamp(){
    for(let i=0;i<SEGS;i++){
      const t=i/SEGS, a=t*TAU*TURNS, y=lerp(H_BOTTOM,H_TOP,t);
      if(i%3) continue;
      const c = crystalColor(t);
      const step = new THREE.Mesh(
        new THREE.BoxGeometry(3.4, .22, 1.7),
        new THREE.MeshPhysicalMaterial({ color:c, roughness:.14, transmission: OD.tr(.6),
          thickness:1.2, transparent:true, opacity:.7, envMap:env, envMapIntensity:1.8 })
      );
      step.position.set(Math.cos(a)*(RADIUS-2.4), y, Math.sin(a)*(RADIUS-2.4));
      step.rotation.y = -a;
      walls.add(step);
    }
  })();

  /* ── floating crystal flecks, like a snow globe ───────────── */
  const fleck = (function(){
    const n = TIER==='mobile'?140:340;
    const p=new Float32Array(n*3), s=new Float32Array(n), sd=new Float32Array(n);
    for(let i=0;i<n;i++){
      const a=Math.random()*TAU, r=Math.random()*RADIUS*1.1;
      p[i*3]=Math.cos(a)*r; p[i*3+1]=rnd(H_BOTTOM,H_TOP+8); p[i*3+2]=Math.sin(a)*r;
      s[i]=rnd(.6,2.2); sd[i]=Math.random()*100;
    }
    const g=new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(p,3));
    g.setAttribute('aSize', new THREE.BufferAttribute(s,1));
    g.setAttribute('aSeed', new THREE.BufferAttribute(sd,1));
    const m=new THREE.ShaderMaterial({
      transparent:true, depthWrite:false, blending:THREE.AdditiveBlending,
      uniforms:{ uT:{value:0}, uMap:{value:OD.SPRITE}, uPR:{value:renderer.getPixelRatio()}, uTop:{value:H_TOP} },
      vertexShader:`
        attribute float aSize,aSeed; uniform float uT,uPR,uTop;
        varying float vA; varying float vH;
        void main(){
          vec3 p=position;
          p.x += sin(uT*.22+aSeed)*1.1;
          p.z += cos(uT*.18+aSeed*1.4)*1.1;
          p.y += sin(uT*.13+aSeed*2.)*1.6;
          vH = clamp(p.y/uTop,0.,1.);
          vA = .25+.55*abs(sin(uT*.6+aSeed*3.));
          vec4 mv=modelViewMatrix*vec4(p,1.);
          gl_PointSize=aSize*uPR*(190./-mv.z)*(0.6+vH*0.9);
          gl_Position=projectionMatrix*mv;
        }`,
      fragmentShader:`
        uniform sampler2D uMap; varying float vA; varying float vH;
        void main(){
          vec4 t=texture2D(uMap,gl_PointCoord);
          vec3 c = mix(vec3(.62,.42,.86), vec3(1.,.96,.88), vH);
          gl_FragColor=vec4(c, t.a*vA*.75);
          if(gl_FragColor.a<.01) discard;
        }`
    });
    scene.add(new THREE.Points(g,m));
    return m;
  })();

  /* ── memory shards ────────────────────────────────────────── */
  const shardGroup = new THREE.Group(); scene.add(shardGroup);
  let memories = [], shards = [], extracted = null, topShard = null;
  const texCache = {};

  function heightOf(m){
    const start = CFG.start.getTime();
    const now = Date.now();
    const t = clamp((new Date(m.date).getTime() - start) / Math.max(1, now-start), 0, 1);
    return lerp(H_BOTTOM + 2, H_TOP - 4, t);
  }

  function photoTexture(url, onReady){
    if(texCache[url]) { onReady(texCache[url]); return; }
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = ()=>{
      const t = new THREE.Texture(img);
      t.encoding = THREE.sRGBEncoding;
      t.needsUpdate = true;
      texCache[url] = t;
      onReady(t);
    };
    img.onerror = ()=> onReady(null);
    img.src = url;
  }

  function makeShard(m, i){
    const y = heightOf(m);
    const t = clamp((y-H_BOTTOM)/(H_TOP-H_BOTTOM), 0, 1);
    const a = t*TAU*TURNS + 0.42;
    const g = new THREE.Group();

    const gem = new THREE.Mesh(
      new THREE.OctahedronGeometry(1.25, 0),
      new THREE.MeshPhysicalMaterial({
        color: crystalColor(t), roughness:.05, metalness:0,
        transmission: OD.tr(.78), thickness:1.6, ior:1.7, transparent:true, opacity:.92,
        clearcoat:1, envMap:env, envMapIntensity:2.6 })
    );
    gem.scale.set(1, 1.35, 1);
    g.add(gem);

    // whatever is inside it
    const inner = new THREE.Mesh(
      new THREE.PlaneGeometry(1.25, .9),
      new THREE.MeshBasicMaterial({ color: OD.sc(0xFFFFFF), transparent:true, opacity:.9, side:THREE.DoubleSide })
    );
    inner.position.z = .02;
    g.add(inner);
    g.userData.inner = inner;

    if(m.thumb || m.asset_url){
      photoTexture(m.thumb || m.asset_url, tx=>{
        if(tx){ inner.material.map = tx; inner.material.color.copy(OD.sc(0xFFFFFF)); inner.material.needsUpdate = true; }
      });
    } else {
      // a milestone or a voice note gets a drawn face instead
      const c = document.createElement('canvas'); c.width=256; c.height=192;
      const cg = c.getContext('2d');
      cg.fillStyle = '#1A1428'; cg.fillRect(0,0,256,192);
      cg.fillStyle = 'rgba(255,230,200,.9)';
      cg.font = '600 22px Georgia, serif'; cg.textAlign='center';
      cg.fillText(m.type === 'voice' ? '♪' : '✦', 128, 78);
      cg.font = '300 15px Jost, sans-serif';
      cg.fillText((m.title||'').slice(0,22), 128, 116);
      const tx = new THREE.CanvasTexture(c); tx.encoding = THREE.sRGBEncoding;
      inner.material.map = tx; inner.material.needsUpdate = true;
    }

    const glow = new THREE.Sprite(new THREE.SpriteMaterial({
      map:OD.GLOW, color:crystalColor(t), transparent:true, opacity:.5,
      blending:THREE.AdditiveBlending, depthWrite:false }));
    glow.scale.setScalar(4.0);
    g.add(glow);
    g.userData.glow = glow;

    const rr = RADIUS + .2;
    g.position.set(Math.cos(a)*rr, y, Math.sin(a)*rr);
    g.lookAt(0, y, 0);
    g.userData.home = g.position.clone();
    g.userData.homeQ = g.quaternion.clone();
    g.userData.mem = m;
    g.userData.ph = Math.random()*TAU;
    return g;
  }

  function rebuild(){
    shards.forEach(s=>shardGroup.remove(s));
    shards = [];
    memories.forEach((m,i)=>{
      const s = makeShard(m,i);
      shards.push(s); shardGroup.add(s);
    });
    // the newest one is still forming, up in the open air
    if(topShard){ scene.remove(topShard); topShard = null; }
    if(memories.length){
      const last = memories[memories.length-1];
      topShard = makeShard(Object.assign({}, last, { date: new Date().toISOString() }), -1);
      topShard.position.set(0, H_TOP + 5, 0);
      topShard.scale.setScalar(1.6);
      topShard.userData.floating = true;
      scene.add(topShard);
    }
  }

  const stopWatch = Store.watch('memories', list=>{
    list.sort((a,b)=> new Date(a.date) - new Date(b.date));
    memories = list;
    rebuild();
  }, 'date', 'asc');

  /* ── extract / open ───────────────────────────────────────── */
  function extract(node){
    if(extracted) return;
    extracted = node;
    Snd.glass();
    const front = new THREE.Vector3();
    cam.getWorldDirection(front);
    const dest = cam.position.clone().addScaledVector(front, 6.2);
    gsap.to(node.position, { x:dest.x, y:dest.y, z:dest.z, duration:.65, ease:'power3.out' });
    gsap.to(node.scale, { x:2.0, y:2.0, z:2.0, duration:.65, ease:'power3.out' });
    gsap.to(node.userData.glow.material, { opacity:.95, duration:.5 });
    OD.toast('tap it again to open it');
  }

  function putBack(){
    if(!extracted) return;
    const n = extracted; extracted = null;
    gsap.to(n.position, { x:n.userData.home.x, y:n.userData.home.y, z:n.userData.home.z,
      duration:.8, ease:'power2.inOut' });
    gsap.to(n.scale, { x:1,y:1,z:1, duration:.8, ease:'power2.inOut' });
    gsap.to(n.userData.glow.material, { opacity:.5, duration:.6 });
  }

  function openMemory(m){
    const isVideo = m.type === 'video';
    const isVoice = m.type === 'voice';
    const media = m.asset_url
      ? (isVideo
          ? `<video class="memmedia" src="${OD.esc(m.asset_url)}" controls playsinline></video>`
          : isVoice
            ? `<audio class="memaudio" src="${OD.esc(m.asset_url)}" controls></audio>`
            : `<img class="memmedia" src="${OD.esc(m.asset_url)}" alt="${OD.esc(m.title||'a memory')}">`)
      : '';
    OD.Sheet.open(`
      <div class="eyebrow">${OD.esc(Days.fmt(m.date))}</div>
      <h2>${OD.esc(m.title||'')}</h2>
      ${media}
      ${m.caption ? `<p class="lead">${OD.esc(m.caption)}</p>` : ''}
      ${m.voice_url ? `<audio class="memaudio" src="${OD.esc(m.voice_url)}" controls></audio>` : ''}
    `, { wide:true, onClose: putBack });
    Snd.chime(660);
  }

  /* ── adding a memory ──────────────────────────────────────── */
  let assetsNs = undefined;
  async function assets(){
    if(assetsNs !== undefined) return assetsNs;
    try{ assetsNs = await claude.use('assets'); }catch(e){ assetsNs = null; }
    return assetsNs;
  }

  async function addMemory(){
    const a = await assets();
    OD.Sheet.open(`
      <div class="eyebrow">a new memory</div>
      <h2>Set it into the wall</h2>
      <label class="fl"><span class="fieldlabel">when</span>
        <input id="mDate" type="date" required></label>
      <label class="fl"><span class="fieldlabel">what to call it</span>
        <input id="mTitle" type="text" maxlength="70" placeholder="The night on the terrace"></label>
      <label class="fl"><span class="fieldlabel">a line about it</span>
        <textarea id="mCap" rows="3" maxlength="300" placeholder="Optional."></textarea></label>
      ${a ? `<label class="fl"><span class="fieldlabel">photo, video or voice note</span>
        <input id="mFile" type="file" accept="image/*,video/*,audio/*"></label>
        <div class="hint" id="mHint">20&nbsp;MB maximum.</div>`
          : `<div class="hint warn">File uploads are not available in this view, so this one will be a milestone: a date, a title and a line. It still takes its place in the wall.</div>`}
      <div class="rowbtn"><button class="btn primary" id="mSave">set it in</button></div>
    `, { wide:true });

    const dEl = $('#mDate');
    dEl.value = Days.key();
    dEl.max = Days.key();

    $('#mSave').addEventListener('click', async ()=>{
      const btn = $('#mSave');
      const date = $('#mDate').value;
      if(!date){ OD.toast('it needs a date to know where it goes'); return; }
      btn.disabled = true; btn.textContent = 'setting…';

      let asset_url = null, asset_id = null, type = 'milestone';
      const fEl = $('#mFile');
      const file = fEl && fEl.files && fEl.files[0];
      if(file && a){
        if(file.size > 20*1024*1024){
          OD.toast('that file is over 20 MB'); btn.disabled=false; btn.textContent='set it in'; return;
        }
        try{
          const res = await a.upload(file);
          asset_url = res.url; asset_id = res.id;
          type = file.type.startsWith('video') ? 'video'
               : file.type.startsWith('audio') ? 'voice' : 'photo';
        }catch(e){
          OD.toast('the upload did not go through — saving it as a milestone');
        }
      }

      await Store.put('memories', Store.newId(), {
        date: new Date(date + 'T12:00:00').toISOString(),
        title: $('#mTitle').value.trim(),
        caption: $('#mCap').value.trim(),
        type, asset_url, asset_id,
        added_by: Store.side || 'him',
        added_at: Date.now()
      });
      Snd.glass();
      OD.Sheet.close();
      OD.toast('it is in the wall now');
    });
  }

  /* ── camera: you climb by scrolling ───────────────────────── */
  const rig = { y: 4, wantY: 4, th: 0.42, wth: 0.42, d: 17, wd: 17 };
  function apply(){
    const t = clamp((rig.y - H_BOTTOM)/(H_TOP-H_BOTTOM), 0, 1);
    const a = t*TAU*TURNS + 0.42 - 1.35;
    cam.position.set(Math.cos(a+rig.th)*rig.d, rig.y + 2.2, Math.sin(a+rig.th)*rig.d);
    cam.lookAt(0, rig.y + 1.0, 0);
  }
  apply();

  const ray = new THREE.Raycaster(), pt = new THREE.Vector2();
  let dragging=false, lx=0, ly=0, moved=0, T=0;

  function down(x,y){ dragging=true; lx=x; ly=y; moved=0; }
  function move(x,y){
    if(!dragging) return;
    const dx=x-lx, dy=y-ly; lx=x; ly=y; moved+=Math.abs(dx)+Math.abs(dy);
    if(extracted) return;
    // drag up and the tower slides down past you: you climb
    rig.wantY = clamp(rig.wantY - dy*0.09, H_BOTTOM, H_TOP + 6);
    rig.wth  -= dx*0.004;
  }
  function up(x,y){
    dragging=false;
    if(moved>9) return;
    pt.set((x/innerWidth)*2-1, -(y/innerHeight)*2+1);
    ray.setFromCamera(pt, cam);
    if(extracted){
      if(ray.intersectObjects(extracted.children, true).length) openMemory(extracted.userData.mem);
      else putBack();
      return;
    }
    const hits = ray.intersectObjects(shardGroup.children, true);
    if(hits.length){
      let o = hits[0].object;
      while(o && !o.userData.mem) o = o.parent;
      if(o) extract(o);
      return;
    }
    if(topShard && ray.intersectObjects(topShard.children, true).length){
      OD.toast('still being written');
    }
  }
  function zoom(d){ rig.wantY = clamp(rig.wantY + d*0.035, H_BOTTOM, H_TOP + 6); }

  function update(dt){
    T += dt;
    fleck.uniforms.uT.value = T;

    shardGroup.children.forEach(s=>{
      if(s === extracted){
        s.rotation.y += dt*.55;
        return;
      }
      const u=s.userData;
      s.position.y = u.home.y + Math.sin(T*.5 + u.ph)*.20;
      s.rotation.y += dt*.12;
      s.userData.glow.material.opacity = .34 + .26*Math.abs(Math.sin(T*.9 + u.ph));
    });
    if(topShard){
      topShard.position.y = H_TOP + 5 + Math.sin(T*.6)*.7;
      topShard.rotation.y += dt*.3;
      topShard.scale.setScalar(1.5 + Math.sin(T*1.1)*.09);
    }
    under.intensity = 2.6 + Math.sin(T*.8)*.5;
    crown.intensity = 3.0 + Math.sin(T*.6)*.6;

    rig.y  = lerp(rig.y,  rig.wantY, dt*2.6);
    rig.th = lerp(rig.th, rig.wth,   dt*2.6);
    rig.d  = lerp(rig.d,  rig.wd,    dt*2.6);
    apply();

    const t = clamp((rig.y-H_BOTTOM)/(H_TOP-H_BOTTOM),0,1);
    const bar = $('#climb');
    if(bar) bar.style.setProperty('--p', (t*100).toFixed(1)+'%');
    const lbl = $('#climbLabel');
    if(lbl){
      const when = new Date(lerp(CFG.start.getTime(), Date.now(), t));
      lbl.textContent = when.toLocaleDateString(undefined,{ month:'long', year:'numeric' });
    }
  }

  function enter(){
    Snd.bed('wind', .14);
    rig.y = rig.wantY = 4;
    $('#climb').classList.add('on');
    gsap.delayedCall(.8, ()=>{
      OD.toast(memories.length
        ? (OD.COARSE ? 'drag up to climb through the years' : 'scroll to climb through the years')
        : 'nothing set into the wall yet — use the ✦ to add the first');
    });
  }
  function exit(){
    Snd.bed('wind', 0);
    $('#climb').classList.remove('on');
    putBack();
  }
  function resize(){ cam.aspect = innerWidth/innerHeight; cam.updateProjectionMatrix(); }

  return {
    scene, cam, update, enter, exit, resize, down, move, up, zoom, addMemory,
    get count(){ return memories.length; },
    dispose(){ stopWatch && stopWatch(); }
  };
};

})(window.OD);
