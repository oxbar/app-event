# --- Identificacao --------------------------------------------------------
variable "project" {
  type    = string
  default = "event-access"
}

variable "environment" {
  description = "dev, staging ou prod."
  type        = string
}

variable "aws_region" { type = string }

variable "account_id" {
  description = "ID da conta, usado para tornar o nome do bucket unico."
  type        = string
}

# --- Rede -----------------------------------------------------------------
variable "vpc_cidr" {
  type    = string
  default = "10.20.0.0/16"
}

variable "availability_zones" { type = list(string) }

variable "single_nat_gateway" {
  type    = bool
  default = true
}

variable "enable_interface_endpoints" {
  type    = bool
  default = false
}

variable "enable_flow_logs" {
  type    = bool
  default = true
}

# --- Dominio --------------------------------------------------------------
variable "domain_name" {
  description = "Dominio principal do app (vazio = usa o dominio da CloudFront)."
  type        = string
  default     = ""
}

variable "domain_aliases" {
  description = "Dominios adicionais (ex.: www)."
  type        = list(string)
  default     = []
}

variable "route53_zone_id" {
  description = "Zona hospedada do dominio. Vazio = validacao e registros criados manualmente."
  type        = string
  default     = ""
}

variable "public_base_url" {
  description = "Sobrescreve a URL publica. Necessario apenas quando nao ha dominio proprio."
  type        = string
  default     = ""
}

variable "extra_cors_origins" {
  type    = list(string)
  default = []
}

# --- Banco ----------------------------------------------------------------
variable "db_engine_version" {
  type    = string
  default = "17.4"
}

variable "db_instance_class" {
  type    = string
  default = "db.t4g.micro"
}

variable "db_allocated_storage" {
  type    = number
  default = 20
}

variable "db_max_allocated_storage" {
  type    = number
  default = 100
}

variable "db_multi_az" {
  type    = bool
  default = false
}

variable "db_backup_retention_period" {
  type    = number
  default = 7
}

variable "db_deletion_protection" {
  type    = bool
  default = false
}

variable "db_skip_final_snapshot" {
  type    = bool
  default = true
}

variable "db_performance_insights_enabled" {
  type    = bool
  default = false
}

variable "db_enhanced_monitoring_interval" {
  type    = number
  default = 0
}

# --- Backend / ECS --------------------------------------------------------
variable "container_image" {
  description = "Imagem inicial do backend. Vazio usa <ecr>:bootstrap (o pipeline promove a real)."
  type        = string
  default     = ""
}

variable "task_cpu" {
  type    = number
  default = 512
}

variable "task_memory" {
  type    = number
  default = 1024
}

variable "cpu_architecture" {
  type    = string
  default = "X86_64"
}

variable "desired_count" {
  type    = number
  default = 2
}

variable "min_capacity" {
  type    = number
  default = 2
}

variable "max_capacity" {
  type    = number
  default = 6
}

variable "use_fargate_spot" {
  type    = bool
  default = false
}

variable "log_retention_days" {
  type    = number
  default = 30
}

variable "restrict_alb_to_cloudfront" {
  type    = bool
  default = true
}

variable "java_tool_options" {
  type    = string
  default = "-XX:MaxRAMPercentage=75 -XX:+UseG1GC -Duser.timezone=UTC"
}

variable "extra_environment" {
  type    = map(string)
  default = {}
}

# --- Aplicacao ------------------------------------------------------------
variable "app_environment" {
  description = "Valor de APP_ENVIRONMENT. 'production' liga o ProductionConfigurationValidator."
  type        = string
  default     = "production"
}

variable "jwt_access_expiration_seconds" {
  type    = number
  default = 900
}

variable "jwt_refresh_expiration_seconds" {
  type    = number
  default = 604800
}

variable "password_reset_ttl_minutes" {
  type    = number
  default = 30
}

variable "reports_timezone" {
  type    = string
  default = "America/Sao_Paulo"
}

# --- Pagamentos -----------------------------------------------------------
variable "payment_provider" {
  description = "ASAAS ou FAKE."
  type        = string
  default     = "ASAAS"
}

variable "asaas_base_url" {
  type    = string
  default = "https://api-sandbox.asaas.com/v3"
}

variable "asaas_sandbox" {
  type    = bool
  default = true
}

variable "asaas_user_agent" {
  type    = string
  default = "event-access-platform/1.0"
}

# --- E-mail ---------------------------------------------------------------
variable "enable_ses" {
  description = "Provisiona SES + credenciais SMTP."
  type        = bool
  default     = true
}

variable "mail_domain" {
  type    = string
  default = ""
}

variable "mail_from_address" {
  type    = string
  default = "nao-responda@eventaccess.local"
}

variable "mail_from_name" {
  type    = string
  default = "Event Access"
}

variable "mail_from_subdomain" {
  type    = string
  default = "mail"
}

variable "dmarc_report_email" {
  type    = string
  default = ""
}

variable "smtp_host" {
  description = "SMTP externo quando enable_ses = false."
  type        = string
  default     = ""
}

variable "smtp_port" {
  type    = number
  default = 587
}

# --- CDN / WAF ------------------------------------------------------------
variable "cloudfront_price_class" {
  type    = string
  default = "PriceClass_200"
}

variable "enable_waf" {
  type    = bool
  default = true
}

variable "waf_rate_limit" {
  type    = number
  default = 2000
}

# --- Operacao -------------------------------------------------------------
variable "alert_emails" {
  type    = list(string)
  default = []
}

variable "secret_recovery_window_in_days" {
  type    = number
  default = 7
}
