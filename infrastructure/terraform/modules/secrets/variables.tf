variable "name_prefix" {
  description = "Prefixo de nomes."
  type        = string
}

variable "asaas_api_key_placeholder" {
  description = "Placeholder da chave Asaas. O valor real e gravado fora do Terraform (CLI/console)."
  type        = string
  default     = "REPLACE_ME"
}

variable "asaas_webhook_token_placeholder" {
  description = "Placeholder do token de webhook do Asaas."
  type        = string
  default     = "REPLACE_ME"
}

variable "recovery_window_in_days" {
  description = "Janela de recuperacao ao destruir o segredo (0 = exclusao imediata)."
  type        = number
  default     = 7
}
