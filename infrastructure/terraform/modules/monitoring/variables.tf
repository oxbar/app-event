variable "name_prefix" { type = string }
variable "kms_key_arn" { type = string }

variable "alert_emails" {
  description = "E-mails que recebem os alarmes (cada um confirma a inscricao no SNS)."
  type        = list(string)
  default     = []
}

variable "alb_arn_suffix" { type = string }
variable "target_group_arn_suffix" { type = string }
variable "ecs_cluster_name" { type = string }
variable "ecs_service_name" { type = string }
variable "rds_instance_id" { type = string }
variable "log_group_name" { type = string }

variable "latency_p95_threshold_seconds" {
  type    = number
  default = 2
}

variable "rds_free_storage_threshold_bytes" {
  description = "Padrao: 4 GiB."
  type        = number
  default     = 4294967296
}

variable "rds_max_connections_threshold" {
  type    = number
  default = 80
}
