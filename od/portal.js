/* ══════════════════════════════════════════════════════════════
   THE CHOCOLATE HEART PORTAL

   It does not break. It softens, sags, runs in columns, and finally
   gives way into a pool of liquid chocolate with the light coming up
   through it.

   The melt is a vertex displacement patched into the standard physical
   material through onBeforeCompile, so the chocolate keeps its real
   lighting, clearcoat and environment reflections the whole way down —
   and it costs nothing on the CPU.
   ══════════════════════════════════════════════════════════════ */
(function(OD){
"use strict";

const { TAU, clamp, lerp, rnd, smooth, Q, TIER, REDUCED, Snd, $ } = OD;

OD.Portal = function(renderer, post, env){

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x000000);   // stage one is pure black
  scene.environment = env;

  const cam = new THREE.PerspectiveCamera(42, innerWidth/innerHeight, .1, 140);
  cam.position.set(0, 0, 11.4);

  /* ── lights ───────────────────────────────────────────────── */
  const key = new THREE.DirectionalLight(OD.sc(0xFFD4A0), 2.4);
  key.position.set(-5.4, 6.6, 5.4); scene.add(key);

  const fill = new THREE.DirectionalLight(OD.sc(0xC9956B), .6);
  fill.position.set(5.2, -1.6, 3.2); scene.add(fill);

  const rimL = new THREE.DirectionalLight(OD.sc(0xFFB070), 1.0);
  rimL.position.set(2.4, 1.2, -6.0); scene.add(rimL);

  scene.add(new THREE.AmbientLight(OD.sc(0x2D1810), 1.2));

  const core = new THREE.PointLight(OD.sc(0xFFE0B0), 0, 30, 1.7);
  scene.add(core);

  /* ── the heart ────────────────────────────────────────────── */
  const NPT = 200;
  const OUTLINE = [];
  for(let i=0;i<NPT;i++){
    const t = i/NPT*TAU, st = Math.sin(t);
    OUTLINE.push(new THREE.Vector2(
      (16*st*st*st)/13,
      (13*Math.cos(t) - 5*Math.cos(2*t) - 2*Math.cos(3*t) - Math.cos(4*t))/13 - .18
    ));
  }
  OUTLINE.reverse();

  const SCALE = TIER==='mobile' ? 1.70 : 2.05;
  const H = 1.22;                                    // heart half-height, local

  const shape = new THREE.Shape();
  shape.moveTo(OUTLINE[0].x, OUTLINE[0].y);
  for(let i=1;i<OUTLINE.length;i++) shape.lineTo(OUTLINE[i].x, OUTLINE[i].y);
  shape.closePath();

  const heartGeo = new THREE.ExtrudeGeometry(shape, {
    depth:.62, bevelEnabled:true, bevelThickness:.20, bevelSize:.105,
    bevelSegments: TIER==='mobile'?3:6, curveSegments:3
  });
  heartGeo.center();
  (function fixUV(g){
    const p = g.attributes.position, uv = g.attributes.uv;
    for(let i=0;i<p.count;i++) uv.setXY(i, p.getX(i)*.42+.5, p.getY(i)*.42+.5);
    uv.needsUpdate = true;
  })(heartGeo);

  /* ── the melt ─────────────────────────────────────────────── */
  const uMelt = { value: 0 };
  const uTime = { value: 0 };

  const MELT_GLSL = `
    uniform float uMelt;
    uniform float uMTime;
    float hash21(vec2 p){
      return fract(sin(dot(p, vec2(12.9898,78.233))) * 43758.5453);
    }
    /* smooth, so neighbouring runs blend into each other — a quantised
       hash combs the silhouette into hard vertical bars */
    float vnoise2(vec2 p){
      vec2 i = floor(p), f = fract(p);
      f = f*f*(3.0-2.0*f);
      return mix(mix(hash21(i),            hash21(i+vec2(1.0,0.0)), f.x),
                 mix(hash21(i+vec2(0.0,1.0)), hash21(i+vec2(1.0,1.0)), f.x), f.y);
    }
    vec3 meltPos(vec3 p){
      float m = uMelt;
      if(m <= 0.0001) return p;
      float HH = ${H.toFixed(3)};
      float h = clamp((p.y + HH) / (2.0*HH), 0.0, 1.0);   // 0 bottom, 1 top

      // chocolate does not fall evenly — it runs, and some runs outpace others
      float col = vnoise2(vec2(p.x, p.z) * 2.3);
      float run = 0.55 + col*0.95;

      // it sinks, and the top has furthest to sink
      p.y -= m * (0.35 + h*2.05) * HH * run;

      // it spreads, but only near the base, and never wider than it is tall —
      // a melting thing collapses downward, it does not grow
      float spread = m*m * pow(1.0 - h, 1.7) * 0.72;
      p.x *= 1.0 + spread;
      p.z *= 1.0 + spread;

      // it is liquid now, so it moves
      p.x += sin(uMTime*1.7 + p.y*2.2 + col*6.28) * m * 0.07;
      p.z += cos(uMTime*1.5 + p.y*2.2 + col*6.28) * m * 0.07;

      // it cannot sink through what it is resting on
      float floorY = -HH*1.06;
      p.y = max(p.y, floorY + 0.02*col);
      // and at the end it is a pool, not a heart
      p.y = mix(p.y, floorY + 0.05 + col*0.05, smoothstep(0.58, 1.0, m));
      return p;
    }
  `;

  function meltable(src){
    const m = src.clone();
    m.customProgramCacheKey = ()=>'od-melt';
    m.onBeforeCompile = sh=>{
      sh.uniforms.uMelt  = uMelt;
      sh.uniforms.uMTime = uTime;
      sh.vertexShader = MELT_GLSL + sh.vertexShader;
      sh.vertexShader = sh.vertexShader.replace(
        '#include <begin_vertex>',
        'vec3 transformed = meltPos(vec3(position));'
      );
      /* As it liquefies the surface reads flatter and wetter, so lean the
         normals toward straight up rather than trying to track the sag. */
      sh.vertexShader = sh.vertexShader.replace(
        '#include <beginnormal_vertex>',
        'vec3 objectNormal = normalize(mix(vec3(normal), vec3(0.0,1.0,0.0), uMelt*0.62));'
      );
    };
    return m;
  }

  const shell = meltable(OD.MAT.chocolate);  shell.envMap = env;
  const inner = meltable(OD.MAT.chocolateBreak); inner.envMap = env;

  const heart = new THREE.Mesh(heartGeo, [shell, inner]);
  heart.scale.setScalar(.0001);
  scene.add(heart);

  const FLOOR = -H*SCALE*1.06;

  /* ── the pool it becomes ──────────────────────────────────── */
  const pool = new THREE.Mesh(
    new THREE.CircleGeometry(1, 56),
    new THREE.MeshPhysicalMaterial({
      color: OD.sc(0x2A1408), roughness:.07, metalness:.02,
      clearcoat:1, clearcoatRoughness:.04, envMap:env, envMapIntensity:2.0,
      transparent:true, opacity:0
    })
  );
  pool.rotation.x = -Math.PI/2;
  pool.position.y = FLOOR;
  pool.scale.setScalar(.01);
  scene.add(pool);

  /* light rising up through it as the shell thins */
  const rise = new THREE.Sprite(new THREE.SpriteMaterial({
    map: OD.GLOW, color: OD.sc(0xFFD9A8), transparent:true, opacity:0,
    blending:THREE.AdditiveBlending, depthWrite:false
  }));
  rise.scale.setScalar(6);
  scene.add(rise);

  const halo = new THREE.Sprite(new THREE.SpriteMaterial({
    map: OD.GLOW, color: OD.sc(0xFFC98A), transparent:true, opacity:0,
    blending:THREE.AdditiveBlending, depthWrite:false, depthTest:false
  }));
  halo.scale.setScalar(10);
  scene.add(halo);

  /* ── drips: beading on the face, then running off ─────────── */
  const dripMat = new THREE.MeshPhysicalMaterial({
    color: OD.sc(0x241106), roughness:.08, metalness:.02,
    clearcoat:1, clearcoatRoughness:.05, envMap:env, envMapIntensity:1.8
  });
  const drips = [];
  for(let i=0;i<(TIER==='mobile'?10:22);i++){
    const d = new THREE.Mesh(new THREE.SphereGeometry(1, 10, 8), dripMat);
    d.visible = false;
    d.userData = { t: rnd(0,5), lane: rnd(-.6,.6), r: rnd(.05,.10), falling:false, vy:0 };
    scene.add(d); drips.push(d);
  }
  let dripsRunning = false;

  /* ── cocoa dust ───────────────────────────────────────────── */
  const DN = Q.dust;
  const dPos = new Float32Array(DN*3);
  const dHome= new Float32Array(DN*3);
  const dTgt = new Float32Array(DN*3);
  const dSize= new Float32Array(DN);
  const dSeed= new Float32Array(DN);
  const dCol = new Float32Array(DN*3);
  const cA = OD.sc(0x3B1E0E), cB = OD.sc(0xC9956B);

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
        gl_FragColor = vec4(vC * 1.5, t.a * vA * uOp);
        if(gl_FragColor.a < .008) discard;
      }`
  });
  scene.add(new THREE.Points(dGeo, dMat));

  /* ── state ────────────────────────────────────────────────── */
  const S = { t:0, t0:performance.now(), phase:'void', px:0, py:0, done:false };
  let onDone = null;

  function onMove(x, y){
    S.px = (x/innerWidth)*2 - 1;
    S.py = -(y/innerHeight)*2 + 1;
  }

  /* ══════════════════════════════════════════════════════════
     THE MELT
     ══════════════════════════════════════════════════════════ */
  function crack(){                    // the name the shell calls; it melts
    if(S.phase !== 'invite') return;
    S.phase = 'melt';

    Snd.melt();
    OD.buzz([12,40,12,60]);
    $('#portalCopy').classList.add('gone');

    /* Slow in, then the collapse runs away with itself — the way a thing
       holds its shape right up to the moment it stops holding it. */
    gsap.to(uMelt, { value: 1, duration: REDUCED ? 1.2 : 4.6, ease:'power2.in' });

    // it dulls as it goes soft, then turns glossy again as liquid
    gsap.to(shell, { roughness: .55, duration: 1.6, ease:'power1.out' });
    gsap.to(shell, { roughness: .12, duration: 2.4, delay:1.6, ease:'power1.inOut' });

    gsap.to(pool.scale, { x: SCALE*1.9, y: SCALE*1.9, z: SCALE*1.9,
                          duration: 4.0, delay: .8, ease:'power2.out' });

    gsap.to(core, { intensity: 5.0, duration: 3.2, delay: 1.2, ease:'power2.in' });
    gsap.to(rise.material, { opacity: .85, duration: 2.6, delay: 1.6 });
    gsap.to(rise.scale, { x:16, y:16, z:16, duration: 3.4, delay: 1.6, ease:'power2.in' });
    gsap.to(dMat.uniforms.uOp, { value: 0, duration: 1.6 });

    gsap.delayedCall(.9, ()=>{ dripsRunning = true; });
    gsap.delayedCall(REDUCED ? 1.4 : 4.4, pour);

    /* Everything above rides on requestAnimationFrame, and a backgrounded
       tab has rAF throttled to almost nothing — which would strand you on a
       half-melted heart. setTimeout keeps running, so finish it by hand. */
    setTimeout(()=>{
      if(S.done) return;
      gsap.globalTimeline.getChildren(true,true,true).forEach(t=>t.progress(1));
      if(S.phase !== 'warp') warp();
      setTimeout(()=>{ if(!S.done){ S.done = true; if(onDone) onDone(); } }, 2200);
    }, 12000);
  }

  function pour(){
    S.phase = 'pour';
    Snd.pour();
    gsap.to(core, { intensity: 16, duration: 1.3, ease:'power2.in' });
    gsap.to(halo.material, { opacity: .95, duration: 1.1 });
    gsap.to(halo.scale, { x:64, y:64, z:64, duration: 1.5, ease:'power2.in' });
    gsap.to(post.uniforms.uExposure, { value: 1.5, duration: 1.4, ease:'power2.in' });
    gsap.to(post.uniforms.uBloom, { value: Q.bloom ? 1.6 : 0, duration: 1.0 });
    gsap.delayedCall(1.0, warp);
  }

  function warp(){
    S.phase = 'warp';
    dMat.uniforms.uOp.value = 0;
    gsap.to(dMat.uniforms.uOp, { value: 1, duration: .3 });
    for(let i=0;i<DN;i++){
      dTgt[i*3]   = dPos[i*3]   * 3.6;
      dTgt[i*3+1] = dPos[i*3+1] * 3.6;
      dTgt[i*3+2] = rnd(7, 15);
    }
    gsap.to(cam.position, { z:-8, duration:2.0, ease:'power3.in' });
    gsap.to(post.uniforms.uAberr, { value:.009, duration:1.4, ease:'power2.in' });
    post.fadeTo(0xFFE9C6, 1, 1.05).delay(.62);
    gsap.delayedCall(1.95, ()=>{
      S.done = true;
      if(onDone) onDone();
    });
  }

  /* ── frame ────────────────────────────────────────────────── */
  const AXIS_Y = new THREE.Vector3(0,1,0);

  function update(dt){
    S.t += dt;
    const wall = (performance.now() - S.t0) / 1000;
    dMat.uniforms.uT.value = S.t;
    uTime.value = S.t;

    if(S.phase !== 'warp'){
      const m0 = uMelt.value;
      cam.position.x = lerp(cam.position.x, (S.px*.55 + Math.sin(S.t*.31)*.13)*(1-m0*.7), dt*1.6);
      cam.position.y = lerp(cam.position.y, (S.py*.40 + Math.cos(S.t*.27)*.10) - m0*.55, dt*1.6);
      // follow it down and give the pool room, so the ending stays in frame
      cam.position.z = lerp(cam.position.z, 11.4 + m0*2.6, dt*1.4);
      cam.lookAt(0, -m0*1.15, 0);
    }

    /* stage one — the void */
    if(S.phase === 'void'){
      dMat.uniforms.uOp.value = Math.min(1, wall/1.8);
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
      if(wall > (REDUCED?0.8:3.0)) S.phase = 'gather';
    }

    /* stage two — it gathers */
    else if(S.phase === 'gather'){
      const span = REDUCED?1.0:2.7;
      const k = clamp((wall - (REDUCED?0.8:3.0)) / span, 0, 1);
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
    }

    /* while melting it slumps to a stop rather than going on turning */
    if(S.phase === 'melt' || S.phase === 'pour'){
      heart.rotation.y += dt * 0.0873 * (1 - uMelt.value);
      heart.rotation.x = lerp(heart.rotation.x, 0, dt*1.2);
      heart.rotation.z = lerp(heart.rotation.z, 0, dt*1.2);
      pool.material.opacity = Math.min(.95, uMelt.value*1.5);
    }

    /* the drips */
    const m = uMelt.value;
    drips.forEach(d=>{
      const u = d.userData;
      if(u.falling){
        u.vy -= 9.0*dt;
        d.position.y += u.vy*dt;
        // a falling bead stretches as it picks up speed.
        // the geometry is a UNIT sphere, so u.r IS the finished radius.
        d.scale.set(u.r, u.r*(1.4 + Math.abs(u.vy)*.30), u.r);
        if(d.position.y < FLOOR){
          u.falling = false; u.vy = 0; u.t = rnd(0,3);
        }
        return;
      }
      u.t += dt*(.40 + m*2.4);
      const ph = (u.t % 5)/5;
      if(ph < .03) u.lane = rnd(-.62,.62);
      d.position.set(
        u.lane*SCALE*.88*(1 + m*.6),
        lerp(1.02, -1.20, ph)*SCALE*.86 - m*SCALE*.7,
        Math.cos(u.lane*1.5)*.46*SCALE
      );
      d.position.applyAxisAngle(AXIS_Y, heart.rotation.y);
      const sc = Math.sin(ph*Math.PI);
      d.scale.setScalar(clamp(sc*u.r, .0008, u.r));
      if(dripsRunning && ph > .80 && Math.random() < .05){
        u.falling = true; u.vy = -.4;
      }
    });

    if(S.phase === 'warp'){
      for(let i=0;i<DN;i++){
        const ix=i*3;
        dPos[ix]   = lerp(dPos[ix],   dTgt[ix],   dt*2.0);
        dPos[ix+1] = lerp(dPos[ix+1], dTgt[ix+1], dt*2.0);
        dPos[ix+2] = lerp(dPos[ix+2], dTgt[ix+2], dt*2.8);
      }
      dGeo.attributes.position.needsUpdate = true;
    }

    core.position.set(0, FLOOR + .5, 0);
    rise.position.set(0, FLOOR + .3, 0);
    halo.position.set(0, FLOOR + .8, -.5);
  }

  return {
    scene, cam, update, crack, onMove,
    get phase(){ return S.phase; },
    set done(fn){ onDone = fn; },
    begin(){ S.t = 0; S.t0 = performance.now(); S.phase = 'void'; uMelt.value = 0; }
  };
};

})(window.OD);
