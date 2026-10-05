import { renderAnnotations, labelStyle, DEFAULT_STYLE } from './annotation-renderer.js?v=7';
import { convertStepFile } from './step-import.js?v=7';
import { validateGlb } from './glb-validation.js?v=7';
import { setupGitHub } from './github-ui.js?v=7';
import { setupPublishing, downloadBlob } from './publishing.js?v=7';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { CSS2DRenderer, CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';

const $ = (id) => document.getElementById(id);
const viewport = $('viewport');
const glbInput = $('glbInput');
const jsonInput = $('jsonInput');
const exportBtn = $('exportBtn');
const previewBtn = $('previewBtn');
const exitPreviewBtn = $('exitPreviewBtn');
const previewToolbar = $('previewToolbar');
const fitBtn = $('fitBtn');
const clearPickBtn = $('clearPickBtn');
const annotationList = $('annotationList');
const statusEl = $('status');
const emptyState = $('emptyState');
const modeHelp = $('modeHelp');
const scaleInput = $('scaleInput');
const unitInput = $('unitInput');
const editForm = $('editForm');
const noSelection = $('noSelection');
const typeField = $('typeField');
const textField = $('textField');
const autoRow = $('autoRow');
const autoTextField = $('autoTextField');
const measurementBox = $('measurementBox');
const deleteBtn = $('deleteBtn');

let modelRoot = null;
let modelFileName = '';
let modelFile = null;
let modelURL = null;
let mode = 'select';
let pendingPoints = [];
let selectedId = null;
let annotations = [];
let nextId = 1;
let pointerDown = null;
let modelLoading = false;
let repositionId = null;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0xe9edf1);
const camera = new THREE.PerspectiveCamera(45, 1, 0.001, 100000);
camera.position.set(2, 1.5, 3);

const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;
viewport.appendChild(renderer.domElement);

const labelRenderer = new CSS2DRenderer();
labelRenderer.domElement.style.position = 'absolute';
labelRenderer.domElement.style.inset = '0';
labelRenderer.domElement.style.pointerEvents = 'none';
viewport.appendChild(labelRenderer.domElement);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.08;
controls.screenSpacePanning = true;

scene.add(new THREE.HemisphereLight(0xffffff, 0x56616f, 2.2));
const keyLight = new THREE.DirectionalLight(0xffffff, 3.0);
keyLight.position.set(5, 8, 6);
scene.add(keyLight);
const fillLight = new THREE.DirectionalLight(0xffffff, 1.2);
fillLight.position.set(-5, 1, -4);
scene.add(fillLight);

const helperGroup = new THREE.Group();
scene.add(helperGroup);
const pickGroup = new THREE.Group();
scene.add(pickGroup);

const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();
const gltfLoader = new GLTFLoader();

function vecToArr(v) { return [v.x, v.y, v.z].map(n => Number(n.toFixed(8))); }
function arrToVec(a) { return new THREE.Vector3(Number(a[0]), Number(a[1]), Number(a[2])); }
function distance(a,b) { return arrToVec(a).distanceTo(arrToVec(b)); }
function setStatus(msg) { statusEl.textContent = msg; }
function uniqueId(prefix='a') { return `${prefix}${nextId++}`; }

function resize() {
  const w = viewport.clientWidth;
  const h = viewport.clientHeight;
  if (!w || !h) return;
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  renderer.setSize(w, h, false);
  labelRenderer.setSize(w, h);
}
new ResizeObserver(resize).observe(viewport);

function animate() {
  controls.update();
  renderer.render(scene, camera);
  labelRenderer.render(scene, camera);
  requestAnimationFrame(animate);
}
animate();

function disposeModel() {
  if (modelRoot) {
    scene.remove(modelRoot);
    modelRoot.traverse(obj => {
      if (obj.geometry) obj.geometry.dispose?.();
      if (obj.material) {
        const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
        mats.forEach(m => m.dispose?.());
      }
    });
  }
  modelRoot = null;
  if (modelURL) URL.revokeObjectURL(modelURL);
  modelURL = null;
}

function fitModel() {
  if (!modelRoot) return;
  const box = new THREE.Box3().setFromObject(modelRoot);
  const size = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());
  const maxDim = Math.max(size.x, size.y, size.z) || 1;
  const dist = maxDim / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2))) * 1.45;
  const dir = new THREE.Vector3(1, .7, 1).normalize();
  camera.position.copy(center).add(dir.multiplyScalar(dist));
  camera.near = Math.max(maxDim / 10000, 0.0001);
  camera.far = Math.max(maxDim * 1000, 100);
  camera.updateProjectionMatrix();
  controls.target.copy(center);
  controls.minDistance = maxDim * 0.01;
  controls.maxDistance = maxDim * 100;
  controls.update();
}

