output "state_bucket" {
  description = "Bucket S3 do state remoto."
  value       = aws_s3_bucket.state.id
}

output "lock_table" {
  description = "Tabela DynamoDB de lock."
  value       = aws_dynamodb_table.lock.name
}

output "ci_terraform_role_arn" {
  description = "Role assumida pelo pipeline de infraestrutura."
  value       = aws_iam_role.terraform.arn
}

output "ci_deploy_role_arn" {
  description = "Role assumida pelo pipeline de aplicacao."
  value       = aws_iam_role.deploy.arn
}
