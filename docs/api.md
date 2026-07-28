# API

A documentação interativa fica em `/swagger-ui/index.html`. Erros seguem o contrato `timestamp`, `status`, `code`, `message`, `fieldErrors` e `traceId`.

## Grupos

- `/api/auth`: login, refresh, logout, recuperação, sessão e troca de organização.
- `/api/organizations`: organizações e membros.
- `/api/events`: eventos, publicação, cancelamento e tipos de ingresso.
- `/api/public`: evento público, checkout, Pix, pedido, status, ingresso e convite.
- `/api/orders`, `/api/payments`, `/api/tickets`, `/api/attendees`: consultas administrativas paginadas.
- `/api/events/{id}/access-points`, `/staff`, `/invitations`: operação do evento.
- `/api/events/{id}/checkins`: scan, entrada manual, histórico e resumo.
- `/api/payments/{id}/refund`, `/api/refunds`: reembolsos.
- `/api/dashboard`, `/reports`, `/audit`: indicadores e governança.
- `/api/webhooks/payments/{provider}` e `/api/dev/payments`: integração e simulação.

Listagens aceitam paginação Spring (`page`, `size`, `sort`) e retornam o contrato paginado padrão.

## Recuperação de senha

| Método | Rota | Observações |
|---|---|---|
| `POST` | `/api/auth/forgot-password` | Público. Resposta genérica, exista ou não a conta. Devolve `message`, `expiresInMinutes`, `emailSent` e — apenas em `development` — `developmentToken`. |
| `POST` | `/api/auth/reset-password` | Público. `204 No Content` em caso de sucesso; `400 INVALID_RESET_TOKEN` para token inválido, expirado ou já utilizado. |

O token trafega somente no e-mail; o banco guarda apenas o hash SHA-256. Um novo
pedido invalida os links anteriores do mesmo usuário e há limite de pedidos por
e-mail dentro de uma janela (`PASSWORD_RESET_MAX_REQUESTS` /
`PASSWORD_RESET_WINDOW_MINUTES`). Concluir a troca revoga todos os refresh tokens.

## Relatórios do evento

| Método | Rota | Resposta |
|---|---|---|
| `GET` | `/api/events/{eventId}/reports/summary` | JSON com pedidos, receita, ingressos, check-ins, taxa de comparecimento e quebra por tipo de ingresso. |
| `GET` | `/api/events/{eventId}/reports/sales` | `text/csv` — vendas (inalterado). |
| `GET` | `/api/events/{eventId}/reports/checkins` | `text/csv` — entradas (inalterado). |
| `GET` | `/api/events/{eventId}/reports/workbook.xlsx` | XLSX com as abas Resumo, Vendas, Ingressos e Entradas. |
| `GET` | `/api/events/{eventId}/reports/sales.xlsx` | XLSX apenas com vendas. |
| `GET` | `/api/events/{eventId}/reports/checkins.xlsx` | XLSX apenas com entradas. |

As rotas XLSX respondem com
`application/vnd.openxmlformats-officedocument.spreadsheetml.sheet` e
`Content-Disposition: attachment`, com nome no formato
`{assunto}-{slug-do-evento}-{AAAAMMDD-HHmm}.xlsx`. Todas exigem que o evento
pertença à organização do token — caso contrário, `404`.

## Diagnóstico (somente `development`)

| Método | Rota | Observações |
|---|---|---|
| `GET` | `/api/dev/e2e/mail` | Caixa de saída em memória; aceita `?recipient=`. Exige perfil administrativo. |
| `DELETE` | `/api/dev/e2e/mail` | Limpa a caixa de saída. |
