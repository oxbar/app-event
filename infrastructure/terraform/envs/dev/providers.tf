terraform {
  required_version = ">= 1.6.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.70"
    }
    random = {
      source  = "hashicorp/random"
      version = "~> 3.6"
    }
  }

  # Preencha via -backend-config no CI ou edite os valores abaixo.
  backend "s3" {
    bucket         = "event-access-tfstate-CHANGE_ME"
    key            = "dev/terraform.tfstate"
    region         = "sa-east-1"
    dynamodb_table = "event-access-tfstate-lock"
    encrypt        = true
  }
}

provider "aws" {
  region = var.aws_region

  default_tags {
    tags = {
      Project     = "event-access"
      Environment = "dev"
      ManagedBy   = "terraform"
      Repository  = "oxbar/app-event"
    }
  }
}

# CloudFront, ACM da borda e WAF global vivem em us-east-1.
provider "aws" {
  alias  = "us_east_1"
  region = "us-east-1"

  default_tags {
    tags = {
      Project     = "event-access"
      Environment = "dev"
      ManagedBy   = "terraform"
      Repository  = "oxbar/app-event"
    }
  }
}

data "aws_caller_identity" "current" {}
