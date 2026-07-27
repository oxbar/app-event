# Patch v5 — seletores, categorias e cor da pulseira

## Objetivo

Corrigir os campos de seleção que apareciam vazios na interface e tornar o cadastro de ingressos mais claro e operacional.

## Implementação

### Seletor reutilizável

Foi criado `SelectFieldComponent`, baseado em `tuiSelect`, `tuiChevron` e `TuiDataListWrapper`.

Ele recebe:

- `FormControl<string>`;
- lista tipada de valores e rótulos;
- placeholder;
- identificação acessível.

O componente é utilizado em:

- perfil de acesso;
- evento;
- membro;
- portaria;
- tipo de ingresso;
- organização;
- relatórios;
- tela de check-in.

### Categorias de ingresso

O formulário apresenta categorias pré-definidas e traduzidas. Ao selecionar uma categoria, o sistema sugere nome, identificação da pulseira e cor. Todos os valores sugeridos podem ser personalizados antes do envio.

### Color picker

O campo utiliza `tuiInputColor`, mantém o valor hexadecimal esperado pela API e mostra uma prévia circular da pulseira.

### Publicação do evento

Quando o backend responde `TICKET_TYPE_REQUIRED`, a interface:

1. abre o painel de ingressos do evento;
2. mostra a mensagem recebida;
3. rola até o formulário;
4. evita novos cliques enquanto a publicação está em andamento.

## Atualização

Somente o frontend precisa ser reconstruído:

```powershell
podman compose build --no-cache frontend
podman compose up -d frontend
```

O patch não altera migrations ou dados existentes.
