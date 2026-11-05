const {chromium}=require('playwright');
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),vm=require('node:vm');
(async()=>{
 for(const file of ['equipe.html','solicitacoes-equipe.html'])for(const m of fs.readFileSync(file,'utf8').matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g))new vm.Script(m[1],{filename:file});
 const browser=await chromium.launch({channel:'chrome',headless:true});
 try{
 const page=await browser.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/*',r=>{
  const url=new URL(r.request().url());
  if(url.origin!=='http://hive.test')return r.fulfill({body:''});
  const file=path.join(process.cwd(),url.pathname);
  if(url.pathname.endsWith('auth.js')||url.pathname.endsWith('db-config.js'))return r.fulfill({body:''});
  return r.fulfill({path:file,contentType:url.pathname.endsWith('.html')?'text/html':'text/javascript'});
 });
 await page.addInitScript(()=>{
  const req={id:'req-1',event_name:'Evento teste',event_date:'05/11/2026',event_end_date:'06/11/2026',event_location:'Local',status:'ready',reservation_mode:'normal',is_test:true};
  const rows=[{id:1,status:'unavailable',whatsapp_last_inbound_text:'Não posso',whatsapp_response_classification:'unavailable'},{id:2,status:'pending'},{id:3,status:'pending'}].map((c,i)=>({...c,request_item_id:10,external_key:'p'+c.id,contact_order:i+1,candidate_name:'Pessoa '+c.id,candidate_whatsapp:'5511999999999',priority:1,rating:4,message_text:'Mensagem salva '+c.id}));
  window.testDB={staffing_requests:[req,{...req,id:'req-2'}],staffing_request_items:[{id:10,request_id:'req-1',function_id:1,quantity:1}],staffing_candidates:rows,freelancer_functions:[{id:1,name:'Técnico de Vídeo',sector:'video',active:true}],company_freelancers_cache:[]};
  window.writes=[];window.invokes=0;
  window.MMAuth={user:{id:'admin'},init:async()=>true,client:{
   from(table){let filters=[],single=false,update=null;const q={select(){return q},order(){return q},eq(k,v){filters.push(x=>String(x[k])===String(v));return q},in(k,v){filters.push(x=>v.map(String).includes(String(x[k])));return q},single(){single=true;return q},update(v){update=v;return q},insert(){throw Error('Retomada não pode inserir')},delete(){throw Error('Retomada não pode excluir')},then(resolve){const found=testDB[table].filter(x=>filters.every(f=>f(x)));if(update){writes.push({table,ids:found.map(x=>x.id),update});found.forEach(x=>Object.assign(x,update));}return Promise.resolve({data:single?found[0]:found,error:null}).then(resolve)}};return q;},
   channel(){return {on(){return this},subscribe(){return this}}},removeChannel(){},functions:{invoke(){window.invokes++;throw Error('Envio não autorizado no teste')}}
  }};
 });
 await page.goto('http://hive.test/equipe.html?request=req-1');
 await page.waitForFunction(()=>document.querySelector('#msg').textContent.includes('retomada'));
 assert.equal(await page.locator('.candidate[data-queue-state="eligible"]').count(),1);
 assert.equal(await page.locator('.candidate[data-candidate-id="2"] textarea').inputValue(),'Mensagem salva 2');
 assert.equal(await page.locator('.candidate[data-candidate-id="1"]').getAttribute('data-inbound-text'),'Não posso');
 assert.equal(await page.locator('#build').isDisabled(),true);
 assert.equal(await page.evaluate(()=>writes.length+invokes),0);
 await page.goto('http://hive.test/equipe.html');await page.waitForFunction(()=>document.querySelector('#msg').textContent.includes('retomada'));
 assert.equal(await page.locator('.candidate[data-candidate-id="2"]').getAttribute('data-queue-state'),'eligible');
 await page.evaluate(()=>{testDB.staffing_candidates[1].status='waiting';});
 await page.evaluate(()=>resumeRequest('req-1'));
 assert.equal(await page.locator('.candidate[data-queue-state="eligible"]').count(),0);
 await page.evaluate(()=>{testDB.staffing_candidates[1].status='unavailable';});
 await page.evaluate(()=>resumeRequest('req-1'));
 assert.equal(await page.locator('.candidate[data-candidate-id="3"]').getAttribute('data-queue-state'),'eligible');
 await page.evaluate(()=>{testDB.staffing_candidates[1].status='available';});
 await page.evaluate(()=>resumeRequest('req-1'));
 assert.equal(await page.locator('.candidate[data-queue-state="eligible"]').count(),0);
 page.once('dialog',d=>d.accept());await page.locator('#cancelRequest').click();
 await page.waitForFunction(()=>document.querySelector('#msg').textContent.includes('cancelada'));
 assert.equal(await page.locator('#eventName').inputValue(),'');
 assert.equal(await page.locator('#build').isEnabled(),true);
 assert.deepEqual(await page.evaluate(()=>writes.map(w=>w.ids)),[['req-1']]);
 assert.equal(await page.evaluate(()=>testDB.staffing_requests[1].status),'ready');
 assert.equal(await page.evaluate(()=>sessionStorage.getItem('hive_staffing_current_request')),null);
 assert.equal(await page.evaluate(()=>invokes),0);
 await page.goto('http://hive.test/solicitacoes-equipe.html');
 await page.waitForFunction(()=>document.querySelector('#msg').textContent.includes('encontrada'));
 assert.equal(await page.getByRole('link',{name:'Continuar seleção · Técnico de Vídeo'}).getAttribute('href'),'equipe.html?request=req-1');
 await page.evaluate(()=>{testDB.staffing_requests[0].status='cancelled';return loadRequests();});
 assert.equal(await page.getByRole('link',{name:/Continuar seleção/}).count(),0);
 assert.deepEqual(errors,[]);
 console.log('PASS: sintaxe, retomada sem inserir/enviar, histórico, recarga, espera, recusa, preenchimento, cancelamento isolado e links.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1});
