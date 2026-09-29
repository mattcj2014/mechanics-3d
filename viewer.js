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
function labelObj(a,p,cls=''){const outer=document.createElement('div');outer.className=`annotation-label ${cls}`;const bubble=document.createElement('div');bubble.className='bubble';bubble.textContent=a.text||'';outer.appendChild(bubble);const o=new CSS2DObject(outer);o.position.copy(p);return o}
function line(a,b){const g=new THREE.BufferGeometry().setFromPoints([a,b]),m=new THREE.LineBasicMaterial({color:0x20252b,depthTest:false,transparent:true,opacity:.9});const l=new THREE.Line(g,m);l.renderOrder=100;return l}
function build(annotations){for(const a of annotations||[]){if(a.type==='label')helperGroup.add(labelObj(a,v(a.position),'label'));else if(a.type==='dimension'){const p1=v(a.points[0]),p2=v(a.points[1]);helperGroup.add(line(p1,p2));helperGroup.add(labelObj(a,p1.clone().add(p2).multiplyScalar(.5),'dimension'))}else if(a.type==='vector'){const p1=v(a.points[0]),p2=v(a.points[1]),dir=p2.clone().sub(p1),len=dir.length();if(len>0){const ar=new THREE.ArrowHelper(dir.clone().normalize(),p1,len,0xc62828,Math.min(len*.18,len*.4),Math.min(len*.08,len*.18));ar.line.material.depthTest=false;ar.cone.material.depthTest=false;helperGroup.add(ar)}helperGroup.add(labelObj(a,p1.clone().add(p2).multiplyScalar(.5),'vector'))}}}
async function init(){try{const q=new URLSearchParams(location.search),project=q.get('project')||'projects/demo/demo.annotations.json';const r=await fetch(project);if(!r.ok)throw new Error(`Could not load ${project}`);const data=await r.json();const modelUrl=new URL(data.model,new URL(project,location.href)).href;model=await new GLTFLoader().loadAsync(modelUrl).then(g=>g.scene);scene.add(model);build(data.annotations);document.getElementById('title').textContent=data.title||data.model||'Mechanics 3D';fit();msg.textContent='Drag to rotate • scroll/pinch to zoom'}catch(e){console.error(e);msg.textContent=e.message}}
init();
document.getElementById('resetBtn').addEventListener('click',fit);document.getElementById('labelsBtn').addEventListener('click',e=>{labelsVisible=!labelsVisible;helperGroup.visible=labelsVisible;e.currentTarget.textContent=labelsVisible?'Hide Labels':'Show Labels'});
