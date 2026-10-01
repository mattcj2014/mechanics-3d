import { GitHubRepository } from './github-api.js';
const $=id=>document.getElementById(id);
export function setupGitHub({publisher,getFile,getPayload,loadProject}){
  let client=null,snapshot=null,busy=false,editing=null,removeTarget=null,published=null;
  const info=message=>$('libraryStatus').textContent=message;
  const buttonIds=['githubConnectBtn','githubDisconnectBtn','libraryRefreshBtn','confirmRemoveBtn','cancelRemoveBtn','directPublishBtn','closeLibraryBtn'];
  try {
    const saved=JSON.parse(localStorage.getItem('mechanics-github-repo')||'null');
    if(saved){$('githubOwner').value=saved.owner||'';$('githubRepo').value=saved.repo||'';$('githubBranch').value=saved.branch||'';}
    else if(location.hostname.endsWith('.github.io')){
      const owner=location.hostname.slice(0,-10);$('githubOwner').value=owner;$('githubRepo').value=location.pathname.split('/').filter(Boolean)[0]||`${owner}.github.io`;
    }
  } catch {}
  function state(){
    $('githubConnectBtn').disabled=busy||!!client;$('githubDisconnectBtn').disabled=busy||!client;$('libraryRefreshBtn').disabled=busy||!client;
    $('directPublishBtn').disabled=busy||!client||!getFile();
    $('directPublishBtn').textContent=busy?'Working…':editing&&publisher.getActiveEntry()?.id===$('problemId').value.trim()?'Update Published Problem':'Publish to GitHub';
    for(const id of ['githubOwner','githubRepo','githubBranch','githubToken'])$(id).disabled=busy||!!client;
    for(const id of ['confirmRemoveBtn','cancelRemoveBtn','closeLibraryBtn'])$(id).disabled=busy;
    $('connectionHint').textContent=client?`Connected: ${client.owner}/${client.repo} · ${client.branch}`:'Connect through Manage Models to publish directly.';
    render();
  }
  function setBusy(value){busy=value;state();}
  function disconnect(){client?.disconnect();client=null;snapshot=null;editing=null;$('githubToken').value='';info('Disconnected. Token cleared.');state();}
  function failure(e){if(e.status===401)disconnect();info(e.message);publisher.setStatus(e.message);}
  function viewerUrl(entry){const base=new URL($('siteBase').value.trim());base.pathname=base.pathname.replace(/\/$/,'')+'/';const url=new URL('viewer.html',base);url.searchParams.set('project',entry.project);return url.href;}
  function render(){
    const list=$('libraryList');list.replaceChildren();
    if(!snapshot){const p=document.createElement('p');p.className='empty';p.textContent='Connect to load published problems.';list.append(p);return;}
    const term=$('librarySearch').value.trim().toLowerCase(),entries=snapshot.catalog.problems.filter(p=>`${p.title} ${p.id}`.toLowerCase().includes(term));
    if(!entries.length){const p=document.createElement('p');p.className='empty';p.textContent='No matching models.';list.append(p);}
    for(const entry of entries){
      const row=document.createElement('div'),text=document.createElement('div'),title=document.createElement('strong'),id=document.createElement('small'),actions=document.createElement('div');
      row.className='library-row';title.textContent=entry.title||entry.id;id.textContent=entry.id+(entry.hidden?' · hidden from gallery':'');text.append(title,id);actions.className='publish-actions';
      const view=document.createElement('a');view.textContent='View';view.target='_blank';view.rel='noopener';try{view.href=viewerUrl(entry);}catch{view.removeAttribute('href');}
      const edit=document.createElement('button');edit.textContent='Edit';edit.disabled=busy;edit.addEventListener('click',()=>openEntry(entry));
      const remove=document.createElement('button');remove.textContent='Remove';remove.className='danger';remove.disabled=busy;remove.addEventListener('click',async()=>{
        if(busy)return;setBusy(true);
        try{removeTarget={entry:structuredClone(entry),revision:await client.revision(snapshot,entry)};$('removeFiles').checked=false;
          $('removePrompt').textContent=`Remove “${entry.title||entry.id}” from the student gallery?`;$('removeDialog').showModal();
        }catch(e){failure(e);}finally{setBusy(false);}
      });
      actions.append(view,edit);
      if(entry.hidden){const restore=document.createElement('button');restore.textContent='Restore';restore.disabled=busy;restore.addEventListener('click',async()=>{if(busy)return;setBusy(true);try{await client.restore(entry);await refresh();info('Problem restored to the gallery. GitHub Pages is updating.');}catch(e){failure(e);}finally{setBusy(false);}});actions.append(restore);}
      actions.append(remove);row.append(text,actions);list.append(row);
    }
  }
  async function refresh(){snapshot=await client.snapshot();state();info(`${snapshot.catalog.problems.length} published problem(s).`);}
  async function openEntry(entry){
    if(busy)return;
    if(getFile()&&!window.confirm('Open this published problem? The current editor contents will be replaced. Export JSON first if you need to keep unsaved work.'))return;
    setBusy(true);info(`Opening ${entry.title}…`);
    try{
      const latest=await client.snapshot(),current=latest.catalog.problems.find(p=>p.id===entry.id);if(!current)throw new Error('Problem was removed. Refresh the library.');
      const loaded=await client.readProject(latest,current);await loadProject(loaded.file,loaded.data,current);
      snapshot=latest;editing={entry:structuredClone(current),revision:loaded.revision};$('libraryDialog').close();
      publisher.setStatus('Published problem loaded. Edit its annotations and click Update Published Problem.');
    }catch(e){failure(e);}finally{setBusy(false);}
  }
  $('openLibraryBtn').addEventListener('click',()=>{$('libraryDialog').showModal();state();});
  $('closeLibraryBtn').addEventListener('click',()=>{if(!busy)$('libraryDialog').close();});
  for(const id of ['libraryDialog','removeDialog'])$(id).addEventListener('cancel',e=>{if(busy)e.preventDefault();});
  $('librarySearch').addEventListener('input',render);
  $('githubDisconnectBtn').addEventListener('click',disconnect);
  $('githubConnectBtn').addEventListener('click',async()=>{
    if(busy)return;setBusy(true);info('Connecting…');
    let pending;
    try{
      const token=$('githubToken').value;$('githubToken').value='';
      pending=new GitHubRepository({token,owner:$('githubOwner').value.trim(),repo:$('githubRepo').value.trim(),branch:$('githubBranch').value.trim()});
      const latest=await pending.connect();client=pending;snapshot=latest;$('githubBranch').value=client.branch;
      try{localStorage.setItem('mechanics-github-repo',JSON.stringify({owner:client.owner,repo:client.repo,branch:client.branch}));}catch{}
      info(`Connected. ${snapshot.catalog.problems.length} problem(s). Close this window to create or publish.`);
    }catch(e){pending?.disconnect();failure(e);}finally{setBusy(false);}
  });
  $('libraryRefreshBtn').addEventListener('click',async()=>{if(busy)return;setBusy(true);try{await refresh();}catch(e){failure(e);}finally{setBusy(false);}});
  document.addEventListener('mechanics-model-change',()=>{if(editing&&publisher.getActiveEntry()?.id!==editing.entry.id)editing=null;state();});
  $('problemId').addEventListener('input',state);
  $('directPublishBtn').addEventListener('click',async()=>{
    if(busy||!client||!getFile())return;
    setBusy(true);published=null;$('checkLiveBtn').disabled=true;
    let committed=false;
    try{
      const id=$('problemId').value.trim(),latest=await client.snapshot();
      const existing=latest.catalog.problems.find(p=>p.id===id);
      let expectedRevision=null;
      if(existing){
        if(editing?.entry.id===id){expectedRevision=editing.revision;publisher.usePublishedProject(editing.entry);}
        else {
          if(!window.confirm(`Replace the published problem “${existing.title||id}”? Its current student link will be kept.`))return;
          expectedRevision=await client.revision(latest,existing);if(!expectedRevision)throw new Error('Its annotation file is missing. Remove the broken entry or choose a new ID.');
          publisher.usePublishedProject(existing);
        }
      }else if(editing?.entry.id===id)throw new Error('This problem was removed since you opened it. Choose a new ID to publish it again.');
      const g=publisher.generate(),file=getFile(),data=structuredClone(getPayload());data.publicationId=crypto.randomUUID();
      const qrPng=await new Promise((resolve,reject)=>$('qrCanvas').toBlob(blob=>blob?resolve(blob):reject(new Error('Could not create QR PNG.')),'image/png'));
      const entry={id:g.id,title:data.title||g.id,project:g.project,hidden:false};
      const result=await client.publish({entry,data,file,qrSvg:g.svg,qrPng,expectedRevision,progress:publisher.setStatus});
      committed=true;published={entry,url:g.url,publicationId:data.publicationId};$('checkLiveBtn').disabled=false;
      publisher.usePublishedProject(entry);publisher.generate();
      try{
        snapshot=await client.snapshot();editing={entry,revision:await client.revision(snapshot,entry)};
        info(`Published ${entry.title}. Commit ${result.sha.slice(0,7)}. GitHub Pages is updating.`);
      }catch(e){info(`Published successfully; library refresh failed: ${e.message}`);}
      publisher.setStatus('Saved to GitHub. Pages is updating; click Check live status before sharing the QR.');
    }catch(e){if(!committed)failure(e);}finally{setBusy(false);}
  });
  $('checkLiveBtn').addEventListener('click',async()=>{
    if(!published)return;
    const button=$('checkLiveBtn');button.disabled=true;
    try{
      const viewer=new URL(published.url),url=new URL(published.entry.project,new URL('./',viewer));url.searchParams.set('_publication',published.publicationId);
      const r=await fetch(url,{cache:'no-store'});if(!r.ok)throw new Error('Not live yet. Wait for the Pages deployment, then check again.');
      const data=await r.json();if(data.publicationId!==published.publicationId)throw new Error('An earlier version is still live. Wait for the Pages deployment, then check again.');
      publisher.setStatus('The published annotations are live. Open the viewer or scan the QR to verify the model.');
    }catch(e){publisher.setStatus(e.message);}finally{button.disabled=false;}
  });
  $('cancelRemoveBtn').addEventListener('click',()=>{if(!busy)$('removeDialog').close();});
  $('confirmRemoveBtn').addEventListener('click',async()=>{
    if(busy||!client||!removeTarget)return;const target=removeTarget,deleteFiles=$('removeFiles').checked;setBusy(true);info('Removing problem…');
    let committed=false;
    try{
      await client.remove(target.entry,{deleteFiles,expectedRevision:target.revision});committed=true;$('removeDialog').close();removeTarget=null;
      if(editing?.entry.id===target.entry.id)editing=null;
      try{await refresh();}catch(e){info(`Removal saved; library refresh failed: ${e.message}`);}
      const message=deleteFiles?'Problem files removed. Its QR link will stop working after deployment.':'Problem hidden from the gallery. Its direct QR link is preserved.';
      publisher.setStatus(message);info(message+' GitHub Pages is updating.');
    }catch(e){if(!committed)failure(e);}finally{setBusy(false);}
  });
  window.addEventListener('pagehide',disconnect);
  window.addEventListener('pageshow',event=>{if(event.persisted)disconnect();});
  state();
}
