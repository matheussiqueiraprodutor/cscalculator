(function hivePptExportModule(){
  const COLORS={
    bg:'03070D',
    bg2:'061C3D',
    panel:'071522',
    blue:'00A3FF',
    blue2:'168BD0',
    text:'F5F7FA',
    muted:'B5C4D1',
    red:'E53935',
    green:'23C971',
    yellow:'F5D442',
    white:'FFFFFF'
  };

  function readJson(key,fallback){
    try{
      const raw=localStorage.getItem(key);
      return raw?JSON.parse(raw):fallback;
    }catch(e){return fallback;}
  }
  function clean(v){return String(v==null?'':v).trim();}
  function fmtInt(v){return Math.round(Number(v||0)).toLocaleString('pt-BR');}
  function fmt1(v){return Number(v||0).toLocaleString('pt-BR',{maximumFractionDigits:1});}
  function safeName(v){
    return (clean(v)||'Sem Nome').replace(/[\\/:*?"<>|]+/g,' ').replace(/\s+/g,' ').trim()||'Sem Nome';
  }

  function addHexPattern(slide,pptx){
    slide.background={color:COLORS.bg};
    slide.addShape(pptx.ShapeType.rect,{x:0,y:0,w:13.333,h:7.5,fill:{color:COLORS.bg},line:{color:COLORS.bg}});
    slide.addShape(pptx.ShapeType.rect,{x:3.7,y:0,w:6.1,h:7.5,fill:{color:'09274A',transparency:38},line:{color:'09274A',transparency:100}});
    let hexIndex=0;
    for(let row=0;row<7;row++){
      for(let col=0;col<11;col++){
        const x=.08+col*1.18+(row%2?.58:0);
        const y=.12+row*1.02;
        const w=1.08,h=.94;
        if(x+w>13.25)continue;
        const hot=(hexIndex%13===4||hexIndex%17===8||hexIndex%23===10);
        slide.addShape(pptx.ShapeType.hexagon,{
          x,y,w,h,
          fill:{color:hot?'0B2744':'061422',transparency:hot?18:35},
          line:{color:hot?COLORS.blue:'153A59',transparency:hot?25:58,pt:hot?1.25:.65}
        });
        hexIndex++;
      }
    }
  }

  function addBrand(slide){
    slide.addText('SBR',{x:.58,y:6.85,w:1.45,h:.36,fontFace:'Arial',fontSize:26,bold:true,color:COLORS.white,margin:0});
    slide.addText('TECHNOLOGY FOR EVENTS',{x:.6,y:7.17,w:1.8,h:.12,fontFace:'Arial',fontSize:5.2,charSpacing:2.4,color:'B8C3CC',margin:0});
  }

  function addBase(slide,pptx,title){
    addHexPattern(slide,pptx);
    if(title){
      slide.addText(title,{x:.72,y:.48,w:8.8,h:.45,fontFace:'Arial',fontSize:21,bold:true,color:COLORS.white,margin:0});
      slide.addShape(pptx.ShapeType.line,{x:.72,y:1.02,w:2.2,h:0,line:{color:COLORS.blue,pt:2.3}});
    }
    addBrand(slide);
  }

  function addLabelValue(slide,label,value,y){
    slide.addText(label,{x:.85,y,w:2.05,h:.28,fontFace:'Arial',fontSize:13,bold:true,color:'D8E4ED',margin:0});
    slide.addText(clean(value),{x:2.9,y,w:8.75,h:.32,fontFace:'Arial',fontSize:13,color:COLORS.white,margin:0,breakLine:false});
  }

  function addBlankSlide(pptx,title){
    const slide=pptx.addSlide();
    addBase(slide,pptx,title);
    return slide;
  }

  function buildCover(pptx){
    const slide=pptx.addSlide();
    addHexPattern(slide,pptx);
    slide.addText('NÓS CONECTAMOS',{x:.66,y:.72,w:3.15,h:.35,fontFace:'Arial',fontSize:20,color:COLORS.white,margin:0});
    slide.addText('PESSOAS E EMPRESAS',{x:.66,y:1.14,w:3.7,h:.4,fontFace:'Arial',fontSize:22,bold:true,color:COLORS.white,margin:0});
    slide.addText('ATRAVÉS DA TECNOLOGIA.',{x:.66,y:1.56,w:3.65,h:.38,fontFace:'Arial',fontSize:20,color:COLORS.white,margin:0});
    const cx=7.25,cy=2.35;
    [[cx,cy],[cx-1.32,cy+.68],[cx+1.32,cy+.68]].forEach((p,i)=>{
      slide.addShape(pptx.ShapeType.hexagon,{
        x:p[0],y:p[1],w:1.6,h:1.4,
        fill:{color:i===0?COLORS.white:COLORS.bg2,transparency:i===0?0:80},
        line:{color:COLORS.white,pt:4}
      });
    });
    slide.addShape(pptx.ShapeType.line,{x:8.02,y:2.05,w:0,h:-.72,line:{color:COLORS.white,pt:4}});
    slide.addShape(pptx.ShapeType.line,{x:8.75,y:2.65,w:.88,h:-.5,line:{color:COLORS.white,pt:4}});
    addBrand(slide);
  }

  function buildSlide2(pptx,cab){
    const slide=pptx.addSlide();
    addBase(slide,pptx,clean(cab.evento));
    if(cab.dataEvento) slide.addText(clean(cab.dataEvento),{x:.78,y:1.22,w:2,h:.3,fontSize:15,color:COLORS.muted,margin:0});
    let y=1.78;
    addLabelValue(slide,'Local:',cab.local,y); y+=.46;
    addLabelValue(slide,'Salas:',cab.sala,y); y+=.46;
    addLabelValue(slide,'Endereço:','',y); y+=.62;
    addLabelValue(slide,'Comercial Responsável:','',y); y+=.46;
    addLabelValue(slide,'Coordenador:','',y); y+=.46;
    addLabelValue(slide,'Head de Vídeo:','',y); y+=.46;
    addLabelValue(slide,'Head de Som:','',y); y+=.46;
    addLabelValue(slide,'Head de Luz:','',y);
    if(cab.hotel){
      slide.addText('Hotel: '+clean(cab.hotel),{x:8.55,y:6.42,w:3.75,h:.28,fontSize:11,color:'A9BAC7',align:'right',margin:0});
    }
  }

  function buildSlide3(pptx,cab){
    const slide=pptx.addSlide();
    addBase(slide,pptx,'CRONOGRAMA MONTAGEM'+(cab.dataMontagem?' – '+clean(cab.dataMontagem):''));
    const lines=[
      '– Chegada Caminhões e Equipe Técnica ',
      '– Finalização de Montagem / Configurações ',
      '– Fim da Montagem '
    ];
    lines.forEach((t,i)=>slide.addText(t,{x:.9,y:1.55+i*.52,w:5.8,h:.34,fontSize:15,color:COLORS.white,margin:0}));
    slide.addText('Equipe Técnica',{x:7.0,y:1.45,w:2.2,h:.35,fontSize:17,bold:true,color:COLORS.white,margin:0});
    const team=['Produção:','Vídeo:','Luz:','Som:'];
    team.forEach((t,i)=>slide.addText(t,{x:7.02,y:2.0+i*.48,w:4.8,h:.3,fontSize:14,color:COLORS.white,margin:0}));
    const footer='Cronograma de Montagem'+(cab.evento?' '+clean(cab.evento):'')+(cab.dataEvento?' – '+clean(cab.dataEvento):'');
    slide.addText(footer,{x:.9,y:5.72,w:10.7,h:.35,fontSize:14,bold:true,color:'DCE7EF',align:'center',margin:0});
  }

  function buildSlide4(pptx,cab,summary){
    const slide=pptx.addSlide();
    addBase(slide,pptx,'Detalhamento técnico'+(cab.evento?' — '+clean(cab.evento):''));
    const lines=clean(summary).split(/\r?\n/).filter(Boolean);
    let y=1.45;
    lines.forEach((line,i)=>{
      slide.addText(line,{x:.86,y,w:11.35,h:.38,fontSize:i===0?15:14,bold:i===0,color:COLORS.white,margin:0,breakLine:false});
      y+=.43;
    });
    if(cab.local) slide.addText('Local: '+clean(cab.local),{x:.86,y:5.95,w:11.2,h:.3,fontSize:12,color:COLORS.muted,margin:0});
  }

  function aerialRows(ds,dl,dv){
    const rows=[];
    (ds&&Array.isArray(ds.riggingResultados)?ds.riggingResultados:[]).forEach(r=>{
      if(!r.usaAncoragem&&!r.usaTalha)return;
      rows.push([
        'Som',
        clean(r.nome),
        fmtInt(r.peso)+' kg',
        r.qtdPontos?String(r.qtdPontos):'',
        r.pesoPorPonto!=null?fmtInt(r.pesoPorPonto)+' kg':'',
        r.usaTalha?(fmtInt(r.qtdTalhas)+' x '+fmt1(r.comprimentoTalha)+' m'):''
      ]);
    });
    (dl&&Array.isArray(dl.riggingResultados)?dl.riggingResultados:[]).forEach(r=>{
      if(!r.usaAncoragem&&!r.usaTalha)return;
      rows.push([
        'Luz',
        clean(r.nome),
        fmtInt(r.peso)+' kg',
        r.qtdPontos?String(r.qtdPontos):'',
        r.pesoPorPonto!=null?fmtInt(r.pesoPorPonto)+' kg':'',
        r.usaTalha?(fmtInt(r.qtdTalhas)+' x '+fmt1(r.comprimentoTalha)+' m'):''
      ]);
    });
    if(dv&&dv.mode==='suspenso'&&Number(dv.pesoTotal)>0){
      const pts=Number(dv.talhas||0);
      rows.push([
        'Vídeo',
        'Painel de LED',
        fmtInt(dv.pesoTotal)+' kg',
        pts?String(pts):'',
        pts?fmtInt(Number(dv.pesoTotal)/pts)+' kg':'',
        pts?(fmtInt(pts)+' talhas'):''
      ]);
    }
    return rows;
  }

  function soloRows(dv){
    const rows=[];
    if(dv&&(dv.mode==='ground'||dv.mode==='groundSuspenso')&&Number(dv.pesoTotal)>0){
      const altura=(dv.topoAtivo&&dv.topoTotalPaineis>0)?dv.alturaRealTotal:dv.alturaM;
      const totalMF=Number(dv.mfFrente||0)+(dv.temTraseira?Number(dv.mfTras||0):0)+Number(dv.mfLateral||0);
      rows.push(['Painel de LED',fmt1(dv.larguraM)+' x '+fmt1(altura)+' m',fmtInt(dv.pesoTotal)+' kg',fmtInt(totalMF),fmtInt(dv.contrapesos),fmtInt(dv.pesoContrapesoUnit)+' kg']);
    }
    return rows;
  }

  function addMemorialTable(slide,pptx,headers,rows){
    if(!rows.length)return;
    const body=[headers].concat(rows);
    slide.addTable(body,{
      x:.75,y:1.42,w:11.82,h:4.55,
      border:{type:'solid',color:'2B5576',pt:.7},
      fill:'071522',
      color:COLORS.white,
      fontFace:'Arial',
      fontSize:11,
      margin:.08,
      rowH:.38,
      colW:headers.length===6?[1.15,3.2,1.55,1.35,1.45,1.95]:undefined,
      bold:false
    });
    headers.forEach((h,i)=>{});
    slide.addShape(pptx.ShapeType.rect,{x:.75,y:1.42,w:11.82,h:.4,fill:{color:'0B2F50'},line:{color:'0B2F50'}});
    const widths=headers.length===6?[1.15,3.2,1.55,1.35,1.45,1.95]:new Array(headers.length).fill(11.82/headers.length);
    let x=.75;
    headers.forEach((h,i)=>{
      slide.addText(h,{x:x+.04,y:1.49,w:widths[i]-.08,h:.22,fontSize:9.5,bold:true,color:COLORS.white,align:'center',margin:0});
      x+=widths[i];
    });
  }

  function buildSlide8(pptx,ds,dl,dv){
    const slide=pptx.addSlide();
    addBase(slide,pptx,'Memorial de Cálculo Aéreo');
    const rows=aerialRows(ds,dl,dv);
    addMemorialTable(slide,pptx,['SETOR','ESTRUTURA / POSIÇÃO','PESO','PONTOS','KG/PONTO','TALHAS'],rows);
  }

  function buildSlide9(pptx,dv){
    const slide=pptx.addSlide();
    addBase(slide,pptx,'Memorial de Cálculo de Solo');
    const rows=soloRows(dv);
    addMemorialTable(slide,pptx,['ITEM','DIMENSÃO','PESO','MÃOS FRANCESAS','CONTRAPESOS','PESO/UN.'],rows);
  }

  function buildSlide10(pptx){
    const slide=pptx.addSlide();
    addBase(slide,pptx,'Cores Para cada Setor');
    slide.addText('Para fácil identificação de possíveis problemas, estamos adotando os padrões dos cabos identificados nas respectivas cores abaixo. Todo cabo deve ser identificado em ambas as pontas com uma fita dessa cor para melhor funcionamento do evento.',{
      x:.85,y:1.35,w:11.4,h:.72,fontSize:14,color:COLORS.white,margin:0
    });
    const rows=[
      ['Cabeamento de áudio','Na cor Vermelha',COLORS.red],
      ['Cabeamento de Vídeo','Na cor Verde',COLORS.green],
      ['Cabeamento de Iluminação','Na cor Amarela',COLORS.yellow]
    ];
    rows.forEach((r,i)=>{
      const y=2.45+i*.82;
      slide.addShape(pptx.ShapeType.rect,{x:.92,y:y+.04,w:.24,h:.24,fill:{color:r[2]},line:{color:r[2]}});
      slide.addText(r[0],{x:1.32,y,w:3.35,h:.34,fontSize:16,bold:true,color:COLORS.white,margin:0});
      slide.addText(r[1],{x:4.85,y,w:2.4,h:.34,fontSize:16,color:COLORS.white,margin:0});
      slide.addShape(pptx.ShapeType.line,{x:.92,y:y+.53,w:8.25,h:0,line:{color:'23445F',pt:.75}});
    });
  }

  function escXml(v){
    return clean(v).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  function flowSvg(state){
    state=state||{};
    const vehicles=Array.isArray(state.vehicles)?state.vehicles:[];
    const origin=escXml(state.origin||'ORIGEM');
    const dest=escXml(state.destination||'DESTINO');
    const event=escXml(state.event||'');
    const cleanPeople=a=>(Array.isArray(a)?a:[]).filter(p=>clean(p.name));
    const ida=vehicles.map((v,i)=>({v,i,p:cleanPeople(v.ida)})).filter(x=>x.p.length||clean(x.v.name)||clean(x.v.model));
    const ret=vehicles.map((v,i)=>({v,i,p:cleanPeople(v.retorno)})).filter(x=>x.v.returns!==false&&(x.p.length||clean(x.v.name)||clean(x.v.model)));

    const cardW=280, gap=28, cols=Math.min(4,Math.max(1,ida.length||1));
    const startX=(1600-(cols*cardW+(cols-1)*gap))/2;
    const cardY=245;
    let cards='';
    ida.forEach((x,idx)=>{
      const col=idx%cols,row=Math.floor(idx/cols);
      const xx=startX+col*(cardW+gap), yy=cardY+row*205;
      const names=x.p.slice(0,5).map((p,j)=>'<text x="'+(xx+18)+'" y="'+(yy+86+j*22)+'" fill="#dce8f0" font-family="Arial" font-size="17">'+escXml(p.name)+(p.driver?' (motorista)':'')+'</text>').join('');
      cards+='<rect x="'+xx+'" y="'+yy+'" width="'+cardW+'" height="176" rx="15" fill="#0a2137" stroke="#00a3ff" stroke-width="2"/>'+
        '<text x="'+(xx+18)+'" y="'+(yy+34)+'" fill="#ffffff" font-family="Arial" font-size="20" font-weight="700">VEÍCULO '+(x.i+1)+(clean(x.v.model)?' — '+escXml(x.v.model):'')+'</text>'+
        '<text x="'+(xx+18)+'" y="'+(yy+61)+'" fill="#8fd5ff" font-family="Arial" font-size="15">IDA • '+origin+' → '+dest+'</text>'+names;
    });

    let retCards='';
    ret.slice(0,4).forEach((x,idx)=>{
      const xx=115+idx*365, yy=670;
      const nm=x.p.slice(0,3).map((p,j)=>'<text x="'+(xx+15)+'" y="'+(yy+68+j*19)+'" fill="#e1e7ec" font-family="Arial" font-size="14">'+escXml(p.name)+(p.driver?' (motorista)':'')+'</text>').join('');
      retCards+='<rect x="'+xx+'" y="'+yy+'" width="330" height="145" rx="13" fill="#111d26" stroke="#7a8791" stroke-width="1.5"/>'+
        '<text x="'+(xx+15)+'" y="'+(yy+30)+'" fill="#ffffff" font-family="Arial" font-size="18" font-weight="700">VEÍCULO '+(x.i+1)+(clean(x.v.model)?' — '+escXml(x.v.model):'')+'</text>'+
        '<text x="'+(xx+15)+'" y="'+(yy+51)+'" fill="#b7c4ce" font-family="Arial" font-size="13">RETORNO • '+dest+' → '+origin+'</text>'+nm;
    });

    return '<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="900">'+
      '<rect width="1600" height="900" fill="#061c3d"/>'+
      '<text x="800" y="55" text-anchor="middle" fill="#ffffff" font-family="Arial" font-size="34" font-weight="700">FLUXO DE VEÍCULOS</text>'+
      '<text x="800" y="88" text-anchor="middle" fill="#c9d7e2" font-family="Arial" font-size="17">'+event+' • IDA E RETORNO</text>'+
      '<rect x="665" y="116" width="270" height="72" rx="12" fill="#172633"/>'+
      '<text x="800" y="149" text-anchor="middle" fill="#ffffff" font-family="Arial" font-size="23" font-weight="700">'+origin+'</text>'+
      '<text x="800" y="174" text-anchor="middle" fill="#b5c5d1" font-family="Arial" font-size="13">SAÍDA</text>'+
      '<text x="800" y="222" text-anchor="middle" fill="#ffffff" font-family="Arial" font-size="34">↓</text>'+
      cards+
      '<text x="800" y="615" text-anchor="middle" fill="#ffffff" font-family="Arial" font-size="30">↓</text>'+
      '<rect x="665" y="622" width="270" height="72" rx="12" fill="#e51414"/>'+
      '<text x="800" y="654" text-anchor="middle" fill="#ffffff" font-family="Arial" font-size="22" font-weight="700">'+dest+'</text>'+
      '<text x="800" y="679" text-anchor="middle" fill="#ffffff" font-family="Arial" font-size="13">DESTINO</text>'+
      retCards+
      '</svg>';
  }

  function svgData(svg){
    return 'data:image/svg+xml;base64,'+btoa(unescape(encodeURIComponent(svg)));
  }

  function buildSlide12(pptx,flow){
    const slide=pptx.addSlide();
    addBase(slide,pptx,'Logística de Veículos');
    const hasFlow=flow&&Array.isArray(flow.vehicles)&&flow.vehicles.some(v=>clean(v.name)||clean(v.model)||(v.ida||[]).some(p=>clean(p.name))||(v.retorno||[]).some(p=>clean(p.name)));
    if(hasFlow){
      slide.addImage({data:svgData(flowSvg(flow)),x:.82,y:1.25,w:11.7,h:5.55});
    }
  }

  async function generate(){
    const Ctor=window.pptxgen||window.PptxGenJS;
    if(!Ctor) throw new Error('Biblioteca de PowerPoint não carregada. Atualize a página e tente novamente.');

    const cab=readJson('descritivo_cabecalho',{});
    const ds=readJson('descritivo_dados_som',null);
    const dl=readJson('descritivo_dados_luz',null);
    const dv=readJson('descritivo_dados_video',null);
    const flow=readJson('hivepro_logistica_veiculos_v1',null);
    let summary='';
    try{
      if(typeof window.gerarResumoTecnico==='function') summary=window.gerarResumoTecnico().texto||'';
    }catch(e){}
    if(!summary&&typeof ultimoResumoTexto!=='undefined') summary=ultimoResumoTexto||'';

    const pptx=new Ctor();
    pptx.layout='LAYOUT_WIDE';
    pptx.author='Hive Pro';
    pptx.company='SBR Technology for Events';
    pptx.subject='Apresentação técnica de evento';
    pptx.title='Apresentação Técnica - '+(clean(cab.evento)||'Evento');
    pptx.lang='pt-BR';
    pptx.theme={
      headFontFace:'Arial',
      bodyFontFace:'Arial',
      lang:'pt-BR'
    };

    buildCover(pptx);
    buildSlide2(pptx,cab);
    buildSlide3(pptx,cab);
    buildSlide4(pptx,cab,summary);
    addBlankSlide(pptx,'Vista 01');
    addBlankSlide(pptx,'Vista 02');
    addBlankSlide(pptx,'Vista 03');
    buildSlide8(pptx,ds,dl,dv);
    buildSlide9(pptx,dv);
    buildSlide10(pptx);
    addBlankSlide(pptx,'Cronograma da Semana');
    buildSlide12(pptx,flow);

    await pptx.writeFile({fileName:'Apresentacao Tecnica - '+safeName(cab.evento)+'.pptx',compression:true});
  }

  window.HivePptExport={generate};
})();