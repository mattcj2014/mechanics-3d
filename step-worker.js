// Parse and tessellate STEP away from the editor so large CAD files cannot freeze it.
importScripts(new URL('./vendor/occt/occt-import-js.js',self.location.href).href);
self.onmessage=async(event)=>{
  try{
    const occt=await occtimportjs({locateFile:name=>new URL('./vendor/occt/'+name,self.location.href).href});
    const result=occt.ReadStepFile(new Uint8Array(event.data.buffer),{linearUnit:'meter',linearDeflectionType:'bounding_box_ratio',linearDeflection:event.data.deflection,angularDeflection:0.5});
    if(!result.success||!result.meshes?.length)throw new Error('No solid geometry could be read from this STEP file. Export the active SolidWorks part or assembly as STEP AP214 and try again.');
    const transfer=[];
    for(const mesh of result.meshes){
      mesh.attributes.position.array=new Float32Array(mesh.attributes.position.array);transfer.push(mesh.attributes.position.array.buffer);
      if(mesh.attributes.normal){mesh.attributes.normal.array=new Float32Array(mesh.attributes.normal.array);transfer.push(mesh.attributes.normal.array.buffer);}
      mesh.index.array=new Uint32Array(mesh.index.array);transfer.push(mesh.index.array.buffer);
    }
    self.postMessage({result},transfer);
  }catch(error){self.postMessage({error:error?.message||String(error)});}
};
