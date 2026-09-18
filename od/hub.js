/* ══════════════════════════════════════════════════════════════
   THE FLOATING ISLANDS HUB + THE TREE OF TIME
   ══════════════════════════════════════════════════════════════ */
(function(OD){
"use strict";

const { TAU, clamp, lerp, rnd, Q, TIER, Snd, $, fbm, Days, CFG } = OD;

/* time of day drives the whole palette */
OD.skyMood = function(){
  const n = new Date();
  const h = n.getHours() + n.getMinutes()/60;
  if(h>=5 && h<8)   return { id:'dawn',  top:0x2A2450, mid:0xE8A07A, bot:0xFFC9A0, sun:0xFFD9A8, night:0.10, name:'dawn',        env:'warm' };
  if(h>=8 && h<17)  return { id:'day',   top:0x24508C, mid:0x6D9FC4, bot:0xE0A868, sun:0xFFDFA6, night:0.00, name:'golden hour', env:'day'  };
  if(h>=17 && h<20) return { id:'dusk',  top:0x2B1B4A, mid:0x8E4A7C, bot:0xE9885E, sun:0xFFB98A, night:0.24, name:'dusk',        env:'warm' };
  return              { id:'night', top:0x05060F, mid:0x101C3A, bot:0x243258, sun:0x8FA8D8, night:1.00, name:'night',       env:'night' };
};

OD.season = function(){
  const m = new Date().getMonth();
  if(m<=1 || m===11) return 'winter';
  if(m<=4) return 'spring';
  if(m<=7) return 'summer';
  return 'autumn';
};

OD.Hub = function(renderer, post, env, mood){
  const MOOD = mood;
  const SEASON = OD.season();

  const scene = new THREE.Scene();
  scene.environment = env;
  const cam = new THREE.PerspectiveCamera(50, innerWidth/innerHeight, .3, 1200);
  scene.fog = new THREE.Fog(OD.sc(MOOD.mid).lerp(OD.sc(MOOD.bot),.45), 150, 470);

  /* ── sky ──────────────────────────────────────────────────── */
  const sky = new THREE.Mesh(
    new THREE.SphereGeometry(520, 48, 30),
    new THREE.ShaderMaterial({
      side: THREE.BackSide, depthWrite: false,
      uniforms:{
        uTop:{value:OD.sc(MOOD.top)}, uMid:{value:OD.sc(MOOD.mid)},
        uBot:{value:OD.sc(MOOD.bot)}, uSun:{value:OD.sc(MOOD.sun)},
        uNight:{value:MOOD.night}, uT:{value:0}, uTint:{value:0}
      },
      vertexShader:`varying vec3 vP; void main(){ vP = normalize(position);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
      fragmentShader:`
        varying vec3 vP;
        uniform vec3 uTop,uMid,uBot,uSun; uniform float uNight,uT,uTint;
        float h21(vec2 p){ return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453); }
        float vnoise(vec2 p){
          vec2 i=floor(p), f=fract(p); f=f*f*(3.0-2.0*f);
          return mix(mix(h21(i),h21(i+vec2(1,0)),f.x),
                     mix(h21(i+vec2(0,1)),h21(i+vec2(1,1)),f.x), f.y);
        }
        float fbm2(vec2 p){
          float s=0.0,a=0.5;
          for(int i=0;i<5;i++){ s+=vnoise(p)*a; p*=2.03; a*=0.5; }
          return s;
        }
        void main(){
          float y = clamp(vP.y*0.5+0.5, 0.0, 1.0);
          vec3 c = mix(uBot, uMid, smoothstep(0.32,0.56,y));
          c = mix(c, uTop, smoothstep(0.55,0.95,y));

          vec3 sd = normalize(vec3(-0.82,0.18,0.54));
          float s = max(dot(vP,sd),0.0);
          c += uSun * pow(s,26.0) * 1.05;
          c += uSun * pow(s, 4.0) * 0.09;

          // high cirrus, drifting
          vec2 cp = vP.xz / max(abs(vP.y)+0.22, 0.22);
          float cl = fbm2(cp*1.5 + vec2(uT*0.012, uT*0.007));
          cl = smoothstep(0.52, 0.86, cl) * smoothstep(0.02, 0.32, vP.y);
          c = mix(c, mix(uBot, vec3(1.0), 0.30), cl * (0.24 - uNight*0.16));

          if(uNight > 0.02){
            vec2 g = floor(vP.xz*300.0 + vP.y*110.0);
            float st = h21(g);
            float tw = 0.5 + 0.5*sin(uT*1.7 + st*40.0);
            c += vec3(smoothstep(0.9977,1.0,st) * tw * uNight) * 1.7;
            float rib = sin(vP.x*2.6 + uT*0.15) * cos(vP.z*1.9 - uT*0.10);
            float band = smoothstep(0.30,0.92,vP.y) * smoothstep(0.42,0.98,rib);
            c += vec3(0.24,0.70,0.58) * band * 0.26 * uNight;
          }
          c = mix(c, vec3(1.0,0.76,0.70), uTint*0.55);
          gl_FragColor = vec4(c,1.0);
        }`
    })
  );
  scene.add(sky);

  /* ── light ────────────────────────────────────────────────── */
  const sun = new THREE.DirectionalLight(OD.sc(MOOD.sun), MOOD.id==='night' ? .45 : 1.55);
  sun.position.set(-90, 56, 58);
  scene.add(sun);
  scene.add(new THREE.AmbientLight(OD.sc(MOOD.mid), MOOD.id==='night' ? .5 : .8));
  scene.add(new THREE.HemisphereLight(OD.sc(MOOD.bot), OD.sc(0x1B1208), .6));

  /* ── distant range ────────────────────────────────────────── */
  (function mountains(){
    const v=[], R=380;
    for(let i=0;i<84;i++){
      const a0=i/84*TAU, a1=(i+1)/84*TAU;
      const h0 = 34 + fbm(Math.cos(a0)*2.4,0,Math.sin(a0)*2.4)*34;
      const h1 = 34 + fbm(Math.cos(a1)*2.4,0,Math.sin(a1)*2.4)*34;
      const x0=Math.cos(a0)*R, z0=Math.sin(a0)*R, x1=Math.cos(a1)*R, z1=Math.sin(a1)*R;
      v.push(x0,-56,z0, x1,-56,z1, x1,h1-56,z1);
      v.push(x0,-56,z0, x1,h1-56,z1, x0,h0-56,z0);
    }
    const g=new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(v,3));
    const c = OD.sc(MOOD.top).lerp(OD.sc(MOOD.mid), .38);
    scene.add(new THREE.Mesh(g, new THREE.MeshBasicMaterial({
      color:c, transparent:true, opacity:.6, fog:false })));
  })();

  /* ── island factory ───────────────────────────────────────── */
  function island(r, depth, seed, topHex, rockHex){
    const geo = new THREE.IcosahedronGeometry(r, TIER==='mobile'?2:3);
    const pos = geo.attributes.position;
    const cols = new Float32Array(pos.count*3);
    const top = OD.sc(topHex), rock = OD.sc(rockHex);
    const plateau = r*0.14;
    for(let i=0;i<pos.count;i++){
      let x=pos.getX(i), y=pos.getY(i), z=pos.getZ(i);
      const n = fbm(x*.34+seed, y*.34, z*.34+seed);
      if(y > 0){
        y = plateau + n*r*.06;
        x += n*r*.05; z += n*r*.05;
      } else {
        const t = clamp(-y/r, 0, 1);
        const taper = Math.pow(1-t, .55);
        y = -depth*Math.pow(t,.76);
        x = x*taper*1.06 + n*r*.18*t;
        z = z*taper*1.06 + n*r*.18*t;
      }
      pos.setXYZ(i,x,y,z);
      const c = (y > plateau*.6)
        ? top.clone().lerp(rock, Math.random()*.22)
        : rock.clone().lerp(top, clamp(.5 + y/(depth*.9), 0, 1)*.26);
      cols[i*3]=c.r; cols[i*3+1]=c.g; cols[i*3+2]=c.b;
    }
    geo.setAttribute('color', new THREE.BufferAttribute(cols,3));
    geo.computeVertexNormals();
    return new THREE.Mesh(geo, new THREE.MeshStandardMaterial({
      vertexColors:true, roughness:.95, metalness:0, flatShading:true,
      normalMap: OD.MAT.rockNormal, normalScale:new THREE.Vector2(.6,.6),
      envMapIntensity:.55
    }));
  }

  /* ── the places ───────────────────────────────────────────── */
  const ISLANDS = [
    { key:'tree',     title:'The Tree of Time',    meta:'every second of it',   pos:new THREE.Vector3(0,0,0),      r:15,  depth:26, top:0x5E8A4A, rock:0x5A4233, live:true },
    { key:'letters',  title:'The Treehouse',       meta:'letters',              pos:new THREE.Vector3(40,14,-36),  r:8.8, depth:14, top:0x6A8F52, rock:0x5E4534, live:true },
    { key:'tower',    title:'The Crystal Tower',   meta:'memories',             pos:new THREE.Vector3(58,4,8),     r:8.2, depth:16, top:0x7FA3B8, rock:0x53566B, live:true },
    { key:'campfire', title:'The Campfire',        meta:'today’s question',     pos:new THREE.Vector3(36,-8,40),   r:9.4, depth:13, top:0x48603C, rock:0x4A3A2E, live:true },
    { key:'lanterns', title:'The Lantern Pad',     meta:'wishes',               pos:new THREE.Vector3(-10,-15,54), r:7.8, depth:12, top:0x8C8574, rock:0x554B40, live:true },
    { key:'cave',     title:'The Underwater Cave', meta:'ours only',            pos:new THREE.Vector3(-14,-64,14), r:0,   depth:0,  top:0, rock:0, live:true, viaRune:true }
  ];

  const groups = {};
  ISLANDS.forEach(is=>{
    if(is.viaRune) return;
    const g = new THREE.Group();
    g.position.copy(is.pos);
    g.add(island(is.r, is.depth, is.pos.x*.07 + is.pos.z*.03, is.top, is.rock));
    g.userData = { base:is.pos.clone(), ph:Math.random()*TAU, key:is.key };
    scene.add(g);
    groups[is.key] = g;
  });

  /* ── landmarks ────────────────────────────────────────────── */
  (function dress(){
    const warmGlow = h => new THREE.SpriteMaterial({
      map:OD.GLOW, color:h, transparent:true, opacity:.9,
      blending:THREE.AdditiveBlending, depthWrite:false });

    // treehouse
    const th = groups.letters;
    const tr = new THREE.Mesh(new THREE.CylinderGeometry(.55,.95,8,9), OD.MAT.bark);
    tr.position.y = 5.0; th.add(tr);
    const cab = new THREE.Mesh(new THREE.BoxGeometry(3.8,2.9,3.3), OD.MAT.wood);
    cab.position.y = 9.2; cab.rotation.y = .42; th.add(cab);
    const win = new THREE.Mesh(new THREE.CircleGeometry(.72,18),
      new THREE.MeshBasicMaterial({ color: OD.sc(0xFFCE96) }));
    win.position.set(1.52,9.4,1.30); win.rotation.y=.42; th.add(win);
    const roof = new THREE.Mesh(new THREE.ConeGeometry(3.2,1.9,4), OD.MAT.woodDark);
    roof.position.y = 11.5; roof.rotation.y = .42+Math.PI/4; th.add(roof);
    const tl = new THREE.PointLight(OD.sc(0xFFB460), 2.2, 26, 2); tl.position.set(0,9.3,0); th.add(tl);
    for(let i=0;i<9;i++){
      const s = new THREE.Sprite(warmGlow(0xFFC98A));
      s.scale.setScalar(1.7);
      const a=i/9*TAU;
      s.position.set(Math.cos(a)*5.6, 6.8+Math.sin(i*2.1)*1.7, Math.sin(a)*5.6);
      th.add(s);
    }

    // crystal tower
    const ct = groups.tower;
    const crystalMat = new THREE.MeshPhysicalMaterial({
      color: OD.sc(0xD6E2F5), roughness:.06, metalness:0, transmission: OD.tr(.9), thickness:3.0,
      transparent:true, opacity:.9, clearcoat:1, ior:1.7, envMap:env, envMapIntensity:2.2
    });
    const spire = new THREE.Mesh(new THREE.ConeGeometry(3.2, 24, 6), crystalMat);
    spire.position.y = 13.4; ct.add(spire);
    const s2 = new THREE.Mesh(new THREE.ConeGeometry(1.6, 11, 6), crystalMat);
    s2.position.set(3.4,7.0,1.5); s2.rotation.z=-.16; ct.add(s2);
    const s3 = new THREE.Mesh(new THREE.ConeGeometry(1.1, 7, 5), crystalMat);
    s3.position.set(-2.8,5.2,-1.4); s3.rotation.z=.2; ct.add(s3);
    const cl = new THREE.PointLight(OD.sc(0xBFD8FF), 1.8, 40, 2); cl.position.y=14; ct.add(cl);

    // campfire
    const cf = groups.campfire;
    for(let i=0;i<6;i++){
      const log = new THREE.Mesh(new THREE.CylinderGeometry(.26,.26,2.8,7), OD.MAT.woodDark);
      const a=i/6*TAU;
      log.position.set(Math.cos(a)*.8, 1.7, Math.sin(a)*.8);
      log.rotation.set(Math.PI/2.3, a, 0);
      cf.add(log);
    }
    const flame = new THREE.Sprite(warmGlow(0xFF9640));
    flame.scale.set(3.4,5.0,1); flame.position.y=3.6; cf.add(flame);
    cf.userData.flame = flame;
    const fl = new THREE.PointLight(OD.sc(0xFF8A3C), 3.2, 40, 2); fl.position.y=3.6; cf.add(fl);
    cf.userData.flight = fl;
    for(let i=0;i<11;i++){
      const t = new THREE.Mesh(new THREE.ConeGeometry(1.2,5.0,5),
        new THREE.MeshStandardMaterial({ color: OD.sc(0x1E2C1C), roughness:1, envMapIntensity:.3 }));
      const a=i/11*TAU + .3;
      t.position.set(Math.cos(a)*7.0, 3.8, Math.sin(a)*7.0);
      cf.add(t);
    }

    // lantern pad
    const lp = groups.lanterns;
    const pad = new THREE.Mesh(new THREE.CylinderGeometry(4.8,5.0,.7,18),
      new THREE.MeshStandardMaterial({ color: OD.sc(0x8A8272), roughness:.94,
        normalMap:OD.MAT.rockNormal, normalScale:new THREE.Vector2(.5,.5) }));
    pad.position.y=1.7; lp.add(pad);
    const stand = new THREE.Mesh(new THREE.CylinderGeometry(.18,.22,1.8,7), OD.MAT.woodDark);
    stand.position.y=2.9; lp.add(stand);
    const lant = new THREE.Mesh(new THREE.CylinderGeometry(.78,.66,1.4,9),
      new THREE.MeshStandardMaterial({ color: OD.sc(0xE8D8B8), roughness:.8, transparent:true, opacity:.66 }));
    lant.position.y=4.4; lp.add(lant);
    lp.userData.lantern = lant;
  })();

  /* ── particle bridges ─────────────────────────────────────── */
  (function bridges(){
    if(!Q.bridge) return;
    const pts=[], cols=[];
    const c1=OD.sc(0xFFD9A8), c2=OD.sc(0xF3A0B8);
    ISLANDS.filter(i=>!i.viaRune && i.key!=='tree').forEach((is,idx)=>{
      const curve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(0,2,0),
        new THREE.Vector3(is.pos.x*.35, is.pos.y*.4+11, is.pos.z*.35),
        new THREE.Vector3(is.pos.x*.72, is.pos.y*.8+6,  is.pos.z*.72),
        is.pos.clone().add(new THREE.Vector3(0,3,0))
      ]);
      for(let i=0;i<Q.bridge;i++){
        const p = curve.getPoint(i/Q.bridge);
        pts.push(p.x+rnd(-.8,.8), p.y+rnd(-.8,.8), p.z+rnd(-.8,.8));
        const c = c1.clone().lerp(c2, (idx%2)?.55:.12);
        cols.push(c.r,c.g,c.b);
      }
    });
    const g=new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pts,3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(cols,3));
    scene.add(new THREE.Points(g, new THREE.PointsMaterial({
      size:1.7, map:OD.SPRITE, vertexColors:true, transparent:true, opacity:.5,
      blending:THREE.AdditiveBlending, depthWrite:false })));
  })();

  /* ── motes / fireflies ────────────────────────────────────── */
  const moteMat = (function(){
    const n = Q.motes;
    const p = new Float32Array(n*3), s = new Float32Array(n);
    for(let i=0;i<n;i++){
      p[i*3]=rnd(-100,100); p[i*3+1]=rnd(-40,60); p[i*3+2]=rnd(-100,100);
      s[i]=Math.random()*100;
    }
    const g=new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(p,3));
    g.setAttribute('aSeed', new THREE.BufferAttribute(s,1));
    const m = new THREE.ShaderMaterial({
      transparent:true, depthWrite:false, blending:THREE.AdditiveBlending,
      uniforms:{ uT:{value:0}, uMap:{value:OD.SPRITE}, uPR:{value:renderer.getPixelRatio()},
        uCol:{value:OD.sc(MOOD.id==='night'?0xC4F58E:0xFFD9A8)}, uNight:{value:MOOD.night} },
      vertexShader:`
        attribute float aSeed; uniform float uT,uPR,uNight; varying float vA;
        void main(){
          vec3 p = position;
          p.y += sin(uT*.30 + aSeed)*1.9;
          p.x += cos(uT*.22 + aSeed*1.3)*1.6;
          float blink = uNight > .5 ? step(.42, fract(sin(aSeed*91.0)*43758.0 + uT*.28)) : 1.0;
          vA = blink * (.30 + .70*abs(sin(uT*.5 + aSeed*2.0)));
          vec4 mv = modelViewMatrix*vec4(p,1.0);
          gl_PointSize = (uNight>.5 ? 3.8 : 2.4) * uPR * (180.0/-mv.z);
          gl_Position = projectionMatrix*mv;
        }`,
      fragmentShader:`
        uniform sampler2D uMap; uniform vec3 uCol; varying float vA;
        void main(){ vec4 t=texture2D(uMap,gl_PointCoord);
          gl_FragColor=vec4(uCol*1.4, t.a*vA*.85); if(gl_FragColor.a<.01) discard; }`
    });
    scene.add(new THREE.Points(g,m));
    return m;
  })();

  /* ══ THE TREE ═══════════════════════════════════════════════ */
  const Tree = (function(){
    const root = new THREE.Group();
    root.position.set(0, 2.2, 0);
    groups.tree.add(root);
    const extras = new THREE.Group();
    root.add(extras);

    let leafPts=null, flyPts=null, built=-1;

    const NAME = [
      'A sprout with two leaves',
      'A sapling finding its feet',
      'A young tree, first buds',
      'Full canopy, first bloom',
      'Tall enough for fireflies',
      'Old enough to have rings',
      'Initials carved in the trunk',
      'Roots grown into a bench'
    ];
    const ERA = ['days 1–7','weeks 2–4','months 2–3','months 4–6','months 7–12','year one','year two','year three and on'];
    const SPEC = [
      { h:1.0,  rad:.09, depth:0, leaves:2,    spread:.4 },
      { h:2.6,  rad:.17, depth:1, leaves:16,   spread:1.1 },
      { h:5.0,  rad:.34, depth:2, leaves:320,  spread:2.2 },
      { h:7.8,  rad:.56, depth:3, leaves:1100, spread:3.4 },
      { h:10.6, rad:.80, depth:4, leaves:2400, spread:4.7 },
      { h:13.8, rad:1.14,depth:4, leaves:4200, spread:6.1 },
      { h:16.0, rad:1.36,depth:5, leaves:5600, spread:7.0 },
      { h:17.8, rad:1.58,depth:5, leaves:7000, spread:7.7 }
    ];
    const LEAFCOL = {
      spring:[0x8FCB6B,0xB8E08C,0xF6B7CE], summer:[0x4E9E4A,0x6FBF5A,0x9ED97E],
      autumn:[0xE08A3C,0xC9552E,0xE8B65A], winter:[0x7E8EA0,0x9FB0BE,0xD6E2EA]
    }[SEASON];

    function stageOf(d){
      return d<7?0 : d<28?1 : d<90?2 : d<180?3 : d<365?4 : d<730?5 : d<1095?6 : 7;
    }

    const tips = [];
    function limb(from, dir, len, rad, depth, max){
      const to = from.clone().addScaledVector(dir, len);
      const m = new THREE.Mesh(
        new THREE.CylinderGeometry(rad*.66, rad, len, depth>2?5:7, 1), OD.MAT.bark);
      m.position.copy(from).addScaledVector(dir, len/2);
      m.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0), dir.clone().normalize());
      extras.add(m);
      if(depth>=max || len<.35){ tips.push(to.clone()); return; }
      const n = depth===0 ? 3 : (Math.random()<.34 ? 3 : 2);
      for(let i=0;i<n;i++){
        const a = (i/n)*TAU + rnd(-.5,.5) + depth;
        const tilt = rnd(.42,.88);
        const d = new THREE.Vector3(Math.cos(a)*tilt, 1-tilt*.42, Math.sin(a)*tilt).normalize();
        d.lerp(dir, .30).normalize();
        limb(to, d, len*rnd(.60,.78), rad*.62, depth+1, max);
      }
    }

    function build(stage){
      if(built === stage) return;
      built = stage;
      while(extras.children.length) extras.remove(extras.children[0]);
      tips.length = 0;
      leafPts = flyPts = null;
      const S = SPEC[stage];

      const segs = Math.max(3, Math.round(S.h*1.5));
      let p = new THREE.Vector3(0,0,0);
      for(let i=0;i<segs;i++){
        const t0=i/segs, t1=(i+1)/segs, len=S.h/segs;
        const sway = new THREE.Vector3(Math.sin(t0*3.1)*.09, 1, Math.cos(t0*2.3)*.07).normalize();
        const m = new THREE.Mesh(new THREE.CylinderGeometry(
          S.rad*(1-t1*.62), S.rad*(1-t0*.62), len, 10, 1), OD.MAT.bark);
        m.position.copy(p).addScaledVector(sway, len/2);
        m.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0), sway);
        extras.add(m);
        p = p.clone().addScaledVector(sway, len);
      }

      if(S.depth > 0){
        const n = stage<3 ? 3 : 4;
        for(let i=0;i<n;i++){
          const a=i/n*TAU + .6, tilt=rnd(.5,.82);
          const d=new THREE.Vector3(Math.cos(a)*tilt, 1-tilt*.4, Math.sin(a)*tilt).normalize();
          limb(p.clone(), d, S.h*rnd(.28,.40), S.rad*.58, 1, S.depth);
        }
      } else tips.push(p.clone());

      /* ── the canopy ──────────────────────────────────────────
         A handful of small points at the branch tips reads as a bare
         winter tree. A canopy needs mass: big overlapping clumps, packed
         densely enough to overdraw, thinning toward the inside the way a
         real crown is hollow, and shaded so the whole thing has a lit
         side and a shadowed side rather than looking flat.            */
      const LN = Math.min(S.leaves, Q.leaves);
      if(LN>0 && tips.length){
        const lp=new Float32Array(LN*3), lc=new Float32Array(LN*3),
              ls=new Float32Array(LN), sd=new Float32Array(LN),
              ln=new Float32Array(LN*3);
        const pal = LEAFCOL.map(h=>OD.sc(h));

        // the volume the crown actually occupies
        const cen = new THREE.Vector3();
        tips.forEach(t=>cen.add(t));
        cen.multiplyScalar(1/tips.length);
        let rad = 0;
        tips.forEach(t=>{ rad = Math.max(rad, t.distanceTo(cen)); });
        rad = Math.max(rad, S.spread*.8);

        const tmp = new THREE.Vector3();
        for(let i=0;i<LN;i++){
          // two thirds cluster tightly on a tip, the rest fill the crown
          if(i % 3){
            const t = tips[(Math.random()*tips.length)|0];
            const clump = S.spread*.30;
            tmp.set(
              t.x + rnd(-1,1)*clump,
              t.y + rnd(-.8,.7)*clump*.85,
              t.z + rnd(-1,1)*clump
            );
          } else {
            // biased outward, so the middle stays open like a real crown
            const u = Math.random()*TAU, v = Math.acos(rnd(-1,.55));
            const rr = rad * (0.62 + 0.38*Math.cbrt(Math.random()));
            tmp.set(
              cen.x + Math.sin(v)*Math.cos(u)*rr,
              cen.y + Math.cos(v)*rr*.80,
              cen.z + Math.sin(v)*Math.sin(u)*rr
            );
          }
          lp[i*3]=tmp.x; lp[i*3+1]=tmp.y; lp[i*3+2]=tmp.z;

          // outward direction doubles as the clump's normal for shading
          const nx=tmp.x-cen.x, ny=tmp.y-cen.y, nz=tmp.z-cen.z;
          const nl=Math.hypot(nx,ny,nz)||1;
          ln[i*3]=nx/nl; ln[i*3+1]=ny/nl; ln[i*3+2]=nz/nl;

          const c = pal[(Math.random()*pal.length)|0];
          const shade = 0.72 + 0.28*Math.random();
          lc[i*3]=c.r*shade; lc[i*3+1]=c.g*shade; lc[i*3+2]=c.b*shade;
          ls[i]=rnd(3.0, 7.2);
          sd[i]=Math.random()*100;
        }
        const g=new THREE.BufferGeometry();
        g.setAttribute('position', new THREE.BufferAttribute(lp,3));
        g.setAttribute('aColor', new THREE.BufferAttribute(lc,3));
        g.setAttribute('aSize', new THREE.BufferAttribute(ls,1));
        g.setAttribute('aSeed', new THREE.BufferAttribute(sd,1));
        g.setAttribute('aNormal', new THREE.BufferAttribute(ln,3));
        leafPts = new THREE.Points(g, new THREE.ShaderMaterial({
          transparent:true, depthWrite:true, alphaTest:0.28,
          uniforms:{ uT:{value:0}, uMap:{value:OD.LEAF},
                     uPR:{value:renderer.getPixelRatio()}, uFall:{value:0},
                     uSun:{value:new THREE.Vector3(-0.72,0.55,0.42).normalize()},
                     uSunCol:{value:OD.sc(MOOD.sun)}, uSky:{value:OD.sc(MOOD.mid)} },
          vertexShader:`
            attribute vec3 aColor, aNormal; attribute float aSize, aSeed;
            uniform float uT,uPR,uFall; uniform vec3 uSun,uSunCol,uSky;
            varying vec3 vC; varying float vA;
            void main(){
              vec3 p = position;
              // every clump breathes on its own phase, so the crown moves
              // like foliage rather than like one rigid object
              p.x += sin(uT*.75 + aSeed)*.34;
              p.z += cos(uT*.65 + aSeed*1.4)*.34;
              p.y += sin(uT*.50 + aSeed*2.1)*.16;

              float f = uFall * (0.4 + fract(aSeed));
              p.y -= f*10.0; p.x += sin(uT*2.0+aSeed)*f*2.6;

              // a lit side and a shadowed side, plus sky bounce from above
              float d = max(dot(aNormal, uSun), 0.0);
              vec3 lit = aColor * (0.42 + 0.78*d) * uSunCol * 1.5;
              lit += aColor * uSky * (0.22 + 0.26*max(aNormal.y,0.0));
              vC = lit;

              vA = 1.0 - smoothstep(0.78,1.0,uFall);
              vec4 mv = modelViewMatrix*vec4(p,1.0);
              gl_PointSize = aSize*uPR*(190.0/-mv.z);
              gl_Position = projectionMatrix*mv;
            }`,
          fragmentShader:`
            uniform sampler2D uMap; varying vec3 vC; varying float vA;
            void main(){
              vec4 t = texture2D(uMap, gl_PointCoord);
              if(t.a < 0.30) discard;
              gl_FragColor = vec4(vC, vA);
            }`
        }));
        extras.add(leafPts);
      }

      if(stage>=4 && MOOD.night>.5){
        const FN = TIER==='mobile'?30:70;
        const fp=new Float32Array(FN*3), fs=new Float32Array(FN);
        for(let i=0;i<FN;i++){
          fp[i*3]=rnd(-9,9); fp[i*3+1]=rnd(.5,S.h*.85); fp[i*3+2]=rnd(-9,9);
          fs[i]=Math.random()*100;
        }
        const fg=new THREE.BufferGeometry();
        fg.setAttribute('position', new THREE.Float32BufferAttribute(fp,3));
        fg.setAttribute('aSeed', new THREE.Float32BufferAttribute(fs,1));
        flyPts = new THREE.Points(fg, new THREE.ShaderMaterial({
          transparent:true, depthWrite:false, blending:THREE.AdditiveBlending,
          uniforms:{ uT:{value:0}, uMap:{value:OD.GLOW}, uPR:{value:renderer.getPixelRatio()} },
          vertexShader:`attribute float aSeed; uniform float uT,uPR; varying float vA;
            void main(){ vec3 p=position;
              p.x+=sin(uT*.7+aSeed)*1.8; p.y+=sin(uT*.5+aSeed*2.0)*1.2; p.z+=cos(uT*.6+aSeed*1.5)*1.8;
              vA = pow(max(sin(uT*1.9+aSeed*7.0),0.0),3.0);
              vec4 mv=modelViewMatrix*vec4(p,1.0);
              gl_PointSize=5.0*uPR*(180.0/-mv.z); gl_Position=projectionMatrix*mv; }`,
          fragmentShader:`uniform sampler2D uMap; varying float vA;
            void main(){ vec4 t=texture2D(uMap,gl_PointCoord);
              gl_FragColor=vec4(0.80,1.0,0.48,t.a*vA); if(gl_FragColor.a<.02) discard; }`
        }));
        extras.add(flyPts);
      }

      if(stage>=6){                                  // the carving
        const c=document.createElement('canvas'); c.width=c.height=192;
        const g=c.getContext('2d');
        g.strokeStyle='rgba(28,16,8,.92)'; g.lineWidth=7; g.lineJoin='round';
        g.beginPath();
        for(let i=0;i<=72;i++){
          const t=i/72*TAU, st=Math.sin(t);
          const x=96+(16*st*st*st)*3.5;
          const y=96-(13*Math.cos(t)-5*Math.cos(2*t)-2*Math.cos(3*t)-Math.cos(4*t))*3.5;
          i?g.lineTo(x,y):g.moveTo(x,y);
        }
        g.closePath(); g.stroke();
        g.font='600 34px Georgia, serif'; g.fillStyle='rgba(28,16,8,.92)'; g.textAlign='center';
        g.fillText('A + D', 96, 110);
        const t=new THREE.CanvasTexture(c); t.encoding=THREE.sRGBEncoding;
        const carve=new THREE.Mesh(new THREE.PlaneGeometry(2.3,2.3),
          new THREE.MeshBasicMaterial({ map:t, transparent:true, opacity:.8, depthWrite:false }));
        carve.position.set(0, 3.6, SPEC[stage].rad*1.03);
        extras.add(carve);
      }

      if(stage>=7){                                  // the bench and the little house
        const bench = new THREE.Mesh(new THREE.BoxGeometry(5.2,.45,1.6), OD.MAT.wood);
        bench.position.set(0,1.2,3.8); extras.add(bench);
        for(let i=0;i<2;i++){
          const leg=new THREE.Mesh(new THREE.CylinderGeometry(.26,.36,1.3,7), OD.MAT.bark);
          leg.position.set(i?2.0:-2.0,.55,3.8); extras.add(leg);
        }
        const hut=new THREE.Mesh(new THREE.BoxGeometry(1.9,1.6,1.7), OD.MAT.wood);
        hut.position.set(1.3, SPEC[stage].h*.74, .9); hut.rotation.y=.5; extras.add(hut);
        const hl=new THREE.PointLight(OD.sc(0xFFC080), .9, 12, 2);
        hl.position.copy(hut.position); extras.add(hl);
      }

      if(stage>=5){                                  // mushrooms
        for(let i=0;i<14;i++){
          const cap=new THREE.Mesh(
            new THREE.SphereGeometry(rnd(.13,.26),8,6,0,TAU,0,Math.PI/2),
            new THREE.MeshStandardMaterial({ color: OD.sc(0xB05A48), roughness:.9,
              emissive: OD.sc(MOOD.night>.5 ? 0x2F6B4A : 0x000000), emissiveIntensity:.8 }));
          const a=Math.random()*TAU, r=rnd(1.5,3.6);
          cap.position.set(Math.cos(a)*r,.13,Math.sin(a)*r);
          extras.add(cap);
        }
      }

      hang(memList);          // new branches, so the fruit moves with them
    }

    /* ══════════════════════════════════════════════════════════
       FRUIT — the memories, hanging where fruit would hang.
       Each photograph rides in a rounded pane on a short stem and
       sways with the branch it is on. Tap one to open it.
       ══════════════════════════════════════════════════════════ */
    const fruit = new THREE.Group();
    root.add(fruit);
    const fruitTex = {};

    /* a photo, masked into a rounded pane with a warm rim */
    function paneTexture(url, done){
      if(fruitTex[url]){ done(fruitTex[url]); return; }
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = ()=>{
        const S = 256, r = 34;
        const c = document.createElement('canvas'); c.width = c.height = S;
        const g = c.getContext('2d');
        g.beginPath();
        g.moveTo(r,0); g.lineTo(S-r,0); g.quadraticCurveTo(S,0,S,r);
        g.lineTo(S,S-r); g.quadraticCurveTo(S,S,S-r,S);
        g.lineTo(r,S); g.quadraticCurveTo(0,S,0,S-r);
        g.lineTo(0,r); g.quadraticCurveTo(0,0,r,0);
        g.closePath(); g.clip();
        // cover-fit, so nothing is squashed
        const s = Math.max(S/img.width, S/img.height);
        const w = img.width*s, h = img.height*s;
        g.drawImage(img, (S-w)/2, (S-h)/2, w, h);
        g.strokeStyle = 'rgba(255,214,150,.85)'; g.lineWidth = 9; g.stroke();
        const t = new THREE.CanvasTexture(c);
        t.encoding = THREE.sRGBEncoding;
        fruitTex[url] = t;
        done(t);
      };
      img.onerror = ()=>done(null);
      img.src = url;
    }

    /* a fruit with nothing in it yet — an invitation */
    function blankTexture(){
      if(fruitTex.__blank) return fruitTex.__blank;
      const S = 128;
      const c = document.createElement('canvas'); c.width = c.height = S;
      const g = c.getContext('2d');
      const grd = g.createRadialGradient(S*.38, S*.34, 4, S*.5, S*.5, S*.56);
      grd.addColorStop(0, '#FFE0A8'); grd.addColorStop(.55, '#E8913F'); grd.addColorStop(1, '#9A4A1E');
      g.fillStyle = grd;
      g.beginPath(); g.arc(S/2, S/2, S*.46, 0, TAU); g.fill();
      g.fillStyle = 'rgba(255,240,210,.5)';
      g.beginPath(); g.ellipse(S*.36, S*.32, S*.10, S*.06, -.6, 0, TAU); g.fill();
      const t = new THREE.CanvasTexture(c);
      t.encoding = THREE.sRGBEncoding;
      fruitTex.__blank = t;
      return t;
    }

    function clearFruit(){
      while(fruit.children.length){
        const c = fruit.children[0];
        fruit.remove(c);
      }
    }

    function hang(list){
      clearFruit();
      if(!tips.length) return;

      const withPhoto = list.filter(m => m.asset_url && m.type !== 'voice');
      const items = withPhoto.length ? withPhoto.slice(-10) : [];
      const count = items.length || 5;          // always bear something

      // spread them around the crown rather than clumping on one branch
      const picks = [];
      const stride = Math.max(1, Math.floor(tips.length / count));
      for(let i=0; i<count; i++){
        picks.push(tips[Math.min(tips.length-1, i*stride + ((i*37)%stride))]);
      }

      picks.forEach((tip, i)=>{
        const mem = items[i] || null;
        const g = new THREE.Group();

        const stemLen = rnd(.7, 1.5);
        const stem = new THREE.Mesh(
          new THREE.CylinderGeometry(.035, .045, stemLen, 5),
          OD.MAT.bark
        );
        stem.position.y = -stemLen/2;
        g.add(stem);

        const size = mem ? 1.75 : .85;
        const pane = new THREE.Mesh(
          new THREE.PlaneGeometry(size, size),
          new THREE.MeshBasicMaterial({
            map: mem ? blankTexture() : blankTexture(),
            transparent:true, side:THREE.DoubleSide, toneMapped:false
          })
        );
        pane.position.y = -stemLen - size/2 + .06;
        g.add(pane);

        const glow = new THREE.Sprite(new THREE.SpriteMaterial({
          map: OD.GLOW, color: OD.sc(mem ? 0xFFD9A8 : 0xFF9A4A),
          transparent:true, opacity: mem ? .32 : .5,
          blending:THREE.AdditiveBlending, depthWrite:false }));
        glow.scale.setScalar(size*2.6);
        glow.position.copy(pane.position);
        g.add(glow);

        if(mem){
          paneTexture(mem.asset_url, t=>{
            if(t){ pane.material.map = t; pane.material.needsUpdate = true; }
          });
        }

        g.position.copy(tip);
        g.userData = { mem, ph: Math.random()*TAU, base: tip.clone(), pane, isFruit:true };
        fruit.add(g);
      });
    }

    /* The memories can arrive before the tree has branches to hang them on,
       and the tree is rebuilt whenever the stage changes — so keep the last
       list and re-hang from both directions. */
    let memList = [];
    let stopFruit = OD.Store.watch('memories', list=>{
      list.sort((a,b)=> new Date(a.date) - new Date(b.date));
      memList = list;
      hang(memList);
    }, 'date', 'asc');

    function swayFruit(T){
      fruit.children.forEach(f=>{
        const u = f.userData;
        f.position.set(
          u.base.x + Math.sin(T*.75 + u.ph)*.34,
          u.base.y + Math.sin(T*.50 + u.ph*2.1)*.16,
          u.base.z + Math.cos(T*.65 + u.ph*1.4)*.34
        );
        f.rotation.z = Math.sin(T*.9 + u.ph)*.10;
        // the pane turns to face you wherever you orbit to
        u.pane.lookAt(cam.position);
      });
    }

    return {
      build, stageOf, name:i=>NAME[i], era:i=>ERA[i], height:i=>SPEC[i].h,
      get leaves(){ return leafPts; }, get flies(){ return flyPts; },
      fruit, swayFruit, rehang: hang,
      dispose(){ stopFruit && stopFruit(); }
    };
  })();

  /* ── the rune to the cave ─────────────────────────────────── */
  const rune = (function(){
    const c=document.createElement('canvas'); c.width=c.height=160;
    const g=c.getContext('2d');
    g.strokeStyle='#8FE0E8'; g.lineWidth=6; g.lineCap='round';
    g.beginPath(); g.arc(80,80,48,0,TAU); g.stroke();
    g.beginPath();
    g.moveTo(80,32); g.lineTo(80,128);
    g.moveTo(46,62); g.lineTo(114,98);
    g.moveTo(114,62); g.lineTo(46,98);
    g.stroke();
    const t=new THREE.CanvasTexture(c); t.encoding=THREE.sRGBEncoding;
    const m=new THREE.Mesh(new THREE.PlaneGeometry(3.0,3.0),
      new THREE.MeshBasicMaterial({ map:t, transparent:true, opacity:.6,
        depthWrite:false, blending:THREE.AdditiveBlending }));
    m.rotation.x=-Math.PI/2;
    m.position.set(10.6, 2.4, 8.4);
    groups.tree.add(m);
    return m;
  })();

  /* ── lantern sky (shared, persistent) ─────────────────────── */
  const lanternSky = OD.LanternSky ? OD.LanternSky(scene, { radius: 150, high: 70 }) : null;

  /* ── camera ───────────────────────────────────────────────── */
  /* A camera's field of view is vertical, so a tall narrow phone sees far
     less across than a wide screen at the same distance and everything
     crowds the edges. Stand further back the narrower it gets. */
  function fit(){
    const a = innerWidth / innerHeight;
    return clamp(0.75 / a, 1, 2.1);
  }
  const VIEWS = {
    hub:  { t:new THREE.Vector3(22,-6,12), d: 140, th:.70, ph:1.04 },
    tree: { t:new THREE.Vector3(0,11,0),   d: 46,  th:.62, ph:1.16 }
  };
  function viewDist(key){
    const base = key === 'hub' ? VIEWS.hub.d : VIEWS.tree.d;
    return base * fit();
  }
  const rig = {
    target: VIEWS.tree.t.clone(), want: VIEWS.tree.t.clone(),
    theta:VIEWS.tree.th, phi:VIEWS.tree.ph, dist:viewDist('tree') + 90,
    wantTheta:VIEWS.tree.th, wantPhi:VIEWS.tree.ph, wantDist:viewDist('tree'),
    flying:false
  };
  function apply(){
    const s=Math.sin(rig.phi), c=Math.cos(rig.phi);
    cam.position.set(
      rig.target.x + rig.dist*s*Math.sin(rig.theta),
      rig.target.y + rig.dist*c,
      rig.target.z + rig.dist*s*Math.cos(rig.theta)
    );
    cam.lookAt(rig.target);
  }
  apply();

  let current='tree', T=0, tint=0, tintTo=0, leafFall=0;

  function viewOf(key){
    if(key==='hub')  return Object.assign({}, VIEWS.hub,  { d: viewDist('hub') });
    if(key==='tree') return Object.assign({}, VIEWS.tree, { d: viewDist('tree') });
    const is = ISLANDS.find(i=>i.key===key);
    return { t: is.pos.clone().add(new THREE.Vector3(0,5,0)),
             d: 30 * fit(),
             th: Math.atan2(is.pos.x, is.pos.z)+.55, ph:1.16 };
  }

  function flyTo(key, done){
    const dest = viewOf(key);
    rig.flying = true;
    Snd.whoosh();
    gsap.killTweensOf(rig); gsap.killTweensOf(rig.want);
    gsap.to(rig, { wantDist:dest.d, wantTheta:dest.th, wantPhi:dest.ph,
      duration:2.3, ease:'power2.inOut', onComplete(){ rig.flying=false; if(done) done(); } });
    gsap.to(rig.want, { x:dest.t.x, y:dest.t.y, z:dest.t.z, duration:2.3, ease:'power2.inOut' });
    current = key;
    $('#compass').classList.toggle('on', key!=='hub');
  }

  function pulse(x,y){
    for(let i=0;i<3;i++){
      const el=document.createElement('div');
      el.className='pulse';
      el.style.left=x+'px'; el.style.top=y+'px';
      $('#fx').appendChild(el);
      gsap.to(el,{ width:'96vmin', height:'96vmin', opacity:0, duration:2.3+i*.36,
        delay:i*.22, ease:'power2.out', onComplete:()=>el.remove() });
    }
    tintTo = 1;
    gsap.delayedCall(2.6, ()=>{ tintTo = 0; });
    OD.buzz([22,60,22,60,120]);
    Snd.heartbeat();
  }

  function shakeLeaves(){
    if(leafFall > .01) return;
    const o={v:0};
    gsap.to(o,{ v:1, duration:4.4, ease:'power1.in',
      onUpdate(){ leafFall=o.v; },
      onComplete(){ leafFall=0; }});
    OD.toast('the tree let go of a few leaves');
  }

  function update(dt){
    T += dt;
    sky.material.uniforms.uT.value = T;
    moteMat.uniforms.uT.value = T;
    tint = lerp(tint, tintTo, dt*1.6);
    sky.material.uniforms.uTint.value = tint;

    Object.keys(groups).forEach(k=>{
      const g=groups[k], u=g.userData;
      g.position.y = u.base.y + Math.sin(T*.42 + u.ph)*1.0;
      g.rotation.y = Math.sin(T*.10 + u.ph)*.035;
    });

    const cf = groups.campfire;
    if(cf.userData.flame){
      const f = .82 + Math.sin(T*9.1)*.11 + Math.sin(T*21.3)*.06;
      cf.userData.flame.scale.set(3.2*f, 4.8*f*1.08, 1);
      cf.userData.flight.intensity = 2.6 + f*1.4;
    }

    rune.material.opacity = .40 + Math.abs(Math.sin(T*1.1))*.42;
    rune.rotation.z += dt*.2;

    if(Tree.leaves){
      Tree.leaves.material.uniforms.uT.value = T;
      Tree.leaves.material.uniforms.uFall.value = leafFall;
    }
    if(Tree.flies) Tree.flies.material.uniforms.uT.value = T;
    Tree.swayFruit(T);
    if(lanternSky) lanternSky.update(dt, T);

    rig.target.lerp(rig.want, dt*2.6);
    rig.theta = lerp(rig.theta, rig.wantTheta, dt*2.6);
    rig.phi   = lerp(rig.phi,   rig.wantPhi,   dt*2.6);
    rig.dist  = lerp(rig.dist,  rig.wantDist,  dt*2.6);
    if(!rig.flying && !dragging) rig.wantTheta += dt*.012;
    apply();
    sky.position.copy(cam.position);
  }

  /* ── labels ───────────────────────────────────────────────── */
  const labels = {};
  ISLANDS.forEach(is=>{
    const el=document.createElement('button');
    el.className='label' + (is.live?'':' locked');
    el.type='button';
    el.innerHTML = '<span class="lname"></span><span class="lmeta"></span>';
    el.querySelector('.lname').textContent = is.title;
    el.querySelector('.lmeta').textContent = is.meta;
    el.addEventListener('click', e=>{ e.stopPropagation(); suppress=true; OD.Nav.go(is.key); });
    $('#labels').appendChild(el);
    labels[is.key]=el;
  });

  const v3 = new THREE.Vector3();
  function positionLabels(){
    ISLANDS.forEach(is=>{
      const el = labels[is.key];
      if(is.viaRune){ rune.getWorldPosition(v3); v3.y += 2.4; }
      else {
        groups[is.key].getWorldPosition(v3);
        v3.y += is.key==='tree' ? Tree.height(Tree.stageOf(Days.count())) + 7 : is.r + 10;
      }
      const far = cam.position.distanceTo(v3);
      v3.project(cam);
      if(v3.z >= 1){ el.style.display='none'; return; }
      el.style.display='';
      el.style.left = ((v3.x*.5+.5)*innerWidth)+'px';
      el.style.top  = ((-v3.y*.5+.5)*innerHeight)+'px';
      el.style.setProperty('--s', clamp(1-(far-32)/300, .55, 1).toFixed(3));
      el.style.opacity = far > 340 ? 0 : '';
    });
  }

  /* ── input ────────────────────────────────────────────────── */
  let dragging=false, lx=0, ly=0, moved=0, suppress=false;
  const ray=new THREE.Raycaster(), pt=new THREE.Vector2();

  function down(x,y){ dragging=true; lx=x; ly=y; moved=0; }
  function move(x,y){
    if(!dragging) return;
    const dx=x-lx, dy=y-ly; lx=x; ly=y; moved += Math.abs(dx)+Math.abs(dy);
    rig.wantTheta -= dx*.005;
    rig.wantPhi = clamp(rig.wantPhi - dy*.004, .38, 1.60);
    rig.flying=false;
    gsap.killTweensOf(rig); gsap.killTweensOf(rig.want);
  }
  function up(x,y){
    const wasDrag = moved > 8;
    dragging=false;
    if(suppress){ suppress=false; return; }
    if(wasDrag) return;
    pt.set((x/innerWidth)*2-1, -(y/innerHeight)*2+1);
    ray.setFromCamera(pt, cam);

    // fruit sit inside the tree island, so they have to be asked about first
    // or the walk up the parent chain just flies you to the island
    const fr = ray.intersectObjects(Tree.fruit.children, true);
    if(fr.length){
      let o = fr[0].object;
      while(o && !o.userData.isFruit) o = o.parent;
      if(o){ pickFruit(o.userData.mem); return; }
    }

    if(ray.intersectObject(rune, false).length){ OD.Nav.go('cave'); return; }
    const hits = ray.intersectObjects(Object.keys(groups).map(k=>groups[k]), true);
    if(!hits.length) return;
    let o = hits[0].object;
    while(o && !o.userData.key) o = o.parent;
    if(!o || !o.userData.key) return;
    if(o.userData.key==='tree' && current==='tree') OD.Nav.rings();
    else OD.Nav.go(o.userData.key);
  }
  function zoom(d){
    rig.wantDist = clamp(rig.wantDist + d*.06, 18, 240);
    gsap.killTweensOf(rig,'wantDist');
  }

  /* picking a fruit off the tree */
  function pickFruit(mem){
    Snd.snap();
    OD.buzz(12);
    if(!mem){
      OD.Sheet.open(`
        <div class="eyebrow">this one is still green</div>
        <h2>Nothing in it yet</h2>
        <p class="lead">The tree bears your photographs. Put one into the Crystal
        Tower and it ripens here, hanging where you can reach it.</p>
        <div class="rowbtn"><button class="btn primary" id="goTower">add a memory</button></div>
      `);
      const b = $('#goTower');
      if(b) b.addEventListener('click', ()=>{ OD.Sheet.close(); OD.Nav.go('tower'); });
      return;
    }
    const media = mem.asset_url
      ? (mem.type === 'video'
          ? `<video class="memmedia" src="${OD.esc(mem.asset_url)}" controls playsinline></video>`
          : `<img class="memmedia" src="${OD.esc(mem.asset_url)}" alt="${OD.esc(mem.title||'a memory')}">`)
      : '';
    OD.Sheet.open(`
      <div class="eyebrow">picked from the tree · ${OD.esc(Days.fmt(mem.date))}${mem.placeholder ? ' · date not set yet' : ''}</div>
      ${mem.title ? `<h2>${OD.esc(mem.title)}</h2>` : ''}
      ${media}
      ${mem.caption ? `<p class="lead">${OD.esc(mem.caption)}</p>` : ''}
    `, { wide:true });
  }

  function resize(){
    cam.aspect = innerWidth/innerHeight;
    cam.updateProjectionMatrix();
    if(!rig.flying && (current === 'hub' || current === 'tree')){
      rig.wantDist = viewDist(current);   // re-fit when the phone is turned
    }
  }

  return {
    scene, cam, Tree, MOOD, SEASON, ISLANDS, groups, labels,
    update, positionLabels, flyTo, pulse, shakeLeaves, down, move, up, zoom, resize,
    lanternSky,
    get current(){ return current; },
    get rig(){ return rig; }
  };
};

})(window.OD);
