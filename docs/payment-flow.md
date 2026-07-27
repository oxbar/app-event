# Fluxo de pagamento

1. O checkout bloqueia os tipos de ingresso, valida janela, limite e capacidade e incrementa `reserved_quantity`.
2. O pedido e seus ingressos individuais são criados como `PENDING_PAYMENT`.
3. O provider gera o Pix e a API persiste o pagamento `PENDING`.
4. O webhook valida assinatura, serializa o payload e registra `(provider, provider_event_id)` em transação independente.
5. Eventos repetidos não são inseridos e não repetem efeitos.
6. O serviço bloqueia pagamento, pedido e tipos de ingresso; valida estado, valor, moeda e expiração.
7. Reservas viram vendas, ingressos viram `VALID`, os hashes dos tokens são gravados e pedido/pagamento viram pagos.
8. Falha ou expiração libera a reserva e invalida os ingressos pendentes.

O `FakePaymentProvider` permite aprovação, falha, expiração e webhook duplicado sem conta externa, mas usa o mesmo `PaymentService` da integração real.
