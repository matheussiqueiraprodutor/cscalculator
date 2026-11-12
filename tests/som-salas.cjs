// NODE_PATH must point to the runtime node_modules directory. No live account is used.
const {chromium}=require('playwright');
const fs=require('node:fs');
const path=require('node:path');
const assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({channel:'chrome',headless:true});
 try{
 const page=await browser.newPage({viewport:{width:1440,height:1000}});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/*',async route=>{
   const url=new URL(route.request().url());
   if(url.hostname!=='127.0.0.1')return route.fulfill({body:''});
   if(url.pathname.endsWith('/auth.js'))return route.fulfill({contentType:'text/javascript',body:'window.MMAuth={init:async()=>true,refreshCatalog:async()=>{},client:null};'});
   const file=path.join(process.cwd(),decodeURIComponent(url.pathname));
   if(!fs.existsSync(file))return route.fulfill({status:404});
   return route.fulfill({path:file,contentType:file.endsWith('.html')?'text/html':'text/javascript'});
 });
 // Existing one-room project: compare migration to the old calculator's results.
 const legacy=JSON.parse(fs.readFileSync(path.join(__dirname,'som-legacy.json'),'utf8'));
 await page.goto('http://127.0.0.1:8765/descritivo.html');
 await page.evaluate(state=>{localStorage.clear();localStorage.setItem('calculadora_som_estado_v1',JSON.stringify(state));},legacy.state);
 await page.goto('http://127.0.0.1:8765/som.html');
 assert.equal(await page.locator('#abasSalasSom button').count(),1);
 assert.deepEqual(await page.evaluate(()=>ultimoCalculo),legacy.result);
 assert.deepEqual(await page.evaluate(()=>JSON.parse(localStorage.getItem('hive_som_antes_salas_v1'))),legacy.state);
 await page.locator('#nomeSalaSom').fill('Plenária');
 await page.locator('#adicionarSalaSom').click();
 assert.equal(await page.evaluate(()=>grupos[0].items.length),0);
 await page.locator('#nomeSalaSom').fill('BU');
 await page.locator('#modelSelect').selectOption('wing');
 await page.locator('#qty-grupo-g1').fill('5');await page.locator('[data-grupo-add="g1"]').click();
 await page.locator('#susp-grupo-g1').uncheck();
 await page.locator('#tensaoRede').selectOption('110');
 await page.locator('#adicionarSalaSom').click();await page.locator('#nomeSalaSom').fill('BU');
 await page.locator('#qty-grupo-g1').fill('7');await page.locator('[data-grupo-add="g1"]').click();
 const third=await page.evaluate(()=>ultimoCalculo.totalWGeral);
 await page.locator('#abasSalasSom button').nth(1).click();
 assert.equal(await page.locator('#modelSelect').inputValue(),'wing');
 assert.equal(await page.locator('#tensaoRede').inputValue(),'110');
 assert.equal(await page.evaluate(()=>grupos[0].items[0].qty),5);
 await page.locator('#abasSalasSom button').first().click();
 assert.deepEqual(await page.evaluate(()=>ultimoCalculo),legacy.result);
 assert.equal(await page.locator('#qtdExpansao').inputValue(),'2');
 await page.locator('#abasSalasSom button').nth(2).click();
 await page.reload();
 assert.equal(await page.locator('#nomeSalaSom').inputValue(),'BU');
 assert.equal(await page.evaluate(()=>ultimoCalculo.totalWGeral),third);
 let aggregate=await page.evaluate(()=>JSON.parse(localStorage.getItem('descritivo_dados_som')));
 assert.equal(aggregate.salas.length,3);
 assert.equal(new Set(aggregate.salas.map(s=>s.id)).size,3);
 assert.equal(aggregate.totalWGeral,aggregate.salas.reduce((n,s)=>n+s.dados.totalWGeral,0));
 assert.equal(aggregate.totalCaixas,14);
 await page.screenshot({path:'.qa/som-salas.png',fullPage:false});
 // Full report includes every room, but engineering exports stay on room 1.
 await page.goto('http://127.0.0.1:8765/descritivo.html');
 const report=await page.evaluate(()=>({html:sectionContent('som').inner,resumo:gerarResumoTecnico().texto,
   aereo:buildAereoEstruturas(),solo:buildSoloEstruturas(),os:osRowsFromArea(artReadDados('som'),'som','caixas')}));
 assert(report.html.includes('Sala 1 — Plenária'));assert(report.html.includes('Sala 3 — BU'));
 assert(report.resumo.includes(new Intl.NumberFormat('pt-BR',{maximumFractionDigits:0}).format(aggregate.totalWGeral)));
 assert.equal(report.aereo.length,1);assert.equal(report.solo.length,0);
 assert.equal(report.aereo[0].rows[0].qty,2);assert(report.os.length>0);
 // Solo memorial also stays with the first room even when another room is suspended.
 await page.goto('http://127.0.0.1:8765/som.html');
 await page.locator('#abasSalasSom button').first().click();await page.locator('#susp-grupo-g1').uncheck();
 await page.goto('http://127.0.0.1:8765/descritivo.html');
 const solo=await page.evaluate(()=>({aereo:buildAereoEstruturas(),solo:buildSoloEstruturas()}));
 assert.equal(solo.aereo.length,0);assert.equal(solo.solo[0].rows[0].qty,2);
 await page.goto('http://127.0.0.1:8765/som.html');
 await page.locator('#abasSalasSom button').nth(1).click();await page.locator('#duplicarSalaSom').click();
 await page.locator('#qty-grupo-g1').fill('1');await page.locator('[data-grupo-add="g1"]').click();
 await page.locator('#abasSalasSom button').nth(1).click();assert.equal(await page.evaluate(()=>grupos[0].items.length),1);
 await page.locator('#abasSalasSom button').nth(3).click();
 page.once('dialog',d=>d.dismiss());await page.locator('#excluirSalaSom').click();assert.equal(await page.locator('#abasSalasSom button').count(),4);
 page.once('dialog',d=>d.accept());await page.locator('#excluirSalaSom').click();assert.equal(await page.locator('#abasSalasSom button').count(),3);
 assert(await page.locator('#excluirSalaSom').isDisabled());
 await page.locator('#nomeSalaSom').fill('<img src=x onerror=alert(1)>');
 await page.goto('http://127.0.0.1:8765/descritivo.html');
 assert.equal(await page.locator('img[src="x"]').count(),0);
 assert.deepEqual(errors,[]);
 console.log('PASS: legacy migration; independent rooms; duplicate names; restore/reload; totals; report; aerial/ground room 1; clone/delete; name escaping.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
