# Infraestrutura AWS — Event Access Platform

Terraform + CI/CD para publicar o monorepo (Spring Boot 3 + Angular/Taiga UI + PostgreSQL) na AWS.

---

## 1. Arquitetura

```
                    Internet
                       │
              ┌────────▼─────────┐
              │   CloudFront     │  ← WAF (managed rules + rate limit)
              │  + ACM us-east-1 │
              └───┬──────────┬───┘
        /* (SPA)  │          │  /api/*  (header secreto x-origin-verify)
              ┌───▼────┐  ┌──▼──────────────┐
              │  S3    │  │  ALB (público)  │
              │ (OAC)  │  └──┬──────────────┘
              └────────┘     │  subnets privadas
                        ┌────▼─────────────┐
                        │ ECS Fargate      │──► Secrets Manager (KMS)
                        │ Spring Boot :8080│──► SES SMTP (:587)
                        └────┬─────────────┘──► Asaas (via NAT)
                             │  subnets de dados
                        ┌────▼─────────────┐
                        │ RDS PostgreSQL 17│
                        └──────────────────┘
```

**Por que CloudFront na frente de tudo:** o Angular chama `/api/...` com URL relativa
(`frontend/src/app/core/api.services.ts`). Servindo SPA e API sob o mesmo host, o
comportamento fica idêntico ao `proxy_pass` do `frontend/nginx.conf` local — sem
CORS entre browser e API, e sem tocar em uma linha do frontend.

### Decisões que fogem do padrão

| Decisão | Motivo |
|---|---|
| Rota do SPA via **CloudFront Function**, não `custom_error_response` | `custom_error_response` vale para a distribuição inteira: um 404 legítimo da API viraria `index.html` com HTTP 200 |
| ALB aceita só a **prefix list da CloudFront** + header secreto | Sem isso o DNS do ALB fica exposto e o WAF vira decoração |
| `/api/webhooks/*` **isento** do rate limit do WAF | Bloquear o Asaas por rate limit = pagamento confirmado sem ingresso emitido |
| Senha do RDS **gerenciada pelo próprio RDS** | Nunca entra no `terraform.tfstate` |
| `ignore_changes` em `task_definition` no serviço ECS | O Terraform cria a infra; o pipeline de aplicação é dono da imagem |
| `deployment_circuit_breaker` com rollback | Se o Flyway ou o `ProductionConfigurationValidator` derrubarem as tasks novas, volta sozinho |

---

## 2. Estrutura

```
infrastructure/terraform/
├── bootstrap/          state S3 + lock DynamoDB + OIDC + roles de CI  (aplicar 1x)
├── modules/
│   ├── network/        VPC 3 camadas, NAT, VPC endpoints, flow logs
│   ├── secrets/        KMS + Secrets Manager (JWT, QR, encryption, Asaas)
│   ├── database/       RDS PostgreSQL 17, force_ssl, storage autoscaling
│   ├── ecr/            registry + lifecycle policy
│   ├── backend/        ALB + ECS Fargate + autoscaling + logs
│   ├── frontend/       S3 + OAC + CloudFront + WAF + CloudFront Function
│   ├── mail/           SES (DKIM/SPF/DMARC) + credenciais SMTP
│   ├── monitoring/     SNS + alarmes + dashboard
│   └── stack/          compõe tudo acima
└── envs/
    ├── dev/            1 task spot, NAT único, sem WAF, Asaas sandbox
    └── prod/           Multi-AZ, WAF, SES, deletion protection
```

---

## 3. Subida do zero

### 3.1 Bootstrap (uma vez por conta)

```bash
cd infrastructure/terraform/bootstrap
terraform init
terraform apply \
  -var 'github_subject_claims=["repo:oxbar/app-event:ref:refs/heads/main","repo:oxbar/app-event:environment:dev","repo:oxbar/app-event:environment:prod","repo:oxbar/app-event:pull_request"]'
```

Anote os quatro outputs: `state_bucket`, `lock_table`, `ci_terraform_role_arn`, `ci_deploy_role_arn`.

> Para GitLab: `-var enable_gitlab_oidc=true -var enable_github_oidc=false` e ajuste
> `gitlab_subject_claims`.

### 3.2 Apontar o backend do state

