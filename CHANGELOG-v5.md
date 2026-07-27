# Event Access Platform — UI Patch v5

Data: 27/07/2026

## Corrigido

- Seletores do Taiga UI que apareciam vazios ou não abriam.
- Perfil de acesso de novos membros com opções visíveis em português.
- Categoria de ingresso com opções pré-cadastradas.
- Campo de cor hexadecimal substituído pelo `InputColor` do Taiga UI.
- Prévia visual da pulseira e sugestões de cores.
- Publicação de evento sem ingresso agora direciona o usuário à configuração e exibe a mensagem do backend.
- Botão de publicação bloqueia cliques repetidos durante a requisição.

## Categorias disponíveis

- Comum (`COMMON`)
- Premium (`PREMIUM`)
- VIP (`VIP`)
- Camarote (`CABIN`)
- Backstage (`BACKSTAGE`)
- Cortesia (`COURTESY`)

A categoria continua armazenada como código técnico no backend. A interface apresenta o rótulo em português.

## Perfis disponíveis

- Administrador da organização (`ORGANIZER_ADMIN`)
- Gestor de evento (`EVENT_MANAGER`)
- Equipe de portaria (`DOOR_STAFF`)
- Financeiro (`FINANCE`)
- Somente leitura (`VIEWER`)
