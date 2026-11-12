// Run with NODE_PATH pointing to Playwright. Uses isolated browser storage, no live account.
const {chromium}=require('playwright');
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({channel:'chrome',headless:true});
 try{
 const page=await browser.newPage({viewport:{width:1440,height:1000}});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/*',route=>{
   const url=new URL(route.request().url());
   if(url.hostname!=='127.0.0.1')return route.fulfill({body:''});
   if(url.pathname.endsWith('/auth.js'))return route.fulfill({contentType:'text/javascript',body:'window.MMAuth={init:async()=>true,refreshCatalog:async()=>{},client:null};'});
   if(url.pathname==='/seed')return route.fulfill({contentType:'text/html',body:'<title>Test fixture</title>'});
   const file=path.join(process.cwd(),url.pathname.startsWith('/baseline/')&&url.pathname.endsWith('.html')?'.qa/'+path.basename(url.pathname,'.html')+'-antes-salas.html':url.pathname.replace('/baseline/','/'));
   if(!fs.existsSync(file))return route.fulfill({status:404});
   return route.fulfill({path:file,contentType:file.endsWith('.html')?'text/html':'text/javascript'});
 });
 let legacy;
 if(process.env.CAPTURE_BASELINE==='1'){
   legacy={};
   await page.goto('http://127.0.0.1:8765/baseline/luz.html');
   legacy.luz=await page.evaluate(()=>{
     grupos[0].items=[{type:Object.keys(EQUIPAMENTOS)[0],qty:4}];grupos[0].nome='Vara principal';grupos[0].comprimento=8;
     infraDmx.usaSplitter=true;infraDmx.saidasSplitter=8;$('usaSplitter').checked=true;updateDmxInfraUI();
     calc();salvarEstadoLuz();return {estado:coletarEstadoLuz(),resultado:ultimoCalculo};
   });
   await page.goto('http://127.0.0.1:8765/baseline/video.html');
   await page.locator('#larguraM').fill('6');await page.locator('#alturaM').fill('3');
   await page.locator('#topoAtivo').check();await page.locator('#topoAlturaM').fill('0.5');
   await page.locator('#processadoraSelect').selectOption('VX1000');
   legacy.video=await page.evaluate(()=>{calc();salvarEstadoVideo();return {estado:coletarEstadoVideo(),resultado:ultimoCalculo};});
   fs.writeFileSync(path.join(__dirname,'luz-video-legacy.json'),JSON.stringify(legacy,null,2));
 }else legacy=JSON.parse(fs.readFileSync(path.join(__dirname,'luz-video-legacy.json'),'utf8'));
 await page.goto('http://127.0.0.1:8765/seed');
 await page.evaluate(data=>{localStorage.clear();for(const key of ['luz','video'])localStorage.setItem('calculadora_'+key+'_estado_v1',JSON.stringify(data[key].estado));},legacy);
 for(const [key,cap] of [['luz','Luz'],['video','Video']]){
   await page.goto('http://127.0.0.1:8765/'+key+'.html');
   assert.deepEqual(await page.evaluate(()=>ultimoCalculo),legacy[key].resultado,key+' legacy calculation unchanged');
   assert.deepEqual(await page.evaluate(k=>JSON.parse(localStorage.getItem('hive_'+k+'_antes_salas_v1')),key),legacy[key].estado);
   await page.locator('#nomeSala'+cap).fill('Plenária');
   await page.locator('#adicionarSala'+cap).click();
   assert.equal(await page.evaluate(k=>k==='luz'?ultimoCalculo.totalAparelhos:ultimoCalculo.totalPaineisGeral,key),0,key+' new room empty');
   await page.locator('#nomeSala'+cap).fill('BU');
   if(key==='luz'){
     await page.locator('#qty-grupo-v1').fill('7');await page.locator('[data-grupo-add="v1"]').click();
     await page.locator('#susp-grupo-v1').uncheck();await page.locator('#usaArtnet').check();await page.locator('#saidasArtnet').fill('16');
     await page.locator('#consoleToggle button').last().click();await page.locator('#tensaoRede').selectOption('110');
   }else{
     await page.locator('#larguraM').fill('4');await page.locator('#alturaM').fill('2');await page.locator('#btnP50').click();
     await page.locator('#btnSuspenso').click();await page.locator('#pixelPitch').selectOption('2.5');
     await page.locator('#processadoraSelect').selectOption('H2');
   }
   const second=await page.evaluate(()=>ultimoCalculo);
   await page.locator('#adicionarSala'+cap).click();await page.locator('#nomeSala'+cap).fill('BU');
   if(key==='luz'){
     await page.locator('#qty-grupo-v1').fill('11');await page.locator('[data-grupo-add="v1"]').click();
   }else{
     await page.locator('#larguraM').fill('3');await page.locator('#alturaM').fill('2');await page.locator('#btnGroundSuspenso').click();
     await page.locator('#alturaBarra').fill('5');await page.locator('#processadoraSelect').selectOption('VX600');
   }
   const third=await page.evaluate(()=>ultimoCalculo);
   await page.locator('#abasSalas'+cap+' button').nth(1).click();assert.deepEqual(await page.evaluate(()=>ultimoCalculo),second);
   await page.reload();assert.deepEqual(await page.evaluate(()=>ultimoCalculo),second,key+' reload active room');
   await page.locator('#abasSalas'+cap+' button').first().click();assert.deepEqual(await page.evaluate(()=>ultimoCalculo),legacy[key].resultado);
   await page.locator('#abasSalas'+cap+' button').nth(2).click();assert.deepEqual(await page.evaluate(()=>ultimoCalculo),third);
   const data=await page.evaluate(k=>JSON.parse(localStorage.getItem('descritivo_dados_'+k)),key);
   assert.equal(data.salas.length,3);assert.equal(new Set(data.salas.map(s=>s.id)).size,3);
   const watts=key==='luz'?'totalW':'potenciaTotalW';assert.equal(data[watts],data.salas.reduce((n,s)=>n+s.dados[watts],0));
   await page.locator('#duplicarSala'+cap).click();
   if(key==='luz'){await page.locator('#qty-grupo-v1').fill('1');await page.locator('[data-grupo-add="v1"]').click();}
   else await page.locator('#larguraM').fill('9');
   await page.locator('#abasSalas'+cap+' button').nth(2).click();assert.deepEqual(await page.evaluate(()=>ultimoCalculo),third,key+' clone isolation');
   await page.locator('#abasSalas'+cap+' button').nth(3).click();
   page.once('dialog',d=>d.dismiss());await page.locator('#excluirSala'+cap).click();assert.equal(await page.locator('#abasSalas'+cap+' button').count(),4);
   page.once('dialog',d=>d.accept());await page.locator('#excluirSala'+cap).click();assert.equal(await page.locator('#abasSalas'+cap+' button').count(),3);
   assert(await page.locator('#excluirSala'+cap).isDisabled());
   await page.screenshot({path:'.qa/'+key+'-salas.png'});
   await page.setViewportSize({width:390,height:844});
   assert(await page.locator('#nomeSala'+cap).isVisible());
   const bounds=await page.locator('#salas'+cap).boundingBox();assert(bounds.x>=0&&bounds.x+bounds.width<=391);
   await page.screenshot({path:'.qa/'+key+'-salas-mobile.png'});await page.setViewportSize({width:1440,height:1000});
 }
 await page.goto('http://127.0.0.1:8765/descritivo.html');
 const report=await page.evaluate(()=>({luz:sectionContent('luz').inner,video:sectionContent('video').inner,resumo:gerarResumoTecnico().texto,
   aereo:buildAereoEstruturas(),solo:buildSoloEstruturas(),osVideo:osVideoRows(artReadDados('video')),cabos:osCabosVideoRows(artReadDados('video')),
   luzData:artReadDados('luz'),videoData:artReadDados('video')}));
 for(const k of ['luz','video'])assert(report[k].includes('Sala 3 — BU'));
 for(const watts of [report.luzData.totalW,report.videoData.potenciaTotalW])assert(report.resumo.includes(Math.round(watts).toLocaleString('pt-BR')));
 assert(report.resumo.includes('Sala 2 — BU: 1 Painel de LED medindo 4x2 m'));
 assert(report.resumo.includes('Sala 3 — BU: 1 Painel de LED medindo 3x2 m'));
 assert.equal(report.aereo.length,1);assert.equal(report.aereo[0].rows[0].qty,4);
 assert.equal(report.solo.length,1);assert.equal(report.solo[0].area,6);
 assert.equal(report.osVideo.reduce((n,r)=>n+r.value,0),report.videoData.casesTotal);
 const expectedCabos=report.videoData.salas.reduce((n,s)=>n+(Math.ceil(s.dados.totalPaineisGeral/10)+1)*10,0);
 assert(report.cabos.every(r=>r.value===expectedCabos));
 // Switch first room's mounting to ensure both memorial paths exclude other rooms.
 await page.goto('http://127.0.0.1:8765/luz.html');await page.locator('#susp-grupo-v1').uncheck();
 await page.goto('http://127.0.0.1:8765/video.html');await page.locator('#btnSuspenso').click();
 await page.goto('http://127.0.0.1:8765/descritivo.html');
 const memorials=await page.evaluate(()=>({aereo:buildAereoEstruturas(),solo:buildSoloEstruturas()}));
 assert.equal(memorials.aereo.length,1);assert.equal(memorials.solo.length,1);assert.equal(memorials.solo[0].rows[0].qty,4);
 for(const [key,cap] of [['luz','Luz'],['video','Video']]){
   await page.goto('http://127.0.0.1:8765/'+key+'.html');await page.locator('#nomeSala'+cap).fill('<img src=x onerror=alert(1)>');
 }
 await page.goto('http://127.0.0.1:8765/descritivo.html');assert.equal(await page.locator('img[src="x"]').count(),0);
 assert.deepEqual(errors,[]);
 console.log('PASS: Luz/Video legacy migration, isolated rooms, repeated names, reload, processor and mounting restoration, clone/delete, mobile layout, totals, reports, OS and room-1 memorials.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
