# v6 — Checkout profissional e Asaas Sandbox

- Redesenho completo e responsivo das páginas públicas de evento e pagamento.
- Correção do armazenamento da imagem Base64 do QR Code (`TEXT`, não `VARCHAR(500)`).
- Implementação de `AsaasPaymentProvider` com cliente, cobrança PIX e QR Code dinâmico.
- Reuso de cobrança por `externalReference` para recuperação após timeout e idempotência.
- Webhook Asaas autenticado por `asaas-access-token` e idempotente pelo ID do evento.
- Sincronização manual da cobrança para homologação sem webhook público.
- Aprovação manual limitada ao provedor FAKE; cobrança Asaas não pode ser aprovada artificialmente.
- Reembolso e cancelamento encaminhados ao provedor ativo.
- Dashboard passa a contar somente ingressos emitidos e atualiza a cada 15 segundos.
- Faturamento atualizado automaticamente quando o pedido muda para `PAID`.
- Mensagens do provedor convertidas em erros seguros e compreensíveis.