async function loadGLBFile(file) {
  if (!file) return;
  if(modelLoading){setStatus('Wait for the current model import to finish.');return false;}
  modelLoading=true;glbInput.disabled=true;$('downloadGlbBtn').disabled=true;
  exportBtn.disabled = true; previewBtn.disabled = true;
  disposeModel();
  publisher.invalidate();
  $('makeQrBtn').disabled = true;
  document.dispatchEvent(new Event('mechanics-model-change'));
  annotations = [];
  selectedId = null;
  clearPending();
  rebuildHelpers();
  refreshList();
  refreshEditor();
  modelFileName = file.name;
  modelFile = file;
  modelURL = URL.createObjectURL(file);
  setStatus(`Loading ${file.name}...`);
  try {
    const wasStep=/\.(step|stp)$/i.test(file.name);
    if(wasStep){file=await convertStepFile(file,{quality:$('stepQuality').value,progress:setStatus});modelFile=file;modelFileName=file.name;unitInput.value='m';scaleInput.value=1;}
    const bytes = await file.arrayBuffer();
    validateGlb(bytes);
    const gltf = await gltfLoader.parseAsync(bytes, '');
    modelRoot = gltf.scene;
    scene.add(modelRoot);
    emptyState.classList.add('hidden');
    exportBtn.disabled = false;
    previewBtn.disabled = false;
    fitBtn.disabled = false;
    fitModel();
    publisher.modelLoaded(file);
    $('downloadGlbBtn').disabled=false;
    setStatus(wasStep?`STEP imported with colors. Dimensions are in meters. Choose a tool to annotate.`:`Loaded ${file.name}. Choose a tool and click the model.`);
    return true;
  } catch (err) {
    exportBtn.disabled = true; previewBtn.disabled = true; fitBtn.disabled = true;
    disposeModel();
    document.dispatchEvent(new Event('mechanics-model-change'));
    emptyState.classList.remove('hidden');
    console.error(err);
    setStatus(`Could not load model: ${err.message}`);
    return false;
  } finally {modelLoading=false;glbInput.disabled=false;}
}

glbInput.addEventListener('change', async () => {await loadGLBFile(glbInput.files?.[0]);glbInput.value='';});
$('downloadGlbBtn').addEventListener('click',()=>{if(modelRoot&&modelFile)downloadBlob(modelFile,modelFile.name);});
fitBtn.addEventListener('click', fitModel);
clearPickBtn.addEventListener('click', () => { clearPending(); setStatus('Placement cancelled.'); });

const helpByMode = {
  select: 'Orbit the model. Click an existing annotation to edit it.',
  label: 'Click one point on the model. A screen-facing label will be created there.',
  dimension: 'Click endpoint 1, then endpoint 2. The measured length is calculated automatically.',
  vector: 'Click the vector tail, then the arrow head. Edit its label afterward.',
  origin: 'Click the model to place the origin. Flip or rotate its X/Y/Z axes in the right panel.'
};

document.querySelectorAll('.tool').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.tool').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    mode = btn.dataset.mode;
    clearPending();
    modeHelp.textContent = helpByMode[mode];
    setStatus(helpByMode[mode]);
  });
});

function eventToModelPoint(ev) {
  if (!modelRoot) return null;
  const rect = renderer.domElement.getBoundingClientRect();
  mouse.x = ((ev.clientX - rect.left) / rect.width) * 2 - 1;
  mouse.y = -((ev.clientY - rect.top) / rect.height) * 2 + 1;
  raycaster.setFromCamera(mouse, camera);
  const hits = raycaster.intersectObject(modelRoot, true);
  return hits.length ? hits[0].point.clone() : null;
}

