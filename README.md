# Event Access Platform

Plataforma SaaS de eventos com checkout, Pix, ingresso digital, QR Code individual e controle de entrada concorrente. O repositório contém backend Java/Spring Boot, frontend Angular/Taiga UI e infraestrutura Docker.

## Arquitetura adotada

1. **Backend:** Java 21, Spring Boot 3.5.16, Spring Security, JPA/Hibernate, PostgreSQL, Flyway, JWT, Swagger e ZXing.
2. **Frontend:** Angular 20 LTS, standalone components, Signals, Reactive Forms, Taiga UI 5.16 e PWA.
3. **Pagamento:** `PaymentProvider` desacoplado, com `FakePaymentProvider` e integração Pix `AsaasPaymentProvider` para Sandbox/produção.
4. **Check-in:** token opaco, armazenamento somente do hash e atualização atômica contra uso simultâneo.
5. **Integração:** URLs relativas `/api`; proxy do Angular no desenvolvimento e proxy do Nginx no Docker.

## Estrutura

```text
event-access-platform/
├── backend/
├── frontend/
├── infrastructure/
├── docs/
├── docker-compose.yml
├── .env.example
├── Makefile
├── start.sh
└── start.ps1
```

## Execução completa

Pré-requisitos: Docker Engine e Docker Compose v2.

```bash
cp .env.example .env
docker compose up --build
```

No Windows PowerShell:

```powershell
./start.ps1
```

## URLs

- Frontend: http://localhost:4200
- Backend: http://localhost:8080
- Swagger: http://localhost:8080/swagger-ui/index.html
- Health: http://localhost:8080/actuator/health

## Credenciais de desenvolvimento

| Perfil | E-mail | Senha |
|---|---|---|
| SUPER_ADMIN | admin@eventaccess.local | Admin@123 |
| ORGANIZER_ADMIN | organizer@eventaccess.local | Organizer@123 |
| DOOR_STAFF | door@eventaccess.local | Door@123 |

As contas são criadas somente quando `APP_ENVIRONMENT=development`.

## Teste rápido do fluxo

1. Entre com `organizer@eventaccess.local`.
2. Abra **Eventos** e use o checkout público da **Festa de Verão**.
3. Escolha Comum ou Premium e conclua a identificação.
4. Com `PAYMENT_PROVIDER=FAKE`, aprove a simulação. Com `ASAAS`, confirme a cobrança no painel Sandbox e aguarde o webhook ou use **Sincronizar** em Pagamentos.
5. Abra o ingresso emitido.
6. Entre como `door@eventaccess.local`, abra **Portaria**, selecione evento e portaria e leia o QR Code.
7. A primeira leitura é aprovada; a segunda é recusada como `ALREADY_USED`.

## Comandos de desenvolvimento

Backend:

```bash
cd backend
mvn clean verify
mvn spring-boot:run
```

Frontend:

```bash
cd frontend
npm install
npm run lint
npm run test
npm run build
npm start
```

## Parar e limpar

```bash
docker compose down
docker compose down -v --remove-orphans
```

## Segurança

- BCrypt para senhas.
- Access token curto e refresh token rotativo armazenado como hash.
- Autorização no backend por perfil.
- Consultas administrativas filtradas pela organização autenticada.
- QR token HMAC-SHA-256, sem dados pessoais e sem persistência em texto puro.
- Reserva de estoque com lock pessimista.
- Aprovação idempotente e check-in atômico.
- CORS restritivo, headers de segurança e respostas de erro padronizadas.
- Inicialização em produção é bloqueada quando o JWT usa o segredo padrão.

## Variáveis

Copie `.env.example`. Em produção, substitua obrigatoriamente `JWT_SECRET`, `QR_SECRET`, senha do banco, origens CORS e URLs públicas.

## Gerar o ZIP novamente

```bash
make zip
```

## Escopo entregue

O ZIP implementa de ponta a ponta os fluxos críticos: login, isolamento organizacional, eventos, categorias, checkout, Pix fake ou Asaas, webhook idempotente, emissão, QR Code, portaria, recusa de duplicidade e dashboard. O schema inclui também as entidades previstas para convites, equipe, reembolsos e auditoria, deixando os módulos administrativos secundários preparados para expansão sem alterar o núcleo transacional.

## Atualizações da interface

A versão v5 corrige os seletores de perfil, evento e categoria, adiciona categorias de ingresso em português, color picker da pulseira e tratamento guiado para publicação sem ingressos. Consulte `CHANGELOG-v5.md` e `docs/ui-patch-v5.md`.


## Asaas Sandbox

Use `.env.asaas.example` como base. Você precisará da API Key de Sandbox e de um token próprio para o webhook. Não envie nem versione esses segredos. O guia completo está em `docs/asaas-sandbox.md`.

```powershell
Copy-Item .env.asaas.example .env
notepad .env
podman compose up --build -d
```

A versão v6 também corrige o checkout público, o armazenamento do QR Code Base64 e a atualização automática do faturamento. Consulte `CHANGELOG-v6.md`.


## Atualização v6.3

A versão v6.3 fecha o fluxo operacional do ingresso e da portaria:

- check-in manual por código público `TKT-...`;
- leitura por token opaco ou URL completa `/t/{token}` e `/ticket/{token}`;
- download do ingresso completo em PNG;
- download separado do QR Code;
- aceite visível e separado dos Termos de Uso e da Política de Privacidade;
- páginas públicas `/termos-de-uso` e `/politica-de-privacidade`;
- auditoria do check-in manual pelo endpoint `/checkins/manual`.

Consulte `CHANGELOG-v6.3.md` e `docs/v6.3-checkin-ticket-legal.md`.

## Recursos operacionais recentes

- tema claro/escuro persistente e integrado ao Taiga UI;
- recuperação de senha com token de uso único e envio SMTP;
- Mailpit local em `http://localhost:8025`;
- relatórios de vendas e entradas em CSV e Excel (`.xlsx`).

Detalhes de configuração: [`docs/theme-password-reports-v7.md`](docs/theme-password-reports-v7.md).
