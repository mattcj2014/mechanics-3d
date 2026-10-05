import { modelAsset, freshUrl } from './model-assets.js?v=7';
import { savePreview } from './project-store.js?v=7';
const $=id=>document.getElementById(id);
export function downloadBlob(blob,name) {
  const url=URL.createObjectURL(blob), a=document.createElement('a');
  a.href=url; a.download=name; a.click(); setTimeout(()=>URL.revokeObjectURL(url),10000);
}
export function setupPublishing({getFile,getPayload,previewBtn}) {
  let generated=null;
  let activeEntry=null;
  const status=text=>$('publishStatus').textContent=text;
  try { $('siteBase').value=localStorage.getItem('mechanics-site-base') || new URL('./',location.href).href; }
  catch { $('siteBase').value=new URL('./',location.href).href; }
  function invalidate() { generated=null; $('qrResult').classList.add('hidden'); }
  for(const id of ['siteBase','problemId','problemTitle']) $(id).addEventListener('input',invalidate);
  function modelLoaded(file) {
    activeEntry=null;
    const base=file.name.replace(/\.glb$/i,'');
    $('problemId').value=base.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,60)||'problem01';
    $('problemTitle').value=base;
    $('makeQrBtn').disabled=false; invalidate(); status('Annotate your model, then publish it or generate its QR code.');
    document.dispatchEvent(new Event('mechanics-model-change'));
  }
  function generate() {
    if(!getFile()) throw new Error('Load a GLB first.');
    const id=$('problemId').value.trim();
    if(!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(id) || id.length>60) throw new Error('Use a short problem ID with lowercase letters, numbers, and hyphens.');
    const base=new URL($('siteBase').value.trim());
    if(!['https:','http:'].includes(base.protocol) || base.search || base.hash) throw new Error('Enter the site homepage address, without query parameters.');
    base.pathname=base.pathname.replace(/\/$/,'')+'/';
    const project=activeEntry?.id===id ? activeEntry.project : `projects/${id}/problem.annotations.json`;
    const url=new URL('viewer.html',base); url.searchParams.set('project',project);
    const qr=window.qrcode(0,'M'); qr.addData(url.href); qr.make();
    const count=qr.getModuleCount(), cell=16, margin=4, canvas=$('qrCanvas');
    canvas.width=canvas.height=(count+margin*2)*cell;
    const ctx=canvas.getContext('2d'); ctx.fillStyle='#fff';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.fillStyle='#000';
    for(let r=0;r<count;r++) for(let c=0;c<count;c++) if(qr.isDark(r,c)) ctx.fillRect((c+margin)*cell,(r+margin)*cell,cell,cell);
    generated={id,project,url:url.href,svg:qr.createSvgTag(8,32)};
    $('studentLink').value=url.href; $('openStudentLink').href=url.href; $('qrResult').classList.remove('hidden');
    try {localStorage.setItem('mechanics-site-base',base.href);} catch {}
    status(['localhost','127.0.0.1'].includes(base.hostname) ? 'This address is local. Enter your published site address before printing a QR for students.' : 'QR prepared. Publish to GitHub before distributing this code.');
    return generated;
  }
  $('makeQrBtn').addEventListener('click',()=>{try {generate();} catch(e){invalidate();status(e.message);}});
  $('pngQrBtn').addEventListener('click',()=>{if(generated){const name=`${generated.id}-qr.png`;$('qrCanvas').toBlob(blob=>downloadBlob(blob,name),'image/png');}});
  $('svgQrBtn').addEventListener('click',()=>{if(generated)downloadBlob(new Blob([generated.svg],{type:'image/svg+xml'}),`${generated.id}-qr.svg`);});
  $('copyLinkBtn').addEventListener('click',async()=>{
    if(!generated)return;
    try {await navigator.clipboard.writeText(generated.url);status('Student link copied.');}
    catch {$('studentLink').select();status('Select and copy the highlighted link.');}
  });
  $('publishPackBtn').addEventListener('click',async()=>{
    const button=$('publishPackBtn'); button.disabled=true;
    try {
      const g=generate(),file=getFile(),data=getPayload();
      const asset=await modelAsset(file);
      data.model=asset.name;data.publicationId=crypto.randomUUID();
      let catalog;
      const r=await fetch(freshUrl('catalog.json'),{cache:'no-store'});
      if(!r.ok) throw new Error('Cannot load the current student catalog. Upload catalog.json from the app package first.');
      catalog=await r.json();
      if(!Array.isArray(catalog.problems))throw new Error('The student catalog is invalid.');
      const entry={id:g.id,title:data.title||g.id,project:g.project};
      catalog.problems=catalog.problems.filter(x=>x.id!==g.id); catalog.problems.push(entry);
      const zip=new window.JSZip();
      zip.file(`${g.project.slice(0,g.project.lastIndexOf('/')+1)}${asset.name}`,asset.bytes);
      zip.file(g.project,JSON.stringify(data,null,2));
      zip.file('catalog.json',JSON.stringify(catalog,null,2));
      zip.file(`${g.project.slice(0,g.project.lastIndexOf('/')+1)}qr.svg`,g.svg);
      const png=await new Promise(resolve=>$('qrCanvas').toBlob(resolve,'image/png'));
      zip.file(`${g.project.slice(0,g.project.lastIndexOf('/')+1)}qr.png`,await png.arrayBuffer());
      zip.file('PUBLISH.txt',`Upload catalog.json and the projects folder to the ROOT of your GitHub Pages repository.\nDo not upload this ZIP; extract it first.\nReplace catalog.json when prompted.\nWait for deployment, then test this link:\n${g.url}\n\nStudent gallery: ${new URL('students.html',$('siteBase').value.endsWith('/')?$('siteBase').value:$('siteBase').value+'/').href}\nThe QR PNG and SVG are in projects/${g.id}/.\nSame problem ID replaces an existing problem. Give each new problem a unique ID.\nIf publishing several problems, upload each pack before exporting the next, so the next catalog includes all published problems.\n`);
      downloadBlob(await zip.generateAsync({type:'blob'}),`${g.id}-publish.zip`);
      status('Publishing pack downloaded. Extract it and upload catalog.json plus projects/ to your repository root.');
    } catch(e) {status(`Could not prepare pack: ${e.message}`);} finally {button.disabled=false;}
  });
  previewBtn.addEventListener('click',async()=>{
    if(!getFile())return;
    const popup=window.open('about:blank','_blank');
    if(!popup){status('Allow popups to open the separate student preview.');return;}
    try {
      const id=crypto.randomUUID(); await savePreview(id,getFile(),getPayload());
      const url=new URL('viewer.html',location.href);url.searchParams.set('preview',id);popup.location.replace(url.href);
      status('Preview opened in a separate student viewer. This private preview works only on this browser; use the publishing pack for a public QR.');
    } catch(e) {popup.close();status(`Could not preview: ${e.message}`);}
  });
  function usePublishedProject(entry){ activeEntry={...entry}; $('problemId').value=entry.id; invalidate(); document.dispatchEvent(new Event('mechanics-model-change')); }
  return {modelLoaded,invalidate,generate,usePublishedProject,setStatus:status,getActiveEntry:()=>activeEntry};
}