renderer.domElement.addEventListener('pointerdown', (ev) => {
  pointerDown = {x: ev.clientX, y: ev.clientY, maxMove: 0, pointerId: ev.pointerId};
});
renderer.domElement.addEventListener('pointermove', (ev) => {
  if (pointerDown?.pointerId === ev.pointerId) {
    pointerDown.maxMove = Math.max(pointerDown.maxMove,
      Math.hypot(ev.clientX - pointerDown.x, ev.clientY - pointerDown.y));
  }
});
renderer.domElement.addEventListener('pointercancel', () => { pointerDown = null; });
renderer.domElement.addEventListener('pointerup', (ev) => {
  const start = pointerDown;
  pointerDown = null;
  if (!start || start.pointerId !== ev.pointerId || !modelRoot || (mode === 'select' && !repositionId)) return;
  const d = Math.max(start.maxMove, Math.hypot(ev.clientX - start.x, ev.clientY - start.y));
  if (d > 5) return; // a drag must never place an annotation, even if it ends near its start
  const p = eventToModelPoint(ev);
  if (!p) { setStatus('No model surface was hit. Click directly on the model.'); return; }
  handlePlacementPoint(p);
});

function addPickDot(point) {
  const div = document.createElement('div');
  div.className = 'pick-dot';
  const obj = new CSS2DObject(div);
  obj.position.copy(point);
  pickGroup.add(obj);
}
function clearPending() {
  repositionId = null;
  pendingPoints = [];
  while (pickGroup.children.length) pickGroup.remove(pickGroup.children[0]);
  clearPickBtn.disabled = true;
}

function handlePlacementPoint(p) {
  if(repositionId){const a=annotations.find(a=>a.id===repositionId);if(a)a.position=vecToArr(p);clearPending();refreshEditor();rebuildHelpers();setStatus('Annotation moved.');return;}
  if(mode==='origin'){
    const size=new THREE.Box3().setFromObject(modelRoot).getSize(new THREE.Vector3());
    const a={id:uniqueId('origin'),type:'origin',text:'O (0, 0, 0)',position:vecToArr(p),axisLength:Math.max(size.x,size.y,size.z)*.2||1,rotation:[0,0,0],flips:[false,false,false],style:{...DEFAULT_STYLE}};
    annotations.push(a);selectAnnotation(a.id);setStatus('Origin placed. Adjust axis length, rotation, or Flip X/Y/Z in the right panel.');return;
  }
  if (mode === 'label') {
    const n = annotations.filter(a => a.type === 'label').length + 1;
    const a = { id: uniqueId('label'), type:'label', text:`Label ${n}`, position:vecToArr(p), style:{...DEFAULT_STYLE} };
    annotations.push(a); selectAnnotation(a.id); rebuildHelpers(); refreshList();
    setStatus('Label created. Edit its text in the right panel, or click another point.');
    return;
  }

  pendingPoints.push(vecToArr(p));
  addPickDot(p);
  clearPickBtn.disabled = false;

  if (mode === 'dimension') {
    if (pendingPoints.length === 1) {
      setStatus('Length: first endpoint saved. Click the second endpoint.');
    } else if (pendingPoints.length === 2) {
      const raw = distance(pendingPoints[0], pendingPoints[1]);
      const a = {
        id: uniqueId('dim'), type:'dimension', points:[...pendingPoints],
        rawDistance: raw, autoText:true, text:formatDimension(raw), style:{...DEFAULT_STYLE}
      };
      annotations.push(a); clearPending(); selectAnnotation(a.id); rebuildHelpers(); refreshList();
      setStatus('Length created. You can keep the measured value or replace the text.');
    }
  } else if (mode === 'vector') {
    if (pendingPoints.length === 1) {
      setStatus('Vector: tail saved. Click the arrow head.');
    } else if (pendingPoints.length === 2) {
      const n = annotations.filter(a => a.type === 'vector').length + 1;
      const a = { id:uniqueId('vec'), type:'vector', points:[...pendingPoints], text:`F${n}`, style:{...DEFAULT_STYLE} };
      annotations.push(a); clearPending(); selectAnnotation(a.id); rebuildHelpers(); refreshList();
      setStatus('Vector created. Edit its label in the right panel.');
    }
  }
}

function formatNumber(v) {
  if (!Number.isFinite(v)) return '0';
  if (Math.abs(v) >= 1000 || (Math.abs(v) > 0 && Math.abs(v) < 0.001)) return v.toExponential(3);
  return Number(v.toFixed(4)).toString();
}
function displayScale() {
  const v = Number(scaleInput.value);
  return Number.isFinite(v) ? v : 1;
}
function formatDimension(raw) {
  const unit = unitInput.value.trim();
  const val = raw * displayScale();
  return `${formatNumber(val)}${unit ? ' ' + unit : ''}`;
}
function updateAutoDimensions() {
  annotations.forEach(a => {
    if (a.type === 'dimension' && a.autoText) a.text = formatDimension(a.rawDistance ?? distance(a.points[0], a.points[1]));
  });
  rebuildHelpers(); refreshList(); refreshEditor();
}
scaleInput.addEventListener('input', updateAutoDimensions);
unitInput.addEventListener('input', updateAutoDimensions);

