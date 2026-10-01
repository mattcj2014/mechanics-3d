// GitHub repository writes are committed together; credentials stay in memory.
export class GitHubError extends Error {
  constructor(message,status=0){super(message);this.name='GitHubError';this.status=status;}
}
export function safePath(path){
  if(typeof path!=='string'||!path||path.startsWith('/')||path.includes('\\')||path.split('/').some(p=>!p||p==='.'||p==='..')||/[?#\x00-\x1f]/.test(path))throw new Error('Invalid repository file path.');
  return path;
}
export function projectFolder(entry){
  const parts=safePath(entry.project).split('/');
  if(parts.length<3||parts[0]!=='projects')throw new Error('This problem is outside the projects folder.');
  return `${parts[0]}/${parts[1]}/`;
}
export function modelPath(entry,data){
  const path=safePath(entry.project), folder=path.slice(0,path.lastIndexOf('/')+1);
  return safePath(folder+safePath(data.model));
}
export function bytesToBase64(bytes){
  const chunks=[];for(let i=0;i<bytes.length;i+=32768)chunks.push(String.fromCharCode(...bytes.subarray(i,i+32768)));
  return btoa(chunks.join(''));
}
export function base64ToBytes(value){const raw=atob(value.replace(/\s/g,'')),out=new Uint8Array(raw.length);for(let i=0;i<raw.length;i++)out[i]=raw.charCodeAt(i);return out;}
export class GitHubRepository {
  #token; #root; #branch; #fetch;
  constructor({token,owner,repo,branch,fetchImpl=fetch}){
    if(!token?.trim())throw new Error('Enter a GitHub token.');
    if(!/^[a-zA-Z0-9-]+$/.test(owner)||!/^[a-zA-Z0-9_.-]+$/.test(repo))throw new Error('Enter a valid GitHub owner and repository name.');
    this.#token=token.trim();this.#root=`/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`;this.#branch=branch?.trim();this.#fetch=fetchImpl;
    this.owner=owner;this.repo=repo;
  }
  get branch(){return this.#branch;}
  disconnect(){this.#token='';}
  async request(path,method='GET',body){
    if(!this.#token)throw new Error('Connect to GitHub first.');
    const response=await this.#fetch('https://api.github.com'+this.#root+path,{method,headers:{Accept:'application/vnd.github+json',Authorization:`Bearer ${this.#token}`,'X-GitHub-Api-Version':'2022-11-28',...(body?{'Content-Type':'application/json'}:{})},body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(90000),redirect:'error',cache:'no-store'});
    if(!response.ok){
      let reason;try{reason=(await response.json()).message;}catch{}
      const guidance=response.status===401?'Token invalid or expired. Reconnect with a valid token.':response.status===403?'Access denied. Check token Contents: Read and write, repository selection, and branch rules.':response.status===404?'Repository, branch, or file not found. Check your connection and token repository access.':response.status===422?'GitHub rejected the change. Check branch rules or refresh the library.':reason||response.statusText;
      throw new GitHubError(guidance,response.status);
    }
    return response.status===204?null:response.json();
  }
  async connect(){
    const repo=await this.request('');
    if(repo.permissions?.push===false)throw new Error('Your account does not have write access to this repository.');
    this.#branch||=repo.default_branch;
    const snapshot=await this.snapshot();
    if(!snapshot.files.has('viewer.html')||!snapshot.files.has('index.html'))throw new Error('Upload the updated app to this repository root once before connecting.');
    return snapshot;
  }
  async blob(sha){const blob=await this.request(`/git/blobs/${encodeURIComponent(sha)}`);if(blob.encoding!=='base64')throw new Error('Unsupported GitHub file encoding.');return base64ToBytes(blob.content);}
  async snapshot(){
    const ref=await this.request(`/git/ref/heads/${encodeURIComponent(this.#branch)}`);
    const commit=await this.request(`/git/commits/${ref.object.sha}`);
    const tree=await this.request(`/git/trees/${commit.tree.sha}?recursive=1`);
    if(tree.truncated)throw new Error('Repository is too large to list safely. Use a dedicated repository for the viewer.');
    const files=new Map(tree.tree.filter(x=>x.type==='blob').map(x=>[x.path,x]));
    const catalogFile=files.get('catalog.json');
    const catalog=catalogFile?JSON.parse(new TextDecoder().decode(await this.blob(catalogFile.sha))):{version:1,problems:[]};
    if(!Array.isArray(catalog.problems))throw new Error('catalog.json must contain a problems array.');
    const ids=new Set();for(const entry of catalog.problems){if(!entry.id||ids.has(entry.id))throw new Error('Library contains missing or duplicate problem IDs. Fix catalog.json before publishing.');safePath(entry.project);ids.add(entry.id);}
    return {head:ref.object.sha,tree:commit.tree.sha,files,catalog};
  }
  async readProject(snapshot,entry){
    const item=snapshot.files.get(safePath(entry.project));if(!item)throw new Error('Annotation file missing from the repository.');
    const data=JSON.parse(new TextDecoder().decode(await this.blob(item.sha)));
    if(!Array.isArray(data.annotations))throw new Error('Problem has no valid annotations array.');
    const path=modelPath(entry,data),model=snapshot.files.get(path);if(!model)throw new Error('Model file missing from the repository.');
    const bytes=await this.blob(model.sha);
    return {data,file:new File([bytes],path.split('/').pop(),{type:'model/gltf-binary'}),revision:`${item.sha}:${model.sha}`};
  }
  async revision(snapshot,entry){
    const annotation=snapshot.files.get(safePath(entry.project));if(!annotation)return null;
    const data=JSON.parse(new TextDecoder().decode(await this.blob(annotation.sha)));
    return `${annotation.sha}:${snapshot.files.get(modelPath(entry,data))?.sha||'missing'}`;
  }
  async uploadBytes(bytes){const blob=await this.request('/git/blobs','POST',{encoding:'base64',content:bytesToBase64(bytes)});return blob.sha;}
  async commitChanges(message,build){
    for(let attempt=0;attempt<3;attempt++){
      const snapshot=await this.snapshot(), changes=await build(snapshot);
      if(!changes.length)throw new Error('No changes to publish.');
      const tree=await this.request('/git/trees','POST',{base_tree:snapshot.tree,tree:changes});
      const commit=await this.request('/git/commits','POST',{message,tree:tree.sha,parents:[snapshot.head]});
      try {await this.request(`/git/refs/heads/${encodeURIComponent(this.#branch)}`,'PATCH',{sha:commit.sha,force:false});return {sha:commit.sha};}
      catch(e){
        if(![409,422].includes(e.status)||attempt===2)throw e;
        const ref=await this.request(`/git/ref/heads/${encodeURIComponent(this.#branch)}`);
        if(ref.object.sha===snapshot.head)throw e; // Branch protection, not a concurrent edit.
      }
    }
  }
  async publish({entry,data,file,qrSvg,qrPng,expectedRevision=null,progress=()=>{}}){
    const folder=projectFolder(entry);safePath(entry.project);
    if(file.size>50*1024*1024)throw new Error('Direct publishing supports GLBs up to 50 MiB. Reduce this model or use another upload workflow.');
    const payload=structuredClone(data);payload.model='model.glb';
    const files=[{path:folder+'model.glb',bytes:new Uint8Array(await file.arrayBuffer())},{path:entry.project,bytes:new TextEncoder().encode(JSON.stringify(payload,null,2))},{path:folder+'qr.svg',bytes:new TextEncoder().encode(qrSvg)},{path:folder+'qr.png',bytes:new Uint8Array(await qrPng.arrayBuffer())}];
    const uploads=[];
    for(let i=0;i<files.length;i++){progress(`Uploading ${i+1}/${files.length}: ${files[i].path.split('/').pop()}`);uploads.push({path:files[i].path,mode:'100644',type:'blob',sha:await this.uploadBytes(files[i].bytes)});}
    progress('Saving model and library in one commit…');
    return this.commitChanges(`Publish mechanics problem: ${entry.title}`,async snapshot=>{
      const current=snapshot.catalog.problems.find(x=>x.id===entry.id),currentFile=snapshot.files.get(entry.project);
      if(expectedRevision){if(!current||current.project!==entry.project||await this.revision(snapshot,entry)!==expectedRevision)throw new Error('This problem changed since it was opened. Refresh and reopen it before updating.');}
      else if(current||currentFile||[...snapshot.files.keys()].some(path=>path.startsWith(folder)))throw new Error('That problem ID or folder already exists. Open it with Edit or choose a new ID.');
      if(snapshot.catalog.problems.some(x=>x.id!==entry.id&&x.project.startsWith(folder)))throw new Error('This folder is shared by another problem. Use a separate problem folder.');
      const catalog=structuredClone(snapshot.catalog);const index=catalog.problems.findIndex(x=>x.id===entry.id);
      if(index<0)catalog.problems.push(entry);else catalog.problems[index]={...catalog.problems[index],...entry};
      return [...uploads,{path:'catalog.json',mode:'100644',type:'blob',content:JSON.stringify(catalog,null,2)}];
    });
  }
  async remove(entry,{deleteFiles=false,expectedRevision=null}={}){
    return this.commitChanges(`Remove mechanics problem: ${entry.title}`,async snapshot=>{
      const current=snapshot.catalog.problems.find(x=>x.id===entry.id);
      if(!current||current.project!==entry.project)throw new Error('Problem changed or was already removed. Refresh the library.');
      if(expectedRevision&&await this.revision(snapshot,entry)!==expectedRevision)throw new Error('Problem was edited by someone else. Refresh before removing.');
      const catalog=structuredClone(snapshot.catalog);
      if(deleteFiles)catalog.problems=catalog.problems.filter(x=>x.id!==entry.id);
      else catalog.problems=catalog.problems.map(x=>x.id===entry.id?{...x,hidden:true}:x);
      const changes=[{path:'catalog.json',mode:'100644',type:'blob',content:JSON.stringify(catalog,null,2)}];
      if(deleteFiles){
        const folder=projectFolder(entry);
        if(catalog.problems.some(x=>x.id!==entry.id&&x.project.startsWith(folder)))throw new Error('This folder is shared by another problem. Remove from the gallery only.');
        // Only remove this problem's actual model, JSON and generated QR files.
        // Preserve any unrelated files stored alongside them.
        const annotation=snapshot.files.get(entry.project);
        const data=annotation?JSON.parse(new TextDecoder().decode(await this.blob(annotation.sha))):{};
        const targets=[entry.project,folder+'qr.svg',folder+'qr.png'];
        if(data.model){const path=modelPath(entry,data);if(!path.startsWith(folder))throw new Error('The model is shared outside this problem folder. Remove from the gallery only.');targets.push(path);}
        for(const path of new Set(targets))if(snapshot.files.has(path))changes.push({path,mode:'100644',type:'blob',sha:null});
      }
      return changes;
    });
  }
  async restore(entry){
    return this.commitChanges(`Restore mechanics problem: ${entry.title}`,async snapshot=>{
      const current=snapshot.catalog.problems.find(x=>x.id===entry.id);
      if(!current||current.project!==entry.project)throw new Error('Problem changed. Refresh the library.');
      const catalog=structuredClone(snapshot.catalog);catalog.problems=catalog.problems.map(x=>x.id===entry.id?{...x,hidden:false}:x);
      return [{path:'catalog.json',mode:'100644',type:'blob',content:JSON.stringify(catalog,null,2)}];
    });
  }

}