Em `envs/dev/providers.tf` e `envs/prod/providers.tf`, troque `event-access-tfstate-CHANGE_ME`
pelo bucket real — ou passe via `-backend-config` (é o que o CI faz).

### 3.3 Ambiente dev

```bash
cd infrastructure/terraform/envs/dev
terraform init -backend-config="bucket=<state_bucket>"
terraform apply
```

**Dev sem domínio próprio precisa de dois applies.** A URL pública só existe depois
que a CloudFront é criada, então no primeiro apply `APP_BASE_URL` fica em `localhost`.
Pegue o output `app_url`, coloque em `public_base_url` no `envs/dev/main.tf` e rode de novo.
Com domínio próprio (prod) isso não acontece.

### 3.4 Ambiente prod

Preencha `envs/prod/terraform.tfvars` (`domain_name`, `route53_zone_id`,
`dmarc_report_email`, `alert_emails`) e:

```bash
cd infrastructure/terraform/envs/prod
terraform init -backend-config="bucket=<state_bucket>"
terraform apply
```

O apply cria os certificados ACM (borda em us-east-1 + regional para o ALB), valida por
DNS no Route 53 e publica os registros de DKIM/SPF/DMARC. **Domínio fora do Route 53:**
deixe `route53_zone_id = ""`, crie os CNAMEs de validação manualmente e use o output
`ses_dkim_tokens` para o DKIM.

---

## 4. Segredos

O Terraform gera `JWT_SECRET`, `QR_SECRET` e `DATA_ENCRYPTION_SECRET` com 64 caracteres
aleatórios — passam direto no seu `ProductionConfigurationValidator`. As chaves do Asaas
entram como `REPLACE_ME` e são gravadas fora do Terraform:

```bash
SECRET=$(terraform output -raw app_secret_name)

# Preserva os valores existentes e substitui só o que é do Asaas
aws secretsmanager get-secret-value --secret-id "$SECRET" \
  --query SecretString --output text \
| jq --arg k "$ASAAS_API_KEY" --arg t "$ASAAS_WEBHOOK_TOKEN" \
     '.asaas_api_key=$k | .asaas_webhook_token=$t' \
| aws secretsmanager put-secret-value --secret-id "$SECRET" --secret-string file:///dev/stdin

# Aplica o novo valor (tasks só releem segredos ao iniciar)
aws ecs update-service --cluster <cluster> --service <service> --force-new-deployment
```

O `secret_string` está com `ignore_changes`: rotacionar pelo console ou CLI não é
revertido no próximo apply.

> **A chave e o token do Asaas que estavam no `.env` compartilhado devem ser considerados
> comprometidos.** Gere novos no painel antes de usar.

### Webhook do Asaas

```
https://<seu-dominio>/api/webhooks/payments/asaas
```

Também disponível como output `webhook_url`. O `WebhookController` já é idempotente e o
WAF não aplica rate limit nesse caminho.

---

## 5. E-mail

O Mailpit do `docker-compose.yml` é substituído por SES SMTP. A task recebe
`MAIL_HOST=email-smtp.<região>.amazonaws.com`, `MAIL_PORT=587`, `MAIL_SMTP_AUTH=true`,
`MAIL_SMTP_STARTTLS=true`, e usuário/senha vindos do Secrets Manager.

⚠️ **Divergência encontrada no seu `.env`:** ele define `MAIL_STARTTLS`, mas o
`application.yml` lê `MAIL_SMTP_STARTTLS`. Localmente o STARTTLS está desligado sem
querer. A task definition usa o nome correto.

Contas SES novas começam em **sandbox** (só envia para endereços verificados). Peça a
saída do sandbox antes de abrir o "Esqueci minha senha" para o público.

---

## 6. CI/CD

### GitHub Actions

`Settings → Secrets and variables → Actions → Variables`:

| Variable | Valor |
|---|---|
| `AWS_TERRAFORM_ROLE_ARN` | output `ci_terraform_role_arn` |
| `AWS_DEPLOY_ROLE_ARN` | output `ci_deploy_role_arn` |
| `TF_STATE_BUCKET` | output `state_bucket` |
| `TF_LOCK_TABLE` | output `lock_table` |

Crie os *environments* `dev` e `prod` (`Settings → Environments`) e exija aprovação em `prod`.