function rebuildHelpers() {
  renderAnnotations(helperGroup,annotations,{selectedId,onSelect:selectAnnotation});
}

function refreshList() {
  annotationList.innerHTML = '';
  if (!annotations.length) {
    annotationList.innerHTML = '<p class="empty">No annotations yet.</p>';
    return;
  }
  annotations.forEach((a, i) => {
    const btn = document.createElement('button');
    btn.className = `annotation-item${a.id === selectedId ? ' selected' : ''}`;
    btn.textContent = `${i+1}. ${a.type}: ${a.text || '(blank)'}`;
    btn.addEventListener('click', () => selectAnnotation(a.id));
    annotationList.appendChild(btn);
  });
}

function selectAnnotation(id) {
  clearPending();
  selectedId = id;
  refreshList(); refreshEditor(); rebuildHelpers();
}
function currentAnnotation() { return annotations.find(a => a.id === selectedId) || null; }

function refreshEditor() {
  const a = currentAnnotation();
  if (!a) {
    noSelection.classList.remove('hidden'); editForm.classList.add('hidden'); return;
  }
  noSelection.classList.add('hidden'); editForm.classList.remove('hidden');
  typeField.value = a.type;
  textField.value = a.text ?? '';
  const style=labelStyle(a);
  for(const id of ['fontSize','fontFamily','color','background','borderColor','appearance'])$('style'+id[0].toUpperCase()+id.slice(1)).value=style[id];
  $('styleBold').checked=!!style.bold;$('styleItalic').checked=!!style.italic;
  $('originControls').classList.toggle('hidden',a.type!=='origin');
  $('repositionBtn').classList.toggle('hidden',!['origin','label'].includes(a.type));
  if(a.type==='origin'){
    $('axisLength').value=a.axisLength;
    ['X','Y','Z'].forEach((axis,i)=>{$('rotate'+axis).value=a.rotation?.[i]||0;$('flip'+axis).checked=!!a.flips?.[i]});
    $('originPosition').textContent='Model point: '+a.position.map(formatNumber).join(', ');
  }
  if (a.type === 'dimension') {
    autoRow.classList.remove('hidden'); measurementBox.classList.remove('hidden');
    autoTextField.checked = a.autoText !== false;
    const raw = a.rawDistance ?? distance(a.points[0], a.points[1]);
    measurementBox.textContent = `Raw model distance: ${formatNumber(raw)} | Displayed: ${formatDimension(raw)}`;
    textField.disabled = autoTextField.checked;
  } else {
    autoRow.classList.add('hidden'); measurementBox.classList.add('hidden');
    textField.disabled = false;
  }
}

editForm.addEventListener('submit',e=>e.preventDefault());
for(const key of ['fontSize','fontFamily','color','background','borderColor','appearance','bold','italic']){
  const input=$('style'+key[0].toUpperCase()+key.slice(1));
  input.addEventListener('input',()=>{const a=currentAnnotation();if(!a)return;a.style=labelStyle(a);a.style[key]=input.type==='checkbox'?input.checked:input.type==='number'?Number(input.value):input.value;rebuildHelpers();});
}
for(const [i,axis] of ['X','Y','Z'].entries()){
  $('flip'+axis).addEventListener('change',()=>{const a=currentAnnotation();if(a?.type!=='origin')return;a.flips??=[false,false,false];a.flips[i]=$('flip'+axis).checked;rebuildHelpers();});
  $('rotate'+axis).addEventListener('input',()=>{const a=currentAnnotation();if(a?.type!=='origin')return;a.rotation??=[0,0,0];a.rotation[i]=Number($('rotate'+axis).value)||0;rebuildHelpers();});
}
$('axisLength').addEventListener('input',()=>{const a=currentAnnotation(),len=Number($('axisLength').value);if(a?.type==='origin'&&len>0&&Number.isFinite(len)){a.axisLength=len;rebuildHelpers();}});
$('resetAxesBtn').addEventListener('click',()=>{const a=currentAnnotation();if(a?.type==='origin'){a.rotation=[0,0,0];a.flips=[false,false,false];refreshEditor();rebuildHelpers();}});
$('repositionBtn').addEventListener('click',()=>{const a=currentAnnotation();if(!a)return;clearPending();repositionId=a.id;clearPickBtn.disabled=false;setStatus('Click a new point on the model to move this annotation.');});
textField.addEventListener('input', () => {
  const a = currentAnnotation(); if (!a) return;
  a.text = textField.value;
  rebuildHelpers(); refreshList();
});
autoTextField.addEventListener('change', () => {
  const a = currentAnnotation(); if (!a || a.type !== 'dimension') return;
  a.autoText = autoTextField.checked;
  if (a.autoText) a.text = formatDimension(a.rawDistance ?? distance(a.points[0],a.points[1]));
  refreshEditor(); rebuildHelpers(); refreshList();
});
deleteBtn.addEventListener('click', () => {
  const a = currentAnnotation(); if (!a) return;
  annotations = annotations.filter(x => x.id !== a.id);
  selectedId = null;
  rebuildHelpers(); refreshList(); refreshEditor();
  setStatus('Annotation deleted.');
});

