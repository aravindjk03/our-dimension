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

  /* "A & D" — taken from the two names rather than hard-coded, so changing
     the config in the database changes what the heart carries. */
  const CFG_INITIALS = (OD.CFG.him.name.charAt(0) + ' & ' + OD.CFG.her.name.charAt(0)).toUpperCase();

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
  /* Project the chocolate grain flat across the FACES only. The extruded side
     wall has its own arc-length UVs; overwriting those with an x/y projection
     gives every vertex along the extrusion the same coordinate and smears the
     texture into a comb of vertical stripes down the rim. */
  (function fixUV(g){
    const p = g.attributes.position, uv = g.attributes.uv;
    g.groups.forEach(gr=>{
      if(gr.materialIndex !== 0) return;               // 0 = caps, 1 = wall
      const end = gr.start + gr.count;
      for(let i=gr.start;i<end;i++) uv.setXY(i, p.getX(i)*.42+.5, p.getY(i)*.42+.5);
    });
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

  /* ── the initials, pressed into the face ──────────────────────
     Drawn as an engraving rather than printed on: a pale copy offset
     down and right where the cut would catch the key light, and a dark
     copy on top for the shadowed upper wall. It rides on the heart, so
     it turns with it, and it only appears once there is a face to press
     it into. */
  const initials = (function(){
    const W = 512, Hh = 256;
    const c = document.createElement('canvas'); c.width = W; c.height = Hh;
    const g = c.getContext('2d');

    function draw(){
      g.clearRect(0,0,W,Hh);
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.font = 'italic 600 128px "Cormorant Garamond", Georgia, serif';
      // the lit lower wall of the groove
      g.fillStyle = 'rgba(255, 226, 184, 0.55)';
      g.fillText(CFG_INITIALS, W/2 + 3, Hh/2 + 3);
      // the shadowed upper wall
      g.fillStyle = 'rgba(28, 12, 4, 0.72)';
      g.fillText(CFG_INITIALS, W/2, Hh/2);
      if(tx) tx.needsUpdate = true;
    }
    let tx = null;
    draw();
    /* the webfont usually is not there yet at boot, so draw it again once it is */
    if(document.fonts && document.fonts.ready) document.fonts.ready.then(draw).catch(()=>{});

    tx = new THREE.CanvasTexture(c);
    tx.encoding = THREE.sRGBEncoding;
    const m = new THREE.Mesh(
      new THREE.PlaneGeometry(1.42, 0.71),
      new THREE.MeshBasicMaterial({ map:tx, transparent:true, opacity:0, depthWrite:false })
    );
    m.position.set(0, -0.04, 0.515);     // just proud of the front face
    heart.add(m);
    return m;
  })();

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
    /* the dust settles into a POOL on the floor, not into a heart — the
       heart is the thing you make out of it */
    const a = Math.random()*TAU, k = Math.sqrt(Math.random());
    dTgt[i*3]   = Math.cos(a)*k*SCALE*1.55;
    dTgt[i*3+1] = (-H*SCALE*1.06) + rnd(0, .30);
    dTgt[i*3+2] = Math.sin(a)*k*SCALE*1.55;
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
  /* `form` is the whole interaction: 0 is a pool of molten chocolate on the
     floor, 1 is a finished heart. You drive it yourself by scrolling, so the
     heart comes back together under your hand rather than on a timer. */
  const S = { t:0, t0:performance.now(), phase:'void', px:0, py:0,
              done:false, form:0, wantForm:0, drawn:0 };
  let onDone = null;

  function onMove(x, y){
    S.px = (x/innerWidth)*2 - 1;
    S.py = -(y/innerHeight)*2 + 1;
  }

  /* ══════════════════════════════════════════════════════════
     GATHERING IT BACK
     The pool on the floor is where you start. Scrolling runs the melt
     backwards: the chocolate climbs out of the puddle and closes into a
     heart under your hand, at whatever speed you move. When it is whole,
     it draws you through itself.
     ══════════════════════════════════════════════════════════ */
  function scroll(delta){
    /* Scrolling during the opening seconds used to go nowhere. Let it bank
       instead, so an impatient hand is rewarded the moment the pool lands. */
    if(S.phase !== 'pool' && S.phase !== 'void' && S.phase !== 'gather') return;
    S.wantForm = clamp(S.wantForm + delta * 0.00090, 0, 1);
    if(!S.heard && S.wantForm > 0.02 && S.phase === 'pool'){
      S.heard = true; Snd.gather();
    }
  }

  /* A tap nudges it along too — nobody should be left hunting for a wheel. */
  function crack(){
    scroll(300);          // scroll() decides what is allowed and what banks
  }

  function complete(){
    if(S.phase !== 'pool') return;
    S.phase = 'formed';
    $('#portalCopy').classList.add('gone');
    Snd.chime(528);
    gsap.delayedCall(.45, function(){ Snd.chime(792); });
    OD.buzz([14,50,14,90]);
    gsap.to(core, { intensity: 7.0, duration: 1.1, ease:'power2.out' });
    gsap.to(pool.material, { opacity: 0, duration: 1.1 });
    gsap.to(rise.material, { opacity: 0, duration: .9 });
    gsap.delayedCall(1.15, drawIn);
  }

  /* and then it takes you in */
  function drawIn(){
    S.phase = 'drawin';
    Snd.whoosh();
    gsap.to(S, { drawn: 1, duration: 2.5, ease:'power2.in' });
    gsap.to(cam, { fov: 88, duration: 2.5, ease:'power2.in',
      onUpdate: function(){ cam.updateProjectionMatrix(); } });
    gsap.to(core, { intensity: 24, duration: 2.1, ease:'power2.in' });
    gsap.to(halo.material, { opacity: .95, duration: 1.4 });
    gsap.to(halo.scale, { x:72, y:72, z:72, duration: 2.1, ease:'power2.in' });
    gsap.to(post.uniforms.uExposure, { value: 1.55, duration: 2.1, ease:'power2.in' });
    gsap.to(post.uniforms.uBloom, { value: Q.bloom ? 1.7 : 0, duration: 1.4 });
    gsap.delayedCall(2.0, warp);

    /* rAF is throttled to nothing on a backgrounded tab, which would strand
       you inside the heart. setTimeout keeps firing, so finish it by hand. */
    setTimeout(function(){
      if(S.done) return;
      gsap.globalTimeline.getChildren(true,true,true).forEach(function(t){ t.progress(1); });
      if(S.phase !== 'warp') warp();
      setTimeout(function(){ if(!S.done){ S.done = true; if(onDone) onDone(); } }, 2200);
    }, 9000);
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

    if(S.phase === 'drawin'){
      /* straight through the middle of it */
      cam.position.x = lerp(cam.position.x, 0, dt*4);
      cam.position.y = lerp(cam.position.y, 0, dt*4);
      cam.position.z = lerp(11.4, 0.55, S.drawn);
      cam.lookAt(0, 0, 0);
    }
    else if(S.phase !== 'warp'){
      const m0 = uMelt.value;
      cam.position.x = lerp(cam.position.x, (S.px*.55 + Math.sin(S.t*.31)*.13)*(1-m0*.7), dt*1.6);
      cam.position.y = lerp(cam.position.y, (S.py*.40 + Math.cos(S.t*.27)*.10) - m0*.55, dt*1.6);
      // stand back while it is a puddle, come in as the heart closes
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
        /* what the dust settles into is a PUDDLE, not a heart */
        S.phase = 'pool';
        uMelt.value = 1;
        pool.material.opacity = .95;
        pool.scale.setScalar(SCALE*1.75);
        $('#portalCopy').classList.add('in');
        drips.forEach(d=>d.visible = true);
        OD.buzz(18);
        Snd.chime(396);
      }
    }

    /* ── the pool, waiting for you to gather it ── */
    else if(S.phase === 'pool'){
      S.form = lerp(S.form, S.wantForm, dt*4.2);
      uMelt.value = 1 - S.form;

      const f = S.form;
      // the puddle shrinks as the chocolate climbs out of it
      pool.scale.setScalar(SCALE*1.75*(1 - f*0.92) + 0.001);
      pool.material.opacity = .95*(1 - f*0.95);
      // and the light inside it grows as it closes over
      core.intensity = f*f*3.2;
      rise.material.opacity = Math.max(0, .55 - f*.55);
      rise.scale.setScalar(6 + f*4);
      // it only starts turning once there is enough of a heart to turn
      heart.rotation.y += dt * 0.0873 * f;
      heart.rotation.x = Math.sin(S.t*.30)*.05*f;
      heart.rotation.z = Math.cos(S.t*.22)*.025*f;
      // and there is no face to press the initials into until the end
      initials.material.opacity = smooth(clamp((f - 0.74)/0.26, 0, 1)) * 0.92;

      if(S.wantForm >= 0.999 && S.form > 0.985) complete();
    }

    /* ── formed, and about to take you in ── */
    else if(S.phase === 'formed' || S.phase === 'drawin'){
      uMelt.value = 0;
      initials.material.opacity = 0.92;
      heart.rotation.y += dt * 0.0873;
      heart.rotation.x = lerp(heart.rotation.x, 0, dt*2.0);
      heart.rotation.z = lerp(heart.rotation.z, 0, dt*2.0);
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
    scene, cam, update, crack, scroll, onMove,
    get phase(){ return S.phase; },
    get form(){ return S.form; },
    set done(fn){ onDone = fn; },
    begin(){
      S.t = 0; S.t0 = performance.now(); S.phase = 'void';
      S.form = 0; S.wantForm = 0; S.drawn = 0; S.heard = false;
      uMelt.value = 1;                       // it starts as a puddle
      cam.fov = 42; cam.updateProjectionMatrix();
    }
  };
};

})(window.OD);
