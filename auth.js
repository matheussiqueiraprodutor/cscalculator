(function(g){'use strict';
const C=g.MM_DB_CONFIG||{};
const S=g.supabase&&C.url&&C.publishableKey?g.supabase.createClient(C.url,C.publishableKey):null;
const MASTER_EMAIL='matheussiqueiraprodutor@gmail.com';
const A={client:S,user:null,profile:null};
A.isMaster=()=>!!(A.user&&String(A.user.email||'').toLowerCase()===MASTER_EMAIL);
A.init=async function(opts){
  opts=opts||{};
  if(!S){location.href='login.html';return false}
  const r=await S.auth.getUser();
  if(r.error||!r.data.user){if(!opts.public) location.href='login.html';return false}
  A.user=r.data.user;
  const p=await S.from('profiles').select('*').eq('id',A.user.id).maybeSingle();
  A.profile=p.data||null;
  if(!A.profile||A.profile.active===false){await S.auth.signOut();location.href='login.html?blocked=1';return false}
  // Administração é exclusiva do e-mail Master configurado acima.
  if(opts.admin&&!A.isMaster()){location.href='index.html';return false}
  document.documentElement.dataset.role=A.isMaster()?'master':'user';
  return true
};
A.isAdmin=()=>A.isMaster();
A.logout=async()=>{if(S)await S.auth.signOut();location.href='login.html'};
A.refreshCatalog=async function(){if(!S)return null;const r=await S.from('catalog_state').select('data,updated_at').eq('id',1).maybeSingle();if(!r.error&&r.data&&r.data.data){localStorage.setItem('mm_catalogo_custom_v1',JSON.stringify(r.data.data));localStorage.setItem('mm_catalogo_cloud_ts',r.data.updated_at||'');return r.data.data}return null};
A.saveCatalog=async function(data){if(!S||!A.isMaster())throw new Error('Acesso restrito ao Master Admin.');const r=await S.from('catalog_state').update({data:data,updated_at:new Date().toISOString(),updated_by:A.user.id}).eq('id',1).select().single();if(r.error)throw r.error;localStorage.setItem('mm_catalogo_custom_v1',JSON.stringify(data));return r.data};
g.MMAuth=A;
})(window);
