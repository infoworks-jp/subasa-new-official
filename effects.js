(()=>{
const nodes=[...document.querySelectorAll('.fx-canvas[data-effect="steam"]')];
if(!nodes.length)return;
const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
const fine=matchMedia('(hover:hover) and (pointer:fine)').matches;
const sims=[];
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
function make(c){
 const ctx=c.getContext('2d',{alpha:true,desynchronized:true});
 const s={c,ctx,w:0,h:0,gw:0,gh:0,d:null,n:null,vx:null,vy:null,nvx:null,nvy:null,last:0,acc:0,profile:c.dataset.profile,visible:false,pointer:null};
 resize(s); sims.push(s); return s;
}
function resize(s){
 const r=s.c.getBoundingClientRect(); s.w=Math.max(1,r.width); s.h=Math.max(1,r.height);
 const mobile=s.w<700, long=Math.min(mobile?84:128,Math.max(64,Math.round(s.w/12)));
 s.gw=long; s.gh=Math.max(48,Math.round(long*s.h/s.w)); const N=s.gw*s.gh;
 s.d=new Float32Array(N);s.n=new Float32Array(N);s.vx=new Float32Array(N);s.vy=new Float32Array(N);s.nvx=new Float32Array(N);s.nvy=new Float32Array(N);
 s.c.width=s.gw;s.c.height=s.gh; s.ctx.imageSmoothingEnabled=true;
}
function source(s){const t=s.profile==='tsubasa'?{x:.54,y:.55}:{x:.56,y:.53};return{x:t.x*s.gw,y:t.y*s.gh}}
function addSteam(s,t){
 const o=source(s), pulse=.55+.45*Math.sin(t*.0017);
 for(let j=-2;j<=2;j++)for(let i=-3;i<=3;i++){const x=Math.round(o.x+i),y=Math.round(o.y+j);if(x<1||x>=s.gw-1||y<1||y>=s.gh-1)continue;const k=y*s.gw+x,r=Math.exp(-(i*i+j*j)/7);s.d[k]=clamp(s.d[k]+r*(.045+.025*pulse),0,1);s.vy[k]-=.018*r;s.vx[k]+=Math.sin(t*.001+i)*.004*r;}
}
function splat(s,p){if(!p)return;const cx=p.x*s.gw,cy=p.y*s.gh;for(let j=-4;j<=4;j++)for(let i=-4;i<=4;i++){const x=Math.round(cx+i),y=Math.round(cy+j);if(x<1||x>=s.gw-1||y<1||y>=s.gh-1)continue;const k=y*s.gw+x,r=Math.exp(-(i*i+j*j)/12);s.vx[k]+=p.dx*.006*r;s.vy[k]+=p.dy*.006*r;s.d[k]=clamp(s.d[k]+.035*r,0,1)}s.pointer=null}
function step(s,t){
 const W=s.gw,H=s.gh;addSteam(s,t);splat(s,s.pointer);
 for(let y=1;y<H-1;y++)for(let x=1;x<W-1;x++){const k=y*W+x;const ax=clamp(x-s.vx[k]*7,1,W-2),ay=clamp(y-s.vy[k]*7,1,H-2),x0=ax|0,y0=ay|0,fx=ax-x0,fy=ay-y0,k00=y0*W+x0,k10=k00+1,k01=k00+W,k11=k01+1;const sample=(a)=>a[k00]*(1-fx)*(1-fy)+a[k10]*fx*(1-fy)+a[k01]*(1-fx)*fy+a[k11]*fx*fy;s.n[k]=sample(s.d)*.986;s.nvx[k]=sample(s.vx)*.965+(Math.sin(y*.31+t*.0007)*.0007);s.nvy[k]=sample(s.vy)*.965-.0014;}
 [s.d,s.n]=[s.n,s.d];[s.vx,s.nvx]=[s.nvx,s.vx];[s.vy,s.nvy]=[s.nvy,s.vy];
}
function draw(s){const W=s.gw,H=s.gh,img=s.ctx.createImageData(W,H),a=img.data;for(let k=0;k<W*H;k++){const q=clamp(s.d[k],0,1),alpha=Math.round(150*Math.pow(q,.72));a[k*4]=242;a[k*4+1]=246;a[k*4+2]=248;a[k*4+3]=alpha}s.ctx.putImageData(img,0,0)}
for(const c of nodes){const s=make(c);c.style.display='block';c.style.pointerEvents='none';const io=new IntersectionObserver(e=>{s.visible=e[0].isIntersecting},{rootMargin:'150px'});io.observe(c);if(fine){const host=c.parentElement;let last=null;host.addEventListener('pointermove',e=>{const r=c.getBoundingClientRect(),x=(e.clientX-r.left)/r.width,y=(e.clientY-r.top)/r.height;if(x<0||x>1||y<0||y>1){last=null;return}if(last)s.pointer={x,y,dx:e.clientX-last.x,dy:e.clientY-last.y};last={x:e.clientX,y:e.clientY}},{passive:true});host.addEventListener('pointerleave',()=>last=null,{passive:true})}}
addEventListener('resize',()=>sims.forEach(resize),{passive:true});
function frame(t){for(const s of sims){if(!s.visible)continue;if(!s.last)s.last=t;const dt=t-s.last;s.last=t;s.acc+=dt;if(s.acc>=33){step(s,t);draw(s);s.acc=0}}if(!reduced)requestAnimationFrame(frame)}
if(reduced){for(const s of sims){addSteam(s,0);draw(s)}}else requestAnimationFrame(frame);
window.__tsubasaEffects={isolated:true,disabledForPerformance:false,effects:['steam','advected-smoke'],engine:'low-res-advection',interactive:fine,canvasCount:sims.length,targetFps:30,maxGrid:128};
})();