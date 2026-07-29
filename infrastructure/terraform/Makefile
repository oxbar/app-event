# Atalhos para operar a infra. Uso: make plan ENV=prod
ENV ?= dev
DIR  = envs/$(ENV)

.PHONY: init plan apply destroy output fmt validate lint secret redeploy logs

init:
	cd $(DIR) && terraform init -reconfigure

plan: init
	cd $(DIR) && terraform plan -lock-timeout=5m -out=tfplan

apply:
	cd $(DIR) && terraform apply -lock-timeout=5m tfplan

destroy:
	cd $(DIR) && terraform destroy -lock-timeout=5m

output:
	cd $(DIR) && terraform output

fmt:
	terraform fmt -recursive .

validate:
	cd $(DIR) && terraform init -backend=false && terraform validate

lint:
	tflint --recursive
	tfsec .

# Força novo rollout sem trocar a imagem (util apos rotacionar segredos).
redeploy:
	aws ecs update-service \
	  --cluster $$(cd $(DIR) && terraform output -raw ecs_cluster_name) \
	  --service $$(cd $(DIR) && terraform output -raw ecs_service_name) \
	  --force-new-deployment

logs:
	aws logs tail $$(cd $(DIR) && terraform output -raw backend_log_group) --follow
