import { setupPublishing } from './publishing.js';
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
  if (!modelRoot) return;
  scene.remove(modelRoot);
  modelRoot.traverse(obj => {
    if (obj.geometry) obj.geometry.dispose?.();
    if (obj.material) {
      const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
      mats.forEach(m => m.dispose?.());
    }
  });
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
  exportBtn.disabled = true; previewBtn.disabled = true;
  disposeModel();
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
    const gltf = await gltfLoader.loadAsync(modelURL);
    modelRoot = gltf.scene;
    scene.add(modelRoot);
    emptyState.classList.add('hidden');
    exportBtn.disabled = false;
    previewBtn.disabled = false;
    fitBtn.disabled = false;
    fitModel();
    publisher.modelLoaded(file);
    setStatus(`Loaded ${file.name}. Choose a tool and click the model.`);
  } catch (err) {
    console.error(err);
    setStatus(`Could not load GLB: ${err.message}`);
  }
}

glbInput.addEventListener('change', () => loadGLBFile(glbInput.files?.[0]));
fitBtn.addEventListener('click', fitModel);
clearPickBtn.addEventListener('click', () => { clearPending(); setStatus('Placement cancelled.'); });

const helpByMode = {
  select: 'Orbit the model. Click an existing annotation to edit it.',
  label: 'Click one point on the model. A screen-facing label will be created there.',
  dimension: 'Click endpoint 1, then endpoint 2. The measured length is calculated automatically.',
  vector: 'Click the vector tail, then the arrow head. Edit its label afterward.'
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
  if (!start || start.pointerId !== ev.pointerId || !modelRoot || mode === 'select') return;
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
  pendingPoints = [];
  while (pickGroup.children.length) pickGroup.remove(pickGroup.children[0]);
  clearPickBtn.disabled = true;
}

function handlePlacementPoint(p) {
  if (mode === 'label') {
    const n = annotations.filter(a => a.type === 'label').length + 1;
    const a = { id: uniqueId('label'), type:'label', text:`Label ${n}`, position:vecToArr(p) };
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
        rawDistance: raw, autoText:true, text:formatDimension(raw)
      };
      annotations.push(a); clearPending(); selectAnnotation(a.id); rebuildHelpers(); refreshList();
      setStatus('Length created. You can keep the measured value or replace the text.');
    }
  } else if (mode === 'vector') {
    if (pendingPoints.length === 1) {
      setStatus('Vector: tail saved. Click the arrow head.');
    } else if (pendingPoints.length === 2) {
      const n = annotations.filter(a => a.type === 'vector').length + 1;
      const a = { id:uniqueId('vec'), type:'vector', points:[...pendingPoints], text:`F${n}` };
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

function makeLabelObject(annotation, position, className='') {
  const outer = document.createElement('div');
  outer.className = `annotation-label ${className}${annotation.id === selectedId ? ' selected' : ''}`;
  outer.dataset.id = annotation.id;
  const bubble = document.createElement('div');
  bubble.className = 'bubble';
  bubble.textContent = annotation.text || '(blank)';
  outer.appendChild(bubble);
  outer.addEventListener('pointerdown', ev => ev.stopPropagation());
  outer.addEventListener('click', ev => { ev.stopPropagation(); selectAnnotation(annotation.id); });
  const obj = new CSS2DObject(outer);
  obj.position.copy(position);
  return obj;
}

function makeLine(a,b,color=0x20252b) {
  const geometry = new THREE.BufferGeometry().setFromPoints([a,b]);
  const material = new THREE.LineBasicMaterial({color, depthTest:false, transparent:true, opacity:.9});
  const line = new THREE.Line(geometry, material);
  line.renderOrder = 100;
  return line;
}

function rebuildHelpers() {
  while (helperGroup.children.length) {
    const c = helperGroup.children[0];
    // CSS2DObject removes its DOM element when Three.js emits "removed".
    // Mutating children directly skips that event and leaves old labels visible.
    helperGroup.remove(c);
    c.traverse(obj => {
      if (obj.isCSS2DObject) obj.element.remove();
      obj.geometry?.dispose?.();
      if (obj.material) {
        const materials = Array.isArray(obj.material) ? obj.material : [obj.material];
        materials.forEach(material => material.dispose?.());
      }
    });
  }
  for (const a of annotations) {
    if (a.type === 'label') {
      helperGroup.add(makeLabelObject(a, arrToVec(a.position), 'label'));
    } else if (a.type === 'dimension') {
      const p1 = arrToVec(a.points[0]), p2 = arrToVec(a.points[1]);
      helperGroup.add(makeLine(p1,p2,0x222222));
      helperGroup.add(makeLabelObject(a, p1.clone().add(p2).multiplyScalar(.5), 'dimension'));
    } else if (a.type === 'vector') {
      const p1 = arrToVec(a.points[0]), p2 = arrToVec(a.points[1]);
      const dir = p2.clone().sub(p1);
      const len = dir.length();
      if (len > 0) {
        const arrow = new THREE.ArrowHelper(dir.clone().normalize(), p1, len, 0xc62828, Math.min(len*.18, len*.4), Math.min(len*.08, len*.18));
        arrow.line.material.depthTest = false;
        arrow.cone.material.depthTest = false;
        arrow.renderOrder = 100;
        helperGroup.add(arrow);
      }
      helperGroup.add(makeLabelObject(a, p1.clone().add(p2).multiplyScalar(.5), 'vector'));
    }
  }
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

jsonInput.addEventListener('change', async () => {
  const file = jsonInput.files?.[0]; if (!file) return;
  try {
    const data = JSON.parse(await file.text());
    if (!Array.isArray(data.annotations)) throw new Error('JSON does not contain an annotations array.');
    annotations = data.annotations;
    $('problemTitle').value = data.title || '';
    publisher.invalidate();
    modelFileName = data.model || modelFileName;
    scaleInput.value = data.settings?.displayScale ?? 1;
    unitInput.value = data.settings?.unit ?? 'units';
    const ids = annotations.map(a => Number(String(a.id).match(/(\d+)$/)?.[1] || 0));
    nextId = Math.max(1, ...ids) + 1;
    selectedId = null;
    rebuildHelpers(); refreshList(); refreshEditor();
    setStatus(`Imported ${file.name}. ${modelRoot ? 'Annotations displayed on the loaded model.' : 'Now load the matching GLB.'}`);
  } catch (err) {
    setStatus(`Could not import JSON: ${err.message}`);
  }
});

const publisher = setupPublishing({ getFile: () => modelRoot ? modelFile : null, getPayload: projectPayload, previewBtn });
