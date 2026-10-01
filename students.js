const list=document.getElementById('problems'),status=document.getElementById('status'),search=document.getElementById('search');
let problems=[];
function render(){
  list.replaceChildren();
  const term=search.value.toLowerCase().trim();
  const filtered=problems.filter(p=>`${p.title} ${p.id}`.toLowerCase().includes(term));
  for(const p of filtered){
    const card=document.createElement('a'),id=document.createElement('span'),title=document.createElement('h2'),cta=document.createElement('span');
    const url=new URL('viewer.html',location.href);url.searchParams.set('project',p.project);
    card.href=url.href;card.className='card';id.className='problem-id';id.textContent=p.id;title.textContent=p.title;cta.className='cta';cta.textContent='Open 3D problem →';card.append(id,title,cta);list.append(card);
  }
  status.textContent=filtered.length?`${filtered.length} example${filtered.length===1?'':'s'}`:'No matching problems.';
}
search.addEventListener('input',render);
try {const r=await fetch('catalog.json',{cache:'no-store'});if(!r.ok&&r.status!==404)throw new Error('Could not load the problem catalog.');const data=r.status===404?{problems:[]}:await r.json();if(!Array.isArray(data.problems))throw new Error('Invalid catalog.');problems=data.problems.filter(p=>!p.hidden);render();}
catch(e){status.textContent=e.message;}
