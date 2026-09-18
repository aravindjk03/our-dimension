/* ══════════════════════════════════════════════════════════════
   THE UNDERWATER CAVE — the private vault
   the plunge · the combination lock · bioluminescence
   depth is intimacy: the deeper you swim, the more private it gets
   ══════════════════════════════════════════════════════════════ */
(function(OD){
"use strict";

const { TAU, clamp, lerp, rnd, TIER, Snd, Store, Days, CFG, $, $$ } = OD;

/* the shaft, top to bottom */
const Y_BRINK = 150, Y_CLOUD_HI = 112, Y_CLOUD_LO = 34, Y_WATER = 0;
const Y_DOOR = -50, Y_MOUTH = -58, Y_DEEP = -172;
const DEPTHS = [
  { lvl:1, from:-62,  to:-100, name:'the shallows', blurb:'things you would show anyone who mattered' },
  { lvl:2, from:-100, to:-138, name:'deeper',       blurb:'things you would show only each other' },
  { lvl:3, from:-138, to:-172, name:'the floor',    blurb:'things that never leave this room' }
];

/* ── default rings: A · D · 06 · 04 ───────────────────────── */
const RINGS = [
  { set:['A','B','C','D','J','K','M','S'], answer:0 },   // A
  { set:['A','B','C','D','J','K','M','S'], answer:3 },   // D
  { set:['01','06','09','14','17','21','25','30'], answer:1 },  // 06
  { set:['01','02','03','04','06','09','11','12'], answer:3 }   // 04
];
function hashCombo(arr){
  let h = 2166136261;
  const s = arr.join('-');
  for(let i=0;i<s.length;i++){ h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return (h>>>0).toString(36);
}

/* a vertical streak, for falling fast */
const STREAK = (function(){
  const c=document.createElement('canvas'); c.width=8; c.height=64;
  const g=c.getContext('2d');
  const grd=g.createLinearGradient(0,0,0,64);
  grd.addColorStop(0,'rgba(255,255,255,0)');
  grd.addColorStop(.5,'rgba(255,255,255,.9)');
  grd.addColorStop(1,'rgba(255,255,255,0)');
  g.fillStyle=grd; g.fillRect(0,0,8,64);
  const t=new THREE.CanvasTexture(c); t.encoding=THREE.sRGBEncoding; return t;
})();

/* a jellyfish bell */
const JELLY = (function(){
  const c=document.createElement('canvas'); c.width=c.height=96;
  const g=c.getContext('2d');
  const grd=g.createRadialGradient(48,38,2,48,40,42);
  grd.addColorStop(0,'rgba(220,255,255,.95)');
  grd.addColorStop(.45,'rgba(150,220,255,.55)');
  grd.addColorStop(1,'rgba(120,180,255,0)');
  g.fillStyle=grd;
  g.beginPath(); g.ellipse(48,40,40,30,0,Math.PI,0); g.fill();
  g.strokeStyle='rgba(190,240,255,.42)'; g.lineWidth=2.2;
  for(let i=0;i<7;i++){
    const x=18+i*10;
    g.beginPath(); g.moveTo(x,42);
    g.bezierCurveTo(x+5,58, x-5,72, x+2,92);
    g.stroke();
  }
  const t=new THREE.CanvasTexture(c); t.encoding=THREE.sRGBEncoding; return t;
})();

OD.Cave = function(renderer, post, env, mood){
  const scene = new THREE.Scene();
  scene.environment = env;
  const cam = new THREE.PerspectiveCamera(56, innerWidth/innerHeight, .1, 900);

  const AIR_FOG   = new THREE.FogExp2(0x1A2238, .0018);
  const WATER_FOG = new THREE.FogExp2(0x0A2E44, .026);
  const DEEP_FOG  = new THREE.FogExp2(0x03131F, .040);
  scene.fog = AIR_FOG;

  /* ── sky above the water ──────────────────────────────────── */
  const sky = new THREE.Mesh(
    new THREE.SphereGeometry(620, 32, 22),
    new THREE.ShaderMaterial({
      side:THREE.BackSide, depthWrite:false, fog:false,
      uniforms:{ uTop:{value:new THREE.Color(mood.top)}, uBot:{value:new THREE.Color(mood.bot)} },
      vertexShader:`varying vec3 vP; void main(){ vP=normalize(position);
        gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
      fragmentShader:`varying vec3 vP; uniform vec3 uTop,uBot;
        void main(){ float y=clamp(vP.y*.5+.5,0.,1.);
          gl_FragColor=vec4(mix(uBot,uTop,smoothstep(.35,.95,y)),1.); }`
    })
  );
  scene.add(sky);

  /* ── clouds you fall through ──────────────────────────────── */
  const clouds = [];
  (function(){
    const c=document.createElement('canvas'); c.width=c.height=256;
    const g=c.getContext('2d');
    for(let i=0;i<48;i++){
      const x=Math.random()*256, y=Math.random()*256, r=rnd(24,86);
      const grd=g.createRadialGradient(x,y,0,x,y,r);
      grd.addColorStop(0,'rgba(255,255,255,'+rnd(.10,.30)+')');
      grd.addColorStop(1,'rgba(255,255,255,0)');
      g.fillStyle=grd; g.beginPath(); g.arc(x,y,r,0,TAU); g.fill();
    }
    const t=new THREE.CanvasTexture(c);
    t.wrapS=t.wrapT=THREE.RepeatWrapping; t.repeat.set(3,3); t.encoding=THREE.sRGBEncoding;
    const n = TIER==='mobile'?5:9;
    for(let i=0;i<n;i++){
      const m=new THREE.Mesh(new THREE.PlaneGeometry(420,420),
        new THREE.MeshBasicMaterial({ map:t, transparent:true, opacity:rnd(.16,.34),
          depthWrite:false, color:new THREE.Color(mood.bot), fog:false }));
      m.rotation.x=-Math.PI/2;
      m.position.set(rnd(-40,40), lerp(Y_CLOUD_LO,Y_CLOUD_HI,i/(n-1)), rnd(-40,40));
      m.userData={ sp:rnd(.02,.07) };
      clouds.push(m); scene.add(m);
    }
  })();

  /* ── speed lines, parented to the camera ──────────────────── */
  const streaks = new THREE.Group();
  cam.add(streaks);
  scene.add(cam);
  for(let i=0;i<(TIER==='mobile'?26:56);i++){
    const s=new THREE.Sprite(new THREE.SpriteMaterial({
      map:STREAK, color:0xDDEEFF, transparent:true, opacity:0,
      blending:THREE.AdditiveBlending, depthWrite:false, depthTest:false, fog:false }));
    const a=Math.random()*TAU, r=rnd(1.6,11);
    s.position.set(Math.cos(a)*r, rnd(-9,9), -rnd(4,26));
    s.scale.set(rnd(.04,.12), rnd(3,11), 1);
    s.userData={ base:s.position.clone(), sp:rnd(.7,1.8) };
    streaks.add(s);
  }

  /* ── the water surface ────────────────────────────────────── */
  const water = new THREE.Mesh(
    new THREE.PlaneGeometry(900, 900, 40, 40),
    new THREE.ShaderMaterial({
      side:THREE.DoubleSide, transparent:true, fog:false,
      uniforms:{ uT:{value:0}, uShallow:{value:new THREE.Color(0x2E7E9C)},
                 uDeep:{value:new THREE.Color(0x05283C)}, uSun:{value:new THREE.Color(mood.sun)} },
      vertexShader:`
        varying vec3 vP; varying vec2 vUv; uniform float uT;
        void main(){
          vUv = uv; vec3 p = position;
          p.z += sin(p.x*0.09 + uT*1.1)*0.9 + cos(p.y*0.07 - uT*0.8)*0.7;
          vP = p;
          gl_Position = projectionMatrix*modelViewMatrix*vec4(p,1.0);
        }`,
      fragmentShader:`
        varying vec3 vP; varying vec2 vUv;
        uniform float uT; uniform vec3 uShallow,uDeep,uSun;
        float h21(vec2 p){ return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453); }
        float vn(vec2 p){ vec2 i=floor(p),f=fract(p); f=f*f*(3.-2.*f);
          return mix(mix(h21(i),h21(i+vec2(1,0)),f.x), mix(h21(i+vec2(0,1)),h21(i+vec2(1,1)),f.x), f.y); }
        void main(){
          vec2 q = vUv*26.0;
          float rip = vn(q + uT*0.20)*0.6 + vn(q*2.3 - uT*0.16)*0.4;
          if(gl_FrontFacing){
            vec3 c = mix(uDeep, uShallow, rip);
            c += uSun * pow(rip, 5.0) * 0.8;
            gl_FragColor = vec4(c, 0.90);
          } else {
            // seen from beneath: a bright, moving ceiling
            vec3 c = mix(vec3(0.05,0.22,0.32), vec3(0.62,0.90,1.0), pow(rip,1.7));
            gl_FragColor = vec4(c, 0.78);
          }
        }`
    })
  );
  water.rotation.x = -Math.PI/2;
  scene.add(water);

  /* ── god rays under the surface ───────────────────────────── */
  const rays = new THREE.Group(); scene.add(rays);
  for(let i=0;i<(TIER==='mobile'?4:9);i++){
    const m=new THREE.Mesh(new THREE.ConeGeometry(rnd(3,9), rnd(40,70), 5, 1, true),
      new THREE.MeshBasicMaterial({ color:0x9FE0FF, transparent:true, opacity:rnd(.05,.12),
        blending:THREE.AdditiveBlending, depthWrite:false, side:THREE.DoubleSide, fog:false }));
    const a=Math.random()*TAU, r=rnd(4,30);
    m.position.set(Math.cos(a)*r, -26, Math.sin(a)*r);
    m.rotation.z = rnd(-.14,.14);
    m.userData={ ph:Math.random()*TAU, o:m.material.opacity };
    rays.add(m);
  }

  /* ── light ────────────────────────────────────────────────── */
  const above = new THREE.DirectionalLight(0xCFEBFF, 1.4);
  above.position.set(-18, 90, 22); scene.add(above);
  const amb = new THREE.AmbientLight(0x12384E, 1.4); scene.add(amb);
  const bioA = new THREE.PointLight(0x46E8D0, 0, 60, 2); bioA.position.set(0,-90,0); scene.add(bioA);
  const bioB = new THREE.PointLight(0x9A6AFF, 0, 60, 2); bioB.position.set(0,-150,0); scene.add(bioB);
  const doorLight = new THREE.PointLight(0x7FE8FF, 0, 40, 2); doorLight.position.set(0,Y_DOOR,6); scene.add(doorLight);

  /* ── the cave shaft ───────────────────────────────────────── */
  const rockMat = new THREE.MeshStandardMaterial({
    color:0x1C2A30, roughness:.98, metalness:0,
    normalMap:OD.MAT.rockNormal, normalScale:new THREE.Vector2(1.3,1.3),
    side:THREE.BackSide, envMapIntensity:.25
  });
  (function shaft(){
    const geo = new THREE.CylinderGeometry(19, 23, Y_MOUTH - Y_DEEP, 28, 18, true);
    const p = geo.attributes.position;
    for(let i=0;i<p.count;i++){
      const x=p.getX(i), y=p.getY(i), z=p.getZ(i);
      const n = OD.fbm(x*.09, y*.06, z*.09, 4);
      const k = 1 + n*.26;
      p.setXYZ(i, x*k, y + n*2.2, z*k);
    }
    geo.computeVertexNormals();
    const m = new THREE.Mesh(geo, rockMat);
    m.position.y = (Y_MOUTH + Y_DEEP)/2;
    scene.add(m);

    // the floor
    const f = new THREE.Mesh(new THREE.CircleGeometry(24, 30),
      new THREE.MeshStandardMaterial({ color:0x16232A, roughness:1,
        normalMap:OD.MAT.rockNormal, normalScale:new THREE.Vector2(1.6,1.6) }));
    f.rotation.x = -Math.PI/2; f.position.y = Y_DEEP;
    scene.add(f);
  })();

  /* the mouth: an arch of coral round the entrance */
  const coral = new THREE.Group(); scene.add(coral);
  for(let i=0;i<(TIER==='mobile'?16:34);i++){
    const a = i/(TIER==='mobile'?16:34)*TAU;
    const r = 17 + rnd(-1.5,1.5);
    const h = rnd(1.2,4.0);
    const col = [0x46E8D0, 0x9A6AFF, 0x4FA8FF, 0xFF7AB8][i%4];
    const c = new THREE.Mesh(
      new THREE.ConeGeometry(rnd(.3,.8), h, 6),
      new THREE.MeshStandardMaterial({ color:0x1A2A32, roughness:.9,
        emissive:col, emissiveIntensity:.9 })
    );
    c.position.set(Math.cos(a)*r, Y_MOUTH + rnd(-3,3), Math.sin(a)*r);
    c.rotation.z = Math.cos(a)*.5; c.rotation.x = -Math.sin(a)*.5;
    c.userData={ ph:Math.random()*TAU, col };
    coral.add(c);
  }

  /* glowing moss down the walls */
  const moss = new THREE.Group(); scene.add(moss);
  for(let i=0;i<(TIER==='mobile'?40:110);i++){
    const a=Math.random()*TAU;
    const y=rnd(Y_DEEP+4, Y_MOUTH);
    const r=18 + rnd(-2,1);
    const col=[0x46E8D0,0x9A6AFF,0x63F0A0][i%3];
    const s=new THREE.Sprite(new THREE.SpriteMaterial({
      map:OD.GLOW, color:col, transparent:true, opacity:.5,
      blending:THREE.AdditiveBlending, depthWrite:false, fog:false }));
    s.position.set(Math.cos(a)*r, y, Math.sin(a)*r);
    s.scale.setScalar(rnd(1.4,4.2));
    s.userData={ ph:Math.random()*TAU, sp:rnd(.4,1.3) };
    moss.add(s);
  }

  /* jellyfish */
  const jellies = [];
  for(let i=0;i<(TIER==='mobile'?7:16);i++){
    const s=new THREE.Sprite(new THREE.SpriteMaterial({
      map:JELLY, color:0xCFF4FF, transparent:true, opacity:.55,
      blending:THREE.AdditiveBlending, depthWrite:false, fog:false }));
    const a=Math.random()*TAU, r=rnd(3,15);
    s.position.set(Math.cos(a)*r, rnd(Y_DEEP+10, Y_MOUTH-4), Math.sin(a)*r);
    s.scale.setScalar(rnd(2.2,5.0));
    s.userData={ ph:Math.random()*TAU, sp:rnd(.25,.7), base:s.position.clone(), sc:s.scale.x };
    jellies.push(s); scene.add(s);
  }

  /* a school of small fish that scatters when you come close */
  const fish = (function(){
    const n = TIER==='mobile'?60:150;
    const p=new Float32Array(n*3), sd=new Float32Array(n);
    for(let i=0;i<n;i++){
      const a=Math.random()*TAU, r=rnd(2,14);
      p[i*3]=Math.cos(a)*r; p[i*3+1]=rnd(Y_DEEP+8,Y_MOUTH-6); p[i*3+2]=Math.sin(a)*r;
      sd[i]=Math.random()*100;
    }
    const g=new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(p,3));
    g.setAttribute('aSeed', new THREE.BufferAttribute(sd,1));
    const m=new THREE.ShaderMaterial({
      transparent:true, depthWrite:false, blending:THREE.AdditiveBlending,
      uniforms:{ uT:{value:0}, uMap:{value:OD.SPRITE}, uPR:{value:renderer.getPixelRatio()},
                 uCam:{value:new THREE.Vector3()}, uScatter:{value:0} },
      vertexShader:`
        attribute float aSeed; uniform float uT,uPR,uScatter; uniform vec3 uCam;
        varying float vA;
        void main(){
          vec3 p = position;
          p.x += sin(uT*.9 + aSeed*6.0)*2.2;
          p.z += cos(uT*.8 + aSeed*5.0)*2.2;
          p.y += sin(uT*.5 + aSeed*3.0)*1.1;
          vec3 away = normalize(p - uCam + vec3(0.001));
          float d = length(p - uCam);
          p += away * uScatter * max(0.0, 9.0 - d) * 1.1;
          vA = .30 + .55*abs(sin(uT*1.6 + aSeed*9.0));
          vec4 mv = modelViewMatrix*vec4(p,1.0);
          gl_PointSize = 2.6*uPR*(170.0/-mv.z);
          gl_Position = projectionMatrix*mv;
        }`,
      fragmentShader:`uniform sampler2D uMap; varying float vA;
        void main(){ vec4 t=texture2D(uMap,gl_PointCoord);
          gl_FragColor=vec4(0.72,0.95,1.0,t.a*vA*.7); if(gl_FragColor.a<.01) discard; }`
    });
    scene.add(new THREE.Points(g,m));
    return m;
  })();

  /* ambient bioluminescent motes */
  const bio = (function(){
    const n = TIER==='mobile'?150:380;
    const p=new Float32Array(n*3), sd=new Float32Array(n), cl=new Float32Array(n*3);
    const pal=[new THREE.Color(0x46E8D0), new THREE.Color(0x9A6AFF), new THREE.Color(0x4FA8FF)];
    for(let i=0;i<n;i++){
      const a=Math.random()*TAU, r=Math.random()*19;
      p[i*3]=Math.cos(a)*r; p[i*3+1]=rnd(Y_DEEP, Y_WATER-4); p[i*3+2]=Math.sin(a)*r;
      sd[i]=Math.random()*100;
      const c=pal[i%3]; cl[i*3]=c.r; cl[i*3+1]=c.g; cl[i*3+2]=c.b;
    }
    const g=new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(p,3));
    g.setAttribute('aSeed', new THREE.BufferAttribute(sd,1));
    g.setAttribute('aColor', new THREE.BufferAttribute(cl,3));
    const m=new THREE.ShaderMaterial({
      transparent:true, depthWrite:false, blending:THREE.AdditiveBlending,
      uniforms:{ uT:{value:0}, uMap:{value:OD.GLOW}, uPR:{value:renderer.getPixelRatio()} },
      vertexShader:`
        attribute float aSeed; attribute vec3 aColor;
        uniform float uT,uPR; varying float vA; varying vec3 vC;
        void main(){
          vC=aColor; vec3 p=position;
          p.x += sin(uT*.22+aSeed)*1.5;
          p.y += sin(uT*.15+aSeed*2.)*2.2;
          p.z += cos(uT*.19+aSeed*1.4)*1.5;
          vA = .18+.72*pow(max(sin(uT*.8+aSeed*7.),0.),2.0);
          vec4 mv=modelViewMatrix*vec4(p,1.);
          gl_PointSize=3.4*uPR*(170./-mv.z);
          gl_Position=projectionMatrix*mv;
        }`,
      fragmentShader:`uniform sampler2D uMap; varying float vA; varying vec3 vC;
        void main(){ vec4 t=texture2D(uMap,gl_PointCoord);
          gl_FragColor=vec4(vC*1.5, t.a*vA); if(gl_FragColor.a<.01) discard; }`
    });
    scene.add(new THREE.Points(g,m));
    return m;
  })();

  /* rising bubbles */
  const bubbleStream = (function(){
    const n = TIER==='mobile'?60:140;
    const p=new Float32Array(n*3), sd=new Float32Array(n);
    for(let i=0;i<n;i++){
      const a=Math.random()*TAU, r=Math.random()*17;
      p[i*3]=Math.cos(a)*r; p[i*3+1]=rnd(Y_DEEP,Y_WATER); p[i*3+2]=Math.sin(a)*r;
      sd[i]=Math.random();
    }
    const g=new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(p,3));
    g.setAttribute('aSeed', new THREE.BufferAttribute(sd,1));
    const m=new THREE.ShaderMaterial({
      transparent:true, depthWrite:false,
      uniforms:{ uT:{value:0}, uMap:{value:OD.SPRITE}, uPR:{value:renderer.getPixelRatio()},
                 uBurst:{value:0} },
      vertexShader:`
        attribute float aSeed; uniform float uT,uPR,uBurst; varying float vA;
        void main(){
          vec3 p=position;
          float rise = fract(uT*(0.04+aSeed*0.05) + aSeed) * 170.0;
          p.y += rise + uBurst*30.0;
          if(p.y > 0.0) p.y -= 170.0;
          p.x += sin(uT*1.4+aSeed*30.0)*0.8;
          p.z += cos(uT*1.2+aSeed*24.0)*0.8;
          vA = (0.28 + 0.4*aSeed) * (1.0 + uBurst*1.6);
          vec4 mv=modelViewMatrix*vec4(p,1.);
          gl_PointSize=(1.6+aSeed*4.0)*uPR*(170./-mv.z);
          gl_Position=projectionMatrix*mv;
        }`,
      fragmentShader:`uniform sampler2D uMap; varying float vA;
        void main(){ vec4 t=texture2D(uMap,gl_PointCoord);
          float ring = smoothstep(0.34,0.5,t.a) - smoothstep(0.5,0.62,t.a);
          gl_FragColor=vec4(0.80,0.94,1.0, (t.a*0.25 + ring*0.8)*vA);
          if(gl_FragColor.a<.01) discard; }`
    });
    scene.add(new THREE.Points(g,m));
    return m;
  })();

  /* ══════════════════════════════════════════════════════════
     THE COMBINATION LOCK
     ══════════════════════════════════════════════════════════ */
  const door = new THREE.Group();
  door.position.y = Y_DOOR;
  scene.add(door);

  const slab = new THREE.Mesh(
    new THREE.CylinderGeometry(17.5, 17.5, 2.4, 30),
    new THREE.MeshStandardMaterial({ color:0x243238, roughness:.96,
      normalMap:OD.MAT.rockNormal, normalScale:new THREE.Vector2(1.5,1.5) })
  );
  door.add(slab);

  let ringDefs = RINGS.map(r=>({ set:r.set.slice(), answer:r.answer }));
  let comboHash = hashCombo(ringDefs.map(r=>r.set[r.answer]));
  const ringMeshes = [];

  function ringTexture(set){
    const W = 1024, H = 128;
    const c=document.createElement('canvas'); c.width=W; c.height=H;
    const g=c.getContext('2d');
    g.fillStyle='#1B272C'; g.fillRect(0,0,W,H);
    const seg = W/set.length;
    set.forEach((sym,i)=>{
      const x=i*seg;
      g.save();
      g.strokeStyle='rgba(120,220,235,.22)'; g.lineWidth=2;
      g.beginPath(); g.moveTo(x,0); g.lineTo(x,H); g.stroke();
      g.fillStyle='rgba(180,240,255,.88)';
      g.font='600 58px Jost, sans-serif';
      g.textAlign='center'; g.textBaseline='middle';
      g.fillText(sym, x+seg/2, H/2);
      g.restore();
    });
    const t=new THREE.CanvasTexture(c);
    t.wrapS=THREE.RepeatWrapping; t.wrapT=THREE.ClampToEdgeWrapping;
    t.encoding=THREE.sRGBEncoding;
    return t;
  }

  function buildRings(){
    ringMeshes.forEach(r=>door.remove(r.mesh));
    ringMeshes.length = 0;
    ringDefs.forEach((def, i)=>{
      const rOuter = 15.5 - i*3.4;
      const m = new THREE.Mesh(
        new THREE.CylinderGeometry(rOuter, rOuter, 2.9, 48, 1, true),
        new THREE.MeshStandardMaterial({
          map: ringTexture(def.set), roughness:.6, metalness:.25,
          emissive:0x0A2A34, emissiveIntensity:.9, side:THREE.DoubleSide,
          envMapIntensity:.8
        })
      );
      m.position.y = .2;
      m.rotation.y = 0;
      door.add(m);
      ringMeshes.push({ mesh:m, def, i, n:def.set.length, target:0 });
    });
  }
  buildRings();

  /* which symbol is facing you */
  function selectedIndex(r){
    const step = TAU / r.n;
    let k = Math.round(-r.mesh.rotation.y / step) % r.n;
    if(k < 0) k += r.n;
    return k;
  }
  function currentCombo(){
    return ringMeshes.map(r => r.def.set[selectedIndex(r)]);
  }

  let unlocked = false;
  let locking = false;

  function tryUnlock(){
    if(unlocked || locking) return;
    const got = hashCombo(currentCombo());
    if(got === comboHash){
      unlocked = true;
      Snd.chime(528);
      gsap.delayedCall(.35, ()=>Snd.chime(792));
      OD.buzz([20,50,20,50,180]);
      ringMeshes.forEach((r,i)=>{
        gsap.to(r.mesh.material, { emissiveIntensity: 4.5, duration:.5, delay:i*.12 });
        gsap.to(r.mesh.material.emissive, { r:1, g:.82, b:.48, duration:.5, delay:i*.12 });
      });
      gsap.to(doorLight, { intensity:9, duration:1.2, delay:.4 });
      gsap.to(door.position, { y: Y_DOOR - 3, duration:2.4, delay:.8, ease:'power2.in' });
      gsap.to(slab.material, { opacity:0, duration:1.8, delay:.9,
        onStart(){ slab.material.transparent = true; } });
      ringMeshes.forEach((r,i)=>{
        gsap.to(r.mesh.material, { opacity:0, duration:1.6, delay:1.0+i*.1,
          onStart(){ r.mesh.material.transparent = true; } });
      });
      gsap.delayedCall(2.4, ()=>{
        door.visible = false;
        phase = 'inside';
        OD.toast('the deeper you go, the more private it gets', 4200);
        $('#depthMeter').classList.add('on');
      });
      OD.toast('it opens');
    } else {
      locking = true;
      Snd.rumble();
      OD.buzz([60,40,60]);
      const o={v:0};
      gsap.to(o,{ v:1, duration:.6, ease:'power2.out', onUpdate(){
        const k = Math.sin(o.v*Math.PI)*.5;
        door.position.x = Math.sin(o.v*70)*k;
        door.position.z = Math.cos(o.v*61)*k;
      }, onComplete(){
        door.position.x = door.position.z = 0;
        // the rings fall back to where they started
        ringMeshes.forEach((r,i)=>{
          gsap.to(r.mesh.rotation, { y:0, duration:.7, delay:i*.06, ease:'power2.inOut' });
        });
        fish.uniforms.uScatter.value = 1;
        gsap.to(fish.uniforms.uScatter, { value:0, duration:2.6, ease:'power2.out' });
        gsap.delayedCall(.9, ()=>{ locking=false; });
        OD.toast('not that');
      }});
    }
  }

  /* ══════════════════════════════════════════════════════════
     THE VAULT CONTENTS — content held inside bubbles
     ══════════════════════════════════════════════════════════ */
  const bubbleGroup = new THREE.Group(); scene.add(bubbleGroup);
  let items = [], bubbles = [], held = null;
  const texCache = {};

  function bubbleMat(){
    return new THREE.MeshPhysicalMaterial({
      color:0xCFF0FF, roughness:.05, metalness:0,
      transmission: OD.tr(.92), thickness:1.4,
      transparent:true, opacity: OD.tr(.92) ? .55 : .30,
      clearcoat:1, envMap:env, envMapIntensity:2.0
    });
  }

  function photoTex(url, cb){
    if(texCache[url]){ cb(texCache[url]); return; }
    const img = new Image(); img.crossOrigin='anonymous';
    img.onload = ()=>{ const t=new THREE.Texture(img); t.encoding=THREE.sRGBEncoding;
      t.needsUpdate=true; texCache[url]=t; cb(t); };
    img.onerror = ()=>cb(null);
    img.src = url;
  }

  function makeBubble(it, i){
    const g = new THREE.Group();
    const lvl = clamp(it.depth_level||1, 1, 3);
    const band = DEPTHS[lvl-1];

    const ball = new THREE.Mesh(new THREE.SphereGeometry(2.0, 20, 16), bubbleMat());
    g.add(ball);

    const inner = new THREE.Mesh(new THREE.PlaneGeometry(2.3, 1.7),
      new THREE.MeshBasicMaterial({ color:0xFFFFFF, transparent:true, opacity:.94,
        side:THREE.DoubleSide, fog:false }));
    g.add(inner);
    g.userData.inner = inner;

    if(it.asset_url && it.type !== 'voice'){
      photoTex(it.asset_url, t=>{ if(t){ inner.material.map=t; inner.material.needsUpdate=true; } });
    } else {
      const c=document.createElement('canvas'); c.width=256; c.height=192;
      const cg=c.getContext('2d');
      cg.fillStyle='#08202C'; cg.fillRect(0,0,256,192);
      cg.fillStyle='rgba(160,240,255,.92)'; cg.textAlign='center';
      cg.font='600 30px Georgia, serif';
      cg.fillText(it.type==='voice' ? '♪' : '“', 128, 74);
      cg.font='300 15px Jost, sans-serif';
      const words=String(it.caption||it.text||'').split(/\s+/);
      let line='', ln=0;
      for(const w of words){
        const t2 = line? line+' '+w : w;
        if(cg.measureText(t2).width > 210){ cg.fillText(line,128,108+ln*20); line=w; ln++; if(ln>2) break; }
        else line=t2;
      }
      if(ln<=2 && line) cg.fillText(line,128,108+ln*20);
      const tx=new THREE.CanvasTexture(c); tx.encoding=THREE.sRGBEncoding;
      inner.material.map=tx; inner.material.needsUpdate=true;
    }

    const glow = new THREE.Sprite(new THREE.SpriteMaterial({
      map:OD.GLOW, color: lvl===3?0x9A6AFF : lvl===2?0x4FA8FF : 0x46E8D0,
      transparent:true, opacity:.45, blending:THREE.AdditiveBlending,
      depthWrite:false, fog:false }));
    glow.scale.setScalar(7.5);
    g.add(glow);
    g.userData.glow = glow;

    const rr = OD.rng((i+1)*0x9E3779B1);
    const a = rr()*TAU, r = 5 + rr()*9;
    const y = lerp(band.from, band.to, .15 + rr()*.7);
    g.position.set(Math.cos(a)*r, y, Math.sin(a)*r);
    g.userData.home = g.position.clone();
    g.userData.item = it;
    g.userData.ph = rr()*TAU;
    g.userData.lvl = lvl;
    return g;
  }

  function rebuildBubbles(){
    bubbles.forEach(b=>bubbleGroup.remove(b));
    bubbles = [];
    items.forEach((it,i)=>{
      const b = makeBubble(it, i);
      bubbles.push(b); bubbleGroup.add(b);
    });
  }

  const stopVault = Store.watch('vault', list=>{
    list.sort((a,b)=>(a.added_at||0)-(b.added_at||0));
    items = list;
    rebuildBubbles();
  }, 'added_at', 'asc');

  /* ── bubble interaction: drift in, expand, pop ────────────── */
  function hold(node){
    if(held) return;
    held = node;
    Snd.bubble();
    const f = new THREE.Vector3(); cam.getWorldDirection(f);
    const dest = cam.position.clone().addScaledVector(f, 7.5);
    gsap.to(node.position, { x:dest.x, y:dest.y, z:dest.z, duration:.9, ease:'power3.out' });
    gsap.to(node.scale, { x:1.9, y:1.9, z:1.9, duration:.9, ease:'power3.out' });
    gsap.to(node.userData.glow.material, { opacity:.85, duration:.6 });
    OD.toast('tap it again to pop it');
  }

  function pop(node){
    const it = node.userData.item;
    Snd.splash();
    OD.buzz(14);
    // the ripple
    const el = document.createElement('div');
    el.className='ripple';
    el.style.left='50%'; el.style.top='50%';
    $('#fx').appendChild(el);
    gsap.to(el,{ width:'140vmin', height:'140vmin', opacity:0, duration:1.5,
      ease:'power2.out', onComplete:()=>el.remove() });

    gsap.to(node.scale, { x:3.4, y:3.4, z:3.4, duration:.3, ease:'power2.out' });
    gsap.to(node.userData.inner.material, { opacity:0, duration:.3 });
    gsap.to(node.userData.glow.material, { opacity:0, duration:.3 });
    node.children.forEach(ch=>{
      if(ch.material && 'opacity' in ch.material){
        ch.material.transparent = true;
        gsap.to(ch.material, { opacity:0, duration:.32 });
      }
    });
    gsap.delayedCall(.30, ()=>{ node.visible = false; openItem(it, node); });
  }

  function openItem(it, node){
    const media = it.asset_url
      ? (it.type==='video'
          ? `<video class="memmedia" src="${OD.esc(it.asset_url)}" controls playsinline></video>`
          : it.type==='voice'
            ? `<audio class="memaudio" src="${OD.esc(it.asset_url)}" controls></audio>`
            : `<img class="memmedia" src="${OD.esc(it.asset_url)}" alt="${OD.esc(it.caption||'something private')}">`)
      : '';
    const who = it.added_by==='her' ? CFG.her : CFG.him;
    const band = DEPTHS[clamp(it.depth_level||1,1,3)-1];
    OD.Sheet.open(`
      <div class="eyebrow">${OD.esc(band.name)} · ${OD.esc(who.pet)} · ${OD.esc(Days.fmtShort(it.added_at))}</div>
      ${media}
      ${it.text ? `<blockquote class="wishq ${it.added_by==='her'?'rose':'gold'}">${OD.esc(it.text)}</blockquote>` : ''}
      ${it.caption ? `<p class="lead">${OD.esc(it.caption)}</p>` : ''}
      <div class="rowbtn">
        <button class="btn" id="vaultDel">let this one go</button>
      </div>
    `, { wide:true, onClose(){
      held = null;
      if(node){
        node.visible = true;
        node.scale.setScalar(1);
        node.position.copy(node.userData.home);
        node.children.forEach(ch=>{ if(ch.material && 'opacity' in ch.material){
          ch.material.opacity = ch === node.userData.glow ? .45 : (ch===node.userData.inner? .94 : (OD.tr(1)?.55:.30));
        }});
      }
    }});
    const del = $('#vaultDel');
    if(del) del.addEventListener('click', async ()=>{
      del.disabled = true; del.textContent='letting go…';
      await Store.remove('vault', it.id);
      OD.Sheet.close();
      OD.toast('gone');
    });
  }

  /* ── adding to the vault ──────────────────────────────────── */
  let assetsNs;
  async function assetsCap(){
    if(assetsNs !== undefined) return assetsNs;
    try{ assetsNs = await claude.use('assets'); }catch(e){ assetsNs = null; }
    return assetsNs;
  }

  async function addItem(){
    const a = await assetsCap();
    const lvlNow = depthBand().lvl;
    OD.Sheet.open(`
      <div class="eyebrow">into the vault</div>
      <h2>Only ever here</h2>
      <p class="lead">Nothing in this room appears anywhere else in the world. How deep you put it
      is how private it is.</p>
      <div class="fieldlabel">how deep</div>
      <div class="emos" id="lvlPick">
        ${DEPTHS.map(d=>`<button type="button" class="emo" data-l="${d.lvl}"
            style="--c:${d.lvl===3?'#9A6AFF':d.lvl===2?'#4FA8FF':'#46E8D0'}">
            <span class="wax"></span>${OD.esc(d.name)}</button>`).join('')}
      </div>
      <label class="fl"><span class="fieldlabel">say something</span>
        <textarea id="vText" rows="3" maxlength="400" placeholder="A line, an inside joke, anything."></textarea></label>
      ${a ? `<label class="fl"><span class="fieldlabel">or bring a file</span>
        <input id="vFile" type="file" accept="image/*,video/*,audio/*"></label>
        <div class="hint">20&nbsp;MB maximum. Photos, screenshots, video, voice notes.</div>`
          : `<div class="hint warn">File uploads are not available in this view, so this one will be words only.</div>`}
      <label class="fl"><span class="fieldlabel">a caption (optional)</span>
        <input id="vCap" type="text" maxlength="140"></label>
      <div class="rowbtn">
        <button class="btn primary" id="vSave">let it sink</button>
        <button class="btn" id="recutBtn">recut the rings</button>
      </div>
    `, { wide:true });

    $('#recutBtn').addEventListener('click', ()=>{ OD.Sheet.close(); gsap.delayedCall(.35, recut); });

    let lvl = lvlNow;
    const picks = $$('#lvlPick .emo');
    picks.forEach(b=>{
      if(+b.dataset.l === lvl) b.classList.add('on');
      b.addEventListener('click', ()=>{
        picks.forEach(x=>x.classList.remove('on'));
        b.classList.add('on'); lvl = +b.dataset.l; Snd.bubble();
      });
    });

    $('#vSave').addEventListener('click', async ()=>{
      const btn = $('#vSave');
      const text = $('#vText').value.trim();
      const fEl = $('#vFile');
      const file = fEl && fEl.files && fEl.files[0];
      if(!text && !file){ OD.toast('it needs words or a file'); return; }
      btn.disabled = true; btn.textContent = 'sinking…';

      let asset_url=null, asset_id=null, type='text';
      if(file && a){
        if(file.size > 20*1024*1024){
          OD.toast('that file is over 20 MB');
          btn.disabled=false; btn.textContent='let it sink'; return;
        }
        try{
          const res = await a.upload(file);
          asset_url = res.url; asset_id = res.id;
          type = file.type.startsWith('video') ? 'video'
               : file.type.startsWith('audio') ? 'voice'
               : (file.name||'').match(/screenshot/i) ? 'screenshot' : 'photo';
        }catch(e){ OD.toast('the upload did not go through — keeping the words'); }
      }

      await Store.put('vault', Store.newId(), {
        type, text, caption: $('#vCap').value.trim(),
        asset_url, asset_id, depth_level: lvl,
        added_by: Store.side || 'him', added_at: Date.now()
      });
      Snd.bubble();
      OD.Sheet.close();
      OD.toast('it is down here now');
    });
  }

  /* ── recutting the rings ──────────────────────────────────── */
  async function recut(){
    OD.Sheet.open(`
      <div class="eyebrow">the lock</div>
      <h2>Recut the rings</h2>
      <p class="lead">Four rings. Choose what each one has to land on. Whoever comes next
      has to line all four up before the door will open.</p>
      <div id="recut">${ringDefs.map((r,i)=>`
        <div class="fieldlabel">ring ${i+1}</div>
        <div class="emos ringpick" data-r="${i}">
          ${r.set.map((s,j)=>`<button type="button" class="emo${j===r.answer?' on':''}" data-j="${j}"
             style="--c:#46E8D0"><span class="wax"></span>${OD.esc(s)}</button>`).join('')}
        </div>`).join('')}</div>
      <div class="rowbtn"><button class="btn primary" id="recutSave">set the lock</button></div>
    `, { wide:true });

    const next = ringDefs.map(r=>r.answer);
    $$('#recut .ringpick').forEach(row=>{
      const ri = +row.dataset.r;
      $$('.emo', row).forEach(b=>{
        b.addEventListener('click', ()=>{
          Array.prototype.forEach.call(row.querySelectorAll('.emo'), x=>x.classList.remove('on'));
          b.classList.add('on'); next[ri] = +b.dataset.j; Snd.carve();
        });
      });
    });

    $('#recutSave').addEventListener('click', async ()=>{
      ringDefs.forEach((r,i)=>{ r.answer = next[i]; });
      comboHash = hashCombo(ringDefs.map(r=>r.set[r.answer]));
      await Store.put('vault_config', 'lock', {
        combination_hash: comboHash,
        ring_symbols: ringDefs.map(r=>r.set),
        set_by: Store.side || 'him', set_at: Date.now()
      });
      OD.Sheet.close();
      OD.toast('the rings are recut');
    });
  }

  /* ══════════════════════════════════════════════════════════
     PHASES
     ══════════════════════════════════════════════════════════ */
  let phase = 'brink';
  let T = 0, vy = 0, camY = Y_BRINK, camA = .4, wantA = .4, orbitR = 26, wantR = 26;
  let submerged = false;

  function depthBand(){
    for(const d of DEPTHS) if(camY <= d.from && camY > d.to) return d;
    return camY > DEPTHS[0].from ? DEPTHS[0] : DEPTHS[2];
  }

  function brink(){
    OD.Sheet.open(`
      <div class="eyebrow">the cliff edge</div>
      <h2>Take the leap?</h2>
      <p class="lead">There is no path down. The only way in is over the edge — through the
      clouds, through the water, and down until the light stops reaching.</p>
      <div class="rowbtn"><button class="btn primary" id="jumpBtn">jump</button></div>
    `, { onClose(){ if(phase==='brink') OD.Nav.go('hub'); } });
    $('#jumpBtn').addEventListener('click', ()=>{
      OD.Sheet.close();
      gsap.delayedCall(.2, jump);
    });
  }

  function jump(){
    phase = 'fall';
    vy = -6;
    Snd.bed('wind', .85, .6);
    Snd.whoosh();
    OD.buzz([10,30,10,30,10]);
    gsap.to(cam, { fov:82, duration:2.4, ease:'power2.in',
      onUpdate(){ cam.updateProjectionMatrix(); } });
    gsap.to(post.uniforms.uAberr, { value:.010, duration:2.2 });
    streaks.children.forEach(s=> gsap.to(s.material, { opacity:rnd(.25,.7), duration:.6, delay:rnd(0,.5) }));
  }

  function splash(){
    phase = 'splash';
    submerged = true;
    scene.fog = WATER_FOG;
    Snd.splash();
    Snd.bed('wind', 0, .25);
    Snd.bed('under', .42, .6);
    OD.buzz([40,30,90]);
    vy = -18;

    bubbleStream.uniforms.uBurst.value = 1;
    gsap.to(bubbleStream.uniforms.uBurst, { value:0, duration:2.6, ease:'power2.out' });

    post.fadeTo(0xCFF4FF, .85, .12);
    gsap.delayedCall(.16, ()=> post.fadeTo(0x0A2E44, 0, 1.4));
    gsap.to(cam, { fov:60, duration:2.0, ease:'power2.out',
      onUpdate(){ cam.updateProjectionMatrix(); } });
    gsap.to(post.uniforms.uAberr, { value:.0034, duration:1.8 });
    streaks.children.forEach(s=> gsap.to(s.material, { opacity:0, duration:.4 }));
    gsap.to(bioA, { intensity:2.4, duration:3 });
    gsap.to(bioB, { intensity:2.0, duration:3 });
    gsap.to(above, { intensity:.35, duration:3 });
    gsap.to(doorLight, { intensity:2.0, duration:3 });

    gsap.delayedCall(2.2, ()=>{ phase = 'descend'; });
  }

  function reachDoor(){
    phase = 'lock';
    Snd.chime(330);
    OD.toast(OD.COARSE ? 'drag each ring until it lines up'
                       : 'drag each ring until it lines up', 4200);
  }

  /* ── input ────────────────────────────────────────────────── */
  const ray = new THREE.Raycaster(), pt = new THREE.Vector2();
  let dragging=false, lx=0, ly=0, moved=0, grabbed=null;

  function down(x,y){
    dragging=true; lx=x; ly=y; moved=0; grabbed=null;
    if(phase!=='lock' || unlocked || locking) return;
    pt.set((x/innerWidth)*2-1, -(y/innerHeight)*2+1);
    ray.setFromCamera(pt, cam);
    for(const r of ringMeshes){
      if(ray.intersectObject(r.mesh, false).length){ grabbed = r; break; }
    }
  }

  function move(x,y){
    if(!dragging) return;
    const dx=x-lx, dy=y-ly; lx=x; ly=y; moved+=Math.abs(dx)+Math.abs(dy);
    if(grabbed){ grabbed.mesh.rotation.y += dx*.008; return; }
    if(phase==='inside'){
      camY = clamp(camY + dy*.16, Y_DEEP+6, Y_MOUTH);
      wantA -= dx*.005;
    } else if(phase==='lock'){
      wantA -= dx*.004;
    }
  }

  function up(x,y){
    dragging=false;
    if(grabbed){
      // snap to the nearest detent
      const step = TAU/grabbed.n;
      const snapped = Math.round(grabbed.mesh.rotation.y/step)*step;
      gsap.to(grabbed.mesh.rotation, { y:snapped, duration:.32, ease:'back.out(2)',
        onComplete(){ Snd.carve(); tryUnlock(); } });
      grabbed = null;
      return;
    }
    if(moved>9) return;

    pt.set((x/innerWidth)*2-1, -(y/innerHeight)*2+1);
    ray.setFromCamera(pt, cam);

    if(phase==='inside'){
      if(held){
        if(ray.intersectObjects(held.children, true).length) pop(held);
        else {
          const n=held; held=null;
          gsap.to(n.position, { x:n.userData.home.x, y:n.userData.home.y, z:n.userData.home.z,
            duration:.9, ease:'power2.inOut' });
          gsap.to(n.scale, { x:1,y:1,z:1, duration:.9, ease:'power2.inOut' });
          gsap.to(n.userData.glow.material, { opacity:.45, duration:.6 });
        }
        return;
      }
      const hits = ray.intersectObjects(bubbleGroup.children, true);
      if(hits.length){
        let o=hits[0].object;
        while(o && !o.userData.item) o=o.parent;
        if(o) hold(o);
      }
    }
  }

  function zoom(d){
    // scrolling down takes you deeper
    if(phase==='inside') camY = clamp(camY - d*.05, Y_DEEP+6, Y_MOUTH);
    else if(phase==='lock') wantR = clamp(wantR + d*.02, 16, 44);
  }

  /* ── frame ────────────────────────────────────────────────── */
  const camTarget = new THREE.Vector3();

  function update(dt){
    T += dt;
    water.material.uniforms.uT.value = T;
    bio.uniforms.uT.value = T;
    fish.uniforms.uT.value = T;
    bubbleStream.uniforms.uT.value = T;
    fish.uniforms.uCam.value.copy(cam.position);

    clouds.forEach(c=>{ c.rotation.z += c.userData.sp*dt; });

    coral.children.forEach(c=>{
      c.material.emissiveIntensity = .55 + .7*Math.abs(Math.sin(T*.8 + c.userData.ph));
    });
    moss.children.forEach(s=>{
      s.material.opacity = .22 + .5*Math.abs(Math.sin(T*s.userData.sp + s.userData.ph));
    });
    jellies.forEach(j=>{
      const u=j.userData;
      const pulse = .82 + .3*Math.abs(Math.sin(T*u.sp*2.4 + u.ph));
      j.scale.set(u.sc*pulse, u.sc*(2-pulse)*.9, 1);
      j.position.y = u.base.y + Math.sin(T*u.sp + u.ph)*3.4;
      j.position.x = u.base.x + Math.cos(T*u.sp*.6 + u.ph)*1.8;
      j.material.opacity = .30 + .34*Math.abs(Math.sin(T*.6 + u.ph));
    });
    rays.children.forEach(r=>{
      r.material.opacity = r.userData.o * (.5 + .5*Math.sin(T*.4 + r.userData.ph));
      r.rotation.y += dt*.04;
    });

    /* ── the fall ── */
    if(phase === 'fall'){
      vy -= 34*dt;
      camY += vy*dt;
      streaks.children.forEach(s=>{
        const u=s.userData;
        s.position.y = u.base.y + ((T*u.sp*70) % 22) - 11;
      });
      if(camY <= Y_WATER){ camY = Y_WATER - .5; splash(); }
      cam.position.set(Math.sin(T*.4)*1.4, camY, 6 + Math.cos(T*.3)*1.4);
      cam.lookAt(0, camY - 14, 0);
      cam.rotation.z = Math.sin(T*.7)*.035;
    }

    else if(phase === 'splash'){
      vy = lerp(vy, -5.5, dt*1.6);
      camY += vy*dt;
      cam.position.set(Math.sin(T*.3)*1.2, camY, 7);
      cam.lookAt(0, camY - 8, 0);
    }

    else if(phase === 'descend'){
      vy = lerp(vy, -6.5, dt*1.2);
      camY += vy*dt;
      cam.position.set(Math.sin(T*.25)*1.6, camY, 9 + Math.cos(T*.2)*1.2);
      cam.lookAt(0, camY - 7, 0);
      if(camY <= Y_DOOR + 16){ camY = Y_DOOR + 16; vy = 0; reachDoor(); }
    }

    else if(phase === 'lock'){
      camA = lerp(camA, wantA, dt*3);
      orbitR = lerp(orbitR, wantR, dt*3);
      camY = lerp(camY, Y_DOOR + 13, dt*1.6);
      cam.position.set(Math.sin(camA)*orbitR*.42, camY, Math.cos(camA)*orbitR*.42 + 12);
      camTarget.set(0, Y_DOOR + 1, 0);
      cam.lookAt(camTarget);
      door.rotation.y = Math.sin(T*.2)*.02;
    }

    else if(phase === 'inside'){
      camA = lerp(camA, wantA, dt*3);
      cam.position.set(Math.sin(camA)*7.5, camY, Math.cos(camA)*7.5);
      camTarget.set(Math.sin(camA+Math.PI)*3, camY - 2, Math.cos(camA+Math.PI)*3);
      cam.lookAt(camTarget);
      if(!dragging) wantA += dt*.05;

      // the deeper you are, the darker and the more violet it gets
      const t = clamp((Y_MOUTH - camY)/(Y_MOUTH - Y_DEEP), 0, 1);
      scene.fog = t > .55 ? DEEP_FOG : WATER_FOG;
      scene.fog.density = lerp(.024, .042, t);
      amb.color.setRGB(lerp(.07,.05,t), lerp(.22,.10,t), lerp(.30,.20,t));
      bioA.intensity = lerp(2.6,1.0,t);
      bioB.intensity = lerp(1.2,3.4,t);

      const band = depthBand();
      const meter = $('#depthMeter');
      if(meter){
        meter.style.setProperty('--p', ((1-t)*100).toFixed(1)+'%');
        const lab = $('#depthLabel');
        if(lab && lab.dataset.n !== band.name){
          lab.dataset.n = band.name;
          lab.textContent = band.name;
        }
      }
    }

    bubbleGroup.children.forEach(b=>{
      if(b === held) { b.rotation.y += dt*.4; return; }
      const u=b.userData;
      b.position.y = u.home.y + Math.sin(T*.4 + u.ph)*.9;
      b.position.x = u.home.x + Math.cos(T*.3 + u.ph)*.7;
      b.rotation.y += dt*.16;
      const inBand = Math.abs(b.position.y - camY) < 26;
      u.glow.material.opacity = (inBand ? .5 : .12) *
        (.7 + .3*Math.abs(Math.sin(T*.8 + u.ph)));
      if(u.inner) u.inner.lookAt(cam.position);
    });

    sky.position.copy(cam.position);
    water.position.x = cam.position.x;
    water.position.z = cam.position.z;
  }

  function enter(){
    phase = 'brink';
    unlocked = false; locking = false; held = null;
    door.visible = true;
    camY = Y_BRINK; vy = 0;
    cam.fov = 56; cam.updateProjectionMatrix();
    scene.fog = AIR_FOG;
    submerged = false;
    above.intensity = 1.4;
    bioA.intensity = 0; bioB.intensity = 0; doorLight.intensity = 0;
    $('#depthMeter').classList.remove('on');
    Snd.bed('wind', .22);

    // pick up a combination that was set from inside
    Store.get('vault_config','lock').then(cfg=>{
      if(cfg && cfg.combination_hash){
        comboHash = cfg.combination_hash;
        if(Array.isArray(cfg.ring_symbols) && cfg.ring_symbols.length === ringDefs.length){
          ringDefs.forEach((r,i)=>{ r.set = cfg.ring_symbols[i]; });
          buildRings();
        }
      }
    });

    gsap.delayedCall(.7, brink);
  }

  function exit(){
    Snd.bed('under', 0);
    Snd.bed('wind', 0);
    $('#depthMeter').classList.remove('on');
    post.uniforms.uAberr.value = .0016;
    cam.fov = 56; cam.updateProjectionMatrix();
  }

  function resize(){ cam.aspect = innerWidth/innerHeight; cam.updateProjectionMatrix(); }

  return {
    scene, cam, update, enter, exit, resize, down, move, up, zoom,
    addItem, recut,
    get phase(){ return phase; },
    get unlocked(){ return unlocked; },
    get count(){ return items.length; },
    dispose(){ stopVault && stopVault(); }
  };
};

})(window.OD);
