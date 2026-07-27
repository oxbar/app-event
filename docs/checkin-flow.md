# Fluxo de check-in

1. A portaria envia token, evento, access point e identificador do dispositivo.
2. O backend valida tenant, evento, portaria ativa e autorização do funcionário.
3. O token é normalizado e convertido em SHA-256; nenhum dado pessoal existe no QR Code.
4. Status, pedido pago e período de validade são validados.
5. A aprovação executa:

```sql
UPDATE tickets
SET status = 'USED', checked_in_at = NOW(), updated_at = NOW(), version = version + 1
WHERE id = :ticketId AND status = 'VALID';
```

6. Somente uma linha atualizada significa entrada aprovada.
7. Zero linhas força nova leitura do estado para explicar `ALREADY_USED` ou outra recusa.
8. Toda tentativa, inclusive QR inválido, é registrada em `checkins` com motivo, funcionário, portaria, IP e horário.
