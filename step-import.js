import * as THREE from 'three';
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js';
import { validateGlb } from './glb-validation.js?v=7';
export function sceneFromStep(result){
  if(!result.success||!result.meshes?.length)throw new Error('The STEP import did not contain any meshes.');
  const materials=new Map(),geometries=[];
  function materialIndex(colors,rgb){
    const values=(Array.isArray(rgb)&&rgb.length===3&&rgb.every(Number.isFinite)?rgb:[0.66,0.7,0.76]).map(x=>Math.min(1,Math.max(0,x)));
    const key=values.join(',');
    if(!materials.has(key))materials.set(key,new THREE.MeshStandardMaterial({color:new THREE.Color(...values),metalness:0,roughness:0.5,side:THREE.DoubleSide}));
    const material=materials.get(key);let index=colors.indexOf(material);if(index<0){index=colors.length;colors.push(material);}return index;
  }
  const prototypes=result.meshes.map((mesh,index)=>{
    const positions=mesh.attributes?.position?.array,indices=mesh.index?.array;
    if(!positions?.length||positions.length%3||!indices?.length||indices.length%3)throw new Error(`STEP mesh ${index+1} has invalid geometry.`);
    const geometry=new THREE.BufferGeometry();geometries.push(geometry);
    geometry.setAttribute('position',new THREE.BufferAttribute(positions instanceof Float32Array?positions:new Float32Array(positions),3));
    const normals=mesh.attributes.normal?.array;
    if(normals?.length===positions.length)geometry.setAttribute('normal',new THREE.BufferAttribute(normals instanceof Float32Array?normals:new Float32Array(normals),3));
    geometry.setIndex(new THREE.BufferAttribute(indices instanceof Uint32Array?indices:new Uint32Array(indices),1));
    if(!geometry.hasAttribute('normal'))geometry.computeVertexNormals();
    const colors=[],defaultMaterial=materialIndex(colors,mesh.color);
    let cursor=0;
    const add=(start,count,material)=>{
      if(!count)return;const last=geometry.groups[geometry.groups.length-1];
      if(last&&last.start+last.count===start&&last.materialIndex===material)last.count+=count;
      else geometry.addGroup(start,count,material);
    };
    for(const face of [...(mesh.brep_faces||[])].sort((a,b)=>a.first-b.first)){
      const start=face.first*3,end=(face.last+1)*3;
      if(!Number.isInteger(start)||!Number.isInteger(end)||start<cursor||end<start||end>indices.length)throw new Error('STEP face color ranges do not match the mesh.');
      add(cursor,start-cursor,defaultMaterial);add(start,end-start,materialIndex(colors,face.color||mesh.color));cursor=end;
    }
    add(cursor,indices.length-cursor,defaultMaterial);
    const object=new THREE.Mesh(geometry,colors);object.name=mesh.name||`Part ${index+1}`;return object;
  });
  const used=new Set();
  function node(source){
    const group=new THREE.Group();group.name=source.name||'Assembly';
    for(const index of source.meshes||[]){if(!prototypes[index])throw new Error('STEP assembly references a missing part.');group.add(prototypes[index].clone());used.add(index);}
    for(const child of source.children||[])group.add(node(child));return group;
  }
  const root=result.root?node(result.root):new THREE.Group();
  prototypes.forEach((object,index)=>{if(!used.has(index))root.add(object);});
  root.userData={sourceFormat:'STEP',linearUnit:'meter'};
  return root;
}
export async function stepResultToGlb(result,name){
  const scene=sceneFromStep(result);
  try{
    const buffer=await new GLTFExporter().parseAsync(scene,{binary:true,onlyVisible:true});validateGlb(buffer);
    return new File([buffer],name.replace(/\.(step|stp)$/i,'')+'.glb',{type:'model/gltf-binary'});
  }finally{
    const geometries=new Set(),materials=new Set();scene.traverse(obj=>{if(obj.geometry)geometries.add(obj.geometry);for(const material of Array.isArray(obj.material)?obj.material:obj.material?[obj.material]:[])materials.add(material);});
    geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());
  }
}
export async function convertStepFile(file,{quality='standard',progress=()=>{}}={}){
  if(file.size>50*1024*1024)throw new Error('STEP files over 50 MiB should be simplified before browser import.');
  const text=new TextDecoder().decode(await file.slice(0,2048).arrayBuffer()).replace(/^\uFEFF/,'');
  if(!text.includes('ISO-10303-21'))throw new Error('This file is not a STEP Part 21 file. Export it as STEP AP214 from SolidWorks.');
  progress('Converting STEP geometry and colors…');
  const buffer=await file.arrayBuffer(),deflection={coarse:0.005,standard:0.001,fine:0.0002}[quality]||0.001;
  const result=await new Promise((resolve,reject)=>{
    const worker=new Worker(new URL('./step-worker.js',import.meta.url));
    const timeout=setTimeout(()=>{worker.terminate();reject(new Error('STEP conversion timed out. Try Coarse detail or simplify the assembly.'));},180000);
    const finish=()=>{clearTimeout(timeout);worker.terminate();};
    worker.onmessage=event=>{finish();if(event.data.error)reject(new Error(event.data.error));else resolve(event.data.result);};
    worker.onerror=()=>{finish();reject(new Error('STEP converter could not start. Confirm vendor/occt/occt-import-js.js and its .wasm file were uploaded, then try a current Chrome or Edge browser.'));};
    worker.postMessage({buffer,deflection},[buffer]);
  });
  progress('Preparing the colored model for the viewer…');
  return stepResultToGlb(result,file.name);
}
