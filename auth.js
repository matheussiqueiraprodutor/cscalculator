(function(g){'use strict';
const C=g.MM_DB_CONFIG||{};
const S=g.supabase&&C.url&&C.publishableKey?g.supabase.createClient(C.url,C.publishableKey):null;
const MASTER_EMAIL='matheussiqueiraprodutor@gmail.com';
const A={client:S,user:null,profile:null};
A.isMaster=()=>!!(A.user&&String(A.user.email||'').toLowerCase()===MASTER_EMAIL);
A.init=async function(opts){
  opts=opts||{};
  if(!S){location.href='login.html';return false}

  // Primeiro tenta a sessão persistida localmente. Isso evita expulsar o usuário
  // por uma falha momentânea de rede/Auth ao abrir uma página.
  let sessionResult;
  try{
    sessionResult=await S.auth.getSession();
  }catch(e){
    console.error('HIVE PRO Auth: erro ao recuperar sessão.',e);
    if(!opts.public) location.href='login.html';
    return false;
  }

  const session=sessionResult&&sessionResult.data&&sessionResult.data.session;
  if(!session||!session.user){
    if(!opts.public) location.href='login.html';
    return false;
  }

  // Confirma o usuário no servidor, mas não encerra a sessão só porque a
  // consulta falhou temporariamente.
  let user=session.user;
  try{
    const r=await S.auth.getUser();
    if(r&&r.data&&r.data.user) user=r.data.user;
  }catch(e){
    console.warn('HIVE PRO Auth: não foi possível confirmar o usuário agora; usando sessão válida.',e);
  }

  A.user=user;

  let pResult;
  try{
    pResult=await S.from('profiles').select('*').eq('id',A.user.id).maybeSingle();
  }catch(e){
    console.warn('HIVE PRO Auth: falha temporária ao consultar perfil.',e);
    pResult={error:e,data:null};
  }

  // Só bloqueia se o banco respondeu explicitamente que o usuário está
  // desativado. Erro de rede/consulta não deve fazer logout.
  if(pResult&&pResult.error){
    A.profile={id:A.user.id,active:true};
  }else{
    A.profile=pResult&&pResult.data?pResult.data:{id:A.user.id,active:true};
    if(A.profile.active===false){
      await S.auth.signOut();
      location.href='login.html?blocked=1';
      return false;
    }
  }

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
