variable "name_prefix" { type = string }
variable "vpc_id"      { type = string }

variable "public_subnet_ids" {
  description = "Subnets publicas do ALB."
  type        = list(string)
}

variable "private_subnet_ids" {
  description = "Subnets privadas das tasks."
  type        = list(string)
}

variable "container_image" {
  description = "Imagem inicial. O rollout real e feito pelo pipeline."
  type        = string
}

variable "container_port" {
  type    = number
  default = 8080
}

variable "health_check_path" {
  type    = string
  default = "/actuator/health/readiness"
}

variable "environment" {
  description = "Variaveis de ambiente em texto plano."
  type        = map(string)
  default     = {}
}

variable "secrets" {
  description = "Mapa NOME_DA_VAR => ARN do segredo (formato arn:...:chave::)."
  type        = map(string)
  default     = {}
}

variable "secret_arns" {
  description = "ARNs de segredos que a execution role pode ler."
  type        = list(string)
  default     = []
}

variable "kms_key_arn" { type = string }

variable "log_kms_key_arn" {
  description = "KMS para o log group (opcional; exige policy de key permitindo o CloudWatch Logs)."
  type        = string
  default     = null
}

variable "certificate_arn" {
  description = "Certificado ACM regional para o listener HTTPS do ALB (vazio = so HTTP entre CloudFront e ALB)."
  type        = string
  default     = ""
}

variable "origin_secret_header_name" {
  type    = string
  default = "x-origin-verify"
}

variable "restrict_alb_to_cloudfront" {
  description = "Restringe o SG do ALB ao prefix list da CloudFront."
  type        = bool
  default     = true
}

variable "access_logs_bucket" {
  description = "Bucket para access logs do ALB (vazio desliga)."
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
  description = "X86_64 ou ARM64 (Graviton, ~20% mais barato)."
  type        = string
  default     = "X86_64"
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

variable "cpu_target_value" {
  type    = number
  default = 60
}

variable "requests_per_target" {
  type    = number
  default = 800
}

variable "log_retention_days" {
  type    = number
  default = 30
}

variable "health_check_grace_period_seconds" {
  description = "Tempo para o Spring Boot subir e rodar o Flyway antes do ALB derrubar a task."
  type        = number
  default     = 180
}

variable "enable_container_insights" {
  type    = bool
  default = true
}

variable "enable_execute_command" {
  description = "Permite 'aws ecs execute-command' para debug."
  type        = bool
  default     = true
}

variable "enable_deletion_protection" {
  type    = bool
  default = false
}

variable "use_fargate_spot" {
  type    = bool
  default = false
}

variable "wait_for_steady_state" {
  type    = bool
  default = false
}

variable "task_extra_policy_statements" {
  description = "Permissoes adicionais para a task role."
  type = list(object({
    actions   = list(string)
    resources = list(string)
  }))
  default = []
}