function projectPayload() {
  return {
    version: 1,
    model: modelFile?.name || modelFileName,
    settings: { displayScale: displayScale(), unit: unitInput.value.trim() },
    title: $('problemTitle').value.trim() || modelFileName,
    annotations
  };
}
exportBtn.addEventListener('click', () => {
  if (!modelFileName) return;
  const payload = projectPayload();
  const blob = new Blob([JSON.stringify(payload, null, 2)], {type:'application/json'});
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  const base = modelFileName.replace(/\.glb$/i,'') || 'model';
  a.download = `${base}.annotations.json`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  setStatus(`Exported ${a.download}. Keep it next to the GLB when you host it.`);
});

exitPreviewBtn.addEventListener('click', () => {
  document.body.classList.remove('preview-mode');
  previewToolbar.classList.add('hidden');
  resize();
});

function applyAnnotations(data) {
  clearPending();
  if (!Array.isArray(data.annotations)) throw new Error('JSON does not contain an annotations array.');
  annotations = structuredClone(data.annotations);
  $('problemTitle').value = data.title || '';
  publisher.invalidate();
  modelFileName = data.model || modelFileName;
  scaleInput.value = data.settings?.displayScale ?? 1;
  unitInput.value = data.settings?.unit ?? 'units';
  const ids = annotations.map(a => Number(String(a.id).match(/(\d+)$/)?.[1] || 0));
  nextId = Math.max(1, ...ids) + 1;
  selectedId = null;
  rebuildHelpers(); refreshList(); refreshEditor();
}
jsonInput.addEventListener('change', async () => {
  const file = jsonInput.files?.[0]; if (!file) return;
  try { applyAnnotations(JSON.parse(await file.text())); setStatus(`Imported ${file.name}. ${modelRoot ? 'Annotations displayed on the loaded model.' : 'Now load the matching GLB.'}`); }
  catch (err) { setStatus(`Could not import JSON: ${err.message}`); }
});

const publisher = setupPublishing({ getFile: () => modelRoot ? modelFile : null, getPayload: projectPayload, previewBtn });

setupGitHub({publisher,getFile:()=>modelRoot?modelFile:null,getPayload:projectPayload,
  loadProject:async(file,data,entry)=>{
    if(!await loadGLBFile(file))throw new Error('Could not load this model.');
    applyAnnotations(data);publisher.usePublishedProject(entry);
    setStatus(`Editing ${entry.title}. Publish to update its existing student link.`);
  }
});

$('loadDemoBtn').addEventListener('click',async()=>{
  if(modelLoading)return;
  if(modelRoot&&!window.confirm('Load the demo? Unsaved annotations in this editor will be replaced.'))return;
  try{
    const response=await fetch('projects/demo/demo.glb',{cache:'no-store'});
    if(!response.ok)throw new Error('Demo is available in the local test folder. Load your own model here.');
    const file=new File([await response.arrayBuffer()],'demo.glb',{type:'model/gltf-binary'});
    const annotationsResponse=await fetch('projects/demo/demo.annotations.json',{cache:'no-store'});
    if(!annotationsResponse.ok)throw new Error('Demo annotations are missing.');
    const data=await annotationsResponse.json();
    if(await loadGLBFile(file)){applyAnnotations(data);setStatus('Demo loaded. Select an annotation to change its appearance, or select Origin and click the beam.');}
  }catch(e){setStatus(e.message);}
});
