# Changelog v4

## Interface

- Menu lateral funcional e recolhível no desktop.
- Drawer móvel com backdrop, fechamento por navegação e tecla Esc.
- Cabeçalho e área de conteúdo passam a ocupar toda a largura quando o menu é recolhido.
- Labels explícitos em formulários operacionais.
- Melhorias de responsividade, foco, contraste e redução de movimento.

## Localização pt-BR

- Situações, perfis, categorias, métodos de pagamento e resultados traduzidos visualmente.
- Datas, números e valores monetários configurados para pt-BR.
- Termos visuais como `Dashboard`, `Status`, `DEV` e `Check-ins` substituídos por equivalentes em português quando aplicável.

## Formulários

- Máscaras de telefone e CPF.
- Validação real de CPF.
- Validação de telefone com DDD.
- Validação de datas de início e término.
- Validação de senha temporária forte.
- Limites numéricos e mensagens de erro junto aos campos.
- CPF condicional no checkout quando configurado no evento.

## Performance e entrega

- Rotas administrativas isoladas em configuração carregada sob demanda.
- Componentes continuam usando `loadComponent`, gerando chunks separados.
- Service Worker desabilitado em localhost para evitar cache antigo durante desenvolvimento.
