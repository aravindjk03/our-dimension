/* ══════════════════════════════════════════════════════════════
   THE CHOCOLATE HEART PORTAL
   Voronoi fracture · tempered-chocolate PBR · propagating cracks
   ══════════════════════════════════════════════════════════════ */
(function(OD){
"use strict";

const { TAU, clamp, lerp, rnd, smooth, Q, TIER, REDUCED, COARSE, Snd, $ } = OD;

OD.Portal = function(renderer, post, env){

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x06040A);
  scene.environment = env;

  const cam = new THREE.PerspectiveCamera(42, innerWidth/innerHeight, .1, 140);
  cam.position.set(0, 0, 11.4);

  /* ── lights ───────────────────────────────────────────────── */
  const key = new THREE.DirectionalLight(0xFFD4A0, 2.1);
  key.position.set(-5.4, 6.6, 5.4);
  scene.add(key);

  const fill = new THREE.DirectionalLight(0xC9956B, .55);
  fill.position.set(5.2, -1.6, 3.2);
  scene.add(fill);

  const rimL = new THREE.DirectionalLight(0xFFB070, .9);
  rimL.position.set(2.4, 1.2, -6.0);
  scene.add(rimL);

  scene.add(new THREE.AmbientLight(0x2D1810, 1.1));

  const core = new THREE.PointLight(0xFFE0B0, 0, 30, 1.7);
  scene.add(core);

  /* ── the heart outline ────────────────────────────────────── */
  const NPT = 240;
  const OUTLINE = [];
  for(let i=0;i<NPT;i++){
    const t = i/NPT*TAU, st = Math.sin(t);
    OUTLINE.push({
      x: (16*st*st*st)/13,
      y: (13*Math.cos(t) - 5*Math.cos(2*t) - 2*Math.cos(3*t) - Math.cos(4*t))/13 - .18,
      o: true
    });
  }
  OUTLINE.reverse();

  const SCALE = TIER==='mobile' ? 1.70 : 2.05;
  const EX = {
    depth:.62, bevelEnabled:true, bevelThickness:.20, bevelSize:.105,
    bevelSegments: TIER==='mobile'?3:6, curveSegments:3
  };

  function shapeOf(pts){
    const s = new THREE.Shape();
    s.moveTo(pts[0].x, pts[0].y);
    for(let i=1;i<pts.length;i++) s.lineTo(pts[i].x, pts[i].y);
    s.closePath();
    return s;
  }

  /* ── materials ────────────────────────────────────────────── */
  const shell = OD.MAT.chocolate;
  const broke = OD.MAT.chocolateBreak;
  shell.envMap = env; broke.envMap = env;

  /* ── whole heart, before it is broken ─────────────────────── */
  const heartGeo = new THREE.ExtrudeGeometry(shapeOf(OUTLINE), EX);
  heartGeo.center();
  // give the caps a usable UV set so the chocolate grain reads at the right scale
  (function fixUV(g){
    const p = g.attributes.position, uv = g.attributes.uv;
    for(let i=0;i<p.count;i++) uv.setXY(i, p.getX(i)*.42+.5, p.getY(i)*.42+.5);
    uv.needsUpdate = true;
  })(heartGeo);
  const heart = new THREE.Mesh(heartGeo, [shell, broke]);
  heart.scale.setScalar(.0001);
  scene.add(heart);

  /* ── molten interior ──────────────────────────────────────── */
  const coreMesh = new THREE.Mesh(
    new THREE.SphereGeometry(1.0, 28, 20),
    new THREE.MeshBasicMaterial({ color:0xFFE9C6 })
  );
  coreMesh.visible = false;
  scene.add(coreMesh);

  const halo = new THREE.Sprite(new THREE.SpriteMaterial({
    map: OD.GLOW, color:0xFFC98A, transparent:true, opacity:0,
    blending:THREE.AdditiveBlending, depthWrite:false, depthTest:false
  }));
  halo.scale.setScalar(10);
  scene.add(halo);

  /* ══════════════════════════════════════════════════════════
     VORONOI FRACTURE
     Each shard is the heart polygon clipped by the perpendicular
     bisector against every other seed. Interior edges then get
     subdivided and jittered so the breaks read as chocolate
     rather than as geometry.
     ══════════════════════════════════════════════════════════ */
  function inside(pt, poly){
    let c = false;
    for(let i=0, j=poly.length-1; i<poly.length; j=i++){
      const a=poly[i], b=poly[j];
      if(((a.y>pt.y)!==(b.y>pt.y)) &&
         (pt.x < (b.x-a.x)*(pt.y-a.y)/(b.y-a.y)+a.x)) c = !c;
    }
    return c;
  }

  function clipBisector(poly, a, b){
    const mx=(a.x+b.x)/2, my=(a.y+b.y)/2;
    const nx=b.x-a.x, ny=b.y-a.y;
    const f = p => (p.x-mx)*nx + (p.y-my)*ny;   // > 0 → nearer b → discard
    const out=[];
    for(let i=0;i<poly.length;i++){
      const P=poly[i], N=poly[(i+1)%poly.length];
      const fp=f(P), fn=f(N);
      if(fp<=0) out.push(P);
      if((fp<0&&fn>0)||(fp>0&&fn<0)){
        const t = fp/(fp-fn);
        out.push({ x:P.x+(N.x-P.x)*t, y:P.y+(N.y-P.y)*t, o:false });
      }
    }
    return out;
  }

  /* roughen the edges that are fresh breaks, leave the shell edge alone */
  function roughen(poly, seedN){
    const out = [];
    for(let i=0;i<poly.length;i++){
      const P=poly[i], N=poly[(i+1)%poly.length];
      out.push(P);
      if(P.o && N.o) continue;                     // both on the shell: keep smooth
      const dx=N.x-P.x, dy=N.y-P.y;
      const len=Math.hypot(dx,dy);
      if(len < .07) continue;
      const steps = clamp(Math.round(len/.055), 1, 6);
      const px=-dy/len, py=dx/len;
      for(let s=1;s<steps;s++){
        const t=s/steps;
        const jag = OD.noise3(P.x*6.4+seedN, P.y*6.4, t*9.1+seedN) * Math.min(.030, len*.20);
        out.push({ x:P.x+dx*t + px*jag, y:P.y+dy*t + py*jag, o:false });
      }
    }
    return out;
  }

  const N = Q.shards;
  const seeds = [];
  (function placeSeeds(){
    const rng = OD.rng(20210406);
    let guard = 0;
    while(seeds.length < N && guard++ < 4000){
      const p = { x: rnd(-1.05,1.05), y: rnd(-1.25,1.05) };
      if(!inside(p, OUTLINE)) continue;
      // keep them apart so no shard is a splinter
      let ok = true;
      for(const s of seeds) if(Math.hypot(s.x-p.x, s.y-p.y) < .30){ ok=false; break; }
      if(ok) seeds.push(p);
    }
    // one seed deliberately near the cleft, where a real heart snaps first
    if(seeds.length) seeds[0] = { x: rnd(-.08,.08), y: .62 };
  })();

  const shards = [];
  const crackSegs = [];

  seeds.forEach((s, si)=>{
    let poly = OUTLINE.slice();
    for(let j=0;j<seeds.length;j++){
      if(j===si) continue;
      poly = clipBisector(poly, s, seeds[j]);
      if(poly.length < 3) break;
    }
    if(poly.length < 3) return;
    poly = roughen(poly, si*7.3);
    if(poly.length < 3) return;

    // collect the fresh-break edges for the glowing crack lines
    for(let i=0;i<poly.length;i++){
      const P=poly[i], Nn=poly[(i+1)%poly.length];
      if(P.o && Nn.o) continue;
      crackSegs.push(P.x,P.y,0, Nn.x,Nn.y,0);
    }

    const g = new THREE.ExtrudeGeometry(shapeOf(poly), EX);
    g.translate(0, 0, -(EX.depth + EX.bevelThickness)/2);
    (function(gg){
      const p=gg.attributes.position, uv=gg.attributes.uv;
      for(let i=0;i<p.count;i++) uv.setXY(i, p.getX(i)*.42+.5, p.getY(i)*.42+.5);
      uv.needsUpdate=true;
    })(g);

    const m = new THREE.Mesh(g, [shell, broke]);
    m.visible = false;

    let cx=0, cy=0;
    poly.forEach(p=>{ cx+=p.x; cy+=p.y; });
    cx/=poly.length; cy/=poly.length;

    m.userData = {
      c: new THREE.Vector2(cx, cy),
      dir: new THREE.Vector3(cx, cy+.10, rnd(-.30,1.0)).normalize(),
      vel: new THREE.Vector3(),
      spin: new THREE.Vector3(rnd(-4,4), rnd(-4,4), rnd(-5,5)),
      melt: Math.random() < .42,
      mass: 0.6 + Math.random()*0.8,
      life: 0, delay: 0
    };
    shards.push(m);
    scene.add(m);
  });

  const shardGroup = new THREE.Group();
  shards.forEach(s=>shardGroup.add(s));
  scene.add(shardGroup);

  /* ── the crack front ──────────────────────────────────────── */
  const crackGeo = new THREE.BufferGeometry();
  crackGeo.setAttribute('position', new THREE.Float32BufferAttribute(crackSegs, 3));
  const crackMat = new THREE.ShaderMaterial({
    transparent:true, depthWrite:false, blending:THREE.AdditiveBlending,
    uniforms:{ uImpact:{value:new THREE.Vector2(0,0)}, uFront:{value:-1}, uOp:{value:1} },
    vertexShader:`
      uniform vec2 uImpact; uniform float uFront; varying float vA;
      void main(){
        float d = distance(position.xy, uImpact);
        vA = smoothstep(uFront + 0.22, uFront - 0.10, d);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }`,
    fragmentShader:`
      varying float vA; uniform float uOp;
      void main(){
        if(vA <= 0.001) discard;
        gl_FragColor = vec4(1.0, 0.86, 0.60, vA * uOp);
      }`
  });
  const cracks = new THREE.LineSegments(crackGeo, crackMat);
  cracks.visible = false;
  scene.add(cracks);

  /* ── cocoa dust ───────────────────────────────────────────── */
  const DN = Q.dust;
  const dPos = new Float32Array(DN*3);
  const dHome= new Float32Array(DN*3);
  const dTgt = new Float32Array(DN*3);
  const dSize= new Float32Array(DN);
  const dSeed= new Float32Array(DN);
  const dCol = new Float32Array(DN*3);
  const cA = new THREE.Color(0x3B1E0E), cB = new THREE.Color(0xC9956B);

  for(let i=0;i<DN;i++){
    const x=rnd(-13,13), y=rnd(-8,8), z=rnd(-6,4);
    dPos[i*3]=dHome[i*3]=x; dPos[i*3+1]=dHome[i*3+1]=y; dPos[i*3+2]=dHome[i*3+2]=z;
    const p = OUTLINE[(Math.random()*NPT)|0];
    const k = Math.sqrt(Math.random());
    dTgt[i*3]=p.x*k*SCALE; dTgt[i*3+1]=p.y*k*SCALE; dTgt[i*3+2]=rnd(-.6,.6);
    dSize[i]=rnd(1.0,3.2); dSeed[i]=Math.random()*100;
    const c = cA.clone().lerp(cB, Math.random()*Math.random());
    dCol[i*3]=c.r; dCol[i*3+1]=c.g; dCol[i*3+2]=c.b;
  }
  const dGeo = new THREE.BufferGeometry();
  dGeo.setAttribute('position', new THREE.BufferAttribute(dPos,3));
  dGeo.setAttribute('aSize', new THREE.BufferAttribute(dSize,1));
  dGeo.setAttribute('aSeed', new THREE.BufferAttribute(dSeed,1));
  dGeo.setAttribute('aColor', new THREE.BufferAttribute(dCol,3));

  const dMat = new THREE.ShaderMaterial({
    transparent:true, depthWrite:false, blending:THREE.AdditiveBlending,
    uniforms:{ uT:{value:0}, uMap:{value:OD.SPRITE}, uOp:{value:0}, uPR:{value:renderer.getPixelRatio()} },
    vertexShader:`
      attribute float aSize, aSeed; attribute vec3 aColor;
      uniform float uT, uPR; varying vec3 vC; varying float vA;
      void main(){
        vC = aColor;
        vec3 p = position;
        p.x += sin(uT*.42 + aSeed)*.18;
        p.y += cos(uT*.31 + aSeed*1.7)*.15;
        vA = .30 + .70*abs(sin(uT*.6 + aSeed*3.1));
        vec4 mv = modelViewMatrix * vec4(p,1.0);
        gl_PointSize = aSize * uPR * (170.0 / -mv.z);
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader:`
      uniform sampler2D uMap; uniform float uOp;
      varying vec3 vC; varying float vA;
      void main(){
        vec4 t = texture2D(uMap, gl_PointCoord);
        gl_FragColor = vec4(vC * 1.6, t.a * vA * uOp);
        if(gl_FragColor.a < .008) discard;
      }`
  });
  const dust = new THREE.Points(dGeo, dMat);
  scene.add(dust);

  /* ── drips ────────────────────────────────────────────────── */
  const dripMat = new THREE.MeshPhysicalMaterial({
    color:0x241106, roughness:.10, metalness:.02, clearcoat:1, clearcoatRoughness:.06,
    envMap: env, envMapIntensity:1.6
  });
  const drips = [];
  for(let i=0;i<(TIER==='mobile'?5:10);i++){
    const d = new THREE.Mesh(new THREE.SphereGeometry(rnd(.04,.085), 10, 8), dripMat);
    d.visible = false;
    d.userData = { t: rnd(0,14), lane: rnd(-.6,.6) };
    scene.add(d); drips.push(d);
  }

  /* ── state ────────────────────────────────────────────────── */
  const S = { t:0, phase:'void', crackAt:0, px:0, py:0, done:false };
  const pointer = new THREE.Vector2(-99,-99);
  const ray = new THREE.Raycaster();
  let onDone = null;

  function onMove(x, y){
    S.px = (x/innerWidth)*2 - 1;
    S.py = -(y/innerHeight)*2 + 1;
    pointer.set(S.px, S.py);
  }

  function impactPoint(){
    ray.setFromCamera(pointer, cam);
    const h = ray.intersectObject(heart, false);
    if(h.length){
      const p = heart.worldToLocal(h[0].point.clone());
      return new THREE.Vector2(p.x, p.y);
    }
    return new THREE.Vector2(S.px*1.0, S.py*1.0);
  }

  /* ── the crack ────────────────────────────────────────────── */
  function crack(){
    if(S.phase !== 'invite') return;
    S.phase = 'crack';
    S.crackAt = S.t;

    Snd.crack();
    OD.buzz([16,28,48]);

    const imp = impactPoint();
    crackMat.uniforms.uImpact.value.copy(imp);
    crackMat.uniforms.uFront.value = 0;
    cracks.visible = true;
    cracks.scale.setScalar(SCALE);
    cracks.rotation.copy(heart.rotation);
    cracks.position.copy(heart.position);

    heart.visible = false;
    coreMesh.visible = true;
    coreMesh.scale.setScalar(SCALE*.56);

    shardGroup.scale.setScalar(SCALE);
    shardGroup.rotation.copy(heart.rotation);

    let maxD = 0;
    shards.forEach(sh=>{
      const d = sh.userData.c.distanceTo(imp);
      sh.userData.delay = d * 0.30;
      maxD = Math.max(maxD, d);
      sh.visible = true;
      sh.position.set(0,0,0);
      sh.rotation.set(0,0,0);
      sh.scale.setScalar(1);
      sh.userData.life = 0;
      sh.userData.vel.set(0,0,0);
    });

    // the fracture races outward across the shell
    gsap.to(crackMat.uniforms.uFront, { value: maxD + .5, duration: .80, ease:'power2.out' });
    gsap.to(core, { intensity: 4.6, duration: .62, ease:'power2.out' });
    gsap.to(halo.material, { opacity: .95, duration: .7, ease:'power2.out' });
    gsap.to(dMat.uniforms.uOp, { value: 0, duration: .8 });
    gsap.to(post.uniforms.uBloom, { value: Q.bloom ? 1.5 : 0, duration: .7 });

    // three small settling snaps as it gives way
    [.16,.34,.55].forEach(t=> gsap.delayedCall(t, ()=>Snd.snap()));

    $('#portalCopy').classList.add('gone');
    gsap.delayedCall(.84, burst);
  }

  function burst(){
    S.phase = 'fly';
    shards.forEach(sh=>{
      const u = sh.userData;
      u.vel.copy(u.dir).multiplyScalar(rnd(3.0,6.2) / u.mass);
      u.vel.z += rnd(.8, 3.0);
    });
    gsap.to(crackMat.uniforms.uOp, { value:0, duration:.4 });
    gsap.to(core, { intensity: 14, duration: .9, ease:'power2.in' });
    gsap.to(coreMesh.scale, { x:6.5, y:6.5, z:6.5, duration:1.4, ease:'power2.in' });
    gsap.to(halo.scale, { x:70, y:70, z:70, duration:1.5, ease:'power2.in' });
    gsap.to(post.uniforms.uExposure, { value:1.7, duration:1.3, ease:'power2.in' });
    Snd.whoosh();
    gsap.delayedCall(.68, warp);
  }

  function warp(){
    S.phase = 'warp';
    dMat.uniforms.uOp.value = 0;
    gsap.to(dMat.uniforms.uOp, { value:1, duration:.3 });
    for(let i=0;i<DN;i++){
      dTgt[i*3]   = dPos[i*3]   * 3.6;
      dTgt[i*3+1] = dPos[i*3+1] * 3.6;
      dTgt[i*3+2] = rnd(7, 15);
    }
    gsap.to(cam.position, { z:-8, duration:2.0, ease:'power3.in' });
    gsap.to(post.uniforms.uAberr, { value:.010, duration:1.4, ease:'power2.in' });

    post.fadeTo(0xFFE9C6, 1, 1.05).delay(.62);
    gsap.delayedCall(1.95, ()=>{
      S.done = true;
      if(onDone) onDone();
    });
  }

  /* ── frame ────────────────────────────────────────────────── */
  function update(dt){
    S.t += dt;
    dMat.uniforms.uT.value = S.t;

    // a little handheld life in the camera the whole way through
    if(S.phase !== 'warp'){
      cam.position.x = lerp(cam.position.x, S.px*.55 + Math.sin(S.t*.31)*.13, dt*1.6);
      cam.position.y = lerp(cam.position.y, S.py*.40 + Math.cos(S.t*.27)*.10, dt*1.6);
      cam.lookAt(0,0,0);
    }

    if(S.phase === 'void'){
      dMat.uniforms.uOp.value = Math.min(1, S.t/1.8);
      const mx = S.px*11, my = S.py*6.6;
      for(let i=0;i<DN;i++){
        const ix=i*3;
        let x=dPos[ix], y=dPos[ix+1];
        const dx=x-mx, dy=y-my, d2=dx*dx+dy*dy;
        if(d2 < 9 && d2 > .0001){
          const f = (1 - d2/9) * 4.2 * dt / Math.sqrt(d2);
          x += dx*f; y += dy*f;
        }
        dPos[ix]   = lerp(x, dHome[ix], dt*.5);
        dPos[ix+1] = lerp(y, dHome[ix+1], dt*.5);
        dPos[ix+2] = lerp(dPos[ix+2], dHome[ix+2], dt*.5);
      }
      dGeo.attributes.position.needsUpdate = true;
      if(S.t > (REDUCED?0.8:3.0)) S.phase = 'gather';
    }

    else if(S.phase === 'gather'){
      const span = REDUCED?1.0:2.7;
      const k = clamp((S.t - (REDUCED?0.8:3.0)) / span, 0, 1);
      const e = smooth(k);
      for(let i=0;i<DN;i++){
        const ix=i*3, r = dt*(1.2 + e*6.0);
        dPos[ix]   = lerp(dPos[ix],   dTgt[ix],   r);
        dPos[ix+1] = lerp(dPos[ix+1], dTgt[ix+1], r);
        dPos[ix+2] = lerp(dPos[ix+2], dTgt[ix+2], r);
      }
      dGeo.attributes.position.needsUpdate = true;
      heart.scale.setScalar(SCALE * (e*e*(3-2*e)));
      dMat.uniforms.uOp.value = 1 - e*.78;
      if(k >= 1){
        S.phase = 'invite';
        $('#portalCopy').classList.add('in');
        document.body.classList.add('hammer');
        drips.forEach(d=>d.visible = true);
        OD.buzz(18);
        Snd.chime(396);
      }
    }

    if(S.phase === 'invite' || S.phase === 'gather'){
      heart.rotation.y += dt * 0.0873;             // five degrees a second
      heart.rotation.x = Math.sin(S.t*.30)*.05;
      heart.rotation.z = Math.cos(S.t*.22)*.025;
      drips.forEach(d=>{
        const u = d.userData;
        u.t += dt*.40;
        const ph = (u.t % 5)/5;
        if(ph < .03) u.lane = rnd(-.62,.62);
        d.position.set(
          u.lane*SCALE*.88,
          lerp(1.02, -1.20, ph)*SCALE*.86,
          Math.cos(u.lane*1.5)*.46*SCALE
        );
        d.position.applyAxisAngle(new THREE.Vector3(0,1,0), heart.rotation.y);
        const sc = Math.sin(ph*Math.PI);
        d.scale.setScalar(clamp(sc*1.5, .001, 1.5));
      });
    }

    if(S.phase === 'crack'){
      const el = S.t - S.crackAt;
      shards.forEach(sh=>{
        const u = sh.userData;
        const k = clamp((el - u.delay)/.40, 0, 1);
        const e = k*k;
        sh.position.copy(u.dir).multiplyScalar(e*.20);
        sh.rotation.z = e*.11*(u.c.x>0?1:-1);
        sh.rotation.x = e*.06*(u.c.y>0?1:-1);
      });
      coreMesh.rotation.y += dt*.6;
    }

    if(S.phase === 'fly' || S.phase === 'warp'){
      shards.forEach(sh=>{
        const u = sh.userData;
        u.life += dt;
        u.vel.y -= 3.4*dt;
        sh.position.addScaledVector(u.vel, dt);
        sh.rotation.x += u.spin.x*dt;
        sh.rotation.y += u.spin.y*dt;
        sh.rotation.z += u.spin.z*dt;
        if(u.melt && u.life > .40){
          const m = clamp((u.life-.40)/.85, 0, 1);
          sh.scale.setScalar(clamp(1-m, .001, 1));
          u.vel.y -= 6.0*dt*m;
        }
      });
    }

    if(S.phase === 'warp'){
      for(let i=0;i<DN;i++){
        const ix=i*3;
        dPos[ix]   = lerp(dPos[ix],   dTgt[ix],   dt*2.0);
        dPos[ix+1] = lerp(dPos[ix+1], dTgt[ix+1], dt*2.0);
        dPos[ix+2] = lerp(dPos[ix+2], dTgt[ix+2], dt*2.8);
      }
      dGeo.attributes.position.needsUpdate = true;
    }

    halo.position.set(0,0,-.5);
  }

  function dispose(){
    scene.traverse(o=>{
      if(o.geometry) o.geometry.dispose();
    });
    crackGeo.dispose(); dGeo.dispose();
  }

  return {
    scene, cam, update, crack, onMove, dispose,
    get phase(){ return S.phase; },
    set done(fn){ onDone = fn; },
    begin(){ S.t = 0; S.phase = 'void'; }
  };
};

})(window.OD);
