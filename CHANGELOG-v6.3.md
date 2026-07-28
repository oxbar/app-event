# Event Access Platform v6.3

## Correções funcionais

- A portaria passa a aceitar três formatos de identificação:
  - código público `TKT-...`;
  - token opaco do ingresso;
  - URL completa nas rotas `/t/{token}` ou `/ticket/{token}`.
- A validação manual agora utiliza o endpoint `/checkins/manual` e registra `MANUAL_CHECKIN` na auditoria.
- A leitura por câmera continua utilizando `/checkins/scan`.
- Mensagens de recusa diferenciam código manual inválido de QR Code inválido.

## Ingresso digital

- Botão para baixar o ingresso completo em PNG.
- Botão para baixar somente o QR Code em PNG.
- Download disponível na tela de pagamento aprovado e na tela pública do ingresso.
- Imagem do ingresso inclui evento, categoria, participante, data, local, código público e pulseira.

## Consentimento e documentos legais

- Checkbox nativo visível, acessível e independente do tema.
- Aceites separados para Termos de Uso e Política de Privacidade.
- Rotas públicas `/termos-de-uso` e `/politica-de-privacidade`.
- Checkout envia `acceptedTerms` e `acceptedPrivacy` separadamente.

## Testes

- O teste de integração crítico cobre check-in manual por código `TKT-...`.
- O mesmo teste cobre leitura de URL `/ticket/{token}` e tentativa duplicada.
