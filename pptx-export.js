/* HIVE PRO — edit the original OOXML package; never reconstruct template slides. */
(function () {
  'use strict';
  const A='http://schemas.openxmlformats.org/drawingml/2006/main';
  const P='http://schemas.openxmlformats.org/presentationml/2006/main';
  const R='http://schemas.openxmlformats.org/officeDocument/2006/relationships';
  const REL='http://schemas.openxmlformats.org/package/2006/relationships';
  const all=(e,n)=>Array.from(e.getElementsByTagNameNS('*',n));
  const one=(e,n)=>all(e,n)[0];
  const xml=s=>{const d=new DOMParser().parseFromString(s,'application/xml');if(one(d,'parsererror'))throw Error('Arquivo de modelo inválido.');return d;};
  const serialize=d=>new XMLSerializer().serializeToString(d);
  const node=(d,ns,name,attrs={})=>{const e=d.createElementNS(ns,name);Object.entries(attrs).forEach(([k,v])=>e.setAttribute(k,v));return e;};
  const shape=(d,id)=>all(d,'sp').find(s=>one(s,'cNvPr')?.getAttribute('id')===String(id));
  const box=s=>{const x=one(s,'xfrm'),o=one(x,'off'),e=one(x,'ext');return {x:+o.getAttribute('x'),y:+o.getAttribute('y'),w:+e.getAttribute('cx'),h:+e.getAttribute('cy')};};
  const canvas=document.createElement('canvas'),ctx=canvas.getContext('2d');
  function hasFont(name){
    const sample='mmmmmmmmmmWWWWWWWWWW0123456789';
    return ['monospace','serif','sans-serif'].some(fallback=>{
      ctx.font='32px '+fallback;const base=ctx.measureText(sample).width;
      ctx.font=`32px "${name}", ${fallback}`;return ctx.measureText(sample).width!==base;
    });
  }
  function lines(text,width,pt,bold=true,font='Calibri') {
    ctx.font=`${bold?'bold ':''}${pt*96/72}px "${font}"`;
    const out=[];
    for(const para of String(text).split('\n')){
      let line='';
      for(const word of para.split(/\s+/).filter(Boolean)){
        if(ctx.measureText(line?line+' '+word:word).width<=width){line=line?line+' '+word:word;continue;}
        if(line){out.push(line);line='';}
        for(const char of word){if(line&&ctx.measureText(line+char).width>width){out.push(line);line='';}line+=char;}
      }
      out.push(line);
    }
    return out;
  }
  function replaceTokens(d,values){
    const affected=new Set();
    for(const p of all(d,'p')){
      const ts=all(p,'t'),text=ts.map(t=>t.textContent).join('');
      const matches=Array.from(text.matchAll(/\{\{\s*([^{}]+?)\s*\}\}/g)).reverse();
      for(const m of matches){
        let parent=p.parentElement;while(parent&&parent.localName!=='sp')parent=parent.parentElement;if(parent)affected.add(parent);
        const key=m[1].trim();if(!(key in values))throw Error('Campo não mapeado: '+key);
        if(parent){parent.hiveFields=parent.hiveFields||new Set();parent.hiveFields.add(key);}
        let start=0,first=null;
        for(const t of ts){const end=start+t.textContent.length;
          if(end>m.index&&start<m.index+m[0].length){
            const from=Math.max(0,m.index-start),to=Math.min(t.textContent.length,m.index+m[0].length-start);
            const prefix=t.textContent.slice(0,from),suffix=t.textContent.slice(to);
            t.textContent=prefix+(first?'':String(values[key]||''))+suffix;first=first||t;
          }start=end;
        }
      }
    }
    return affected;
  }
  function breakRun(r,wrapped){
    const t=one(r,'t');t.textContent=wrapped[0];let anchor=r;
    for(const text of wrapped.slice(1)){
      const br=node(r.ownerDocument,A,'a:br');const style=one(r,'rPr');if(style)br.append(style.cloneNode(true));anchor.after(br);
      const next=r.cloneNode(true);one(next,'t').textContent=text;br.after(next);anchor=next;
    }
  }
  function fitHexagon(s){
    const b=box(s),body=one(s,'bodyPr'),paras=all(s,'p'),pt=+(one(s,'rPr')?.getAttribute('sz')||3200)/100;
    const lineHeight=pt*96/72*1.2,height=b.h/9525,width=b.w/9525;
    const adjustment=all(s,'gd').find(e=>e.getAttribute('name')==='adj')?.getAttribute('fmla');
    const bevel=adjustment?Number(adjustment.replace('val ',''))/100000:0.25;
    const space=(i,count)=>{
      const top=(height-count*lineHeight)/2+i*lineHeight;
      // Test both edges of each line against the sloping polygon, leaving an inset.
      const distance=Math.max(Math.abs(top-height/2),Math.abs(top+lineHeight-height/2))/(height/2);
      return width*(1-2*bevel*distance)-20;
    };
    const measure=span=>{const rp=span.style,size=+(rp?.getAttribute('sz')||pt*100)/100;ctx.font=`${rp?.getAttribute('b')==='1'?'bold ':''}${size*96/72}px Calibri`;return ctx.measureText(span.text).width;};
    const input=paras.map(p=>{
      const tokens=[];
      for(const r of Array.from(p.children)){
        if(r.localName==='br'){tokens.push({br:true});continue;}
        if(r.localName!=='r')continue;
        const style=one(r,'rPr');for(const word of (one(r,'t')?.textContent||'').trim().split(/\s+/).filter(Boolean))tokens.push({text:word,style});
      }
      return {p,tokens};
    });
    let layout;
    for(let count=1;count*lineHeight<=height-16;count++){
      const out=[];let failed=false;
      for(const {p,tokens} of input){
        let line={p,spans:[],width:0};
        for(const token of tokens){
          if(token.br){out.push(line);line={p,spans:[],width:0};continue;}
          let span={...token,text:(line.spans.length?' ':'')+token.text};
          if(line.width+measure(span)>space(out.length,count)&&line.spans.length){out.push(line);line={p,spans:[],width:0};span={...token};}
          // A single long word may use the wider middle of the hexagon; never split it prematurely.
          if(measure(span)>space(out.length,count)){failed=true;break;}
          line.spans.push(span);line.width+=measure(span);
        }
        if(failed)break;out.push(line);
      }
      if(!failed&&out.length<=count&&out.every((line,i)=>line.width<=space(i,out.length))){layout=out;break;}
    }
    if(!layout)return false;
    for(const p of paras){
      const rows=layout.filter(line=>line.p===p);for(const child of Array.from(p.children))if(['r','br'].includes(child.localName))child.remove();
      const end=Array.from(p.children).find(e=>e.localName==='endParaRPr');
      rows.forEach((line,i)=>{if(i)p.insertBefore(node(s.ownerDocument,A,'a:br'),end||null);for(const span of line.spans){const r=node(s.ownerDocument,A,'a:r');if(span.style)r.append(span.style.cloneNode(true));const t=node(s.ownerDocument,A,'a:t');t.setAttributeNS('http://www.w3.org/XML/1998/namespace','xml:space','preserve');t.textContent=span.text;r.append(t);p.insertBefore(r,end||null);}});
    }
    body.setAttribute('wrap','none');all(body,'spAutoFit').forEach(e=>e.remove());
    return true;
  }
  function fitFields(d,affected,page){
    for(const s of all(d,'sp')){
      if(affected&&!affected.has(s))continue;
      const b=box(s),hex=one(s,'prstGeom')?.getAttribute('prst')==='hexagon';
      if(!one(s,'txBody')||!all(s,'t').length)continue;
      const fields=Array.from(s.hiveFields||[]).map(k=>({'evento':'nome do evento','data':'data do evento','data montagem':'data de montagem'}[k]||k)).join(' e ');
      const location=page|| (one(s,'cNvPr')?.getAttribute('id')==='21'?3:2);
      const overflow=()=>Error('Página '+location+' — '+(fields||'texto do evento')+': o texto continua maior que a área disponível, mesmo após a quebra automática de linhas. Revise esse campo; a fonte e o desenho foram preservados.');
      if(hex){if(!fitHexagon(s))throw overflow();continue;}
      // A central rectangle 60% wide and 80% high stays inside the hexagon's slopes.
      const width=(b.w/9525)*(hex?0.60:0.94),height=(b.h/9525)*(hex?0.80:0.94);
      let used=0;
      for(const p of all(s,'p')){
        const runs=Array.from(p.children).filter(e=>e.localName==='r');
        const pt=+(one(p,'rPr')?.getAttribute('sz')|| (hex?3200:1800))/100;
        const text=Array.from(p.children).map(e=>e.localName==='br'?'\n':e.localName==='r'?(one(e,'t')?.textContent||''):'').join('');
        const wrapped=lines(text,width,pt);const spacing=+(one(p,'spcPct')?.getAttribute('val')||100000)/100000;
        used+=wrapped.length*pt*96/72*1.2*spacing;
        // Each template paragraph with a variable is a single style, except its fixed label.
        // Wrap runs without flattening their individual formatting.
        let remaining=width;
        for(const r of Array.from(p.children)){
          if(r.localName==='br'){remaining=width;continue;}
          if(r.localName!=='r')continue;
          const t=one(r,'t');if(!t)continue;const rp=one(r,'rPr'),size=+(rp?.getAttribute('sz')||pt*100)/100;
          ctx.font=`${rp?.getAttribute('b')==='1'?'bold ':''}${size*96/72}px Calibri`;
          const w=ctx.measureText(t.textContent).width;
          if(w>remaining){
            if(remaining<width&&r!==runs[0]){const br=node(d,A,'a:br');r.before(br);}
            const ls=lines(t.textContent,width,size,rp?.getAttribute('b')==='1');breakRun(r,ls);ctx.font=`${rp?.getAttribute('b')==='1'?'bold ':''}${size*96/72}px Calibri`;remaining=width-ctx.measureText(ls.at(-1)).width;
          }else remaining-=w;
        }
      }
      if(used>height)throw overflow();
      const body=one(s,'bodyPr');body.setAttribute('wrap','square');all(body,'spAutoFit').forEach(e=>e.remove());
    }
  }
  function description(d,text){
    const s=shape(d,17),rect=box(shape(d,16)),b=box(s),ext=one(one(s,'xfrm'),'ext');
    // Keep the original text origin and width; the existing surrounding rectangle bounds its height.
    const height=rect.y+rect.h-b.y-(b.y-rect.y);ext.setAttribute('cy',height);
    let size=16,wrapped;
    for(;size>=4;size-=0.25){wrapped=lines(text,b.w/9525-24,size);if(wrapped.length*size*96/72*1.25<height/9525-20)break;}
    if(size<4)throw Error('Descritivo extenso demais para o retângulo da página 4.');
    const body=one(s,'txBody'),style=one(s,'rPr').cloneNode(true);style.setAttribute('sz',Math.round(size*100));
    all(body,'p').forEach(p=>p.remove());const bp=one(body,'bodyPr');bp.setAttribute('anchor','ctr');bp.setAttribute('wrap','square');all(bp,'spAutoFit').forEach(e=>e.remove());
    for(const line of wrapped){const p=node(d,A,'a:p');p.append(node(d,A,'a:pPr',{algn:'ctr'}));const r=node(d,A,'a:r');r.append(style.cloneNode(true));const t=node(d,A,'a:t');t.textContent=line;r.append(t);p.append(r);body.append(p);}
    return size;
  }
  async function imageOnSlide(zip,index,data,area){
    const path=`ppt/slides/slide${index}.xml`,d=xml(await zip.file(path).async('string'));
    const relPath=`ppt/slides/_rels/slide${index}.xml.rels`,rels=xml(await zip.file(relPath).async('string'));
    const rid='rIdHiveExport',name=`hive-export-${index}.png`,raw=data.split(',')[1];zip.file('ppt/media/'+name,raw,{base64:true});
    rels.documentElement.append(node(rels,REL,'Relationship',{Id:rid,Type:R+'/image',Target:'../media/'+name}));
    const im=new Image();im.src=data;await im.decode();const scale=Math.min(area.w/im.width,area.h/im.height),w=Math.round(im.width*scale),h=Math.round(im.height*scale);
    const id=Math.max(...all(d,'cNvPr').map(e=>+e.getAttribute('id')))+1;
    const fragment=xml(`<p:pic xmlns:p="${P}" xmlns:a="${A}" xmlns:r="${R}"><p:nvPicPr><p:cNvPr id="${id}" name="Conteúdo Hive Pro ${index}"/><p:cNvPicPr><a:picLocks noChangeAspect="1"/></p:cNvPicPr><p:nvPr/></p:nvPicPr><p:blipFill><a:blip r:embed="${rid}"/><a:stretch><a:fillRect/></a:stretch></p:blipFill><p:spPr><a:xfrm><a:off x="${Math.round(area.x+(area.w-w)/2)}" y="${Math.round(area.y+(area.h-h)/2)}"/><a:ext cx="${w}" cy="${h}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></p:spPr></p:pic>`);
    one(d,'spTree').append(d.importNode(fragment.documentElement,true));zip.file(path,serialize(d));zip.file(relPath,serialize(rels));
  }
  async function memorial(kind){
    const solo=kind==='solo',structures=solo?buildSoloEstruturas():buildAereoEstruturas();
    if(!structures.length)return null;
    if(structures.length>(solo?6:8))throw Error('O memorial '+kind+' excede a quantidade de estruturas suportada pelo modelo Excel.');
    const zip=await JSZip.loadAsync(artB64ToUint8(solo?ART_SOLO_B64:ART_AEREO_B64));let sheet=await zip.file('xl/worksheets/sheet1.xml').async('string');const cab=cabRead();
    if(solo){sheet=sheet.replace(/<mergeCells([^>]*)>/,'<mergeCells$1><mergeCell ref="B3:C3"/><mergeCell ref="B4:C4"/>').replace('<c r="C4" s="2"/>','<c r="C4" s="9"/>');}
    const row=solo?4:5;for(const [col,value] of [['B',cab.evento],['D',cab.local],['G',cab.dataEvento],['H',cab.dataMontagem],[solo?'J':'I',cab.sala]])sheet=artSetString(sheet,col+row,value);
    structures.forEach((est,i)=>{const slot=solo?soloSlot(i):aereoSlot(i);
      if(est.rows.length>slot.eqRows)throw Error('Há equipamentos demais em '+est.titulo+'. O modelo Excel não comporta todos; exportação interrompida para não omitir dados.');
      sheet=artSetString(sheet,slot.title,' ESTRUTURA '+(solo?String(i+1).padStart(2,'0'):i+1)+' — '+est.titulo);
      sheet=artSetNumber(sheet,solo?slot.area:slot.pontos,solo?est.area:est.pontos);
      est.rows.forEach((r,j)=>{const line=slot.eqStart+j;sheet=artSetString(sheet,slot.nameCol+line,r.nome);sheet=artSetNumber(sheet,slot.qtyCol+line,r.qty);sheet=artSetNumber(sheet,slot.unitCol+line,Number((r.pesoUnit||0).toFixed(3)));});
    });
    zip.file('xl/worksheets/sheet1.xml',sheet);
    return HiveSheetImage.render(zip);
  }
  async function logistics(){
    const state=JSON.parse(localStorage.getItem('hivepro_logistica_veiculos_v1')||'null');
    if(!state?.vehicles?.length)return null;
    if(state.event&&cabRead().evento&&state.event.trim()!==cabRead().evento.trim())throw Error('A logística salva pertence a outro evento. Atualize o evento na área de Logística antes de exportar.');
    const frame=document.createElement('iframe');frame.style.cssText='position:fixed;left:-20000px;top:0;width:1500px;height:1000px;border:0';
    const loaded=new Promise((resolve,reject)=>{frame.onload=resolve;frame.onerror=()=>reject(Error('Não foi possível abrir a logística.'));});
    frame.src='logistica.html';document.body.append(frame);
    try{await Promise.race([loaded,new Promise((_,reject)=>setTimeout(()=>reject(Error('Tempo esgotado ao carregar logística.')),20000))]);
      const w=frame.contentWindow;await w.document.fonts.ready;
      if(!w.html2canvas)throw Error('A biblioteca de PNG da logística não carregou.');
      const target=w.document.getElementById('capture');target.style.cssText+=';width:1280px;min-width:1280px;height:auto;overflow:visible;aspect-ratio:auto';
      const source=await w.html2canvas(target,{backgroundColor:'#061c3d',scale:2,useCORS:true,width:1280,windowWidth:1280});
      const out=document.createElement('canvas');out.width=1600;out.height=900;const c=out.getContext('2d');c.fillStyle='#061c3d';c.fillRect(0,0,1600,900);const scale=Math.min(1600/source.width,900/source.height);c.drawImage(source,(1600-source.width*scale)/2,(900-source.height*scale)/2,source.width*scale,source.height*scale);return out.toDataURL('image/png');
    }finally{frame.remove();}
  }
  async function generate(values){
    await document.fonts.ready;
    for(const font of ['Calibri','Arial','Times New Roman'])if(!hasFont(font))throw Error('A fonte '+font+' precisa estar instalada para preservar o modelo e os memoriais.');
    const response=await fetch('assets/hive-template.pptx');if(!response.ok)throw Error('Não foi possível carregar o PowerPoint modelo.');
    const zip=await JSZip.loadAsync(await response.arrayBuffer());
    for(const index of [2,3]){const path=`ppt/slides/slide${index}.xml`,d=xml(await zip.file(path).async('string'));const affected=replaceTokens(d,values);fitFields(d,affected,index);zip.file(path,serialize(d));}
    const path='ppt/slides/slide4.xml',d=xml(await zip.file(path).async('string'));const summary=gerarResumoTecnico().texto;if(!summary)throw Error('Gere o descritivo técnico antes de exportar.');description(d,summary);zip.file(path,serialize(d));
    // Content area copied from the existing vehicle-logistics rectangle in the template.
    const area=box(shape(xml(await zip.file('ppt/slides/slide12.xml').async('string')),14));
    // Authorized correction of the older attachment's title; source file remains untouched.
    const aerialPath='ppt/slides/slide9.xml',aerial=xml(await zip.file(aerialPath).async('string'));
    one(shape(aerial,11),'t').textContent='Memorial de Cálculo Aéreo';zip.file(aerialPath,serialize(aerial));
    const missing=[];
    for(const [kind,index] of [['solo',8],['aereo',9]]){const data=await memorial(kind);if(data)await imageOnSlide(zip,index,data,area);else missing.push('memorial '+kind);}
    const png=await logistics();if(png)await imageOnSlide(zip,12,png,area);else missing.push('logística de veículos');
    if(missing.length&&!confirm('Sem dados para '+missing.join(', ')+'. Essas páginas ficarão como no modelo. Exportar assim?'))return;
    const types=xml(await zip.file('[Content_Types].xml').async('string'));
    if(!all(types,'Default').some(e=>e.getAttribute('Extension')==='png')){types.documentElement.append(node(types,types.documentElement.namespaceURI,'Default',{Extension:'png',ContentType:'image/png'}));zip.file('[Content_Types].xml',serialize(types));}
    const blob=await zip.generateAsync({type:'blob',mimeType:'application/vnd.openxmlformats-officedocument.presentationml.presentation'});
    artDownloadBlob(blob,'Apresentação Técnica - '+String(values.evento||'Evento').replace(/[\\/:*?"<>|]/g,' ')+'.pptx');return blob;
  }
  function review(){
    const cab=cabRead(),values={evento:cab.evento||'',data:cab.dataEvento||'',local:cab.local||'',salas:cab.sala||'',endereço:cab.endereco||'', 'data montagem':cab.dataMontagem||'','tec de vídeo':'','tec de som':'','tec de iluminação':'','técnico de vídeo e auxiliar de vídeo':'','técnico de luz e auxiliares de luz':'','técnico de som e auxiliar de som':''};
    const dialog=document.createElement('dialog');dialog.style.cssText='background:#131315;color:#f3f1ec;border:1px solid #29292d;border-radius:4px;max-width:700px;width:95vw;max-height:90vh;padding:24px';
    const form=document.createElement('form');form.innerHTML='<h2>Exportar PowerPoint</h2><p>Revise os campos do modelo. Os dados desta revisão são usados somente nesta exportação.</p><div id="ppt-team"></div>';
    for(const [key,value] of Object.entries(values)){const label=document.createElement('label');label.style.cssText='display:block;margin:10px 0';label.textContent=key;const input=document.createElement('input');input.name=key;input.value=value;input.style.cssText='display:block;width:100%;padding:8px;margin-top:4px';label.append(input);form.append(label);}
    const status=document.createElement('p');status.setAttribute('role','status');form.append(status);
    const cancel=document.createElement('button');cancel.type='button';cancel.className='btn';cancel.textContent='Cancelar';cancel.onclick=()=>dialog.close();
    const go=document.createElement('button');go.className='btn';go.textContent='Gerar PowerPoint';form.append(cancel,go);dialog.append(form);document.body.append(dialog);dialog.addEventListener('close',()=>dialog.remove(),{once:true});dialog.showModal();
    dialog.addEventListener('cancel',e=>{if(go.disabled)e.preventDefault();});
    form.onsubmit=async e=>{e.preventDefault();go.disabled=cancel.disabled=true;status.textContent='Preenchendo o modelo original…';try{const result=await generate(Object.fromEntries(new FormData(form)));if(result)dialog.close();}catch(err){console.error(err);status.textContent=err.message;}finally{go.disabled=cancel.disabled=false;}};
    loadTeam(form,cab).catch(err=>{form.querySelector('#ppt-team').textContent='Equipe não carregada: '+err.message+'. Você pode preencher os nomes abaixo.';});
  }
  async function loadTeam(form,cab){
    if(!window.MMAuth?.client||!cab.evento)return;
    const client=MMAuth.client;const result=await client.from('staffing_requests').select('id,event_name,event_date,status,is_test,reservation_mode').eq('event_name',cab.evento).order('created_at',{ascending:false});if(result.error)throw result.error;
    const requests=(result.data||[]).filter(r=>!r.is_test&&r.status!=='cancelled');if(!requests.length)return;
    const label=document.createElement('label');label.textContent='Importar equipe da solicitação: ';const select=document.createElement('select');select.append(new Option('Selecione a solicitação',''));requests.forEach(r=>select.append(new Option(r.event_name+' — '+r.event_date+' (#'+r.id+')',r.id)));label.append(select);form.querySelector('#ppt-team').append(label);
    select.onchange=async()=>{if(!select.value)return;select.disabled=true;try{
      const [ir,fr]=await Promise.all([client.from('staffing_request_items').select('id,function_id').eq('request_id',select.value),client.from('freelancer_functions').select('id,name,sector')]);if(ir.error||fr.error)throw ir.error||fr.error;
      const items=ir.data||[];if(!items.length)return;
      const cr=await client.from('staffing_candidates').select('request_item_id,candidate_name,status').in('request_item_id',items.map(i=>i.id));if(cr.error)throw cr.error;
      const sector={video:[],som:[],luz:[]},heads={video:[],som:[],luz:[]};
      const request=requests.find(r=>String(r.id)===select.value);
      for(const c of cr.data||[]){if(c.status!=='confirmed'&&!(c.status==='available'&&request.reservation_mode!=='pre_reserve'))continue;const item=items.find(i=>String(i.id)===String(c.request_item_id)),fn=(fr.data||[]).find(f=>String(f.id)===String(item?.function_id));if(!fn)continue;const text=(fn.sector+' '+fn.name).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();const key=/video|resolume|vmix|cinegraf|powerpoint/.test(text)?'video':/som|audio/.test(text)?'som':/luz|ilumin/.test(text)?'luz':null;if(!key)continue;sector[key].push(c.candidate_name);if(!/auxiliar/.test(text))heads[key].push(c.candidate_name);}
      for(const [key,head,list] of [['video','tec de vídeo','técnico de vídeo e auxiliar de vídeo'],['som','tec de som','técnico de som e auxiliar de som'],['luz','tec de iluminação','técnico de luz e auxiliares de luz']]){form.elements[head].value=[...new Set(heads[key])].join(', ');form.elements[list].value=[...new Set(sector[key])].join(', ');}
    }catch(err){alert('Não foi possível importar a equipe: '+err.message);}finally{select.disabled=false;}};
  }
  const button=document.getElementById('btnPowerPoint');if(button)button.addEventListener('click',review);
  window.HivePptx={generate,replaceTokens,fitFields,description,memorial,logistics};
})();
