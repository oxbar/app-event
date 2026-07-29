data "aws_region" "current" {}

# Substitui o Mailpit do docker-compose: em produção o Spring fala SMTP com o SES.
resource "aws_sesv2_email_identity" "domain" {
  email_identity = var.mail_domain

  dkim_signing_attributes {
    next_signing_key_length = "RSA_2048_BIT"
  }
}

resource "aws_sesv2_email_identity_mail_from_attributes" "this" {
  count = var.mail_from_subdomain == "" ? 0 : 1

  email_identity         = aws_sesv2_email_identity.domain.email_identity
  mail_from_domain       = "${var.mail_from_subdomain}.${var.mail_domain}"
  behavior_on_mx_failure = "USE_DEFAULT_VALUE"
}

resource "aws_sesv2_configuration_set" "this" {
  configuration_set_name = "${var.name_prefix}-transactional"

  delivery_options {
    tls_policy = "REQUIRE"
  }

  reputation_options {
    reputation_metrics_enabled = true
  }

  sending_options {
    sending_enabled = true
  }
}

# --- Registros DNS (quando a zona e gerenciada aqui) ----------------------
resource "aws_route53_record" "dkim" {
  count = var.route53_zone_id == "" ? 0 : 3

  zone_id = var.route53_zone_id
  name    = "${aws_sesv2_email_identity.domain.dkim_signing_attributes[0].tokens[count.index]}._domainkey.${var.mail_domain}"
  type    = "CNAME"
  ttl     = 600
  records = ["${aws_sesv2_email_identity.domain.dkim_signing_attributes[0].tokens[count.index]}.dkim.amazonses.com"]
}

resource "aws_route53_record" "mail_from_mx" {
  count = var.route53_zone_id == "" || var.mail_from_subdomain == "" ? 0 : 1

  zone_id = var.route53_zone_id
  name    = "${var.mail_from_subdomain}.${var.mail_domain}"
  type    = "MX"
  ttl     = 600
  records = ["10 feedback-smtp.${data.aws_region.current.name}.amazonses.com"]
}

resource "aws_route53_record" "mail_from_spf" {
  count = var.route53_zone_id == "" || var.mail_from_subdomain == "" ? 0 : 1

  zone_id = var.route53_zone_id
  name    = "${var.mail_from_subdomain}.${var.mail_domain}"
  type    = "TXT"
  ttl     = 600
  records = ["v=spf1 include:amazonses.com ~all"]
}

resource "aws_route53_record" "dmarc" {
  count = var.route53_zone_id == "" ? 0 : 1

  zone_id = var.route53_zone_id
  name    = "_dmarc.${var.mail_domain}"
  type    = "TXT"
  ttl     = 600
  records = ["v=DMARC1; p=quarantine; rua=mailto:${var.dmarc_report_email}"]
}

# --- Credenciais SMTP -----------------------------------------------------
resource "aws_iam_user" "smtp" {
  name = "${var.name_prefix}-ses-smtp"
  path = "/service/"
}

data "aws_iam_policy_document" "smtp" {
  statement {
    effect    = "Allow"
    actions   = ["ses:SendRawEmail", "ses:SendEmail"]
    resources = ["*"]

    condition {
      test     = "StringEquals"
      variable = "ses:FromAddress"
      values   = [var.mail_from_address]
    }
  }
}

resource "aws_iam_user_policy" "smtp" {
  name   = "${var.name_prefix}-ses-smtp"
  user   = aws_iam_user.smtp.name
  policy = data.aws_iam_policy_document.smtp.json
}

resource "aws_iam_access_key" "smtp" {
  user = aws_iam_user.smtp.name
}

resource "aws_secretsmanager_secret" "smtp" {
  name                    = "${var.name_prefix}/smtp"
  description             = "Credenciais SMTP do Amazon SES"
  kms_key_id              = var.kms_key_arn
  recovery_window_in_days = var.recovery_window_in_days
}

resource "aws_secretsmanager_secret_version" "smtp" {
  secret_id = aws_secretsmanager_secret.smtp.id

  secret_string = jsonencode({
    username = aws_iam_access_key.smtp.id
    password = aws_iam_access_key.smtp.ses_smtp_password_v4
    host     = "email-smtp.${data.aws_region.current.name}.amazonaws.com"
    port     = "587"
  })
}