- **`infra.yml`** — `fmt`/`validate`/`tflint`/`tfsec`, plan comentado no PR, apply na `main` com aprovação de environment
- **`deploy.yml`** — testes → imagem no ECR → nova revisão da task definition → rollout com `wait-for-service-stability` → S3 + invalidação → smoke test

Autenticação por OIDC: nenhuma chave estática no repositório.

### GitLab CI

Mesmo pipeline em `.gitlab-ci.yml`. Variáveis: `AWS_TERRAFORM_ROLE`, `AWS_DEPLOY_ROLE`,
`TF_STATE_BUCKET`, `TF_LOCK_TABLE`. **Use um ou outro, não os dois no mesmo repositório.**

### Migrations

O rollout roda com `minimum_healthy_percent = 100`: task antiga e nova convivem por alguns
minutos. **As migrations do Flyway precisam ser backward-compatible** — adicionar coluna
`NOT NULL` sem default, ou dropar coluna ainda usada, quebra a versão antiga durante a
transição. Padrão seguro: expand → migrar dados → contract em um deploy posterior.

---

## 7. Operação

```bash
# Logs em tempo real
aws logs tail /ecs/event-access-prod/backend --follow

# Shell numa task (enable_execute_command já está ligado)
aws ecs execute-command --cluster event-access-prod-cluster \
  --task <task-id> --container backend --interactive --command "/bin/sh"

# Rollback para a revisão anterior
aws ecs update-service --cluster event-access-prod-cluster \
  --service event-access-prod-backend --task-definition event-access-prod-backend:<N-1>

# Estado do rollout
aws ecs describe-services --cluster event-access-prod-cluster \
  --services event-access-prod-backend --query 'services[0].deployments'
```

Dashboard: CloudWatch → `event-access-prod-overview`.
Alarmes vão para o tópico SNS — **cada e-mail em `alert_emails` precisa confirmar a inscrição.**

---

## 8. Custos

Estimativa mensal em `sa-east-1`, tráfego baixo. Confirme no AWS Pricing Calculator.

| | dev | prod |
|---|---|---|
| NAT Gateway | ~US$ 35–70 (1) | ~US$ 105–210 (3) |
| RDS | ~US$ 20 (t4g.micro) | ~US$ 130–160 (t4g.medium Multi-AZ) |
| Fargate | ~US$ 8 (1× spot) | ~US$ 60–70 (2× on-demand) |
| ALB | ~US$ 25 | ~US$ 25 |
| CloudFront + S3 + WAF | ~US$ 5 | ~US$ 15–25 |
| Logs, KMS, Secrets, PI | ~US$ 5 | ~US$ 15 |
| **Total aproximado** | **US$ 100–135** | **US$ 350–500** |

**Cuidado com `enable_interface_endpoints = true`** (ligado em prod): são 5 endpoints ×
3 AZ ≈ 15 ENIs a ~US$ 0,01/h ≈ **US$ 110/mês**. Só compensa com volume alto de tráfego
para ECR/Logs/Secrets. Comece com `false` e ligue quando a linha de dados do NAT justificar.

**Reduções fáceis em dev:** `single_nat_gateway = true` (já está), `use_fargate_spot = true`
(já está), e desligar o ambiente fora do horário comercial com `desired_count = 0`.

---

## 9. Checklist antes de abrir para o público

- [ ] Chaves do Asaas rotacionadas e gravadas no Secrets Manager
- [ ] `asaas_sandbox = false` e `asaas_base_url = https://api.asaas.com/v3` em prod
- [ ] Webhook cadastrado no painel do Asaas apontando para o domínio real
- [ ] SES fora do sandbox; DKIM verificado; DMARC publicado
- [ ] Inscrições SNS confirmadas
- [ ] `db_deletion_protection = true` e `db_skip_final_snapshot = false` (já em prod)
- [ ] Restore de backup testado ao menos uma vez
- [ ] `enable_waf = true` e rate limit calibrado com tráfego real
- [ ] Environment `prod` do CI com aprovação obrigatória

## 10. O que não está incluído

Fora do escopo desta entrega, vale mapear depois: Route 53 health checks com failover
regional, replicação cross-region do RDS, backup do Secrets Manager, WAF em modo `COUNT`
antes de bloquear, testes e2e Playwright no pipeline, e distributed tracing
(X-Ray ou OpenTelemetry).
