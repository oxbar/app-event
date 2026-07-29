output "app_url" {
  description = "URL publica da aplicacao."
  value       = var.domain_name != "" ? "https://${var.domain_name}" : "https://${module.frontend.domain_name}"
}

output "cloudfront_domain_name" {
  value = module.frontend.domain_name
}

output "cloudfront_distribution_id" {
  value = module.frontend.distribution_id
}

output "frontend_bucket" {
  value = module.frontend.bucket_name
}

output "alb_dns_name" {
  value = module.backend.alb_dns_name
}

output "ecr_repository_url" {
  value = module.ecr.repository_url
}

output "ecs_cluster_name" {
  value = module.backend.cluster_name
}

output "ecs_service_name" {
  value = module.backend.service_name
}

output "ecs_task_family" {
  value = module.backend.task_definition_family
}

output "backend_log_group" {
  value = module.backend.log_group_name
}

output "app_secret_name" {
  description = "Segredo onde ficam JWT/QR/encryption e as chaves do Asaas."
  value       = module.secrets.app_secret_name
}

output "db_endpoint" {
  value = module.database.endpoint
}

output "db_master_secret_arn" {
  value = module.database.master_user_secret_arn
}

output "sns_alerts_topic_arn" {
  value = module.monitoring.sns_topic_arn
}

output "webhook_url" {
  description = "URL a cadastrar no painel do Asaas."
  value       = "${var.domain_name != "" ? "https://${var.domain_name}" : "https://${module.frontend.domain_name}"}/api/webhooks/payments/asaas"
}

output "ses_dkim_tokens" {
  description = "CNAMEs de DKIM quando o DNS nao esta no Route53."
  value       = var.enable_ses ? module.mail[0].dkim_tokens : []
}
