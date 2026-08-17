import {
  ACESFilmicToneMapping,
  Color,
  LinearFilter,
  Mesh,
  MeshBasicMaterial,
  PerspectiveCamera,
  PlaneGeometry,
  Scene,
  SRGBColorSpace,
  TextureLoader,
  Timer,
  Vector2,
} from 'https://esm.sh/three@0.183.2';
import { RenderPipeline, WebGPURenderer } from 'https://esm.sh/three@0.183.2/webgpu';
import { pass, uniform } from 'https://esm.sh/three@0.183.2/tsl';
import { attachPointerSplats, FluidSimulation, fluidOverlay } from 'https://esm.sh/three-fluid-fx@0.1.0/tsl?deps=three@0.183.2';

const stage=document.getElementById('fluidTextStage');
if(!(stage instanceof HTMLElement))throw new Error('Missing #fluidTextStage');
const slidePath=stage.dataset.slide||'assets/susukino-top.webp';

if(!('gpu' in navigator)){
  stage.classList.add('webgpu-unavailable');
  window.__tsubasaFluid={engine:'three-fluid-fx',renderer:'fallback-pending',pointer:false,reason:'WebGPU unavailable'};
}else{
  const CAMERA_FOV=45,CAMERA_Z=6.4,FIXED_FLUID_DT=1/60,MAX_FLUID_SUBSTEPS=2;
  const renderer=new WebGPURenderer({antialias:true,forceWebGL:false});
  renderer.outputColorSpace=SRGBColorSpace;
  renderer.toneMapping=ACESFilmicToneMapping;
  renderer.toneMappingExposure=1;
  renderer.setClearColor(new Color('#050303'),1);
  renderer.domElement.id='fluidTextCanvas';
  Object.assign(renderer.domElement.style,{position:'absolute',inset:'0',width:'100%',height:'100%',touchAction:'pan-y'});
  stage.appendChild(renderer.domElement);
  try{
    await renderer.init();
    const scene=new Scene(),camera=new PerspectiveCamera(CAMERA_FOV,1,.1,100);
    camera.position.set(0,0,CAMERA_Z);camera.updateMatrixWorld(true);
    const loader=new TextureLoader();
    const slideTexture=await loader.loadAsync(slidePath);
    slideTexture.colorSpace=SRGBColorSpace;slideTexture.minFilter=LinearFilter;slideTexture.magFilter=LinearFilter;
    const bgMaterial=new MeshBasicMaterial({map:slideTexture,toneMapped:false}),bgMesh=new Mesh(new PlaneGeometry(1,1),bgMaterial);scene.add(bgMesh);
    const fluid=new FluidSimulation(renderer,{profile:'balanced',splatRadius:.014,splatForce:7,pressureIterations:8,curlStrength:.18,velocityDissipation:.99,densityDissipation:.94,pressureDissipation:.8,enableVorticity:false,bfecc:true,reflectWalls:false});
    fluid.enableDye=true;fluid.dyeDissipation=.965;
    const overlayIntensity=uniform(.68),overlayOpacity=uniform(.38),overlayVelocityScale=uniform(1),elapsedTime=uniform(0),dyeTexel=uniform(new Vector2(1/512,1/512)),cursorColor=uniform(new Color(.88,.95,1)),vibrance=uniform(.42);
    const scenePass=pass(scene,camera);
    const output=fluidOverlay('artInk',scenePass,fluid.densityNode,fluid.dyeNode,fluid.velocityNode,{intensity:overlayIntensity,opacity:overlayOpacity,time:elapsedTime,texel:dyeTexel,cursorColor,vibrance,velocityScale:overlayVelocityScale});
    const pipeline=new RenderPipeline(renderer);pipeline.outputNode=output;pipeline.needsUpdate=true;
    const detachPointerSplats=attachPointerSplats(renderer.domElement,fluid,{coloredStrokes:true});
    const getWorldViewport=()=>{const height=2*CAMERA_Z*Math.tan((CAMERA_FOV*Math.PI)/360);return{height,width:height*camera.aspect}};
    const textureAspect=t=>{const i=t.image;return(i?.naturalWidth||i?.videoWidth||i?.width||1)/(i?.naturalHeight||i?.videoHeight||i?.height||1)};
    const fitCover=(mesh,t,v)=>{const ia=textureAspect(t),va=v.width/v.height;let w=v.width,h=v.height;if(ia>va)w=v.height*ia;else h=v.width/ia;mesh.scale.set(w,h,1)};
    const resize=()=>{const w=Math.max(1,stage.clientWidth),h=Math.max(1,stage.clientHeight),mobile=w<=700,dpr=Math.min(window.devicePixelRatio||1,mobile?1:1.25);renderer.setPixelRatio(dpr);renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix();fluid.resize(w,h);const img=fluid.dyeTexture.image,dw=img.width??512,dh=img.height??512;dyeTexel.value.set(1/dw,1/dh);fitCover(bgMesh,slideTexture,getWorldViewport())};
    resize();window.addEventListener('resize',resize,{passive:true});
    const clock=new Timer();let acc=0,frame=0,ready=false,visible=true;
    new IntersectionObserver(es=>{visible=es[0]?.isIntersecting??true},{rootMargin:'80px'}).observe(stage);
    renderer.setAnimationLoop(()=>{clock.update();if(!visible)return;const dt=Math.min(Math.max(clock.getDelta(),1e-6),FIXED_FLUID_DT*MAX_FLUID_SUBSTEPS);elapsedTime.value=clock.getElapsed();acc+=dt;let sub=0;while(acc>=FIXED_FLUID_DT&&sub<MAX_FLUID_SUBSTEPS){fluid.step(FIXED_FLUID_DT);acc-=FIXED_FLUID_DT;sub++}if(sub===MAX_FLUID_SUBSTEPS)acc=0;pipeline.render();frame++;if(!ready&&frame>1){ready=true;stage.classList.add('fluid-ready')}window.__tsubasaFluid={frame,engine:'three-fluid-fx',renderer:'WebGPU',slide:slidePath,distortion:false,pointer:true,style:'original-artInk'}});
    window.addEventListener('pagehide',()=>{renderer.setAnimationLoop(null);window.removeEventListener('resize',resize);detachPointerSplats?.();bgMaterial.dispose();bgMesh.geometry.dispose();slideTexture.dispose();fluid.dispose?.();renderer.dispose()},{once:true});
  }catch(error){console.error(error);stage.classList.add('webgpu-unavailable');renderer.domElement.remove();window.__tsubasaFluid={engine:'three-fluid-fx',renderer:'fallback-pending',pointer:false,reason:String(error?.message||error)}}
}
