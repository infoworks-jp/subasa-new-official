(()=>{
'use strict';
const canvas=document.getElementById('c'), hud=document.getElementById('hud'), report=document.getElementById('qa-report');
if(new URLSearchParams(location.search).has('qa'))document.body.classList.add('qa-mode');
const gl=canvas.getContext('webgl2',{alpha:false,antialias:false,premultipliedAlpha:false,preserveDrawingBuffer:true});
if(!gl){hud.textContent='WebGL2 unavailable';return;}
const ext=gl.getExtension('EXT_color_buffer_float');
const state={build:'STEAM-LAB-GPU-20260819-D',frames:0,start:performance.now(),fps:0,fpsSamples:[],pointerDown:0,pointerMove:0,pointerUp:0,pointerCancel:0,splatCount:0,holdSplatCount:0,holdSeconds:0,lastErr:0,webglErrors:0,consoleErrors:0,contextLost:false,verticalImpulse:0,horizontalImpulse:0,qa:null};
window.__steamLab=state;
addEventListener('error',()=>state.consoleErrors++);addEventListener('unhandledrejection',()=>state.consoleErrors++);
const VS=`#version 300 es
precision highp float;layout(location=0) in vec2 p;out vec2 uv;void main(){uv=p*.5+.5;gl_Position=vec4(p,0.,1.);}`;
const STEP=`#version 300 es
precision highp float;in vec2 uv;out vec4 outColor;
uniform sampler2D prev;uniform vec2 texel;uniform float dt;uniform float time;uniform float aspect;
uniform vec2 pointer;uniform vec2 pointerVel;uniform float pointerActive;uniform float hold;uniform float autoPulse;
float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453123);} 
float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.0-2.0*f);return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x),f.y);} 
vec2 sampleVel(vec2 q){return texture(prev,clamp(q,0.0,1.0)).rg;}
void main(){
 vec4 s0=texture(prev,uv); vec2 v=s0.rg; float d=s0.b;
 vec2 back=uv-v*dt*0.82; vec4 adv=texture(prev,clamp(back,0.0,1.0)); v=adv.rg; d=adv.b;
 // gentle diffusion
 vec4 n1=texture(prev,clamp(uv+vec2(texel.x,0),0.0,1.0));
 vec4 n2=texture(prev,clamp(uv-vec2(texel.x,0),0.0,1.0));
 vec4 n3=texture(prev,clamp(uv+vec2(0,texel.y),0.0,1.0));
 vec4 n4=texture(prev,clamp(uv-vec2(0,texel.y),0.0,1.0));
 vec2 avgV=(n1.rg+n2.rg+n3.rg+n4.rg)*.25; float avgD=(n1.b+n2.b+n3.b+n4.b)*.25;
 v=mix(v,avgV,.042); d=mix(d,avgD,.018);
 // buoyancy + slow coherent meander
 float nn=noise(vec2(uv.y*5.0-time*.12, time*.06));
 float nn2=noise(vec2(uv.y*8.0+time*.08, uv.x*3.0-time*.04));
 v.y += (0.046 + d*0.072)*dt;
 v.x += ((nn-.5)*0.042 + (nn2-.5)*0.018)*dt;
 // subtle curl-like shear from neighboring density
 float dl=n2.b, dr=n1.b, db=n4.b, dtp=n3.b;
 vec2 grad=vec2(dr-dl,dtp-db);
 v += vec2(grad.y,-grad.x)*0.24*dt;
 // auto multi-source steam near lower center, pulsing slowly
 float pulse=.78 + .22*sin(time*.55) + .10*sin(time*.21+1.3);
 vec2 srcs[4]; srcs[0]=vec2(.415,.070);srcs[1]=vec2(.478,.058);srcs[2]=vec2(.540,.074);srcs[3]=vec2(.602,.064);
 for(int i=0;i<4;i++){
   float phase=float(i)*1.73;
   vec2 source=srcs[i];source.x+=sin(time*(.27+float(i)*.041)+phase)*(.016+.003*float(i));
   vec2 q=uv-source; q.x*=aspect;
   float g=exp(-dot(q,q)/.00030);
   float flick=.52+.48*smoothstep(-.25,.65,sin(time*(.43+float(i)*.045)+phase));
   d += g * (0.0026 + 0.0020*flick) * pulse * dt*60.0;
   v.y += g*(0.036+0.011*flick)*dt*60.0;
   v.x += g*(sin(time*.57+phase)*.025+sin(time*.17+phase*2.1)*.012)*dt*60.0;
 }
 // moving finger: direct physical impulse into velocity field
 if(pointerActive>.5){
   vec2 q=uv-pointer; q.x*=aspect;
   float rad=0.060 + min(length(pointerVel)*.65,.10);
   float g=exp(-dot(q,q)/(rad*rad));
   vec2 pv=pointerVel; pv.x/=max(aspect,.001); pv.y*=1.18;
   v += pv*g*0.82;
   d += g*min(length(pointerVel)*0.045,0.020);
 }
 // stationary hold: obstacle-like, slowly growing outward/around the finger
 if(hold>.02){
   vec2 q=uv-pointer; q.x*=aspect;
   float dist=max(length(q),.001); vec2 dir=q/dist; dir.x/=max(aspect,.001);
   float h=clamp((hold-.12)/1.15,0.0,1.0);
   float ring=exp(-pow((dist-(.030+.035*h))/.038,2.0));
   // stronger sideways/upward than downward, never an explosive radial blast
   vec2 flow=vec2(dir.x*0.026, abs(dir.y)*0.010 + 0.018);
   v += flow*ring*h*dt*60.0;
   d *= 1.0 - exp(-dist*55.0)*h*0.010;
 }
 // stable, long tail dissipation — deterministic
 float densDecay=pow(0.9908,dt*60.0); float velDecay=pow(0.988,dt*60.0);
 d*=densDecay; v*=velDecay;
 d=clamp(d,0.0,1.0); v=clamp(v,vec2(-.22),vec2(.22));
 outColor=vec4(v,d,1.0);
}`;
const CURL=`#version 300 es
precision highp float;in vec2 uv;out vec4 o;uniform sampler2D u;uniform vec2 texel;
void main(){float L=texture(u,uv-vec2(texel.x,0)).g,R=texture(u,uv+vec2(texel.x,0)).g,B=texture(u,uv-vec2(0,texel.y)).r,T=texture(u,uv+vec2(0,texel.y)).r;o=vec4(.5*(R-L-T+B),0,0,1);}`;
const VORT=`#version 300 es
precision highp float;in vec2 uv;out vec4 o;uniform sampler2D u;uniform sampler2D curlTex;uniform vec2 texel;uniform float dt;
void main(){float L=abs(texture(curlTex,uv-vec2(texel.x,0)).r),R=abs(texture(curlTex,uv+vec2(texel.x,0)).r),B=abs(texture(curlTex,uv-vec2(0,texel.y)).r),T=abs(texture(curlTex,uv+vec2(0,texel.y)).r),C=texture(curlTex,uv).r;vec2 f=.5*vec2(T-B,R-L);f/=length(f)+.0001;f*=C*18.0;vec4 s=texture(u,uv);s.rg+=f*dt;o=s;}`;
const DIV=`#version 300 es
precision highp float;in vec2 uv;out vec4 o;uniform sampler2D u;uniform vec2 texel;
void main(){float L=texture(u,uv-vec2(texel.x,0)).r,R=texture(u,uv+vec2(texel.x,0)).r,B=texture(u,uv-vec2(0,texel.y)).g,T=texture(u,uv+vec2(0,texel.y)).g;o=vec4(.5*(R-L+T-B),0,0,1);}`;
const PRESS=`#version 300 es
precision highp float;in vec2 uv;out vec4 o;uniform sampler2D pressureTex;uniform sampler2D divergenceTex;uniform vec2 texel;
void main(){float L=texture(pressureTex,uv-vec2(texel.x,0)).r,R=texture(pressureTex,uv+vec2(texel.x,0)).r,B=texture(pressureTex,uv-vec2(0,texel.y)).r,T=texture(pressureTex,uv+vec2(0,texel.y)).r,D=texture(divergenceTex,uv).r;o=vec4((L+R+B+T-D)*.25,0,0,1);}`;
const GRAD=`#version 300 es
precision highp float;in vec2 uv;out vec4 o;uniform sampler2D u;uniform sampler2D pressureTex;uniform vec2 texel;
void main(){float L=texture(pressureTex,uv-vec2(texel.x,0)).r,R=texture(pressureTex,uv+vec2(texel.x,0)).r,B=texture(pressureTex,uv-vec2(0,texel.y)).r,T=texture(pressureTex,uv+vec2(0,texel.y)).r;vec4 s=texture(u,uv);s.rg-=.5*vec2(R-L,T-B);o=s;}`;
const RENDER=`#version 300 es
precision highp float;in vec2 uv;out vec4 outColor;uniform sampler2D stateTex;uniform float time;uniform vec2 texel;
float h(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}float n(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(h(i),h(i+vec2(1,0)),f.x),mix(h(i+vec2(0,1)),h(i+vec2(1,1)),f.x),f.y);}
void main(){float d=texture(stateTex,uv).b;float dx=texture(stateTex,uv+vec2(texel.x,0)).b-texture(stateTex,uv-vec2(texel.x,0)).b;float dy=texture(stateTex,uv+vec2(0,texel.y)).b-texture(stateTex,uv-vec2(0,texel.y)).b;float edge=smoothstep(.00025,.0038,length(vec2(dx,dy)));float root=mix(.22,1.0,smoothstep(.045,.15,uv.y));float g1=n(vec2(uv.x*10.0+time*.052,uv.y*7.5-time*.032));float g2=n(vec2(uv.x*21.0-time*.031,uv.y*13.0+time*.019));float grain=g1*.68+g2*.32;float ribbon=(.28+.72*smoothstep(.40,.72,grain))*(.26+.74*edge);float a=smoothstep(.0018,.038,d)*root*ribbon;float soft=pow(a,1.10);vec3 col=mix(vec3(.22,.25,.27),vec3(.66,.68,.69),soft);outColor=vec4(col*soft*.82,1.0);}`;
function shader(type,src){const s=gl.createShader(type);gl.shaderSource(s,src);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw new Error(gl.getShaderInfoLog(s));return s}
function program(fs){const p=gl.createProgram();gl.attachShader(p,shader(gl.VERTEX_SHADER,VS));gl.attachShader(p,shader(gl.FRAGMENT_SHADER,fs));gl.linkProgram(p);if(!gl.getProgramParameter(p,gl.LINK_STATUS))throw new Error(gl.getProgramInfoLog(p));return p}
const stepP=program(STEP),renderP=program(RENDER),curlP=program(CURL),vortP=program(VORT),divP=program(DIV),pressP=program(PRESS),gradP=program(GRAD); const vao=gl.createVertexArray();gl.bindVertexArray(vao);const b=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,b);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,3,-1,-1,3]),gl.STATIC_DRAW);gl.enableVertexAttribArray(0);gl.vertexAttribPointer(0,2,gl.FLOAT,false,0,0);
let W=180,H=320, textures=[], fbos=[], auxT=[],auxF=[],ping=0;
function alloc(){
 const r=canvas.getBoundingClientRect(); const ar=r.width/Math.max(1,r.height); H=320; W=Math.max(120,Math.round(H*ar));
 textures.concat(auxT).forEach(t=>gl.deleteTexture(t));fbos.concat(auxF).forEach(f=>gl.deleteFramebuffer(f));textures=[];fbos=[];auxT=[];auxF=[];
 const internal=ext?gl.RGBA16F:gl.RGBA8, type=ext?gl.HALF_FLOAT:gl.UNSIGNED_BYTE;
 for(let i=0;i<2;i++){const t=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,t);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);gl.texImage2D(gl.TEXTURE_2D,0,internal,W,H,0,gl.RGBA,type,null);const f=gl.createFramebuffer();gl.bindFramebuffer(gl.FRAMEBUFFER,f);gl.framebufferTexture2D(gl.FRAMEBUFFER,gl.COLOR_ATTACHMENT0,gl.TEXTURE_2D,t,0);textures.push(t);fbos.push(f);}
 for(let i=0;i<4;i++){const t=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,t);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.NEAREST);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.NEAREST);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);gl.texImage2D(gl.TEXTURE_2D,0,internal,W,H,0,gl.RGBA,type,null);const f=gl.createFramebuffer();gl.bindFramebuffer(gl.FRAMEBUFFER,f);gl.framebufferTexture2D(gl.FRAMEBUFFER,gl.COLOR_ATTACHMENT0,gl.TEXTURE_2D,t,0);auxT.push(t);auxF.push(f);gl.clear(gl.COLOR_BUFFER_BIT);}
 gl.bindFramebuffer(gl.FRAMEBUFFER,fbos[0]);gl.viewport(0,0,W,H);gl.clearColor(0,0,0,1);gl.clear(gl.COLOR_BUFFER_BIT);gl.bindFramebuffer(gl.FRAMEBUFFER,fbos[1]);gl.clear(gl.COLOR_BUFFER_BIT); ping=0;
}
function resize(){const dpr=Math.min(devicePixelRatio||1,1.5),w=Math.max(1,innerWidth),h=Math.max(1,innerHeight);canvas.width=Math.round(w*dpr);canvas.height=Math.round(h*dpr);canvas.style.width=w+'px';canvas.style.height=h+'px';alloc()} resize();addEventListener('resize',resize,{passive:true});
let pointer={down:false,x:.5,y:.5,lastX:.5,lastY:.5,vx:0,vy:0,downAt:0,lastMove:0};
function local(e){const r=canvas.getBoundingClientRect();return {x:(e.clientX-r.left)/r.width,y:1-(e.clientY-r.top)/r.height}}
canvas.addEventListener('pointerdown',e=>{const p=local(e);pointer.down=true;pointer.x=pointer.lastX=p.x;pointer.y=pointer.lastY=p.y;pointer.vx=pointer.vy=0;pointer.downAt=performance.now();pointer.lastMove=pointer.downAt;state.pointerDown++;canvas.setPointerCapture?.(e.pointerId);e.preventDefault()},{passive:false});
canvas.addEventListener('pointermove',e=>{if(!pointer.down)return;const p=local(e),now=performance.now(),dt=Math.max(8,now-pointer.lastMove)/1000;let dx=p.x-pointer.x,dy=p.y-pointer.y;pointer.lastX=pointer.x;pointer.lastY=pointer.y;pointer.x=p.x;pointer.y=p.y;pointer.vx=dx/dt*0.008;pointer.vy=dy/dt*0.008;pointer.lastMove=now;state.pointerMove++;state.splatCount++;state.horizontalImpulse+=Math.abs(pointer.vx);state.verticalImpulse+=Math.abs(pointer.vy);e.preventDefault()},{passive:false});
function up(e){pointer.down=false;pointer.vx*=.5;pointer.vy*=.5;if(e.type==='pointercancel')state.pointerCancel++;else state.pointerUp++;try{canvas.releasePointerCapture?.(e.pointerId)}catch{} e.preventDefault()}
canvas.addEventListener('pointerup',up,{passive:false});canvas.addEventListener('pointercancel',up,{passive:false});
let last=performance.now(),acc=0,fcount=0,lastHud=last;
function U(p,n,...v){const l=gl.getUniformLocation(p,n);if(l===null)return;if(v.length===1)gl.uniform1f(l,v[0]);else if(v.length===2)gl.uniform2f(l,v[0],v[1]);}
function S(p,n,tex,unit){gl.activeTexture(gl.TEXTURE0+unit);gl.bindTexture(gl.TEXTURE_2D,tex);gl.uniform1i(gl.getUniformLocation(p,n),unit)}
function target(p,f){gl.useProgram(p);gl.bindFramebuffer(gl.FRAMEBUFFER,f);gl.viewport(0,0,W,H);U(p,'texel',1/W,1/H)}
function frame(now){let dt=Math.min(.033,(now-last)/1000||.016);last=now;state.frames++;fcount++;acc+=dt;
 const hold=pointer.down?(now-pointer.downAt)/1000:0;state.holdSeconds=hold;if(hold>.2){state.holdSplatCount++;state.splatCount++;}
 gl.bindVertexArray(vao);
 target(curlP,auxF[0]);S(curlP,'u',textures[ping],0);gl.drawArrays(gl.TRIANGLES,0,3);
 target(vortP,fbos[1-ping]);S(vortP,'u',textures[ping],0);S(vortP,'curlTex',auxT[0],1);U(vortP,'dt',dt);gl.drawArrays(gl.TRIANGLES,0,3);ping=1-ping;
 target(divP,auxF[1]);S(divP,'u',textures[ping],0);gl.drawArrays(gl.TRIANGLES,0,3);
 gl.bindFramebuffer(gl.FRAMEBUFFER,auxF[2]);gl.clearColor(0,0,0,1);gl.clear(gl.COLOR_BUFFER_BIT);let pp=2;
 for(let i=0;i<12;i++){let out=pp===2?3:2;target(pressP,auxF[out]);S(pressP,'pressureTex',auxT[pp],0);S(pressP,'divergenceTex',auxT[1],1);gl.drawArrays(gl.TRIANGLES,0,3);pp=out;}
 target(gradP,fbos[1-ping]);S(gradP,'u',textures[ping],0);S(gradP,'pressureTex',auxT[pp],1);gl.drawArrays(gl.TRIANGLES,0,3);ping=1-ping;
 gl.useProgram(stepP);gl.bindFramebuffer(gl.FRAMEBUFFER,fbos[1-ping]);gl.viewport(0,0,W,H);S(stepP,'prev',textures[ping],0);U(stepP,'texel',1/W,1/H);U(stepP,'dt',dt);U(stepP,'time',now/1000);U(stepP,'aspect',canvas.clientWidth/Math.max(1,canvas.clientHeight));U(stepP,'pointer',pointer.x,pointer.y);U(stepP,'pointerVel',pointer.vx,pointer.vy);U(stepP,'pointerActive',pointer.down && (Math.abs(pointer.vx)+Math.abs(pointer.vy)>.00005)?1:0);U(stepP,'hold',hold);U(stepP,'autoPulse',1);gl.drawArrays(gl.TRIANGLES,0,3);ping=1-ping;
 pointer.vx*=.84;pointer.vy*=.84;
 gl.useProgram(renderP);gl.bindFramebuffer(gl.FRAMEBUFFER,null);gl.viewport(0,0,canvas.width,canvas.height);gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,textures[ping]);gl.uniform1i(gl.getUniformLocation(renderP,'stateTex'),0);U(renderP,'time',now/1000);U(renderP,'texel',1/W,1/H);gl.drawArrays(gl.TRIANGLES,0,3);
 const err=gl.getError();if(err!==gl.NO_ERROR){state.lastErr=err;state.webglErrors++;}
 if(now-lastHud>500){state.fps=Math.round(fcount/acc);state.fpsSamples.push(state.fps);fcount=0;acc=0;lastHud=now;hud.textContent=`FPS ${state.fps}\nMOVE ${state.pointerMove}  SPLAT ${state.splatCount}\nHOLD ${hold.toFixed(2)}s\nXimp ${state.horizontalImpulse.toFixed(3)} Yimp ${state.verticalImpulse.toFixed(3)}\nGL ${state.lastErr||0}`}
 requestAnimationFrame(frame)} requestAnimationFrame(frame);
 canvas.addEventListener('webglcontextlost',e=>{state.contextLost=true;e.preventDefault()});
 const sleep=ms=>new Promise(r=>setTimeout(r,ms));
 function sampleField(){
  const data=ext?new Float32Array(W*H*4):new Uint8Array(W*H*4);let vx=0,vy=0,density=0,n=0;
  gl.bindFramebuffer(gl.FRAMEBUFFER,fbos[ping]);gl.readPixels(0,0,W,H,gl.RGBA,ext?gl.FLOAT:gl.UNSIGNED_BYTE,data);const scale=ext?1:1/255;
  for(let i=0;i<data.length;i+=16){vx+=Math.abs(data[i]*scale);vy+=Math.abs(data[i+1]*scale);density+=data[i+2]*scale;n++;}
  gl.bindFramebuffer(gl.FRAMEBUFFER,null);return {vx:vx/n,vy:vy/n,density:density/n};
 }
 function fieldDelta(a,b){return Math.abs(b.vx-a.vx)+Math.abs(b.vy-a.vy)+Math.abs(b.density-a.density)}
 async function motion(kind,speed=1){
  const map={left:[-.18,0],right:[.18,0],up:[0,.18],down:[0,-.18],diagonal:[.127,.127]};const v=map[kind],before=sampleField();
  pointer.down=true;pointer.x=pointer.lastX=.5;pointer.y=pointer.lastY=.45;pointer.downAt=performance.now();state.pointerDown++;
  for(let i=0;i<14;i++){pointer.vx=v[0]/14*.85*speed;pointer.vy=v[1]/14*.85*speed;pointer.x+=v[0]/14;pointer.y+=v[1]/14;state.pointerMove++;state.splatCount++;state.horizontalImpulse+=Math.abs(pointer.vx);state.verticalImpulse+=Math.abs(pointer.vy);await sleep(20/speed)}
  pointer.down=false;state.pointerUp++;await sleep(180);const after=sampleField();return {score:fieldDelta(before,after),before,after};
 }
 async function hold(seconds){
  const before=sampleField(),moves=state.pointerMove,hs=state.holdSplatCount;pointer.down=true;pointer.x=pointer.lastX=.5;pointer.y=pointer.lastY=.46;pointer.vx=pointer.vy=0;pointer.downAt=performance.now();state.pointerDown++;
  await sleep(seconds*1000);const after=sampleField();pointer.down=false;state.pointerUp++;return {score:fieldDelta(before,after),moves:state.pointerMove-moves,holdSplats:state.holdSplatCount-hs,before,after};
 }
 function fmt(n){return Number.isFinite(n)?n.toFixed(6):'ERROR'}
 function renderReport(q){
  const pass=s=>s?'PASS':'FAIL',fps=state.fpsSamples.length?state.fpsSamples:[0];
  report.textContent=`STEAM-LAB-QA-REPORT\nBUILD: ${state.build}\nTEST-TIME: ${q.testTime||'RUNNING'}\nFPS-AVG: ${(fps.reduce((a,b)=>a+b,0)/fps.length).toFixed(1)}\nFPS-MIN: ${Math.min(...fps)}\nPOINTER-DOWN: ${state.pointerDown}\nPOINTER-MOVE: ${state.pointerMove}\nPOINTER-UP: ${state.pointerUp}\nPOINTER-CANCEL: ${state.pointerCancel}\nLEFT-SCORE: ${fmt(q.left?.score)}\nLEFT: ${q.left?pass(q.left.pass):'PENDING'}\nRIGHT-SCORE: ${fmt(q.right?.score)}\nRIGHT: ${q.right?pass(q.right.pass):'PENDING'}\nUP-SCORE: ${fmt(q.up?.score)}\nUP: ${q.up?pass(q.up.pass):'PENDING'}\nDOWN-SCORE: ${fmt(q.down?.score)}\nDOWN: ${q.down?pass(q.down.pass):'PENDING'}\nDIAGONAL-SCORE: ${fmt(q.diagonal?.score)}\nDIAGONAL: ${q.diagonal?pass(q.diagonal.pass):'PENDING'}\nHOLD-1S-SCORE: ${fmt(q.hold1?.score)}\nHOLD-1S: ${q.hold1?pass(q.hold1.pass):'PENDING'}\nHOLD-2S-SCORE: ${fmt(q.hold2?.score)}\nHOLD-2S: ${q.hold2?pass(q.hold2.pass):'PENDING'}\nHOLD-3S-SCORE: ${fmt(q.hold3?.score)}\nHOLD-3S: ${q.hold3?pass(q.hold3.pass):'PENDING'}\nSPLAT-COUNT: ${state.splatCount}\nHOLD-SPLAT-COUNT: ${state.holdSplatCount}\nVELOCITY-X: ${fmt(q.final?.vx)}\nVELOCITY-Y: ${fmt(q.final?.vy)}\n${q.fade.map((v,i)=>`DENSITY-T${['0','0.25','0.5','1','2','3','5','8','10'][i]}: ${fmt(v)}`).join('\n')}\nFADE-DURATION: ${q.fadeDuration||'PENDING'}\nABRUPT-FADE: ${q.abruptFade==null?'PENDING':q.abruptFade?'TRUE':'FALSE'}\nWEBGL-ERRORS: ${state.webglErrors}\nCONTEXT-LOST: ${state.contextLost?'TRUE':'FALSE'}\nCONSOLE-ERRORS: ${state.consoleErrors}\nOVERALL: ${q.overall==null?'PENDING':pass(q.overall)}`;
 }
 window.__runQAScenario=kind=>kind.startsWith('hold')?hold(Number(kind.replace('hold',''))||1):motion(kind);
 window.__runSteamLabQA=async function(){
  if(state.qa?.running)return state.qa;const q=state.qa={running:true,fade:Array(9).fill(NaN)};renderReport(q);await sleep(10000);
  for(const k of ['left','right','up','down','diagonal']){q[k]=await motion(k);q[k].pass=q[k].score>.00001;renderReport(q)}
  q.hold1=await hold(1);q.hold1.pass=q.hold1.score>.00001&&q.hold1.moves===0&&q.hold1.holdSplats>0;renderReport(q);
  q.hold2=await hold(2);q.hold2.pass=q.hold2.score>.00001&&q.hold2.moves===0&&q.hold2.holdSplats>0;renderReport(q);
  q.hold3=await hold(3);q.hold3.pass=q.hold3.score>.00001&&q.hold3.moves===0&&q.hold3.holdSplats>0;renderReport(q);
  await motion('right',1.8);const marks=[0,250,500,1000,2000,3000,5000,8000,10000],fadeStart=performance.now();for(let i=0;i<marks.length;i++){await sleep(Math.max(0,marks[i]-(performance.now()-fadeStart)));q.fade[i]=sampleField().density;renderReport(q)}
  q.abruptFade=q.fade.some((v,i)=>i&&v<q.fade[i-1]*.35);q.fadeDuration='10.0s';
  const remaining=60000-(performance.now()-state.start);if(remaining>0)await sleep(remaining);q.final=sampleField();q.testTime=new Date().toISOString();
  const directional=['left','right','up','down','diagonal'].every(k=>q[k].pass),holds=[q.hold1,q.hold2,q.hold3].every(x=>x.pass),fps=state.fpsSamples.length?Math.min(...state.fpsSamples):0;
  q.overall=directional&&holds&&!q.abruptFade&&!state.contextLost&&state.webglErrors===0&&state.consoleErrors===0&&fps>=20;q.running=false;renderReport(q);return q;
 };
 if(new URLSearchParams(location.search).has('qa'))setTimeout(()=>window.__runSteamLabQA(),1200);
})();
