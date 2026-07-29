variable "repository_name" { type = string }
variable "kms_key_arn"     { type = string }

variable "keep_last_images" {
  type    = number
  default = 15
}

variable "force_delete" {
  type    = bool
  default = false
}
