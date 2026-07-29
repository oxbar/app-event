locals {
  name_prefix = "${var.project}-${var.environment}"
  has_domain  = var.domain_name != ""

  # URL publica usada em links de e-mail, CORS e retorno do checkout.
  public_url = var.public_base_url != "" ? var.public_base_url : (
    local.has_domain ? "https://${var.domain_name}" : "http://localhost:4200"
  )

  api_domain = local.has_domain ? "api.${var.domain_name}" : ""

  alb_origin_domain = local.has_domain ? local.api_domain : module.backend.alb_dns_name
}

# ---------------------------------------------------------------------------
# Rede
# ---------------------------------------------------------------------------
module "network" {
  source = "../network"

  name_prefix                = local.name_prefix
  aws_region                 = var.aws_region
  vpc_cidr                   = var.vpc_cidr
  availability_zones         = var.availability_zones
  single_nat_gateway         = var.single_nat_gateway
  enable_interface_endpoints = var.enable_interface_endpoints
  enable_flow_logs           = var.enable_flow_logs
}

# ---------------------------------------------------------------------------
# Segredos e registry
# ---------------------------------------------------------------------------
module "secrets" {
  source = "../secrets"

  name_prefix             = local.name_prefix
  recovery_window_in_days = var.secret_recovery_window_in_days
}

module "ecr" {
  source = "../ecr"

  repository_name = "${var.project}-backend"
  kms_key_arn     = module.secrets.kms_key_arn
  force_delete    = var.environment != "prod"
}

# ---------------------------------------------------------------------------
# Banco de dados
# ---------------------------------------------------------------------------
module "database" {
  source = "../database"

  name_prefix                = local.name_prefix
  vpc_id                     = module.network.vpc_id
  subnet_ids                 = module.network.data_subnet_ids
  allowed_security_group_ids = [module.backend.service_security_group_id]
  kms_key_arn                = module.secrets.kms_key_arn

  engine_version               = var.db_engine_version
  instance_class               = var.db_instance_class
  allocated_storage            = var.db_allocated_storage
  max_allocated_storage        = var.db_max_allocated_storage
  multi_az                     = var.db_multi_az
  backup_retention_period      = var.db_backup_retention_period
  deletion_protection          = var.db_deletion_protection
  skip_final_snapshot          = var.db_skip_final_snapshot
  performance_insights_enabled = var.db_performance_insights_enabled
  enhanced_monitoring_interval = var.db_enhanced_monitoring_interval
}

# ---------------------------------------------------------------------------
# E-mail transacional (substitui o Mailpit)
# ---------------------------------------------------------------------------
module "mail" {
  count  = var.enable_ses ? 1 : 0
  source = "../mail"

  name_prefix             = local.name_prefix
  mail_domain             = var.mail_domain
  mail_from_address       = var.mail_from_address
  mail_from_subdomain     = var.mail_from_subdomain
  dmarc_report_email      = var.dmarc_report_email
  route53_zone_id         = var.route53_zone_id
  kms_key_arn             = module.secrets.kms_key_arn
  recovery_window_in_days = var.secret_recovery_window_in_days
}

# ---------------------------------------------------------------------------
# Certificados
# ---------------------------------------------------------------------------
resource "aws_acm_certificate" "cdn" {
  count    = local.has_domain ? 1 : 0
  provider = aws.us_east_1

  domain_name               = var.domain_name
  subject_alternative_names = var.domain_aliases
  validation_method         = "DNS"

  lifecycle {
    create_before_destroy = true
  }
}

resource "aws_acm_certificate" "alb" {
  count = local.has_domain ? 1 : 0

  domain_name       = local.api_domain
  validation_method = "DNS"

  lifecycle {
    create_before_destroy = true
  }
}

