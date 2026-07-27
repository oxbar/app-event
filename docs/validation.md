# Relatório de validação da entrega

Data da geração: 27 de julho de 2026.

## Executado neste ambiente

- Inventário e presença dos arquivos obrigatórios.
- Parsing de JSON, YAML e XML.
- Verificação dos scripts Shell.
- Verificação de sintaxe Java até a resolução de dependências externas.
- Verificação TypeScript até a resolução dos pacotes Angular/Taiga UI.
- Verificação de rotas relativas `/api` e ausência de bibliotecas visuais concorrentes.
- Verificação de tabelas, índices, update atômico de check-in, tenant e estratégia de QR Code.
- Busca por TODOs críticos, `UnsupportedOperationException` e mocks de dados no frontend.

## Não executado neste ambiente

A máquina de geração possui Java 21 e Node.js 22, porém não possui Maven ou Docker e o acesso de shell aos repositórios Maven/npm está bloqueado. Portanto, não foi possível executar de forma honesta:

```bash
cd backend && mvn clean verify
cd frontend && npm install && npm run lint && npm run test -- --watch=false && npm run build
docker compose up --build
```

Esses comandos permanecem configurados no repositório e no CI. A validação integrada deve ser executada em uma máquina com Docker e acesso às dependências antes de produção.
