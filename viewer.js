import { renderAnnotations } from './annotation-renderer.js?v=7';
import { freshUrl } from './model-assets.js?v=7';
import { loadValidatedGLB } from './glb-validation.js?v=7';
import { loadPreview } from './project-store.js?v=7';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { CSS2DRenderer, CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';

const viewport=document.getElementById('viewport'), msg=document.getElementById('message');
const scene=new THREE.Scene(); scene.background=new THREE.Color(0xe9edf1);
const camera=new THREE.PerspectiveCamera(45,1,.001,100000); camera.position.set(2,1.5,3);
const renderer=new THREE.WebGLRenderer({antialias:true}); renderer.setPixelRatio(Math.min(devicePixelRatio,2)); renderer.outputColorSpace=THREE.SRGBColorSpace; viewport.appendChild(renderer.domElement);
const labels=new CSS2DRenderer(); labels.domElement.style.position='absolute'; labels.domElement.style.inset='0'; labels.domElement.style.pointerEvents='none'; viewport.appendChild(labels.domElement);
const controls=new OrbitControls(camera,renderer.domElement); controls.enableDamping=true; controls.dampingFactor=.08;
scene.add(new THREE.HemisphereLight(0xffffff,0x56616f,2.2)); const light=new THREE.DirectionalLight(0xffffff,3); light.position.set(5,8,6); scene.add(light);
const helperGroup=new THREE.Group(); scene.add(helperGroup); let model=null; let labelsVisible=true;
const v=a=>new THREE.Vector3(+a[0],+a[1],+a[2]);

function resize(){const w=viewport.clientWidth,h=viewport.clientHeight;camera.aspect=w/h;camera.updateProjectionMatrix();renderer.setSize(w,h,false);labels.setSize(w,h)} new ResizeObserver(resize).observe(viewport);
function loop(){controls.update();renderer.render(scene,camera);labels.render(scene,camera);requestAnimationFrame(loop)} loop();
function fit(){if(!model)return;const b=new THREE.Box3().setFromObject(model),s=b.getSize(new THREE.Vector3()),c=b.getCenter(new THREE.Vector3()),m=Math.max(s.x,s.y,s.z)||1,d=m/(2*Math.tan(THREE.MathUtils.degToRad(camera.fov/2)))*1.45;camera.position.copy(c).add(new THREE.Vector3(1,.7,1).normalize().multiplyScalar(d));controls.target.copy(c);camera.near=Math.max(m/10000,.0001);camera.far=Math.max(m*1000,100);camera.updateProjectionMatrix();controls.update()}
function build(annotations){renderAnnotations(helperGroup,annotations);}
async function init(){
  let objectUrl;
  try {
    const q = new URLSearchParams(location.search);
    let data, modelUrl;
    if(q.has('preview')) {
      const saved = await loadPreview(q.get('preview'));
      if(!saved) throw new Error('Preview expired. Open it again from the editor on this browser.');
      data = saved.data;
      objectUrl = URL.createObjectURL(saved.file);
      modelUrl = objectUrl;
      document.getElementById('title').textContent = 'Private preview';
    } else {
      const project = q.get('project') || 'projects/demo/demo.annotations.json';
      const r = await fetch(freshUrl(project),{cache:'no-store'});
      if(!r.ok) throw new Error(`Problem not published yet, or file missing: ${project}`);
      data = await r.json();
      modelUrl = new URL(data.model, new URL(project,location.href)).href;
      if(!/^model-[a-f0-9]{64}\.glb$/.test(data.model))modelUrl=freshUrl(modelUrl);
    }
    model = await loadValidatedGLB(new GLTFLoader(),modelUrl).then(g=>g.scene);
    scene.add(model); build(data.annotations);
    document.getElementById('title').textContent = (q.has('preview')?'Preview · ':'') + (data.title||data.model||'Mechanics 3D');
    fit(); msg.textContent = 'Drag to rotate • scroll/pinch to zoom';
  } catch(e) { console.error(e); msg.textContent=e.message; }
  finally { if(objectUrl) URL.revokeObjectURL(objectUrl); }
}
init();
document.getElementById('resetBtn').addEventListener('click',fit);document.getElementById('labelsBtn').addEventListener('click',e=>{labelsVisible=!labelsVisible;helperGroup.visible=labelsVisible;e.currentTarget.textContent=labelsVisible?'Hide Labels':'Show Labels'});