resource "aws_route53_record" "cdn_validation" {
  for_each = local.has_domain && var.route53_zone_id != "" ? {
    for dvo in aws_acm_certificate.cdn[0].domain_validation_options : dvo.domain_name => {
      name   = dvo.resource_record_name
      record = dvo.resource_record_value
      type   = dvo.resource_record_type
    }
  } : {}

  zone_id         = var.route53_zone_id
  name            = each.value.name
  type            = each.value.type
  records         = [each.value.record]
  ttl             = 60
  allow_overwrite = true
}

resource "aws_route53_record" "alb_validation" {
  for_each = local.has_domain && var.route53_zone_id != "" ? {
    for dvo in aws_acm_certificate.alb[0].domain_validation_options : dvo.domain_name => {
      name   = dvo.resource_record_name
      record = dvo.resource_record_value
      type   = dvo.resource_record_type
    }
  } : {}

  zone_id         = var.route53_zone_id
  name            = each.value.name
  type            = each.value.type
  records         = [each.value.record]
  ttl             = 60
  allow_overwrite = true
}

resource "aws_acm_certificate_validation" "cdn" {
  count    = local.has_domain && var.route53_zone_id != "" ? 1 : 0
  provider = aws.us_east_1

  certificate_arn         = aws_acm_certificate.cdn[0].arn
  validation_record_fqdns = [for r in aws_route53_record.cdn_validation : r.fqdn]
}

resource "aws_acm_certificate_validation" "alb" {
  count = local.has_domain && var.route53_zone_id != "" ? 1 : 0

  certificate_arn         = aws_acm_certificate.alb[0].arn
  validation_record_fqdns = [for r in aws_route53_record.alb_validation : r.fqdn]
}

# ---------------------------------------------------------------------------
# Backend (ALB + ECS Fargate)
# ---------------------------------------------------------------------------
module "backend" {
  source = "../backend"

  name_prefix        = local.name_prefix
  vpc_id             = module.network.vpc_id
  public_subnet_ids  = module.network.public_subnet_ids
  private_subnet_ids = module.network.private_subnet_ids

  container_image = var.container_image != "" ? var.container_image : "${module.ecr.repository_url}:bootstrap"
  container_port  = 8080

  kms_key_arn     = module.secrets.kms_key_arn
  certificate_arn = local.has_domain ? aws_acm_certificate.alb[0].arn : ""

  secret_arns = compact([
    module.secrets.app_secret_arn,
    module.database.master_user_secret_arn,
    var.enable_ses ? module.mail[0].smtp_secret_arn : ""
  ])

  environment = merge(
    {
      APP_ENVIRONMENT            = var.app_environment
      APP_BASE_URL               = local.public_url
      BACKEND_BASE_URL           = local.public_url
      CORS_ALLOWED_ORIGINS       = join(",", compact(concat([local.public_url], var.extra_cors_origins)))
      SPRING_DATASOURCE_URL      = module.database.jdbc_url
      JWT_ACCESS_EXPIRATION      = tostring(var.jwt_access_expiration_seconds)
      JWT_REFRESH_EXPIRATION     = tostring(var.jwt_refresh_expiration_seconds)
      PAYMENT_PROVIDER           = var.payment_provider
      ASAAS_BASE_URL             = var.asaas_base_url
      ASAAS_USER_AGENT           = var.asaas_user_agent
      ASAAS_SANDBOX              = tostring(var.asaas_sandbox)
      MAIL_ENABLED               = "true"
      MAIL_HOST                  = var.enable_ses ? module.mail[0].smtp_host : var.smtp_host
      MAIL_PORT                  = var.enable_ses ? tostring(module.mail[0].smtp_port) : tostring(var.smtp_port)
      MAIL_SMTP_AUTH             = "true"
      MAIL_SMTP_STARTTLS         = "true"
      MAIL_FROM                  = var.mail_from_address
      MAIL_FROM_NAME             = var.mail_from_name
      PASSWORD_RESET_TTL_MINUTES = tostring(var.password_reset_ttl_minutes)
      REPORTS_TIMEZONE           = var.reports_timezone
      JAVA_TOOL_OPTIONS          = var.java_tool_options
    },
    var.extra_environment
  )

