variable "project" {
  description = "Prefixo usado em todos os recursos."
  type        = string
  default     = "event-access"
}

variable "aws_region" {
  description = "Regiao principal da conta."
  type        = string
  default     = "sa-east-1"
}

variable "enable_github_oidc" {
  description = "Cria o provider OIDC do GitHub Actions."
  type        = bool
  default     = true
}

variable "github_subject_claims" {
  description = "Claims 'sub' autorizados a assumir as roles de CI (repo:OWNER/REPO:ref:refs/heads/main, repo:OWNER/REPO:environment:prod, ...)."
  type        = list(string)
  default = [
    "repo:oxbar/app-event:ref:refs/heads/main",
    "repo:oxbar/app-event:environment:dev",
    "repo:oxbar/app-event:environment:prod",
    "repo:oxbar/app-event:pull_request"
  ]
}

variable "enable_gitlab_oidc" {
  description = "Cria o provider OIDC do GitLab CI."
  type        = bool
  default     = false
}

variable "gitlab_issuer_url" {
  description = "Issuer do GitLab (https://gitlab.com ou a URL da instancia self-managed)."
  type        = string
  default     = "https://gitlab.com"
}

variable "gitlab_subject_claims" {
  description = "Claims 'sub' do GitLab autorizados (project_path:GRUPO/PROJETO:ref_type:branch:ref:main)."
  type        = list(string)
  default     = ["project_path:oxbar/app-event:ref_type:branch:ref:main"]
}
