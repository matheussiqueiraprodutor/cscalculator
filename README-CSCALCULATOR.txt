CSCAlculator - versão personalizada

Alterações desta versão:
- Marca e títulos alterados para cscalculator.
- Identidade visual ajustada para preto com detalhes em azul-marinho.
- O acesso administrativo do front-end foi restrito ao e-mail:
  matheussiqueiraprodutor@gmail.com
- A criação de novos usuários continua disponível, mas sempre cria perfil USER.
- A opção visual de promover usuários a ADMIN foi removida.

IMPORTANTE SOBRE O MASTER ADMIN:
Esta cópia do front-end considera o e-mail acima como Master Admin. Para que a restrição seja efetiva também no backend, a Edge Function do Supabase "admin-users" e as políticas/RLS do banco precisam aplicar a mesma regra. O código dessa função não veio neste ZIP, então essa parte não foi alterada.

DOMÍNIO PRETENDIDO:
cscalculator.com.br

Não há senhas, tokens de serviço ou chaves secretas neste arquivo.
