# Suíte end-to-end

Cobre o roteiro de homologação inteiro contra a stack real: navegador → frontend →
backend → Postgres. Não há mock em lugar nenhum.

## Antes de rodar

```bash
podman compose up -d          # ou make up
npm install                   # traz o @playwright/test
npm run e2e:install           # baixa o Chromium (uma vez)
```

O backend precisa de **duas** coisas:

| Variável | Valor para e2e | Por quê |
|---|---|---|
| `APP_ENVIRONMENT` | `development` | expõe `/api/dev/payments/**` |
| `PAYMENT_PROVIDER` | `FAKE` | o Asaas recusa aprovação manual, e está certo |

Com `PAYMENT_PROVIDER=ASAAS` o backend responde `MANUAL_APPROVAL_NOT_ALLOWED` — a trava
existe justamente para impedir que alguém marque cobrança real como paga por endpoint
interno. Não desligue essa trava; use o provedor local.

Use o arquivo pronto na raiz do repositório:

```bash
podman compose --env-file .env.e2e up -d --build
```

Ele reaproveita o banco e as demais variáveis, trocando apenas o provedor de pagamento.
Levar o sandbox do Asaas para dentro da suíte traria rede externa, latência e um serviço
de terceiro no caminho crítico — três motivos para o teste falhar sem que o produto tenha
problema.

O caminho Asaas continua coberto: é o roteiro manual de homologação, com
`approve-asaas-payment.ps1` e o botão **Sincronizar**.

## Rodar

```bash
npm run e2e:full              # recria a stack com .env.e2e (FAKE), valida e executa tudo
npm run e2e                   # tudo
npm run e2e -- 05-door        # só a portaria
npm run e2e:ui                # modo interativo
npm run e2e:report            # relatório HTML da última execução
npm run lint:e2e              # só checagem de tipos, sem navegador
```

`e2e:full` é o comando seguro para homologação completa: ele força a reconstrução
com `PAYMENT_PROVIDER=FAKE` e interrompe antes dos cenários caso a imagem ainda
esteja em Asaas ou fora do ambiente de desenvolvimento. Isso evita que uma falha
de configuração apareça como dezenas de timeouts no checkout.

Por padrão, tanto o navegador quanto o cliente auxiliar da suíte usam
`http://localhost:4200`. As chamadas `/api` passam pelo proxy do Angular/Nginx.
Isso evita atingir por engano outra aplicação que esteja ocupando a porta 8080
do host.

Para usar endereços diferentes ou acessar o backend diretamente:

```bash
E2E_BASE_URL=http://localhost:8081 E2E_API_URL=http://localhost:9090 npm run e2e
```

## Como está organizada

| Arquivo | Passos do roteiro |
|---|---|
| `01-event-setup` | 1, 2 — criação, lotes, publicação |
| `02-operations` | 3, 4 — portaria, membro, vínculo, convite |
| `03-checkout-pix` | 5, 6 — compra, Pix pendente, aprovação, webhook duplicado |
| `04-digital-ticket` | 7 — QR, pulseira, acesso anônimo, copiar código |
| `05-door-checkin` | 9 a 12 — liberação, duplicidade, evento errado, bloqueio |
| `06-permissions` | 18 — bloqueio por perfil na interface **e** na API |
| `07-reports-audit` | 17, 19 — CSVs e trilha de auditoria |
| `08-inventory` | teste extra — estoque sob concorrência |

## Duas decisões que valem explicação

**Cada arquivo cria seu próprio evento.** O `RUN_ID` entra no slug, no e-mail do
operador e no nome do evento. Sem isso, a segunda execução esbarraria em e-mail
duplicado, estoque consumido e ingressos antigos já expirados — o mesmo problema que
o roteiro manual resolve pedindo um evento exclusivo.

**A portaria é testada pelo campo manual, não pela câmera.** Simular vídeo em CI é
frágil e testaria o driver do navegador, não a regra. O campo manual chega ao mesmo
`POST /api/events/{id}/checkins/manual` e passa pelo mesmo `UPDATE ... WHERE status =
'VALID'`. A invariante sob teste é a mesma; só o caminho de entrada muda.

Vale notar: a guarda de releitura de 3 segundos da câmera **não** se aplica ao campo
manual. Por isso o teste de entrada duplicada consegue validar duas vezes seguidas
sem esperar.

## Setup por API, verificação por interface

Evento, lotes e publicação são criados via API; checkout, portaria e permissões são
percorridos no navegador. É proposital: quando o teste da portaria falha, a causa é a
portaria — não o formulário de cadastro de lote três telas atrás.
