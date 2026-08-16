(()=>{
/* Performance reset: the previous particle steam renderer failed the visual brief
   and caused continuous main-thread/canvas work. Keep the effect contract explicit
   but do not render until the replacement WebGL fluid implementation is ready. */
const canvases=[...document.querySelectorAll('.fx-canvas[data-effect="steam"]')];
for(const c of canvases){
  const ctx=c.getContext('2d');
  if(ctx)ctx.clearRect(0,0,c.width,c.height);
  c.style.pointerEvents='none';
  c.style.display='none';
}
window.__tsubasaEffects={
  isolated:true,
  disabledForPerformance:true,
  effects:[],
  engine:'disabled-failed-steam-reset',
  interactive:false,
  canvasCount:canvases.length
};
})();