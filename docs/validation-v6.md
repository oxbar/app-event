# Validação da versão v6

## Executado neste ambiente

- Patch aplicado sobre uma cópia limpa da v5 com `git apply --check`.
- `git diff --check` sem espaços inválidos.
- 43/43 verificações estruturais aprovadas.
- 35 arquivos TypeScript analisados pelo compilador TypeScript em modo de transpilação: sem erros de sintaxe.
- 92 arquivos Java verificados estruturalmente: delimitadores balanceados.
- ZIPs testados com `unzip -t`.

## Não executado neste ambiente

O ambiente de geração não possui Maven e não conseguiu concluir o acesso ao registry npm. Portanto, os comandos abaixo precisam ser executados pelo Podman na máquina de destino:

```powershell
podman compose build --no-cache backend frontend
podman compose up -d
podman compose logs -f backend frontend
```

A validação funcional do Asaas exige uma API Key Sandbox real e não pode ser simulada sem a credencial da conta.

## Fluxos para validar localmente

1. Backend inicia e Flyway aplica V2.
2. Checkout cria cliente/cobrança no Asaas.
3. QR Code e Pix Copia e Cola aparecem.
4. Confirmação pelo painel Sandbox envia webhook.
5. Pedido muda para `PAID`.
6. Ingressos mudam para `VALID`.
7. Faturamento aparece no dashboard em até 15 segundos.
8. Primeiro check-in é aprovado e o segundo é recusado.
