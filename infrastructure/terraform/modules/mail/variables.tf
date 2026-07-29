variable "name_prefix" { type = string }

variable "mail_domain" {
  description = "Dominio verificado no SES (ex.: eventaccess.com.br)."
  type        = string
}

variable "mail_from_address" {
  description = "Remetente usado pela aplicacao (MAIL_FROM)."
  type        = string
}

variable "mail_from_subdomain" {
  description = "Subdominio custom MAIL FROM (ex.: 'mail'). Vazio desliga."
  type        = string
  default     = "mail"
}

variable "dmarc_report_email" {
  description = "Caixa que recebe os relatorios DMARC."
  type        = string
}

variable "route53_zone_id" {
  description = "Zona Route53 do dominio. Vazio = registros DNS criados manualmente."
  type        = string
  default     = ""
}

variable "kms_key_arn" { type = string }

variable "recovery_window_in_days" {
  type    = number
  default = 7
}
