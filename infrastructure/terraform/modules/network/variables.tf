variable "name_prefix" {
  description = "Prefixo de nomes (ex.: event-access-prod)."
  type        = string
}

variable "aws_region" {
  description = "Regiao AWS."
  type        = string
}

variable "vpc_cidr" {
  description = "CIDR da VPC."
  type        = string
  default     = "10.20.0.0/16"
}

variable "availability_zones" {
  description = "AZs usadas (minimo 2)."
  type        = list(string)

  validation {
    condition     = length(var.availability_zones) >= 2
    error_message = "Informe pelo menos duas AZs para alta disponibilidade."
  }
}

variable "enable_nat_gateway" {
  description = "Cria NAT Gateway para as subnets privadas."
  type        = bool
  default     = true
}

variable "single_nat_gateway" {
  description = "Usa um unico NAT para todas as AZs (mais barato, menos resiliente)."
  type        = bool
  default     = true
}

variable "enable_interface_endpoints" {
  description = "Cria VPC endpoints de interface (ECR, Logs, Secrets Manager, SSM)."
  type        = bool
  default     = false
}

variable "enable_flow_logs" {
  description = "Habilita VPC Flow Logs (apenas REJECT) no CloudWatch."
  type        = bool
  default     = true
}

variable "flow_logs_retention_days" {
  description = "Retencao dos flow logs."
  type        = number
  default     = 30
}
