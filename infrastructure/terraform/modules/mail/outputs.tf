output "smtp_secret_arn" {
  value = aws_secretsmanager_secret.smtp.arn
}

output "smtp_host" {
  value = "email-smtp.${data.aws_region.current.name}.amazonaws.com"
}

output "smtp_port" {
  value = 587
}

output "dkim_tokens" {
  description = "Use para criar os CNAMEs manualmente quando o DNS estiver fora da AWS."
  value       = aws_sesv2_email_identity.domain.dkim_signing_attributes[0].tokens
}

output "configuration_set_name" {
  value = aws_sesv2_configuration_set.this.configuration_set_name
}
