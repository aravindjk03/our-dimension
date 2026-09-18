/* ══════════════════════════════════════════════════════════════
   OUR DIMENSION — core
   device tiers · maths · procedural PBR textures · environment
   cinematic post chain · audio · shared data · ui primitives
   ══════════════════════════════════════════════════════════════ */
window.OD = window.OD || {};
(function(OD){
"use strict";

/* ── config ─────────────────────────────────────────────────── */
const CFG = OD.CFG = {
  start: new Date(2021, 3, 6, 0, 0, 0),
  her: { pet:'PAPA', name:'Diana Saldin', hex:0xF3A0B8, css:'#F3A0B8' },
  him: { pet:'AVI',  name:'Aravind',      hex:0xF6C177, css:'#F6C177' },
  line: '…of loving you'
};

/* ── device ─────────────────────────────────────────────────── */
const COARSE  = OD.COARSE  = matchMedia('(pointer:coarse)').matches;
const REDUCED = OD.REDUCED = matchMedia('(prefers-reduced-motion: reduce)').matches;
const TIER    = OD.TIER    = innerWidth < 768 ? 'mobile' : innerWidth < 1024 ? 'tablet' : 'desktop';
const Q = OD.Q = {
  mobile : { dust:260, shards:9,  dpr:0.8,  leaves:1200, motes:140, bridge:26, tex:512,  bloom:false, blurSteps:1, aniso:2 },
  tablet : { dust:520, shards:15, dpr:1,    leaves:2000, motes:220, bridge:38, tex:1024, bloom:true,  blurSteps:2, aniso:4 },
  desktop: { dust:900, shards:22, dpr:Math.min(devicePixelRatio,2), leaves:2900, motes:320, bridge:54, tex:1024, bloom:true, blurSteps:3, aniso:8 }
}[TIER];

/* ── maths ──────────────────────────────────────────────────── */
const TAU = OD.TAU = Math.PI*2;
const clamp = OD.clamp = (v,a,b)=> v<a?a:v>b?b:v;
const lerp  = OD.lerp  = (a,b,t)=> a+(b-a)*t;
const rnd   = OD.rnd   = (a,b)=> a+Math.random()*(b-a);
const smooth= OD.smooth= t=> t*t*(3-2*t);
/* transmission is expensive on phones; fall back to plain translucency there */
const tr = OD.tr = v => TIER==='mobile' ? 0 : v;

function hash(x,y,z){ const n = Math.sin(x*127.1 + y*311.7 + z*74.7)*43758.5453; return n-Math.floor(n); }
const noise3 = OD.noise3 = function(x,y,z){
  const xi=Math.floor(x), yi=Math.floor(y), zi=Math.floor(z);
  const xf=x-xi, yf=y-yi, zf=z-zi;
  const u=smooth(xf), v=smooth(yf), w=smooth(zf);
  let r=0;
  for(let i=0;i<2;i++)for(let j=0;j<2;j++)for(let k=0;k<2;k++)
    r += hash(xi+i,yi+j,zi+k)*(i?u:1-u)*(j?v:1-v)*(k?w:1-w);
  return r*2-1;
};
const fbm = OD.fbm = function(x,y,z,oct){
  let a=.5, f=1, s=0, n=0;
  for(let i=0;i<(oct||4);i++){ s += noise3(x*f,y*f,z*f)*a; n+=a; a*=.5; f*=2.03; }
  return s/n;
};

/* deterministic per-seed rng so a reload gives the same world */
OD.rng = function(seed){
  let s = seed>>>0 || 1;
  return function(){ s ^= s<<13; s^=s>>>17; s^=s<<5; s>>>=0; return s/4294967296; };
};

/* ── canvas helpers ─────────────────────────────────────────── */
function cv(size){
  const c = document.createElement('canvas');
  c.width = c.height = size;
  return c;
}
function tex(canvas, repeat, srgb){
  const t = new THREE.CanvasTexture(canvas);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  if(repeat) t.repeat.set(repeat, repeat);
  if(srgb !== false) t.encoding = THREE.sRGBEncoding;
  t.anisotropy = Q.aniso;
  return t;
}
OD.tex = tex;

/* derive a tangent-space normal map from a height canvas */
function normalFromHeight(hc, strength){
  const S = hc.width;
  const src = hc.getContext('2d').getImageData(0,0,S,S).data;
  const out = cv(S);
  const g = out.getContext('2d');
  const img = g.createImageData(S,S);
  const H = (x,y)=>{
    x=(x+S)%S; y=(y+S)%S;
    return src[(y*S+x)*4]/255;
  };
  const k = strength || 2.2;
  for(let y=0;y<S;y++) for(let x=0;x<S;x++){
    const dx = (H(x+1,y)-H(x-1,y))*k;
    const dy = (H(x,y+1)-H(x,y-1))*k;
    let nx=-dx, ny=-dy, nz=1;
    const l = Math.hypot(nx,ny,nz);
    const i=(y*S+x)*4;
    img.data[i]   = (nx/l*.5+.5)*255;
    img.data[i+1] = (ny/l*.5+.5)*255;
    img.data[i+2] = (nz/l*.5+.5)*255;
    img.data[i+3] = 255;
  }
  g.putImageData(img,0,0);
  const t = tex(out, 1, false);
  t.encoding = THREE.LinearEncoding;
  return t;
}
OD.normalFromHeight = normalFromHeight;

/* ── soft sprites ───────────────────────────────────────────── */
function softSprite(stops){
  const c = cv(64), g = c.getContext('2d');
  const grd = g.createRadialGradient(32,32,0,32,32,32);
  (stops || [[0,'rgba(255,255,255,1)'],[.34,'rgba(255,255,255,.55)'],[1,'rgba(255,255,255,0)']])
    .forEach(s=>grd.addColorStop(s[0],s[1]));
  g.fillStyle=grd; g.fillRect(0,0,64,64);
  const t=new THREE.CanvasTexture(c); t.encoding=THREE.sRGBEncoding; return t;
}
OD.SPRITE = softSprite();
OD.GLOW   = softSprite([[0,'rgba(255,255,255,1)'],[.16,'rgba(255,255,255,.72)'],[.5,'rgba(255,255,255,.18)'],[1,'rgba(255,255,255,0)']]);
OD.LEAF   = (function(){
  const c=cv(64), g=c.getContext('2d');
  g.translate(32,32); g.rotate(-.5); g.scale(1,.6);
  const grd=g.createRadialGradient(0,0,0,0,0,30);
  grd.addColorStop(0,'rgba(255,255,255,1)'); grd.addColorStop(.62,'rgba(255,255,255,.72)');
  grd.addColorStop(1,'rgba(255,255,255,0)');
  g.fillStyle=grd; g.beginPath(); g.arc(0,0,30,0,TAU); g.fill();
  const t=new THREE.CanvasTexture(c); t.encoding=THREE.sRGBEncoding; return t;
})();
OD.softSprite = softSprite;

/* ══════════════════════════════════════════════════════════════
   PROCEDURAL MATERIALS
   Everything is drawn at load. No external image is ever fetched,
   which keeps the page inside its budget and the CSP happy.
   ══════════════════════════════════════════════════════════════ */
const MAT = OD.MAT = {};

/* — tempered dark chocolate ————————————————————————————— */
function chocolateMaps(S){
  const alb = cv(S), a = alb.getContext('2d');
  const hgt = cv(S), h = hgt.getContext('2d');
  const rgh = cv(S), r = rgh.getContext('2d');

  const ai = a.createImageData(S,S);
  const hi = h.createImageData(S,S);
  const ri = r.createImageData(S,S);

  for(let y=0;y<S;y++) for(let x=0;x<S;x++){
    const u=x/S*7, v=y/S*7;
    // broad cocoa mottling + fine conching grain
    const big  = fbm(u, v, 0.0, 4);
    const fine = fbm(u*9.1, v*9.1, 3.3, 3);
    const micro= noise3(x*.42, y*.42, 11.0);
    // the pale streaks tempered chocolate gets as it sets
    const streak = Math.pow(Math.max(0, fbm(u*.6, v*3.4, 7.0, 2)), 3) * .55;

    let t = .5 + big*.34 + fine*.16;
    t = clamp(t, 0, 1);
    // #2A1408 -> #5C3218, with a cocoa-butter bloom on top
    const R = lerp(0x24, 0x62, t) + streak*44;
    const G = lerp(0x11, 0x36, t) + streak*34;
    const B = lerp(0x06, 0x19, t) + streak*26;

    const i=(y*S+x)*4;
    ai.data[i]=clamp(R,0,255); ai.data[i+1]=clamp(G,0,255); ai.data[i+2]=clamp(B,0,255); ai.data[i+3]=255;

    const hv = clamp(.5 + big*.30 + fine*.26 + micro*.10, 0, 1)*255;
    hi.data[i]=hi.data[i+1]=hi.data[i+2]=hv; hi.data[i+3]=255;

    // glossier where it is smooth, duller on the bloom streaks
    const rv = clamp(.20 + fine*.14 + streak*.55, .07, .85)*255;
    ri.data[i]=ri.data[i+1]=ri.data[i+2]=rv; ri.data[i+3]=255;
  }
  a.putImageData(ai,0,0); h.putImageData(hi,0,0); r.putImageData(ri,0,0);
  return { albedo:tex(alb,1), normal:normalFromHeight(hgt, 1.5), rough:tex(rgh,1,false) };
}

/* — a fresh break: matte, porous, paler ——————————————— */
function breakMaps(S){
  const alb = cv(S), a = alb.getContext('2d');
  const hgt = cv(S), h = hgt.getContext('2d');
  const ai=a.createImageData(S,S), hi=h.createImageData(S,S);
  for(let y=0;y<S;y++) for(let x=0;x<S;x++){
    const u=x/S*11, v=y/S*11;
    const n = fbm(u,v,21.0,4), g = noise3(x*.9,y*.9,5.0);
    const t = clamp(.5+n*.5, 0, 1);
    const R=lerp(0x4A,0x8C,t), G=lerp(0x28,0x55,t), B=lerp(0x12,0x2C,t);
    const i=(y*S+x)*4;
    ai.data[i]=R; ai.data[i+1]=G; ai.data[i+2]=B; ai.data[i+3]=255;
    const hv=clamp(.5+n*.44+g*.24,0,1)*255;
    hi.data[i]=hi.data[i+1]=hi.data[i+2]=hv; hi.data[i+3]=255;
  }
  a.putImageData(ai,0,0); h.putImageData(hi,0,0);
  return { albedo:tex(alb,1), normal:normalFromHeight(hgt, 3.4) };
}

/* — aged warm wood ——————————————————————————————————— */
function woodMaps(S, tint){
  const alb=cv(S), a=alb.getContext('2d');
  const hgt=cv(S), h=hgt.getContext('2d');
  const ai=a.createImageData(S,S), hi=h.createImageData(S,S);
  const base = tint || [0x6B,0x48,0x2B];
  for(let y=0;y<S;y++) for(let x=0;x<S;x++){
    const u=x/S, v=y/S;
    // growth rings pulled along one axis, plus knots
    const warp = fbm(u*3.0, v*.6, 2.0, 3)*.28;
    const rings = Math.sin((v*14.0 + warp*9.0)*Math.PI);
    const grain = fbm(u*44.0, v*3.0, 9.0, 2);
    const t = clamp(.5 + rings*.22 + grain*.26, 0, 1);
    const i=(y*S+x)*4;
    ai.data[i]  = clamp(base[0]*(.62+t*.72),0,255);
    ai.data[i+1]= clamp(base[1]*(.62+t*.72),0,255);
    ai.data[i+2]= clamp(base[2]*(.62+t*.72),0,255);
    ai.data[i+3]= 255;
    const hv = clamp(.5 + rings*.28 + grain*.32, 0, 1)*255;
    hi.data[i]=hi.data[i+1]=hi.data[i+2]=hv; hi.data[i+3]=255;
  }
  a.putImageData(ai,0,0); h.putImageData(hi,0,0);
  return { albedo:tex(alb,1), normal:normalFromHeight(hgt, 2.0) };
}

/* — bark ——————————————————————————————————————————————— */
function barkMaps(S){
  const alb=cv(S), a=alb.getContext('2d');
  const hgt=cv(S), h=hgt.getContext('2d');
  const ai=a.createImageData(S,S), hi=h.createImageData(S,S);
  for(let y=0;y<S;y++) for(let x=0;x<S;x++){
    const u=x/S, v=y/S;
    // vertical fissures
    const f = Math.abs(fbm(u*7.0, v*1.4, 4.0, 4));
    const crack = Math.pow(1-clamp(f*3.2,0,1), 2.2);
    const moss = clamp(fbm(u*4.0, v*4.0, 31.0, 3)*.5+.5, 0, 1);
    const t = clamp(.45 + f*.9, 0, 1);
    const i=(y*S+x)*4;
    let R = lerp(0x2A,0x6A,t), G = lerp(0x1C,0x4A,t), B = lerp(0x12,0x30,t);
    if(moss > .72){ R=lerp(R,0x4E,.42); G=lerp(G,0x76,.42); B=lerp(B,0x3A,.42); }
    R -= crack*36; G -= crack*26; B -= crack*18;
    ai.data[i]=clamp(R,0,255); ai.data[i+1]=clamp(G,0,255); ai.data[i+2]=clamp(B,0,255); ai.data[i+3]=255;
    const hv = clamp(.55 - crack*.55 + f*.4, 0, 1)*255;
    hi.data[i]=hi.data[i+1]=hi.data[i+2]=hv; hi.data[i+3]=255;
  }
  a.putImageData(ai,0,0); h.putImageData(hi,0,0);
  return { albedo:tex(alb,2), normal:normalFromHeight(hgt, 3.0) };
}

/* — laid paper for letters —————————————————————————————— */
function paperMaps(S){
  const alb=cv(S), a=alb.getContext('2d');
  const hgt=cv(S), h=hgt.getContext('2d');
  const ai=a.createImageData(S,S), hi=h.createImageData(S,S);
  for(let y=0;y<S;y++) for(let x=0;x<S;x++){
    const u=x/S*9, v=y/S*9;
    const fib = fbm(u*13,v*13,17,3);
    const laid = Math.sin(y*.55)*.04 + Math.sin(x*.09)*.03;
    const stain = Math.pow(clamp(fbm(u*.7,v*.7,41,3)*.5+.5,0,1), 3)*.22;
    const t = clamp(.86 + fib*.10 + laid, 0, 1);
    const i=(y*S+x)*4;
    ai.data[i]  = clamp(246*t - stain*46, 0, 255);
    ai.data[i+1]= clamp(234*t - stain*56, 0, 255);
    ai.data[i+2]= clamp(212*t - stain*70, 0, 255);
    ai.data[i+3]= 255;
    const hv=clamp(.5+fib*.5+laid*4,0,1)*255;
    hi.data[i]=hi.data[i+1]=hi.data[i+2]=hv; hi.data[i+3]=255;
  }
  a.putImageData(ai,0,0); h.putImageData(hi,0,0);
  return { albedo:tex(alb,1), normal:normalFromHeight(hgt, 1.1) };
}

/* — rock / island crust ————————————————————————————————— */
function rockMaps(S){
  const hgt=cv(S), h=hgt.getContext('2d');
  const hi=h.createImageData(S,S);
  for(let y=0;y<S;y++) for(let x=0;x<S;x++){
    const n = fbm(x/S*9, y/S*9, 63, 5);
    const i=(y*S+x)*4;
    const hv=clamp(.5+n*.55,0,1)*255;
    hi.data[i]=hi.data[i+1]=hi.data[i+2]=hv; hi.data[i+3]=255;
  }
  h.putImageData(hi,0,0);
  return { normal: normalFromHeight(hgt, 2.6) };
}

OD.buildMaterials = function(){
  const S = Q.tex;
  const choc  = chocolateMaps(S);
  const brk   = breakMaps(S/2);
  const wood  = woodMaps(S, [0x76,0x50,0x2E]);
  const dwood = woodMaps(S/2, [0x46,0x30,0x1E]);
  const bark  = barkMaps(S);
  const paper = paperMaps(S/2);
  const rock  = rockMaps(S/2);

  MAT.chocolate = new THREE.MeshPhysicalMaterial({
    map: choc.albedo, normalMap: choc.normal, roughnessMap: choc.rough,
    normalScale: new THREE.Vector2(.55,.55),
    color: 0xFFFFFF, roughness: 1.0, metalness: .04,
    clearcoat: .68, clearcoatRoughness: .16,
    envMapIntensity: 1.35
  });
  MAT.chocolateBreak = new THREE.MeshStandardMaterial({
    map: brk.albedo, normalMap: brk.normal,
    normalScale: new THREE.Vector2(1.2,1.2),
    roughness: .92, metalness: .0, envMapIntensity: .35
  });
  MAT.wood = new THREE.MeshStandardMaterial({
    map: wood.albedo, normalMap: wood.normal, roughness: .78, metalness: 0, envMapIntensity: .8
  });
  MAT.woodDark = new THREE.MeshStandardMaterial({
    map: dwood.albedo, normalMap: dwood.normal, roughness: .88, metalness: 0, envMapIntensity: .6
  });
  MAT.bark = new THREE.MeshStandardMaterial({
    map: bark.albedo, normalMap: bark.normal, roughness: .96, metalness: 0, envMapIntensity: .5
  });
  MAT.paper = new THREE.MeshStandardMaterial({
    map: paper.albedo, normalMap: paper.normal, roughness: .94, metalness: 0,
    side: THREE.DoubleSide, envMapIntensity: .7
  });
  MAT.rockNormal = rock.normal;
  MAT.paperMap = paper.albedo;
  return MAT;
};

/* ══════════════════════════════════════════════════════════════
   ENVIRONMENT — a tiny procedural studio so clearcoat has
   something to reflect. This is most of what sells the chocolate.
   ══════════════════════════════════════════════════════════════ */
OD.makeEnv = function(renderer, preset){
  const W = 512, H = 256;
  const c = document.createElement('canvas'); c.width=W; c.height=H;
  const g = c.getContext('2d');
  const P = preset || 'warm';

  const sky = g.createLinearGradient(0,0,0,H);
  if(P === 'warm'){
    sky.addColorStop(0,'#3A2415'); sky.addColorStop(.42,'#1A0E07'); sky.addColorStop(1,'#080402');
  } else if(P === 'night'){
    sky.addColorStop(0,'#16203A'); sky.addColorStop(.5,'#0A0E1C'); sky.addColorStop(1,'#04060C');
  } else {
    sky.addColorStop(0,'#9FC3D8'); sky.addColorStop(.46,'#FFE3BE'); sky.addColorStop(1,'#4A3A2A');
  }
  g.fillStyle = sky; g.fillRect(0,0,W,H);

  // the key light, as a soft rectangle high and to the left
  function blob(x,y,rx,ry,col,alpha){
    const grd=g.createRadialGradient(x,y,0,x,y,Math.max(rx,ry));
    grd.addColorStop(0,col); grd.addColorStop(1,'rgba(0,0,0,0)');
    g.save(); g.globalAlpha=alpha; g.translate(x,y); g.scale(1,ry/rx); g.translate(-x,-y);
    g.fillStyle=grd; g.beginPath(); g.arc(x,y,rx,0,TAU); g.fill(); g.restore();
  }
  blob(W*0.22, H*0.24, 96, 62, 'rgba(255,226,180,1)', 1);     // key
  blob(W*0.72, H*0.34, 70, 48, 'rgba(255,170,110,.75)', 1);   // warm fill
  blob(W*0.50, H*0.08, 150, 40, 'rgba(255,240,215,.45)', 1);  // overhead sheen
  if(P === 'night'){
    blob(W*0.80, H*0.20, 60, 40, 'rgba(150,200,255,.5)', 1);
  }
  // a faint horizon line gives edges something to catch
  const hz = g.createLinearGradient(0,H*.52,0,H*.62);
  hz.addColorStop(0,'rgba(255,200,150,.22)'); hz.addColorStop(1,'rgba(0,0,0,0)');
  g.fillStyle=hz; g.fillRect(0,H*.52,W,H*.10);

  const t = new THREE.CanvasTexture(c);
  t.mapping = THREE.EquirectangularReflectionMapping;
  t.encoding = THREE.sRGBEncoding;

  const pmrem = new THREE.PMREMGenerator(renderer);
  pmrem.compileEquirectangularShader();
  const env = pmrem.fromEquirectangular(t).texture;
  pmrem.dispose(); t.dispose();
  return env;
};

/* ══════════════════════════════════════════════════════════════
   POST — bright pass, separable blur, then one composite that does
   ACES, bloom, vignette, chromatic aberration, grain and sRGB.
   Written against three's core only: no addon imports.
   ══════════════════════════════════════════════════════════════ */
OD.Post = function(renderer){
  const quadCam = new THREE.OrthographicCamera(-1,1,1,-1,0,1);
  const quadGeo = new THREE.PlaneGeometry(2,2);
  const quadScene = new THREE.Scene();
  const quad = new THREE.Mesh(quadGeo, null);
  quadScene.add(quad);

  const RT = (w,h,type)=> new THREE.WebGLRenderTarget(Math.max(2,w|0), Math.max(2,h|0), {
    minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter,
    format: THREE.RGBAFormat, type: type || THREE.HalfFloatType,
    depthBuffer: true, stencilBuffer: false
  });

  let sceneRT = null, bright = null, blurA = [], blurB = [];
  const STEPS = Q.blurSteps;

  const brightMat = new THREE.ShaderMaterial({
    uniforms:{ tDiffuse:{value:null}, uThresh:{value:0.62}, uKnee:{value:0.38} },
    vertexShader:`varying vec2 vUv; void main(){ vUv=uv; gl_Position=vec4(position.xy,0.,1.); }`,
    fragmentShader:`
      varying vec2 vUv; uniform sampler2D tDiffuse; uniform float uThresh,uKnee;
      void main(){
        vec3 c = texture2D(tDiffuse,vUv).rgb;
        float l = dot(c, vec3(0.2126,0.7152,0.0722));
        float s = smoothstep(uThresh - uKnee, uThresh + uKnee, l);
        gl_FragColor = vec4(c * s, 1.0);
      }`
  });

  const blurMat = new THREE.ShaderMaterial({
    uniforms:{ tDiffuse:{value:null}, uDir:{value:new THREE.Vector2(1,0)}, uTexel:{value:new THREE.Vector2()} },
    vertexShader:`varying vec2 vUv; void main(){ vUv=uv; gl_Position=vec4(position.xy,0.,1.); }`,
    fragmentShader:`
      varying vec2 vUv; uniform sampler2D tDiffuse; uniform vec2 uDir,uTexel;
      void main(){
        vec2 o = uDir * uTexel;
        vec3 c = texture2D(tDiffuse,vUv).rgb * 0.227027;
        c += texture2D(tDiffuse, vUv + o*1.3846).rgb * 0.316216;
        c += texture2D(tDiffuse, vUv - o*1.3846).rgb * 0.316216;
        c += texture2D(tDiffuse, vUv + o*3.2308).rgb * 0.070270;
        c += texture2D(tDiffuse, vUv - o*3.2308).rgb * 0.070270;
        gl_FragColor = vec4(c,1.0);
      }`
  });

  const compMat = new THREE.ShaderMaterial({
    uniforms:{
      tDiffuse:{value:null}, tBloom0:{value:null}, tBloom1:{value:null}, tBloom2:{value:null},
      uBloom:{value:0.85}, uExposure:{value:1.08}, uVignette:{value:1.0},
      uGrain:{value:0.045}, uAberr:{value:0.0016}, uTime:{value:0}, uSteps:{value:STEPS},
      uTint:{value:new THREE.Color(0xFFFFFF)}, uFade:{value:0.0}, uFadeCol:{value:new THREE.Color(0x000000)}
    },
    vertexShader:`varying vec2 vUv; void main(){ vUv=uv; gl_Position=vec4(position.xy,0.,1.); }`,
    fragmentShader:`
      varying vec2 vUv;
      uniform sampler2D tDiffuse,tBloom0,tBloom1,tBloom2;
      uniform float uBloom,uExposure,uVignette,uGrain,uAberr,uTime,uFade;
      uniform int uSteps;
      uniform vec3 uTint,uFadeCol;

      vec3 aces(vec3 x){
        const float a=2.51,b=0.03,c=2.43,d=0.59,e=0.14;
        return clamp((x*(a*x+b))/(x*(c*x+d)+e),0.0,1.0);
      }
      float rand(vec2 p){ return fract(sin(dot(p,vec2(12.9898,78.233)))*43758.5453); }

      void main(){
        vec2 uv = vUv;
        vec2 d = uv - 0.5;
        float r2 = dot(d,d);

        // chromatic aberration grows toward the edges, like a real lens
        float ab = uAberr * r2 * 4.0;
        vec3 col;
        col.r = texture2D(tDiffuse, uv + d*ab).r;
        col.g = texture2D(tDiffuse, uv).g;
        col.b = texture2D(tDiffuse, uv - d*ab).b;

        vec3 bl = texture2D(tBloom0,uv).rgb;
        if(uSteps > 1) bl += texture2D(tBloom1,uv).rgb * 0.75;
        if(uSteps > 2) bl += texture2D(tBloom2,uv).rgb * 0.55;
        col += bl * uBloom;

        col *= uExposure;
        col = aces(col);
        col *= uTint;

        // vignette
        float vig = smoothstep(0.92, 0.22, r2 * uVignette * 2.1);
        col *= mix(0.42, 1.0, vig);

        // Fine grain, animated. Weighted by luminance: real film grain lives
        // in the midtones, and unweighted grain on a near-black frame reads as
        // television static once the sRGB curve lifts it.
        float g = rand(uv * vec2(1920.0,1080.0) + fract(uTime)*97.0) - 0.5;
        float luma = dot(col, vec3(0.2126,0.7152,0.0722));
        col += g * uGrain * (0.08 + 0.92 * sqrt(clamp(luma, 0.0, 1.0)));

        col = mix(col, uFadeCol, uFade);

        // linear -> sRGB
        col = pow(max(col, vec3(0.0)), vec3(1.0/2.2));
        gl_FragColor = vec4(col, 1.0);
      }`
  });

  function resize(w,h){
    const pr = renderer.getPixelRatio();
    const W = Math.max(2, (w*pr)|0), H = Math.max(2,(h*pr)|0);
    [sceneRT,bright].forEach(t=>t&&t.dispose());
    blurA.forEach(t=>t.dispose()); blurB.forEach(t=>t.dispose());
    sceneRT = RT(W,H);
    sceneRT.texture.encoding = THREE.LinearEncoding;
    bright = RT(W/2,H/2);
    blurA = []; blurB = [];
    for(let i=0;i<STEPS;i++){
      const s = Math.pow(2, i+1);
      blurA.push(RT(W/s/2, H/s/2));
      blurB.push(RT(W/s/2, H/s/2));
    }
  }

  function render(scene, camera, dt){
    if(!sceneRT) return;
    renderer.setRenderTarget(sceneRT);
    renderer.clear();
    renderer.render(scene, camera);

    if(!Q.bloom){
      compMat.uniforms.tDiffuse.value = sceneRT.texture;
      compMat.uniforms.tBloom0.value = compMat.uniforms.tBloom1.value =
        compMat.uniforms.tBloom2.value = sceneRT.texture;
      compMat.uniforms.uBloom.value = 0.0;
    } else {
      quad.material = brightMat;
      brightMat.uniforms.tDiffuse.value = sceneRT.texture;
      renderer.setRenderTarget(bright);
      renderer.render(quadScene, quadCam);

      let src = bright;
      quad.material = blurMat;
      for(let i=0;i<STEPS;i++){
        const a=blurA[i], b=blurB[i];
        blurMat.uniforms.uTexel.value.set(1/a.width, 1/a.height);
        blurMat.uniforms.tDiffuse.value = src.texture;
        blurMat.uniforms.uDir.value.set(1,0);
        renderer.setRenderTarget(a); renderer.render(quadScene, quadCam);
        blurMat.uniforms.tDiffuse.value = a.texture;
        blurMat.uniforms.uDir.value.set(0,1);
        renderer.setRenderTarget(b); renderer.render(quadScene, quadCam);
        src = b;
      }
      compMat.uniforms.tDiffuse.value = sceneRT.texture;
      compMat.uniforms.tBloom0.value = blurB[0].texture;
      compMat.uniforms.tBloom1.value = blurB[Math.min(1,STEPS-1)].texture;
      compMat.uniforms.tBloom2.value = blurB[Math.min(2,STEPS-1)].texture;
    }

    compMat.uniforms.uTime.value += dt||0.016;
    quad.material = compMat;
    renderer.setRenderTarget(null);
    renderer.render(quadScene, quadCam);
  }

  return {
    resize, render, uniforms: compMat.uniforms,
    set bloom(v){ compMat.uniforms.uBloom.value = Q.bloom ? v : 0; },
    set exposure(v){ compMat.uniforms.uExposure.value = v; },
    set vignette(v){ compMat.uniforms.uVignette.value = v; },
    set grain(v){ compMat.uniforms.uGrain.value = v; },
    set aberration(v){ compMat.uniforms.uAberr.value = v; },
    fadeTo(col, amt, dur){
      compMat.uniforms.uFadeCol.value.set(col);
      return gsap.to(compMat.uniforms.uFade, { value:amt, duration:dur, ease:'power2.inOut' });
    }
  };
};

/* ══════════════════════════════════════════════════════════════
   AUDIO — everything synthesised, nothing downloaded
   ══════════════════════════════════════════════════════════════ */
OD.Snd = (function(){
  let ctx=null, master=null, on=false, built=false, noiseBuf=null;
  const beds = {};

  function ensure(){
    if(ctx) return ctx;
    const AC = window.AudioContext || window.webkitAudioContext;
    if(!AC) return null;
    ctx = new AC();
    master = ctx.createGain(); master.gain.value=0; master.connect(ctx.destination);
    const len = ctx.sampleRate*3;
    noiseBuf = ctx.createBuffer(1,len,ctx.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for(let i=0;i<len;i++) d[i]=Math.random()*2-1;
    return ctx;
  }

  function bed(name, build){
    if(beds[name]) return beds[name];
    const g = ctx.createGain(); g.gain.value=0; g.connect(master);
    build(g); beds[name]=g; return g;
  }

  function buildAll(){
    if(built||!ctx) return; built=true;

    bed('workshop', g=>{                       // the chocolatier's room
      const lp=ctx.createBiquadFilter(); lp.type='lowpass'; lp.frequency.value=210; lp.Q.value=.6;
      lp.connect(g);
      [55,55.7,82.5].forEach((f,i)=>{
        const o=ctx.createOscillator(); o.type=i===2?'sine':'sawtooth'; o.frequency.value=f;
        const og=ctx.createGain(); og.gain.value=i===2?.10:.042;
        o.connect(og); og.connect(lp); o.start();
      });
      const l=ctx.createOscillator(); l.frequency.value=.055;
      const lg=ctx.createGain(); lg.gain.value=58; l.connect(lg); lg.connect(lp.frequency); l.start();
    });

    bed('wind', g=>{
      const s=ctx.createBufferSource(); s.buffer=noiseBuf; s.loop=true;
      const bp=ctx.createBiquadFilter(); bp.type='bandpass'; bp.frequency.value=540; bp.Q.value=.7;
      s.connect(bp); bp.connect(g); s.start();
      const l=ctx.createOscillator(); l.frequency.value=.085;
      const lg=ctx.createGain(); lg.gain.value=300; l.connect(lg); lg.connect(bp.frequency); l.start();
    });

    bed('fire', g=>{
      const s=ctx.createBufferSource(); s.buffer=noiseBuf; s.loop=true;
      const lp=ctx.createBiquadFilter(); lp.type='lowpass'; lp.frequency.value=900;
      const hp=ctx.createBiquadFilter(); hp.type='highpass'; hp.frequency.value=180;
      s.connect(hp); hp.connect(lp); lp.connect(g); s.start();
      const l=ctx.createOscillator(); l.frequency.value=2.7;
      const lg=ctx.createGain(); lg.gain.value=420; l.connect(lg); lg.connect(lp.frequency); l.start();
    });

    bed('under', g=>{                          // muffled underwater
      const s=ctx.createBufferSource(); s.buffer=noiseBuf; s.loop=true;
      const lp=ctx.createBiquadFilter(); lp.type='lowpass'; lp.frequency.value=260; lp.Q.value=2;
      s.connect(lp); lp.connect(g); s.start();
    });
  }

  function ramp(node,to,t){
    if(!node||!ctx) return;
    const n=ctx.currentTime;
    node.gain.cancelScheduledValues(n);
    node.gain.setValueAtTime(node.gain.value,n);
    node.gain.linearRampToValueAtTime(to, n+(t||1.4));
  }

  function noise(dur, type, f0, f1, vol, q){
    if(!ctx||!on) return;
    const t=ctx.currentTime;
    const s=ctx.createBufferSource(); s.buffer=noiseBuf;
    const bp=ctx.createBiquadFilter(); bp.type=type||'bandpass'; bp.Q.value=q||1.2;
    bp.frequency.setValueAtTime(f0,t);
    bp.frequency.exponentialRampToValueAtTime(Math.max(40,f1),t+dur);
    const g=ctx.createGain();
    g.gain.setValueAtTime(vol,t); g.gain.exponentialRampToValueAtTime(.0008,t+dur);
    s.connect(bp); bp.connect(g); g.connect(master); s.start(t); s.stop(t+dur+.05);
  }

  function tone(f, dur, type, vol, slideTo){
    if(!ctx||!on) return;
    const t=ctx.currentTime;
    const o=ctx.createOscillator(); o.type=type||'sine'; o.frequency.setValueAtTime(f,t);
    if(slideTo) o.frequency.exponentialRampToValueAtTime(slideTo,t+dur);
    const g=ctx.createGain(); g.gain.setValueAtTime(0,t);
    g.gain.linearRampToValueAtTime(vol||.15,t+.015);
    g.gain.exponentialRampToValueAtTime(.0006,t+dur);
    o.connect(g); g.connect(master); o.start(t); o.stop(t+dur+.05);
  }

  return {
    get enabled(){ return on; },
    wake(){ ensure(); if(ctx&&ctx.state==='suspended') ctx.resume(); },
    toggle(){
      ensure(); if(!ctx) return false;
      if(ctx.state==='suspended') ctx.resume();
      buildAll(); on=!on; ramp(master, on?.6:0, 1.0); return on;
    },
    /* mix a named bed */
    bed(name, v, t){ if(ctx&&on&&beds[name]) ramp(beds[name], v, t||2.0); },
    silenceAll(t){ Object.keys(beds).forEach(k=>ramp(beds[k],0,t||1.2)); },

    crack(){ noise(.34,'bandpass',3400,300,.9,1.5); tone(180,.22,'triangle',.5,48); },
    snap(){ noise(.12,'bandpass',5200,900,.5,2.4); },
    whoosh(){
      if(!ctx||!on) return;
      const t=ctx.currentTime;
      const s=ctx.createBufferSource(); s.buffer=noiseBuf;
      const bp=ctx.createBiquadFilter(); bp.type='bandpass'; bp.Q.value=1.1;
      bp.frequency.setValueAtTime(220,t);
      bp.frequency.exponentialRampToValueAtTime(1900,t+.9);
      bp.frequency.exponentialRampToValueAtTime(300,t+2.0);
      const g=ctx.createGain(); g.gain.setValueAtTime(0,t);
      g.gain.linearRampToValueAtTime(.32,t+.5); g.gain.linearRampToValueAtTime(0,t+2.1);
      s.connect(bp); bp.connect(g); g.connect(master); s.start(t); s.stop(t+2.2);
    },
    paper(){ noise(.20,'highpass',2600,1400,.22,.7); },
    ink(){ noise(.035,'bandpass',rnd(2400,4200),1600,.10,3); },
    carve(){ noise(.07,'bandpass',rnd(700,1500),400,.16,2.2); },
    splash(){ noise(.7,'lowpass',2600,160,.7,.8); },
    bubble(){ tone(rnd(420,900),.16,'sine',.12, rnd(900,1600)); },
    match(){ noise(.22,'highpass',5200,1800,.4,.9); },
    seal(){ noise(.5,'lowpass',900,140,.5,.7); tone(90,.4,'sine',.22); },
    rumble(){ noise(1.5,'lowpass',260,50,.85,.6); tone(42,1.3,'sine',.40,26); },
    glass(){ tone(1760,1.4,'sine',.14,2093); tone(2640,1.1,'sine',.06); },
    chime(f){
      if(!ctx||!on) return;
      [1,2.01,3.02,4.04].forEach((m,i)=> tone((f||528)*m, 2.2-i*.3, 'sine', .15/(i+1)));
    },
    heartbeat(){ tone(62,.20,'sine',.45,44); setTimeout(()=>tone(56,.26,'sine',.34,38), 230); }
  };
})();

/* ══════════════════════════════════════════════════════════════
   SHARED DATA + IDENTITY
   The page must be fully usable with no database at all; shared
   state lights up only when the capability actually resolves.
   ══════════════════════════════════════════════════════════════ */
OD.Store = (function(){
  let db=null, user=null, uid=null, side=null, canWrite=null, ready=false;

  function ls(k,v){
    try{ if(v===undefined) return localStorage.getItem(k); localStorage.setItem(k,v); return v; }
    catch(e){ return null; }
  }

  async function boot(){
    if(window.claude && claude.use){
      try{ db   = await claude.use('db'); }catch(e){ db=null; }
      try{ user = await claude.use('user'); }catch(e){ user=null; }
    }
    if(user){
      try{ uid = await user.id(); }catch(e){ uid=null; }
      try{ canWrite = await user.can('data.write'); }catch(e){ canWrite=null; }
    }
    const remembered = ls('od.side');
    if(remembered==='her'||remembered==='him') side = remembered;

    if(db){
      try{
        const c = await db.doc('config/relationship').get();
        if(c.exists){
          const d=c.data();
          if(d.start){ const dt=new Date(d.start); if(!isNaN(dt)) CFG.start=dt; }
          if(d.her_pet) CFG.her.pet=String(d.her_pet);
          if(d.him_pet) CFG.him.pet=String(d.him_pet);
          if(d.her_name) CFG.her.name=String(d.her_name);
          if(d.him_name) CFG.him.name=String(d.him_name);
          if(d.line) CFG.line=String(d.line);
        }
      }catch(e){}
      if(uid){
        try{
          const s = await db.doc('config/identities').get();
          const d = s.exists ? s.data() : {};
          if(d.her===uid) side='her';
          else if(d.him===uid) side='him';
          else if(side) await claim(side, d);
        }catch(e){}
      }
    }
    ready = true;
    return side;
  }

  async function claim(s, known){
    try{
      const d = known || (await db.doc('config/identities').get()).data() || {};
      const next = { her:d.her||null, him:d.him||null };
      next[s] = uid;
      await db.doc('config/identities').set(next);
    }catch(e){}
  }

  async function pick(s){
    side = s; ls('od.side', s);
    if(db && uid) await claim(s);
  }

  /* ---- collection helpers that degrade to local storage ---- */
  function localList(col){
    try{ return JSON.parse(ls('od.'+col) || '[]'); }catch(e){ return []; }
  }
  function localSave(col, arr){ ls('od.'+col, JSON.stringify(arr)); }

  return {
    boot, pick,
    get db(){ return db; },
    get uid(){ return uid; },
    get side(){ return side; },
    get who(){ return side ? CFG[side] : null; },
    get other(){ return side ? CFG[side==='her'?'him':'her'] : null; },
    get writable(){ return !!db && canWrite !== false; },
    get ready(){ return ready; },

    /* subscribe to a collection; falls back to a one-shot local read */
    watch(col, fn, orderBy, dir){
      if(db){
        let q = db.collection(col);
        if(orderBy) q = q.orderBy(orderBy, dir||'asc');
        try{
          return q.onSnapshot(
            snap => fn(snap.docs.map(d=>Object.assign({ id:d.id }, d.data()))),
            ()=> fn(localList(col))
          );
        }catch(e){ /* fall through */ }
      }
      fn(localList(col));
      return ()=>{};
    },
    async put(col, id, data){
      if(db){
        try{ await db.collection(col).doc(id).set(data); return true; }catch(e){}
      }
      const arr = localList(col).filter(x=>x.id!==id);
      arr.push(Object.assign({id:id}, data));
      localSave(col, arr);
      return false;
    },
    async patch(col, id, data){
      if(db){
        try{ await db.collection(col).doc(id).update(data); return true; }catch(e){}
        try{ await db.collection(col).doc(id).set(data); return true; }catch(e){}
      }
      const arr = localList(col);
      const i = arr.findIndex(x=>x.id===id);
      if(i>=0) Object.assign(arr[i], data); else arr.push(Object.assign({id:id}, data));
      localSave(col, arr);
      return false;
    },
    async get(col, id){
      if(db){
        try{
          const s = await db.collection(col).doc(id).get();
          return s.exists ? Object.assign({id:s.id}, s.data()) : null;
        }catch(e){}
      }
      return localList(col).find(x=>x.id===id) || null;
    },
    async remove(col, id){
      if(db){ try{ await db.collection(col).doc(id).delete(); return true; }catch(e){} }
      localSave(col, localList(col).filter(x=>x.id!==id));
      return false;
    },
    localList, localSave,
    newId(){ return Date.now().toString(36) + Math.random().toString(36).slice(2,7); }
  };
})();

/* ══════════════════════════════════════════════════════════════
   TIME
   ══════════════════════════════════════════════════════════════ */
OD.Days = {
  parts(){
    const ms = Date.now() - CFG.start.getTime();
    const s = Math.floor(ms/1000);
    return { d:Math.floor(s/86400), h:Math.floor(s/3600)%24, m:Math.floor(s/60)%60, s:s%60, ms };
  },
  count(){ return this.parts().d; },
  get start(){ return CFG.start; },
  /* is today (or the given date) a day that deserves gold? */
  occasion(date){
    const d = date || new Date();
    const s = CFG.start;
    if(d.getMonth()===s.getMonth() && d.getDate()===s.getDate())
      return { kind:'anniversary', label:'the day it started' };
    if(d.getMonth()===1 && d.getDate()===14)
      return { kind:'valentine', label:"valentine's" };
    if(d.getMonth()===11 && d.getDate()===31)
      return { kind:'newyear', label:'the last night of the year' };
    return null;
  },
  key(date){
    const d = date || new Date();
    return d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0');
  },
  fmt(d){
    const dt = (d instanceof Date) ? d : new Date(d);
    if(isNaN(dt)) return '';
    return dt.toLocaleDateString(undefined,{ day:'numeric', month:'long', year:'numeric' });
  },
  fmtShort(d){
    const dt = (d instanceof Date) ? d : new Date(d);
    if(isNaN(dt)) return '';
    return dt.toLocaleDateString(undefined,{ day:'numeric', month:'short', year:'numeric' });
  },
  midnight(){
    const n = new Date(); n.setHours(24,0,0,0); return n.getTime();
  }
};

/* ══════════════════════════════════════════════════════════════
   UI PRIMITIVES
   ══════════════════════════════════════════════════════════════ */
const $  = OD.$  = s => document.querySelector(s);
const $$ = OD.$$ = s => Array.prototype.slice.call(document.querySelectorAll(s));

OD.esc = function(s){
  return String(s==null?'':s).replace(/[&<>"']/g, c =>
    ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
};

OD.toast = function(msg, ms){
  const t = $('#toast');
  if(!t) return;
  t.textContent = msg;
  t.classList.add('on');
  clearTimeout(OD.toast._t);
  OD.toast._t = setTimeout(()=>t.classList.remove('on'), ms||2800);
};

OD.buzz = function(p){ try{ navigator.vibrate && navigator.vibrate(p); }catch(e){} };

/* the sheet is the one place every piece of reading and writing happens */
OD.Sheet = (function(){
  let el, body, onClose=null;
  function ensure(){
    if(el) return;
    el = $('#sheet'); body = $('#sheetBody');
    $('#sheetClose').addEventListener('click', ()=>OD.Sheet.close());
    el.addEventListener('pointerdown', e=>{ if(e.target===el) OD.Sheet.close(); });
    document.addEventListener('keydown', e=>{
      if(e.key==='Escape' && el.classList.contains('open')) OD.Sheet.close();
    });
  }
  return {
    open(html, opts){
      ensure();
      opts = opts||{};
      body.innerHTML = html;
      el.classList.toggle('wide', !!opts.wide);
      el.classList.toggle('bare', !!opts.bare);
      el.classList.add('open');
      onClose = opts.onClose || null;
      const f = body.querySelector('[autofocus]');
      if(f) setTimeout(()=>f.focus(), 340);
      return body;
    },
    close(){
      ensure();
      if(!el.classList.contains('open')) return;
      el.classList.remove('open');
      const f = onClose; onClose=null;
      if(f) f();
    },
    get body(){ ensure(); return body; },
    get isOpen(){ ensure(); return el.classList.contains('open'); }
  };
})();

})(window.OD);
