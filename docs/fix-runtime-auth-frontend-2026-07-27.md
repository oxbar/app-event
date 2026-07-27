# Correção de autenticação e erros do frontend — 27/07/2026

## Problemas corrigidos

- Respostas `403 Forbidden` em todas as APIs privadas após login.
- Reconstrução do principal autenticado acessando relacionamento JPA `LAZY` fora de transação.
- Access token expirado sendo enviado ao endpoint de refresh e bloqueando a renovação da sessão.
- Ausência de resposta JSON padronizada para `401` e `403`.
- Header `Authorization` explicitamente encaminhado pelo Nginx.
- Erro Angular `NG0201` causado por `tuiSelect` sem `FormControl`.
- Exceções RxJS não tratadas nas telas de dashboard e eventos.
- Estados de erro e repetição de carregamento nas telas principais.

## Arquivos principais alterados

- `backend/src/main/java/com/eventaccess/platform/security/PrincipalService.java`
- `backend/src/main/java/com/eventaccess/platform/security/JwtAuthenticationFilter.java`
- `backend/src/main/java/com/eventaccess/platform/config/SecurityConfig.java`
- `frontend/nginx.conf`
- `frontend/src/app/core/http.ts`
- `frontend/src/app/core/auth.service.ts`
- `frontend/src/app/core/api-error.ts`
- `frontend/src/app/layout/shell.component.ts`
- `frontend/src/app/features/dashboard.component.ts`
- `frontend/src/app/features/events.component.ts`
- `frontend/src/app/features/door.component.ts`
- `frontend/src/app/features/reports.component.ts`
- `frontend/src/app/features/operations.component.ts`

## Observação sobre `content.js`

Erros com origem em `content.js` e mensagens sobre `message channel closed` são gerados por extensões do navegador. Eles não fazem parte do bundle Angular. Para confirmar, abra a aplicação em janela anônima com extensões desativadas.
