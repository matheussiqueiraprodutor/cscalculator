/* Render the existing memorial workbook styles and formulas, not a replacement table design. */
(function () {
  'use strict';
  const all=(e,n)=>Array.from(e.getElementsByTagNameNS('*',n)),one=(e,n)=>all(e,n)[0];
  const xml=s=>new DOMParser().parseFromString(s,'application/xml');
  const attr=(e,k,f='')=>e?.getAttribute(k)??f;
  const col=s=>Array.from(s).reduce((n,c)=>n*26+c.charCodeAt(0)-64,0);
  const ref=s=>{const m=s.replace(/\$/g,'').match(/^([A-Z]+)(\d+)$/);if(!m)throw Error('Referência de célula inválida: '+s);return [col(m[1]),+m[2]];};
  const address=(c,r)=>{let s='';for(;c;c=Math.floor((c-1)/26))s=String.fromCharCode(65+(c-1)%26)+s;return s+r;};
  function formula(source,read){
    // Restricted grammar: no eval, script execution, or fallback to stale Excel caches.
    const tokens=source.replace(/\$/g,'').match(/"(?:[^"]|"")*"|<=|>=|<>|[A-Z]+\d+|[A-Z_]+|\d+(?:\.\d+)?|[()+*\-/,:%=<>]/g)||[];
    if(tokens.join('')!==source.replace(/\$/g,'').replace(/\s+(?=(?:[^"]*"[^"]*")*[^"]*$)/g,''))throw Error('Fórmula não suportada: '+source);
    let i=0;
    function primary(){
      const t=tokens[i++];let out;
      if(t==='('){out=compare();if(tokens[i++]!==')')throw Error('Fórmula inválida.');}
      else if(t==='-'){const a=primary();out=()=>-Number(a());}
      else if(t?.startsWith('"'))out=()=>t.slice(1,-1).replace(/""/g,'"');
      else if(/^\d/.test(t||''))out=()=>Number(t);
      else if(/^[A-Z]+\d+$/.test(t||'')){
        if(tokens[i]===':'){i++;const end=tokens[i++];out=()=>{const [c1,r1]=ref(t),[c2,r2]=ref(end),v=[];for(let r=r1;r<=r2;r++)for(let c=c1;c<=c2;c++)v.push(read(address(c,r)));return v;};}
        else out=()=>read(t);
      }else if(['SUM','IF','IFERROR'].includes(t)){
        if(tokens[i++]!=='(')throw Error('Fórmula inválida.');const args=[];if(tokens[i]!==')'){do{args.push(compare());if(tokens[i]!==',')break;i++;}while(true);}if(tokens[i++]!==')')throw Error('Fórmula inválida.');
        out=()=>{if(t==='IFERROR'){try{return args[0]();}catch{return args[1]();}}if(t==='IF')return args[0]()?args[1]():args[2]();return args.flatMap(a=>a()).reduce((s,v)=>s+(Number(v)||0),0);};
      }else throw Error('Fórmula não suportada: '+source);
      if(tokens[i]==='%'){i++;const a=out;out=()=>Number(a())/100;}return out;
    }
    function product(){let a=primary();while(['*','/'].includes(tokens[i])){const op=tokens[i++],l=a,r=primary();a=()=>{const divisor=Number(r());if(op==='/'&&!divisor)throw Error('Divisão por zero');return op==='*'?Number(l())*divisor:Number(l())/divisor;};}return a;}
    function sum(){let a=product();while(['+','-'].includes(tokens[i])){const op=tokens[i++],l=a,r=product();a=()=>op==='+'?Number(l())+Number(r()):Number(l())-Number(r());}return a;}
    function compare(){let a=sum();if(['=','<>','<','>','<=','>='].includes(tokens[i])){const op=tokens[i++],l=a,r=sum();a=()=>{const x=l(),y=r();switch(op){case '=':return x===y;case '<>':return x!==y;case '<':return x<y;case '>':return x>y;case '<=':return x<=y;case '>=':return x>=y;}};}return a;}
    const result=compare();if(i!==tokens.length)throw Error('Fórmula não suportada: '+source);return result();
  }
  async function render(zip,options={}){
    const load=async p=>xml(await zip.file(p).async('string'));
    const [sheet,styles,shared,book,theme]=await Promise.all(['xl/worksheets/sheet1.xml','xl/styles.xml','xl/sharedStrings.xml','xl/workbook.xml','xl/theme/theme1.xml'].map(load));
    const strings=all(shared,'si').map(s=>all(s,'t').map(t=>t.textContent).join(''));
    const cells=new Map(all(sheet,'c').map(c=>[attr(c,'r'),c])),cache=new Map(),busy=new Set();
    function read(r){if(cache.has(r))return cache.get(r);if(busy.has(r))throw Error('Referência circular no memorial.');busy.add(r);const c=cells.get(r),f=c&&one(c,'f'),t=attr(c,'t'),v=c&&one(c,'v')?.textContent;
      const value=f?formula(f.textContent,read):t==='s'?strings[Number(v)]||'':t==='inlineStr'?all(c,'t').map(t=>t.textContent).join(''):t==='str'?v||'':v===undefined?'':Number(v);
      busy.delete(r);cache.set(r,value);return value;
    }
    const print=all(book,'definedName').find(e=>attr(e,'name')==='_xlnm.Print_Area')?.textContent.match(/\$[A-Z]+\$\d+:\$[A-Z]+\$\d+/)?.[0];if(!print)throw Error('Área de impressão não encontrada no memorial.');
    const [start,end]=print.split(':'),[c1,r1]=ref(start),[c2,r2]=ref(end);
    const widths=[],heights=[],xs=[],ys=[];const format=one(sheet,'sheetFormatPr');
    for(let c=c1;c<=c2;c++){const spec=all(sheet,'col').find(e=>c>=+attr(e,'min')&&c<=+attr(e,'max'));widths[c]=attr(spec,'hidden')==='true'?0:Math.floor(7*Number(attr(spec,'width',attr(format,'defaultColWidth','8.43')))+5);xs[c]=(xs[c-1]||0)+(widths[c-1]||0);}
    for(let r=r1;r<=r2;r++){const row=all(sheet,'row').find(e=>+attr(e,'r')===r);heights[r]=attr(row,'hidden')==='true'?0:Number(attr(row,'ht',attr(format,'defaultRowHeight','15')))*96/72;ys[r]=(ys[r-1]||0)+(heights[r-1]||0);}
    const fonts=Array.from(one(styles,'fonts').children),fills=Array.from(one(styles,'fills').children),borders=Array.from(one(styles,'borders').children),xfs=Array.from(one(styles,'cellXfs').children);
    const palette=['lt1','dk1','lt2','dk2','accent1','accent2','accent3','accent4','accent5','accent6','hlink','folHlink'].map(n=>{const c=one(one(theme,'clrScheme'),n)?.firstElementChild;return attr(c,'lastClr',attr(c,'val','000000'));});
    function color(e,fallback='#000000'){
      if(!e)return fallback;let v=attr(e,'rgb');if(v)v=v.slice(-6);else if(e.hasAttribute('theme'))v=palette[+attr(e,'theme')];else if(e.hasAttribute('indexed')){v=+attr(e,'indexed')===64?'000000':+attr(e,'indexed')===65?'FFFFFF':undefined;}if(!v)return fallback;
      const tint=+attr(e,'tint','0');if(tint)v=v.match(/../g).map(h=>{const n=parseInt(h,16);return Math.round(tint<0?n*(1+tint):n+(255-n)*tint).toString(16).padStart(2,'0');}).join('');return '#'+v;
    }
    const numFmts=new Map(all(styles,'numFmt').map(e=>[+attr(e,'numFmtId'),attr(e,'formatCode')]));
    const dxfs=one(styles,'dxfs')?Array.from(one(styles,'dxfs').children):[];
    const conditions=all(sheet,'conditionalFormatting').flatMap(e=>all(e,'cfRule').map(rule=>({refs:attr(e,'sqref').split(' '),rule})));
    const merges=all(sheet,'mergeCell').map(e=>{const [a,b]=attr(e,'ref').split(':');return [...ref(a),...ref(b||a)];});
    const output=document.createElement('canvas');output.width=Math.ceil((xs[c2]+widths[c2])*2);output.height=Math.ceil((ys[r2]+heights[r2])*2);const ctx=output.getContext('2d');ctx.scale(2,2);ctx.fillStyle='#FFFFFF';ctx.fillRect(0,0,output.width/2,output.height/2);
    function border(e,x,y,w,h,side){if(!e||!attr(e,'style'))return;ctx.strokeStyle=color(one(e,'color'));ctx.lineWidth=attr(e,'style')==='medium'?2:1;ctx.beginPath();if(side==='left'){ctx.moveTo(x,y);ctx.lineTo(x,y+h);}if(side==='right'){ctx.moveTo(x+w,y);ctx.lineTo(x+w,y+h);}if(side==='top'){ctx.moveTo(x,y);ctx.lineTo(x+w,y);}if(side==='bottom'){ctx.moveTo(x,y+h);ctx.lineTo(x+w,y+h);}ctx.stroke();}
    // Fill first, then borders and text, so merged cells retain their perimeter styling.
    for(let pass=0;pass<2;pass++)for(let r=r1;r<=r2;r++)for(let c=c1;c<=c2;c++){
      if(!widths[c]||!heights[r])continue;const cell=cells.get(address(c,r));if(!cell)continue;const xf=xfs[+attr(cell,'s','0')],fill=fills[+attr(xf,'fillId','0')],b=borders[+attr(xf,'borderId','0')],font=fonts[+attr(xf,'fontId','0')];
      const x=xs[c],y=ys[r],w=widths[c],h=heights[r];const merge=merges.find(([a,b,d,e])=>c>=a&&c<=d&&r>=b&&r<=e);const anchor=!merge||(c===merge[0]&&r===merge[1]);
      const conditionalRef=merge?address(merge[0],merge[1]):address(c,r);
      const condition=conditions.find(e=>e.refs.includes(conditionalRef)&&attr(e.rule,'type')==='cellIs'&&attr(e.rule,'operator')==='greaterThan'&&Number(read(conditionalRef))>Number(one(e.rule,'formula').textContent));
      const dxf=condition?dxfs[+attr(condition.rule,'dxfId')]:null;
      if(pass===0){const pattern=one(fill,'patternFill');if(attr(pattern,'patternType')==='solid'){ctx.fillStyle=color(one(pattern,'fgColor'),'#FFFFFF');ctx.fillRect(x,y,w,h);}if(dxf&&one(dxf,'fill')){ctx.fillStyle=color(one(one(dxf,'fill'),'bgColor'));ctx.fillRect(x,y,w,h);}continue;}
      for(const side of ['left','right','top','bottom']){
        if(merge&&((side==='left'&&c!==merge[0])||(side==='right'&&c!==merge[2])||(side==='top'&&r!==merge[1])||(side==='bottom'&&r!==merge[3])))continue;
        border(one(b,side),x,y,w,h,side);
      }
      if(!anchor)continue;let value=read(address(c,r));if(value==='')continue;
      const mw=merge?xs[merge[2]]+widths[merge[2]]-x:w,mh=merge?ys[merge[3]]+heights[merge[3]]-y:h;
      const alignment=one(xf,'alignment'),fontName=attr(one(font,'name'),'val','Calibri'),bold=one(font,'b')&&attr(one(font,'b'),'val')!=='false',italic=one(font,'i')&&attr(one(font,'i'),'val')!=='false';
      let size=+attr(one(font,'sz'),'val','11')*96/72;
      const fmt=numFmts.get(+attr(xf,'numFmtId'))||({2:'0.00',1:'0'}[+attr(xf,'numFmtId')]||'General');
      if(typeof value==='number'){const places=fmt.match(/0\.([0#]+)/)?.[1].length;value=places!==undefined?value.toLocaleString('pt-BR',{minimumFractionDigits:places,maximumFractionDigits:places}):String(Math.round(value*1e9)/1e9).replace('.',',');}
      ctx.font=`${italic?'italic ':''}${bold||one(dxf||font,'b')?'bold ':''}${size}px "${fontName}"`;ctx.fillStyle=color(dxf&&one(dxf,'color')||one(font,'color'));ctx.textBaseline='top';
      if(['true','1'].includes(attr(alignment,'shrinkToFit'))&&ctx.measureText(String(value)).width>mw-6){size*=Math.max(0,(mw-6)/ctx.measureText(String(value)).width);ctx.font=`${italic?'italic ':''}${bold?'bold ':''}${size}px "${fontName}"`;}
      const wrap=attr(alignment,'wrapText')==='true'||attr(alignment,'wrapText')==='1';let lines=[];
      for(const para of String(value).split('\n')){if(!wrap){lines.push(para);continue;}let line='';for(const word of para.split(/\s+/)){if(line&&ctx.measureText(line+' '+word).width>mw-6){lines.push(line);line=word;}else line+=(line?' ':'')+word;}lines.push(line);}
      const lineHeight=size*1.12,total=lines.length*lineHeight,vertical=attr(alignment,'vertical','bottom');let ty=y+(vertical==='center'?(mh-total)/2:vertical==='top'?2:mh-total-2);const horizontal=attr(alignment,'horizontal','general');
      ctx.save();ctx.beginPath();ctx.rect(x+1,y+1,mw-2,mh-2);ctx.clip();for(const line of lines){const tw=ctx.measureText(line).width;const tx=horizontal==='center'?x+(mw-tw)/2:horizontal==='right'||(horizontal==='general'&&typeof read(address(c,r))==='number')?x+mw-tw-3:x+3;ctx.fillText(line,tx,ty);ty+=lineHeight;}ctx.restore();
    }
    if(!options.regions?.length)return output.toDataURL('image/png');
    // Crop existing filled structure blocks, preserving their cells, fonts, borders and proportions.
    const crops=options.regions.map(range=>{
      const [start,end]=range.split(':'),[left,top]=ref(start),[right,bottom]=ref(end);
      if(left<c1||right>c2||top<r1||bottom>r2)throw Error('Tabela fora da área de impressão do memorial.');
      return {x:xs[left]*2,y:ys[top]*2,w:(xs[right]+widths[right]-xs[left])*2,h:(ys[bottom]+heights[bottom]-ys[top])*2};
    });
    const landscape=document.createElement('canvas');landscape.width=3200;landscape.height=1800;
    const margin=24,gap=32,availableW=landscape.width-margin*2,availableH=landscape.height-margin*2;
    const maxW=Math.max(...crops.map(c=>c.w)),maxH=Math.max(...crops.map(c=>c.h));
    let best;
    for(let columns=1;columns<=crops.length;columns++){
      const rows=Math.ceil(crops.length/columns),scale=Math.min((availableW-gap*(columns-1))/(columns*maxW),(availableH-gap*(rows-1))/(rows*maxH));
      if(!best||scale>best.scale)best={columns,rows,scale};
    }
    const target=landscape.getContext('2d'),cellW=maxW*best.scale,cellH=maxH*best.scale;
    const gridH=best.rows*cellH+(best.rows-1)*gap;
    crops.forEach((crop,i)=>{
      const row=Math.floor(i/best.columns),column=i%best.columns,count=Math.min(best.columns,crops.length-row*best.columns);
      const gridW=count*cellW+(count-1)*gap,w=crop.w*best.scale,h=crop.h*best.scale;
      const x=(landscape.width-gridW)/2+column*(cellW+gap)+(cellW-w)/2,y=(landscape.height-gridH)/2+row*(cellH+gap)+(cellH-h)/2;
      target.drawImage(output,crop.x,crop.y,crop.w,crop.h,x,y,w,h);
    });
    return landscape.toDataURL('image/png');
  }
  window.HiveSheetImage={render,formula};
})();
