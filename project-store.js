function db() {
  return new Promise((resolve,reject)=>{
    const request=indexedDB.open('mechanics-3d-previews',1);
    request.onupgradeneeded=()=>request.result.createObjectStore('projects');
    request.onsuccess=()=>resolve(request.result);
    request.onerror=()=>reject(request.error);
  });
}
export async function savePreview(id, file, data) {
  const database=await db();
  try { await new Promise((resolve,reject)=>{
    const tx=database.transaction('projects','readwrite');
    // Only retain the current preview so large GLBs do not accumulate.
    tx.objectStore('projects').clear();
    tx.objectStore('projects').put({file,data},id);
    tx.oncomplete=resolve; tx.onerror=()=>reject(tx.error); tx.onabort=()=>reject(tx.error);
  }); } finally { database.close(); }
}
export async function loadPreview(id) {
  const database=await db();
  try { return await new Promise((resolve,reject)=>{
    const req=database.transaction('projects').objectStore('projects').get(id);
    req.onsuccess=()=>resolve(req.result); req.onerror=()=>reject(req.error);
  }); } finally { database.close(); }
}
