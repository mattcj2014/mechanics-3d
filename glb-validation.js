// Validate the GLB container before Three.js tries to allocate mesh arrays.
export function validateGlb(buffer){
  if(!(buffer instanceof ArrayBuffer)||buffer.byteLength<20)throw new Error('This file is too short to be a GLB. Export a new .glb from your CAD program.');
  const view=new DataView(buffer);
  if(view.getUint32(0,true)!==0x46546c67)throw new Error('This is not a GLB file. Renaming another file to .glb does not convert it.');
  if(view.getUint32(4,true)!==2)throw new Error('This viewer requires glTF/GLB version 2.');
  if(view.getUint32(8,true)!==buffer.byteLength)throw new Error('This GLB is incomplete: its file length does not match its header. Export or upload it again.');
  let offset=12,json=null,binaryLength=0,binarySeen=false;
  while(offset<buffer.byteLength){
    if(offset+8>buffer.byteLength)throw new Error('This GLB has an incomplete chunk header. Export it again.');
    const length=view.getUint32(offset,true),type=view.getUint32(offset+4,true);offset+=8;
    if(length%4||length>buffer.byteLength-offset)throw new Error('This GLB has a damaged or incomplete data chunk. Export it again.');
    if(json===null&&type!==0x4e4f534a)throw new Error('This GLB is missing its model description. Export it again.');
    if(type===0x4e4f534a){
      if(json!==null)throw new Error('This GLB contains duplicate model descriptions.');
      try{json=JSON.parse(new TextDecoder().decode(new Uint8Array(buffer,offset,length)).replace(/\0+$/,''));}
      catch{throw new Error('This GLB has an unreadable model description. Export it again.');}
    }else if(type===0x004e4942){if(binarySeen)throw new Error('This GLB contains duplicate mesh data chunks.');binarySeen=true;binaryLength=length;}
    offset+=length;
  }
  if(!json||json.asset?.version!=='2.0')throw new Error('This file does not contain a valid glTF 2.0 model description.');
  const first=json.buffers?.[0];
  if(first&&first.uri===undefined){
    if(!Number.isSafeInteger(first.byteLength)||first.byteLength<0)throw new Error('This GLB declares an invalid mesh buffer size.');
    if(first.byteLength>binaryLength){
      const generator=String(json.asset.generator||'');
      throw new Error(`Incomplete GLB: it declares ${first.byteLength.toLocaleString('en-US')} bytes of mesh data, but contains ${binaryLength.toLocaleString('en-US')}. ${/solidworks/i.test(generator)?'Re-export from SolidWorks as Extended Reality Binary (.glb).':'Export the model again.'}`);
    }
  }
  return {json,binaryLength};
}
export async function loadValidatedGLB(loader,url){
  const response=await fetch(url,{cache:'no-store'});
  if(!response.ok)throw new Error(`Could not load the model file (HTTP ${response.status}). Check that the GLB is published beside its annotation JSON.`);
  const buffer=await response.arrayBuffer();validateGlb(buffer);
  const resolved=new URL(url,location.href),base=resolved.protocol==='blob:'?'':new URL('./',resolved).href;
  return loader.parseAsync(buffer,base);
}
