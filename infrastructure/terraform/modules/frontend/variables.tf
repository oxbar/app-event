variable "name_prefix" { type = string }

variable "bucket_name" {
  description = "Nome do bucket do frontend (deve ser globalmente unico)."
  type        = string
}

variable "alb_domain_name" {
  description = "DNS do ALB usado como origem de /api/*."
  type        = string
}

variable "alb_uses_https" {
  description = "Se o ALB tem listener HTTPS, a CloudFront fala TLS com ele."
  type        = bool
  default     = false
}

variable "origin_secret_header_name" {
  type    = string
  default = "x-origin-verify"
}

variable "origin_secret_header_value" {
  type      = string
  sensitive = true
}

variable "aliases" {
  description = "Dominios customizados (exige certificate_arn em us-east-1)."
  type        = list(string)
  default     = []
}

variable "certificate_arn" {
  description = "Certificado ACM em us-east-1. Vazio usa o dominio *.cloudfront.net."
  type        = string
  default     = ""
}

variable "price_class" {
  description = "PriceClass_100 (US/EU), PriceClass_200 (inclui America do Sul) ou PriceClass_All."
  type        = string
  default     = "PriceClass_200"
}

variable "enable_waf" {
  type    = bool
  default = true
}

variable "waf_rate_limit" {
  description = "Requisicoes por IP em 5 minutos para /api/* (fora webhooks)."
  type        = number
  default     = 2000
}

variable "geo_allowed_countries" {
  description = "Lista de paises permitidos (vazio = sem restricao)."
  type        = list(string)
  default     = []
}

variable "access_logs_bucket_domain" {
  description = "Bucket de logs no formato bucket.s3.amazonaws.com (vazio desliga)."
  type        = string
  default     = ""
}

variable "force_destroy" {
  type    = bool
  default = false
}
