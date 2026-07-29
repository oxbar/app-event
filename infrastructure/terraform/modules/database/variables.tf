variable "name_prefix" { type = string }
variable "vpc_id"      { type = string }

variable "subnet_ids" {
  description = "Subnets de dados (privadas, sem rota para a internet)."
  type        = list(string)
}

variable "allowed_security_group_ids" {
  description = "Security groups autorizados a falar na porta 5432."
  type        = list(string)
  default     = []
}

variable "kms_key_arn" { type = string }

variable "engine_version" {
  description = "Versao do PostgreSQL (o compose local usa 17)."
  type        = string
  default     = "17.4"
}

variable "parameter_group_family" {
  type    = string
  default = "postgres17"
}

variable "instance_class" {
  type    = string
  default = "db.t4g.micro"
}

variable "allocated_storage" {
  type    = number
  default = 20
}

variable "max_allocated_storage" {
  description = "Teto do autoscaling de storage."
  type        = number
  default     = 100
}

variable "database_name" {
  type    = string
  default = "event_access"
}

variable "master_username" {
  type    = string
  default = "event_access"
}

variable "multi_az" {
  type    = bool
  default = false
}

variable "backup_retention_period" {
  type    = number
  default = 7
}

variable "backup_window" {
  type    = string
  default = "04:00-05:00"
}

variable "maintenance_window" {
  type    = string
  default = "sun:05:30-sun:06:30"
}

variable "deletion_protection" {
  type    = bool
  default = false
}

variable "skip_final_snapshot" {
  type    = bool
  default = true
}

variable "apply_immediately" {
  type    = bool
  default = true
}

variable "performance_insights_enabled" {
  type    = bool
  default = false
}

variable "enhanced_monitoring_interval" {
  description = "Intervalo do Enhanced Monitoring em segundos (0 desliga)."
  type        = number
  default     = 0
}
