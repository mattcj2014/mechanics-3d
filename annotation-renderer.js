import * as THREE from 'three';
import { CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';

export const DEFAULT_STYLE={fontSize:16,fontFamily:'sans',bold:true,italic:false,color:'#18202a',background:'#ffffff',borderColor:'#222222',appearance:'box'};
const fonts={sans:'Arial, sans-serif',serif:'Georgia, serif',mono:'Consolas, monospace'};
export function labelStyle(a){
  const s={...DEFAULT_STYLE,...a.style};
  s.fontSize=Math.max(8,Math.min(72,Number(s.fontSize)||16));
  for(const k of ['color','background','borderColor'])if(!/^#[0-9a-f]{6}$/i.test(s[k]))s[k]=DEFAULT_STYLE[k];
  if(!fonts[s.fontFamily])s.fontFamily='sans';
  return s;
}
export function styleBubble(bubble,a){
  const s=labelStyle(a);
  Object.assign(bubble.style,{fontSize:`${s.fontSize}px`,fontFamily:fonts[s.fontFamily],fontWeight:s.bold?'700':'400',fontStyle:s.italic?'italic':'normal',color:s.color,background:s.appearance==='plain'?'transparent':s.background,border:s.appearance==='plain'?'none':`1px solid ${s.borderColor}`,borderRadius:s.appearance==='pill'?'999px':'6px',padding:s.appearance==='plain'?'2px':'5px 8px',boxShadow:s.appearance==='plain'?'none':'0 1px 5px #0002'});
}
export function originDirections(a){
  const angles=a.rotation||[0,0,0];
  const rotation=new THREE.Euler(...angles.map(n=>THREE.MathUtils.degToRad(Number(n)||0)),'XYZ');
  return [new THREE.Vector3(1,0,0),new THREE.Vector3(0,1,0),new THREE.Vector3(0,0,1)].map((v,i)=>v.applyEuler(rotation).multiplyScalar(a.flips?.[i]?-1:1));
}
export function clearAnnotations(group){
  for(const child of [...group.children]){
    group.remove(child);
    child.traverse(o=>{if(o.isCSS2DObject)o.element.remove();o.geometry?.dispose();if(o.material)for(const m of Array.isArray(o.material)?o.material:[o.material])m.dispose();});
  }
}
export function renderAnnotations(group,annotations,{selectedId=null,onSelect=null}={}){
  clearAnnotations(group);
  const point=p=>new THREE.Vector3(...p.map(Number));
  function label(a,p,kind,text=a.text||'(blank)',color=null){
    const outer=document.createElement('div');outer.className=`annotation-label ${kind}${a.id===selectedId?' selected':''}`;
    const bubble=document.createElement('div');bubble.className='bubble';bubble.textContent=text;styleBubble(bubble,a);if(color)bubble.style.color=color;
    outer.appendChild(bubble);outer.style.pointerEvents=onSelect?'auto':'none';
    if(onSelect){outer.addEventListener('pointerdown',e=>e.stopPropagation());outer.addEventListener('click',e=>{e.stopPropagation();onSelect(a.id)});}
    const object=new CSS2DObject(outer);object.position.copy(p);group.add(object);
  }
  function arrow(p,dir,len,color){
    const a=new THREE.ArrowHelper(dir,p,len,color,len*.16,len*.07);
    for(const material of [a.line.material,a.cone.material]){material.depthTest=false;material.depthWrite=false;}
    a.line.renderOrder=a.cone.renderOrder=100;group.add(a);
  }
  for(const a of annotations||[]){
    if(a.type==='label')label(a,point(a.position),'label');
    else if(a.type==='origin'){
      const p=point(a.position),len=Math.max(1e-8,Number(a.axisLength)||1),dirs=originDirections(a);
      dirs.forEach((dir,i)=>{const color=['#c62828','#16803c','#185abd'][i];arrow(p,dir,len,color);label(a,p.clone().addScaledVector(dir,len*1.12),'axis',['X','Y','Z'][i],color)});
      label(a,p,'origin',a.text||'O (0, 0, 0)');
    }else if(a.type==='dimension'||a.type==='vector'){
      const p=point(a.points[0]),q=point(a.points[1]),delta=q.clone().sub(p),len=delta.length();
      if(a.type==='vector'&&len>0)arrow(p,delta.normalize(),len,labelStyle(a).color);
      if(a.type==='dimension'){
        const line=new THREE.Line(new THREE.BufferGeometry().setFromPoints([p,q]),new THREE.LineBasicMaterial({color:labelStyle(a).borderColor,depthTest:false,depthWrite:false}));line.renderOrder=100;group.add(line);
      }
      label(a,p.clone().add(q).multiplyScalar(.5),a.type);
    }
  }
}