  secrets = merge(
    {
      JWT_SECRET                 = "${module.secrets.app_secret_arn}:jwt_secret::"
      QR_SECRET                  = "${module.secrets.app_secret_arn}:qr_secret::"
      DATA_ENCRYPTION_SECRET     = "${module.secrets.app_secret_arn}:data_encryption_secret::"
      ASAAS_API_KEY              = "${module.secrets.app_secret_arn}:asaas_api_key::"
      ASAAS_WEBHOOK_TOKEN        = "${module.secrets.app_secret_arn}:asaas_webhook_token::"
      SPRING_DATASOURCE_USERNAME = "${module.database.master_user_secret_arn}:username::"
      SPRING_DATASOURCE_PASSWORD = "${module.database.master_user_secret_arn}:password::"
    },
    var.enable_ses ? {
      MAIL_USERNAME = "${module.mail[0].smtp_secret_arn}:username::"
      MAIL_PASSWORD = "${module.mail[0].smtp_secret_arn}:password::"
    } : {}
  )

  task_cpu                   = var.task_cpu
  task_memory                = var.task_memory
  cpu_architecture           = var.cpu_architecture
  desired_count              = var.desired_count
  min_capacity               = var.min_capacity
  max_capacity               = var.max_capacity
  log_retention_days         = var.log_retention_days
  use_fargate_spot           = var.use_fargate_spot
  enable_deletion_protection = var.environment == "prod"
  restrict_alb_to_cloudfront = var.restrict_alb_to_cloudfront
}

# ---------------------------------------------------------------------------
# Frontend (S3 + CloudFront + WAF)
# ---------------------------------------------------------------------------
module "frontend" {
  source = "../frontend"

  providers = {
    aws           = aws
    aws.us_east_1 = aws.us_east_1
  }

  name_prefix = local.name_prefix
  bucket_name = "${local.name_prefix}-frontend-${var.account_id}"

  alb_domain_name            = local.alb_origin_domain
  alb_uses_https             = local.has_domain
  origin_secret_header_name  = module.backend.origin_secret_header_name
  origin_secret_header_value = module.backend.origin_secret

  aliases         = local.has_domain ? concat([var.domain_name], var.domain_aliases) : []
  certificate_arn = local.has_domain ? aws_acm_certificate.cdn[0].arn : ""

  price_class    = var.cloudfront_price_class
  enable_waf     = var.enable_waf
  waf_rate_limit = var.waf_rate_limit
  force_destroy  = var.environment != "prod"

  depends_on = [aws_acm_certificate_validation.cdn]
}

# ---------------------------------------------------------------------------
# DNS
# ---------------------------------------------------------------------------
resource "aws_route53_record" "app" {
  for_each = local.has_domain && var.route53_zone_id != "" ? toset(concat([var.domain_name], var.domain_aliases)) : toset([])

  zone_id = var.route53_zone_id
  name    = each.value
  type    = "A"

  alias {
    name                   = module.frontend.domain_name
    zone_id                = module.frontend.hosted_zone_id
    evaluate_target_health = false
  }
}

resource "aws_route53_record" "api" {
  count = local.has_domain && var.route53_zone_id != "" ? 1 : 0

  zone_id = var.route53_zone_id
  name    = local.api_domain
  type    = "A"

  alias {
    name                   = module.backend.alb_dns_name
    zone_id                = module.backend.alb_zone_id
    evaluate_target_health = true
  }
}

# ---------------------------------------------------------------------------
# Observabilidade
# ---------------------------------------------------------------------------
module "monitoring" {
  source = "../monitoring"

  name_prefix  = local.name_prefix
  kms_key_arn  = module.secrets.kms_key_arn
  alert_emails = var.alert_emails

  alb_arn_suffix          = module.backend.alb_arn_suffix
  target_group_arn_suffix = module.backend.target_group_arn_suffix
  ecs_cluster_name        = module.backend.cluster_name
  ecs_service_name        = module.backend.service_name
  rds_instance_id         = module.database.instance_id
  log_group_name          = module.backend.log_group_name
}
