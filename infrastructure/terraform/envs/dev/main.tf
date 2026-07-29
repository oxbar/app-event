module "stack" {
  source = "../../modules/stack"

  providers = {
    aws           = aws
    aws.us_east_1 = aws.us_east_1
  }

  project     = "event-access"
  environment = "dev"
  aws_region  = var.aws_region
  account_id  = data.aws_caller_identity.current.account_id

  # --- Rede: barata, um NAT so -------------------------------------------
  vpc_cidr           = "10.20.0.0/16"
  availability_zones = ["sa-east-1a", "sa-east-1c"]
  single_nat_gateway = true
  enable_flow_logs   = false

  # --- Dominio ------------------------------------------------------------
  # Sem dominio proprio a app sobe em https://<id>.cloudfront.net.
  # Nesse caso rode o apply, pegue o output app_url e coloque em
  # public_base_url para que links de e-mail e CORS fiquem corretos.
  domain_name     = ""
  route53_zone_id = ""
  public_base_url = "https://d24f1xgeci0zz2.cloudfront.net"

  # --- Banco --------------------------------------------------------------
  db_engine_version          = "17.10"
  db_instance_class          = "db.t4g.micro"
  db_allocated_storage       = 20
  db_multi_az                = false
  db_backup_retention_period = 3
  db_deletion_protection     = false
  db_skip_final_snapshot     = true

  # --- Backend ------------------------------------------------------------
  task_cpu           = 512
  task_memory        = 1024
  cpu_architecture   = "X86_64"
  desired_count      = 1
  min_capacity       = 1
  max_capacity       = 3
  use_fargate_spot   = true
  log_retention_days = 14

  # --- Aplicacao ----------------------------------------------------------
  app_environment  = "development"
  payment_provider = "ASAAS"
  asaas_base_url   = "https://api-sandbox.asaas.com/v3"
  asaas_sandbox    = true

  # --- E-mail -------------------------------------------------------------
  # Sem dominio verificado, deixe enable_ses = false e aponte um SMTP externo.
  enable_ses        = false
  smtp_host         = "smtp.exemplo.com"
  smtp_port         = 587
  mail_from_address = "nao-responda@eventaccess.dev"
  mail_from_name    = "Event Access (dev)"

  # --- CDN / alertas ------------------------------------------------------
  cloudfront_price_class = "PriceClass_100"
  enable_waf             = false
  alert_emails           = []
}
