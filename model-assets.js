// Model contents determine the filename, so replacing a problem cannot reuse a stale GLB URL.
export async function modelAsset(file){
  const bytes=new Uint8Array(await file.arrayBuffer());
  const hash=new Uint8Array(await crypto.subtle.digest('SHA-256',bytes));
  const name='model-'+Array.from(hash,b=>b.toString(16).padStart(2,'0')).join('')+'.glb';
  return {name,bytes};
}
export function freshUrl(path,base=location.href){
  const url=new URL(path,base);url.searchParams.set('_fresh',crypto.randomUUID());return url.href;
}
