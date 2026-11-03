// Run with NODE_PATH pointing to an installation of playwright; serve the repository on :8765.
const {chromium}=require('playwright');
const fs=require('node:fs');
const assert=require('node:assert/strict');
(async()=>{
 fs.mkdirSync('.qa',{recursive:true});
 if(!fs.existsSync('.qa/html2canvas.min.js')){
  const response=await fetch('https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/dist/html2canvas.min.js');
  if(!response.ok)throw Error('Não foi possível obter a dependência de teste html2canvas 1.4.1.');
  fs.writeFileSync('.qa/html2canvas.min.js',Buffer.from(await response.arrayBuffer()));
 }
 const browser=await chromium.launch({headless:true,channel:'chrome'});
 const page=await browser.newPage({viewport:{width:1400,height:1000}});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.route('http://127.0.0.1:8765/**',async r=>{
  const path=require('node:path').join(process.cwd(),decodeURIComponent(new URL(r.request().url()).pathname));
  const ext=require('node:path').extname(path);if(!fs.existsSync(path))return r.fulfill({status:404});
  return r.fulfill({path,contentType:({'.html':'text/html','.js':'text/javascript','.pptx':'application/octet-stream'}[ext]||'application/octet-stream')});
 });
 await page.route('**/auth.js',r=>r.fulfill({contentType:'text/javascript',body:'window.MMAuth={init:async()=>true,refreshCatalog:async()=>{},client:null};'}));
 await page.route('**/*jszip.min.js',r=>r.fulfill({path:require.resolve('jszip/dist/jszip.min.js')}));
 await page.route('https://cdn.jsdelivr.net/**',r=>r.fulfill({contentType:'text/javascript',body:''}));
 await page.route('**/html2canvas.min.js',r=>r.fulfill({path:'.qa/html2canvas.min.js'}));
 await page.route('https://fonts.googleapis.com/**',r=>r.fulfill({body:''}));
 await page.goto('http://127.0.0.1:8765/descritivo.html');
 await page.evaluate(()=>{
  localStorage.clear();localStorage.setItem('descritivo_cabecalho',JSON.stringify({evento:'Congresso de Tecnologia',dataEvento:'03/11/2026',dataMontagem:'02/11/2026',local:'Centro de Eventos',sala:'Principal'}));
  localStorage.setItem('descritivo_dados_som',JSON.stringify({totalW:2000,gruposResultados:[{nome:'Som solo',caixas:2,suspenso:false,equipamentos:[{label:'Caixa de teste',qty:2,peso:40}]}]}));
  localStorage.setItem('descritivo_dados_luz',JSON.stringify({totalW:1200,gruposResultados:[{nome:'Luz aérea',aparelhos:4,suspenso:true,qtdPontos:2,equipamentos:[{label:'Moving de teste',qty:4,peso:60}]}]}));
  localStorage.setItem('hivepro_logistica_veiculos_v1',JSON.stringify({event:'Congresso de Tecnologia',origin:'CL',destination:'Centro de Eventos',vehicles:[{id:'1',name:'Van',model:'Van de teste',returns:true,ida:[{id:'p1',name:'Motorista de teste',driver:true}],retorno:[{id:'p1',name:'Motorista de teste',driver:true}]}]}));
 });
 await page.reload();
 await page.evaluate(()=>{
  const rows={staffing_requests:[{id:1,event_name:'Congresso de Tecnologia',event_date:'2026-11-03',status:'ready',is_test:false,reservation_mode:'normal'}],staffing_request_items:[{id:11,function_id:21}],freelancer_functions:[{id:21,name:'Técnico de Som',sector:'Áudio'}],staffing_candidates:[{request_item_id:11,candidate_name:'Pessoa confirmada',status:'available'},{request_item_id:11,candidate_name:'Pessoa pendente',status:'waiting'}]};
  MMAuth.client={from(table){return {select(){return this;},eq(){return this;},order(){return this;},in(){return this;},then(resolve){resolve({data:rows[table],error:null});}};}};
 });
 await page.locator('#btnPowerPoint').click();assert(await page.locator('dialog').isVisible());
 await page.locator('#ppt-team select').selectOption('1');
 await page.waitForFunction(()=>document.querySelector('dialog input[name="tec de som"]').value==='Pessoa confirmada');
 assert.equal(await page.locator('dialog input[name="técnico de som e auxiliar de som"]').inputValue(),'Pessoa confirmada');
 await page.locator('dialog button').filter({hasText:'Cancelar'}).click();
 const formulas=await page.evaluate(()=>{
  const read=r=>({A1:10,A2:20,A3:0,B1:''}[r]??'');const f=HiveSheetImage.formula;
  return [f('SUM(A1:A2)*20%',read),f('IFERROR(A1/A3,"")',read),f('IF(B1="","",IF(A1<=500,"ESTÁ CONFORME","NÃO CONFORME"))',read),f('IFERROR(A1/A2,"")',read)];
 });assert.deepEqual(formulas,[6,'','',0.5]);
 const output=await page.evaluate(async()=>{
  const solo=await HivePptx.memorial('solo'),aereo=await HivePptx.memorial('aereo'),logistica=await HivePptx.logistics();
  // Expose the filled images for visual QA, not product data.
  const values={evento:'Congresso de Tecnologia',data:'03/11/2026',local:'Centro de Eventos',salas:'Principal',endereço:'Rua de Teste, 123','data montagem':'02/11/2026','tec de vídeo':'Maria Silva','tec de som':'João Santos','tec de iluminação':'Ana Souza','técnico de vídeo e auxiliar de vídeo':'Maria Silva e Pedro Lima','técnico de luz e auxiliares de luz':'Ana Souza e Carlos Silva','técnico de som e auxiliar de som':'João Santos e José Lima'};
  window.confirm=()=>true;window.artDownloadBlob=()=>{};
  const blob=await HivePptx.generate(values);const data=Array.from(new Uint8Array(await blob.arrayBuffer()));
  return {data,solo,aereo,logistica};
 });
 fs.mkdirSync('.qa',{recursive:true});fs.writeFileSync('.qa/export-test.pptx',Buffer.from(output.data));
 const JSZip=require('jszip');const original=await JSZip.loadAsync(fs.readFileSync('assets/hive-template.pptx'));const exported=await JSZip.loadAsync(Buffer.from(output.data));
 for(const index of [1,5,6,7,10,11])assert.deepEqual(await exported.file(`ppt/slides/slide${index}.xml`).async('nodebuffer'),await original.file(`ppt/slides/slide${index}.xml`).async('nodebuffer'));
 for(const kind of ['solo','aereo','logistica'])fs.writeFileSync('.qa/'+kind+'.png',Buffer.from(output[kind].split(',')[1],'base64'));
 // Broken runs, escaping, and overlong text must be handled without modifying fixed labels.
 const checks=await page.evaluate(async()=>{
  const d=new DOMParser().parseFromString('<a:p xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><a:r><a:t>Label {{ even</a:t></a:r><a:r><a:t>to }} final</a:t></a:r></a:p>','application/xml');
  HivePptx.replaceTokens(d,{evento:'A & B <C>'});
  const txt=d.documentElement.textContent;
  const z=await JSZip.loadAsync(await (await fetch('assets/hive-template.pptx')).arrayBuffer());const slide=new DOMParser().parseFromString(await z.file('ppt/slides/slide2.xml').async('string'),'application/xml');
  HivePptx.replaceTokens(slide,{evento:'Nome muito longo '.repeat(200),data:'',local:'',salas:'',endereço:'','tec de vídeo':'','tec de som':'','tec de iluminação':''});let rejected=false;try{HivePptx.fitFields(slide);}catch{rejected=true;}
  const desc=new DOMParser().parseFromString(await z.file('ppt/slides/slide4.xml').async('string'),'application/xml');
  const fontSize=HivePptx.description(desc,'Texto técnico de teste com várias linhas. '.repeat(100));
  return {txt,rejected,fontSize};
 });assert.equal(checks.txt,'Label A & B <C> final');assert(checks.rejected);assert(checks.fontSize<16);
 assert.deepEqual(errors,[]);await browser.close();console.log('PASS: export, workbook formulas, dialog, split runs, escaping, overflow.');
})().catch(e=>{console.error(e);process.exit(1);});
