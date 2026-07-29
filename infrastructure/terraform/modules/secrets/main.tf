resource "aws_kms_key" "this" {
  description             = "${var.name_prefix} - criptografia de segredos, logs e banco"
  deletion_window_in_days = 30
  enable_key_rotation     = true
}

resource "aws_kms_alias" "this" {
  name          = "alias/${var.name_prefix}"
  target_key_id = aws_kms_key.this.key_id
}

# Segredos da aplicacao gerados aqui; os de terceiros (Asaas) entram como
# placeholder e sao preenchidos fora do Terraform.
resource "random_password" "jwt" {
  length  = 64
  special = false
}

resource "random_password" "qr" {
  length  = 64
  special = false
}

resource "random_password" "data_encryption" {
  length  = 64
  special = false
}

resource "aws_secretsmanager_secret" "app" {
  name                    = "${var.name_prefix}/app"
  description             = "Segredos da aplicacao Event Access"
  kms_key_id              = aws_kms_key.this.arn
  recovery_window_in_days = var.recovery_window_in_days
}

resource "aws_secretsmanager_secret_version" "app" {
  secret_id = aws_secretsmanager_secret.app.id

  secret_string = jsonencode({
    jwt_secret             = random_password.jwt.result
    qr_secret              = random_password.qr.result
    data_encryption_secret = random_password.data_encryption.result
    asaas_api_key          = var.asaas_api_key_placeholder
    asaas_webhook_token    = var.asaas_webhook_token_placeholder
  })

  # Rotacao manual/externa nao deve ser sobrescrita pelo Terraform.
  lifecycle {
    ignore_changes = [secret_string]
  }
}
