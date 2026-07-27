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
