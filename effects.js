(()=>{
const canvases=[...document.querySelectorAll('.fx-canvas[data-effect="steam"]')];
if(!canvases.length)return;
const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
const DPR=Math.min(devicePixelRatio||1,1.5);
const states=[];
function resize(s){const r=s.c.getBoundingClientRect();s.w=Math.max(1,r.width);s.h=Math.max(1,r.height);s.c.width=Math.round(s.w*DPR);s.c.height=Math.round(s.h*DPR);s.ctx.setTransform(DPR,0,0,DPR,0,0)}
function make(s,i){const profile=s.c.dataset.profile;const mobile=s.w<700;const baseX=profile==='tsubasa'?(mobile?s.w*.49:s.w*.57):(mobile?s.w*.51:s.w*.56);const baseY=profile==='tsubasa'?(mobile?s.h*.48:s.h*.48):(mobile?s.h*.48:s.h*.46);return{phase:Math.random()*Math.PI*2,speed:.00032+Math.random()*.00018,amp:(mobile?10:18)+Math.random()*(mobile?12:24),x:baseX+(Math.random()-.5)*(mobile?70:150),y:baseY+Math.random()*25,len:(mobile?100:155)+Math.random()*(mobile?80:150),width:(mobile?8:13)+Math.random()*(mobile?9:18),alpha:.10+Math.random()*.11,drift:(Math.random()-.5)*.018,seed:i*1.71+Math.random()*5}}
function reset(s){s.p=Array.from({length:s.w<700?14:22},(_,i)=>make(s,i))}
for(const c of canvases){const s={c,ctx:c.getContext('2d'),w:0,h:0,p:[]};resize(s);reset(s);states.push(s)}
addEventListener('resize',()=>states.forEach(s=>{resize(s);reset(s)}),{passive:true});
function strand(ctx,p,t){const rise=((t*p.speed+p.phase)%(Math.PI*2))/(Math.PI*2);const fade=Math.sin(Math.PI*rise);const y=p.y-rise*p.len;const sway=Math.sin(t*.00115+p.seed+rise*5.2)*p.amp+Math.sin(t*.00055+p.seed*2)*p.amp*.45;const x=p.x+sway+p.drift*t;ctx.beginPath();ctx.moveTo(x,y+42);ctx.bezierCurveTo(x-p.amp*.45,y+22,x+p.amp*.75,y-8,x+Math.sin(t*.0008+p.seed)*p.amp,y-45);ctx.strokeStyle=`rgba(245,248,250,${p.alpha*fade})`;ctx.lineWidth=p.width*(.55+.55*fade);ctx.lineCap='round';ctx.shadowBlur=18;ctx.shadowColor='rgba(255,255,255,.18)';ctx.stroke()}
function frame(t){for(const s of states){const ctx=s.ctx;ctx.clearRect(0,0,s.w,s.h);ctx.save();ctx.globalCompositeOperation='screen';ctx.filter='blur(5px)';for(const p of s.p)strand(ctx,p,reduced?2400:t);ctx.restore()}if(!reduced)requestAnimationFrame(frame)}
requestAnimationFrame(frame);
window.__tsubasaEffects={isolated:true,disabledForPerformance:false,effects:['steam'],canvasCount:states.length};
})();