# Atualização de interface v4 — pt-BR, validações, lazy loading e menu responsivo

## Escopo

Esta atualização altera apenas o frontend e mantém os contratos da API e o banco de dados.

Principais mudanças:

- tradução visual de situações, perfis, categorias, métodos e resultados para pt-BR;
- `LOCALE_ID` configurado como `pt-BR`, incluindo datas e valores monetários;
- máscaras reutilizáveis para telefone, CPF, CPF/CNPJ, CEP e números inteiros;
- validação de telefone brasileiro, CPF, intervalo de datas e senha temporária forte;
- mensagens de validação junto aos campos;
- checkout com CPF condicional quando o evento exigir documento;
- quantidade do checkout limitada pelo estoque e pelo máximo por pedido;
- rotas administrativas agrupadas e carregadas sob demanda;
- menu lateral recolhível no desktop e drawer no celular;
- fechamento do menu por clique no fundo, navegação ou tecla `Esc`;
- preferência de menu recolhido persistida no navegador;
- Service Worker desativado em `localhost` para evitar frontend antigo após rebuild local;
- tratamentos de erro adicionais nas telas operacionais.

Os códigos de domínio continuam em inglês na API e no banco, por exemplo `PENDING_PAYMENT`. Isso evita quebra de compatibilidade. A interface converte esses códigos para `Pagamento pendente`.

## Aplicação com Git

Execute os comandos na raiz do projeto, onde está o arquivo `docker-compose.yml`.

### 1. Registrar o estado atual

Caso a pasta ainda não seja um repositório Git:

```powershell
git init
git config user.name "Micael Santana"
git config user.email "seu-email@example.com"
git add .
git commit -m "chore: registrar versão funcional antes do patch v4"
```

Caso já seja um repositório, confirme que não existem mudanças pendentes:

```powershell
git status
```

Salve mudanças próprias antes de aplicar o patch:

```powershell
git add .
git commit -m "chore: salvar alterações locais antes do patch v4"
```

### 2. Criar uma tag e uma branch de segurança

```powershell
git tag before-ui-v4
git switch -c feature/ui-ptbr-v4
```

### 3. Copiar o patch para a raiz

Copie `event-access-ui-v4.patch` para a mesma pasta de `docker-compose.yml`.

### 4. Validar sem alterar arquivos

```powershell
git apply --check .\event-access-ui-v4.patch
```

Se não houver saída, o patch pode ser aplicado.

### 5. Aplicar e preparar o commit

```powershell
git apply --index .\event-access-ui-v4.patch
git status
git diff --cached --stat
```

### 6. Criar o commit

```powershell
git commit -m "feat(frontend): interface pt-BR, validações e menu responsivo"
```

## Reconstrução com Podman

A atualização altera somente o frontend. Não é necessário apagar o banco.

```powershell
podman compose build --no-cache frontend
podman compose up -d
podman compose logs -f frontend
```

Para reconstruir tudo:

```powershell
podman compose down --remove-orphans
podman compose up --build -d
podman compose logs -f
```

## Remover o Service Worker antigo uma vez

Uma versão anterior podia registrar Service Worker em `localhost`. Depois de instalar o patch, abra o console do navegador em `http://localhost:4200` e execute uma vez:

```javascript
Promise.all([
  navigator.serviceWorker.getRegistrations().then(registrations =>
    Promise.all(registrations.map(registration => registration.unregister()))
  ),
  caches.keys().then(keys => Promise.all(keys.map(key => caches.delete(key))))
]).then(() => location.reload());
```

A v4 não registra Service Worker em `localhost` ou `127.0.0.1`.

## Validação

```powershell
podman compose exec frontend nginx -t
podman compose ps
```

No navegador, valide:

1. O botão de menu recolhe e reabre a barra lateral no desktop.
2. Em largura móvel, o botão abre um drawer e o fundo fecha o menu.
3. `Esc` fecha o menu móvel.
4. Situações aparecem em português, como `Pagamento pendente` e `Ativo`.
5. Telefone é formatado como `(47) 99999-9999`.
6. CPF inválido é recusado quando o evento exige documento.
7. O término do evento não aceita horário anterior ao início.
8. A quantidade do checkout respeita o limite do ingresso.
9. As páginas continuam acessíveis por URL após atualizar o navegador.

## Rollback

Rollback preservando o histórico:

```powershell
git switch feature/ui-ptbr-v4
git revert HEAD
podman compose build --no-cache frontend
podman compose up -d
```

Retorno imediato à tag anterior, descartando mudanças posteriores da branch atual:

```powershell
git reset --hard before-ui-v4
podman compose build --no-cache frontend
podman compose up -d
```

Use `reset --hard` somente quando não houver arquivos locais que precisem ser preservados.

## Se `git apply --check` falhar

Tente a aplicação em três vias:

```powershell
git apply --3way --index .\event-access-ui-v4.patch
```

Se ainda houver conflito, use o ZIP de arquivos de substituição e revise as diferenças antes do commit:

```powershell
git diff
git add frontend docs
git commit -m "feat(frontend): aplicar atualização de interface v4"
```
