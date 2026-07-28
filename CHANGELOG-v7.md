# Event Access Platform — v7.0

Três entregas: tema claro/escuro funcionando de verdade, recuperação de senha
com notificação por e-mail e exportação de relatórios em XLSX. O CSV, os
endpoints e a suíte end-to-end existentes seguem intactos.

---

## 1. Tema claro e escuro — correção de causa raiz

**O que estava errado.** O atributo `tuiTheme` era aplicado no `<tui-root>`,
mas as variáveis de cor (`--bg`, `--surface`, `--text`) nascem em `:root` e o
`body` as consome. Com o atributo preso a um elemento interno, o `body` ficava
fora do escopo do override: o fundo continuava claro e o tema escuro aparecia
pela metade. Não havia leitura de `prefers-color-scheme`, a barra lateral tinha
`#111116` cravado e as telas de login/recuperação não ofereciam nenhum controle.

**O que mudou.**

| Antes | Agora |
| --- | --- |
| `tuiTheme` no `<tui-root>` | `tuiTheme` no `<html>` e no `<body>` |
| Dois estados (claro/escuro) | `light`, `dark` e `system` |
| Ignorava o sistema operacional | `prefers-color-scheme` reativo |
| Cores da sidebar cravadas | Tokens `--sidebar-*`, `--auth-glow`, `--surface-muted` |
| Controle só dentro do painel | `app-theme-toggle` também em login, recuperação e nova senha |
| `<meta theme-color>` fixa | Acompanha o tema (barra do navegador no celular) |

Efeito colateral positivo: overlays do Angular CDK (dropdowns, diálogos) são
montados no `body`, fora do `tui-root`. Com o atributo na raiz, eles passaram a
herdar o tema — antes ficavam claros sobre a tela escura.

Compatibilidade: o valor legado `'dark'` gravado pela versão anterior em
`localStorage` continua sendo lido.

## 2. UI/UX

- Cabeçalho com avatar de iniciais do usuário.
- Relatórios: cartões de resumo, esqueleto de carregamento, `aria-live` no
  status e tabela de vendas por tipo de ingresso.
- Recuperação de senha: estado de "e-mail enviado" com prazo do link e espera
  de 30 s antes do reenvio.
- Nova senha: medidor de força com quatro critérios, confirmação validada e o
  campo de token oculto quando ele já vem no link.
- Login: aviso de senha alterada ao voltar do fluxo de recuperação.
- Foco visível padronizado e alvos de toque preservados.

**Nada de nomenclatura foi renomeado**: `#report-event`, "Exportar vendas" e
"Exportar entradas" continuam com o texto exato, porque a suíte Playwright os
localiza por `getByRole`. Os botões novos usam rótulos que não colidem com
esses seletores.

## 3. Esqueci minha senha, com e-mail

- `MailService`: envia por SMTP quando `app.mail.enabled=true`; caso contrário
  registra no log. **Nunca propaga exceção** — um SMTP fora do ar não pode virar
  erro 500 nem revelar se a conta existe. Mantém uma caixa de saída em memória
  (50 últimas) usada por testes e diagnóstico.
- `MailTemplates`: HTML com estilo inline e versão em texto puro; o link existe
  nas duas. Dados do usuário passam por escape.
- `PasswordResetService`: resposta genérica sempre; apenas o hash SHA-256 vai ao
  banco; um pedido novo invalida os links anteriores; limite de 3 pedidos por
  e-mail a cada 15 minutos; a troca revoga todos os refresh tokens e dispara o
  aviso "sua senha foi alterada".
- `docker compose` sobe o **Mailpit**: caixa de entrada em <http://localhost:8025>.
- Endpoint de diagnóstico `GET /api/dev/e2e/mail` (apenas em `development`).

## 4. Relatórios em XLSX

Novos endpoints, sem tocar nos de CSV:

| Endpoint | Conteúdo |
| --- | --- |
| `GET /api/events/{id}/reports/summary` | JSON com os números consolidados |
| `GET /api/events/{id}/reports/workbook.xlsx` | Resumo, Vendas, Ingressos e Entradas |
| `GET /api/events/{id}/reports/sales.xlsx` | Somente vendas |
| `GET /api/events/{id}/reports/checkins.xlsx` | Somente entradas |

A planilha abre pronta para uso: cabeçalho congelado, filtro automático, linhas
zebradas, largura de coluna coerente e linha de totais. **Dinheiro é número** com
formato `R$` e **data é data** — ordenar por "pago em" funciona, em vez de
ordenar texto. As datas usam o fuso da organização (`Organization.timezone`),
com `REPORTS_TIMEZONE` como reserva.

## 5. Testes

**Backend** — `MailServiceTest`, `MailTemplatesTest`, `PasswordResetServiceTest`,
`ReportServiceTest` (gera o arquivo e o lê de volta com POI, conferindo abas,
tipos de célula e totais) e `ReportEndpointsTest` (MockMvc: MIME e
`Content-Disposition`).

**Frontend** — `theme.service.spec`, `file-download.spec`, `validators.spec`
estendido, `forgot-password.component.spec`, `reset-password.component.spec`,
`reports.component.spec`.

**End-to-end** — `09-password-reset.spec.ts` (pedido → e-mail real → link →
nova senha → login; token de uso único; e-mail inexistente não gera mensagem),
`10-theme.spec.ts` (compara a luminância do `body`, não só o atributo) e
`11-reports-excel.spec.ts` (assinatura ZIP `PK` e presença das abas).

`karma.conf.js` novo, com `ChromeHeadlessNoSandbox` — sem ele a suíte não sobe
em contêiner nem na maioria dos CIs.

## 6. Configuração nova

```
MAIL_ENABLED=true          MAIL_HOST=mailpit        MAIL_PORT=1025
MAIL_FROM=nao-responda@eventaccess.local            MAIL_FROM_NAME=Event Access
MAIL_SMTP_AUTH=false       MAIL_SMTP_STARTTLS=false MAIL_SUBJECT_PREFIX=
PASSWORD_RESET_TTL_MINUTES=30   PASSWORD_RESET_MAX_REQUESTS=3
PASSWORD_RESET_WINDOW_MINUTES=15
REPORTS_TIMEZONE=America/Sao_Paulo
```

Dependências adicionadas ao `backend/pom.xml`: `spring-boot-starter-mail` e
`org.apache.poi:poi-ooxml:5.4.1`.

## 7. Como validar

```bash
podman compose up --build          # ou docker compose up --build
cd backend  && mvn clean verify
cd frontend && npm ci && npm run lint && npm run test && npm run build
cd frontend && npm run e2e         # stack no ar, PAYMENT_PROVIDER=FAKE
```

Para conferir o e-mail de recuperação: peça a troca em `/forgot-password` e
abra <http://localhost:8025>.

## 8. Ressalva honesta sobre a verificação

O patch foi produzido em um ambiente sem Maven, sem acesso ao Maven Central e
sem navegador instalado. Portanto:

- **Verificado aqui:** `ng build`, `tsc -p tsconfig.spec.json --noEmit`,
  `tsc -p tsconfig.e2e.json --noEmit`, `validate-project.py`, checagem estrutural
  dos 106 arquivos Java e conferência automática dos `String.formatted` dos
  templates de e-mail.
- **Não executado:** `mvn clean verify`, Karma e Playwright. Rode-os no seu
  ambiente antes de mesclar — o CI já tem Chrome e Maven.
