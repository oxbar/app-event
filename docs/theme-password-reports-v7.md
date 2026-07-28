# Tema, recuperação de senha e relatórios Excel

## Tema claro e escuro

A preferência é persistida em `localStorage` (`event-access-theme`) e aplicada no elemento `<html>` por `data-theme`. Isso mantém as variáveis visuais da aplicação e o tema do Taiga UI sincronizados, inclusive após recarregar a página.

## Recuperação de senha por e-mail

O fluxo usa token aleatório armazenado somente como hash, expira em 30 minutos, invalida solicitações anteriores e revoga sessões ativas depois da troca de senha.

No Docker Compose, o Mailpit recebe os e-mails locais:

- SMTP: `localhost:1025`
- Caixa de entrada: `http://localhost:8025`

Para produção, configure:

```env
MAIL_ENABLED=true
MAIL_HOST=smtp.seu-provedor.com
MAIL_PORT=587
MAIL_USERNAME=usuario
MAIL_PASSWORD=segredo
MAIL_SMTP_AUTH=true
MAIL_STARTTLS=true
MAIL_FROM=no-reply@seudominio.com
APP_BASE_URL=https://app.seudominio.com
```

Nunca use o token de desenvolvimento fora de `APP_ENVIRONMENT=development`.

## Relatórios

A tela de relatórios oferece:

- vendas em CSV;
- vendas em XLSX;
- entradas em CSV;
- entradas em XLSX.

As planilhas XLSX incluem título, evento, data de geração, cabeçalhos formatados, filtros, painel congelado, formatos de moeda/data e totalizadores.

## Validação

```bash
cd backend
mvn test

cd ../frontend
npm run lint
npm test
npm run lint:e2e
npm run e2e:full
```
