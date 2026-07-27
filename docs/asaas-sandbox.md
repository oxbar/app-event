# Integração Pix — Asaas Sandbox

## Arquitetura implementada

O checkout usa a jornada de cobrança Pix adequada para um pedido individual:

1. O backend cria ou reaproveita o cliente no Asaas.
2. Cria uma cobrança `PIX` em `POST /v3/payments`.
3. Usa o código público do pedido em `externalReference` para conciliação e idempotência.
4. Recupera o QR Code dinâmico em `GET /v3/payments/{id}/pixQrCode`.
5. Armazena apenas o identificador da cobrança, payload Pix, imagem e resposta operacional necessária.
6. O Asaas envia `PAYMENT_RECEIVED` ao webhook.
7. O webhook valida `asaas-access-token`, impede evento duplicado e aprova o pedido em transação.
8. A aprovação emite os ingressos e o dashboard passa a somar o pedido pago.

O QR Code dinâmico é usado no checkout porque é individual, possui vencimento e aceita somente um pagamento. O QR Code estático permanece como ferramenta complementar de homologação do Sandbox, não como QR principal dos pedidos.

## Credenciais necessárias

Não envie segredos pelo chat nem faça commit deles. Configure localmente:

- `ASAAS_API_KEY`: API Key da conta Sandbox.
- `ASAAS_WEBHOOK_TOKEN`: token aleatório de 32 a 255 caracteres, diferente da API Key.
- `ASAAS_USER_AGENT`: identificação da aplicação, por exemplo `event-access-platform/1.0`.
- Uma chave Pix cadastrada na conta Sandbox é recomendada para manter o fluxo dinâmico estável.

Gere o token do webhook no PowerShell:

```powershell
.\infrastructure\scripts\generate-asaas-webhook-token.ps1
```

## Configuração

```powershell
Copy-Item .env.asaas.example .env
notepad .env
```

Preencha. Use aspas simples na API Key porque as chaves Asaas normalmente começam com `$`, caractere que o Compose pode tentar interpolar:

```text
PAYMENT_PROVIDER=ASAAS
ASAAS_BASE_URL=https://api-sandbox.asaas.com/v3
ASAAS_API_KEY='$aact_hmlg_...'
ASAAS_WEBHOOK_TOKEN=token-aleatorio-com-32-ou-mais-caracteres
ASAAS_USER_AGENT=event-access-platform/1.0
ASAAS_SANDBOX=true
```

Reconstrua o backend:

```powershell
podman compose down --remove-orphans
podman compose build --no-cache backend frontend
podman compose up -d
podman compose logs -f backend
```

## Webhook em desenvolvimento local

O Asaas não consegue chamar `localhost`. Exponha apenas o backend por um túnel HTTPS.

Exemplo com Cloudflare Tunnel:

```powershell
cloudflared tunnel --url http://localhost:8080
```

Copie a URL HTTPS exibida e configure no painel Sandbox:

```text
https://SEU-TUNEL.trycloudflare.com/api/webhooks/payments/asaas
```

No webhook do Asaas:

- envie os eventos de pagamento;
- use o mesmo token de `ASAAS_WEBHOOK_TOKEN` como token de autenticação;
- mantenha o endpoint ativo;
- acompanhe as entregas em **Integrações > Logs de Webhook**.

Eventos essenciais:

```text
PAYMENT_CREATED
PAYMENT_UPDATED
PAYMENT_RECEIVED
PAYMENT_CONFIRMED
PAYMENT_OVERDUE
PAYMENT_DELETED
PAYMENT_REFUNDED
PAYMENT_PARTIALLY_REFUNDED
```

## Como confirmar uma cobrança no Sandbox

A documentação atual do Asaas informa que cobranças Sandbox não possuem endpoint de confirmação via API. Para a cobrança dinâmica criada pelo checkout:

1. Entre no painel Sandbox.
2. Abra a cobrança criada para o pedido.
3. Clique em **CONFIRMAR PAGAMENTO**.
4. O webhook deve alterar o pedido para `PAID`.
5. Sem webhook público, entre como organizador, abra **Pagamentos** e clique em **Sincronizar**.

A interface pública consulta somente a API local. Ela não faz polling contínuo no Asaas.

## Teste complementar de QR Code estático

O Sandbox oferece um fluxo separado para validar pagamento de QR Code por API:

1. Cadastre uma chave Pix no Sandbox.
2. Crie um QR Code estático em `POST /v3/pix/qrCodes/static`.
3. Use o `payload` retornado em `POST /v3/pix/qrCodes/pay`.
4. Valide os webhooks e a cobrança criada automaticamente.

Esse fluxo testa a infraestrutura Pix do Sandbox, mas não substitui a cobrança dinâmica por pedido usada pelo Event Access.

## Diagnóstico

### Backend não inicia

Confira:

```powershell
podman compose logs backend
```

Erros mais comuns:

- API Key vazia, curta ou do ambiente de produção;
- token do webhook com menos de 32 caracteres;
- `PAYMENT_PROVIDER` diferente de `ASAAS`;
- URL base incorreta.

### Erro 502 ao gerar Pix

O backend transforma falhas do provedor em `PAYMENT_PROVIDER_ERROR` sem expor a API Key. Verifique a mensagem da tela e os logs do backend.

### Pagamento confirmado no Asaas, mas pedido pendente

1. Confira os Logs de Webhook no Asaas.
2. Confirme que a URL pública termina em `/api/webhooks/payments/asaas`.
3. Confirme o header/token `asaas-access-token`.
4. No painel Event Access, abra **Pagamentos** e use **Sincronizar**.

### Faturamento não atualizou

O dashboard soma apenas pedidos com status `PAID`. Após webhook ou sincronização:

- pagamento = `APPROVED`;
- pedido = `PAID`;
- ingressos = `VALID`;
- faturamento inclui `orders.total_amount`.

O dashboard atualiza automaticamente a cada 15 segundos e também possui botão **Atualizar**.
