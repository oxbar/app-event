module "stack" {
  source = "../../modules/stack"

  providers = {
    aws           = aws
    aws.us_east_1 = aws.us_east_1
  }

  project     = "event-access"
  environment = "prod"
  aws_region  = var.aws_region
  account_id  = data.aws_caller_identity.current.account_id

  # --- Rede: um NAT por AZ, endpoints privados ----------------------------
  vpc_cidr                   = "10.30.0.0/16"
  availability_zones         = ["sa-east-1a", "sa-east-1b", "sa-east-1c"]
  single_nat_gateway         = false
  enable_interface_endpoints = true
  enable_flow_logs           = true

  # --- Dominio ------------------------------------------------------------
  domain_name     = var.domain_name
  domain_aliases  = ["www.${var.domain_name}"]
  route53_zone_id = var.route53_zone_id

  # --- Banco --------------------------------------------------------------
  db_instance_class               = "db.t4g.medium"
  db_allocated_storage            = 50
  db_max_allocated_storage        = 300
  db_multi_az                     = true
  db_backup_retention_period      = 30
  db_deletion_protection          = true
  db_skip_final_snapshot          = false
  db_performance_insights_enabled = true
  db_enhanced_monitoring_interval = 60

  # --- Backend ------------------------------------------------------------
  task_cpu         = 1024
  task_memory      = 2048
  cpu_architecture = "X86_64"
  desired_count    = 2
  min_capacity     = 2
  max_capacity     = 10
  use_fargate_spot = false
  log_retention_days = 90

  # --- Aplicacao ----------------------------------------------------------
  # 'production' ativa o ProductionConfigurationValidator: segredos fracos
  # ou ASAAS_SANDBOX=true derrubam o boot de proposito.
  app_environment  = "production"
  payment_provider = "ASAAS"
  asaas_base_url   = "https://api.asaas.com/v3"
  asaas_sandbox    = false

  # --- E-mail -------------------------------------------------------------
  enable_ses          = true
  mail_domain         = var.domain_name
  mail_from_address   = "nao-responda@${var.domain_name}"
  mail_from_name      = "Event Access"
  mail_from_subdomain = "mail"
  dmarc_report_email  = var.dmarc_report_email

  # --- CDN / alertas ------------------------------------------------------
  cloudfront_price_class = "PriceClass_200"
  enable_waf             = true
  waf_rate_limit         = 3000
  alert_emails           = var.alert_emails
}
