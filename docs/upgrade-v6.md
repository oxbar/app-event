# Atualização v6 por Git

## Pré-requisitos

- Projeto na versão v5.
- Git instalado.
- Alterações locais salvas em commit ou stash.
- Podman Machine ativa.

## Aplicar

Na raiz do projeto:

```powershell
git status
git add .
git commit -m "chore: salvar estado antes da v6"
git tag before-asaas-v6
git switch -c feature/asaas-pix-v6
```

Copie `event-access-platform-v6.patch` e `apply-event-access-platform-v6.ps1` para a raiz e execute:

```powershell
powershell -ExecutionPolicy Bypass -File .\apply-event-access-platform-v6.ps1
```

Revise e confirme:

```powershell
git status
git diff --cached --stat
git commit -m "feat: integrar Pix Asaas Sandbox e redesenhar checkout"
```

## Banco de dados

A migration `V2__asaas_payment_integration.sql` é automática. Ela:

- altera `payments.pix_qr_code_url` para `TEXT`, necessário para a imagem Base64 do Asaas;
- adiciona o vínculo do participante com o cliente do provedor;
- cria índices de consulta do provedor.

Não apague o volume PostgreSQL para aplicar a atualização.

## Reconstrução

```powershell
podman compose down --remove-orphans
podman compose build --no-cache backend frontend
podman compose up -d
podman compose logs -f backend frontend
```

## Rollback

O rollback do código pode ser feito com:

```powershell
git reset --hard before-asaas-v6
```

A migration V2 é compatível com a versão anterior porque apenas amplia coluna e adiciona campos. Portanto, não é necessário desfazê-la para retornar o código à v5.
