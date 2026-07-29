variable "aws_region" {
  type    = string
  default = "sa-east-1"
}

variable "domain_name" {
  description = "Dominio principal de producao."
  type        = string
}

variable "route53_zone_id" {
  description = "Zona Route53 do dominio."
  type        = string
}

variable "dmarc_report_email" {
  type = string
}

variable "alert_emails" {
  type    = list(string)
  default = []
}
