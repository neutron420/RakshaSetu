variable "aws_region" {
  description = "AWS region for all resources"
  type        = string
  default     = "ap-south-1"
}

variable "environment" {
  description = "Deployment environment (dev, staging, production)"
  type        = string
  default     = "production"

  validation {
    condition     = contains(["dev", "staging", "production"], var.environment)
    error_message = "Environment must be dev, staging, or production."
  }
}

variable "project_name" {
  description = "Project identifier used in resource naming"
  type        = string
  default     = "rakshasetu"
}


variable "vpc_cidr" {
  description = "CIDR block for the VPC"
  type        = string
  default     = "10.0.0.0/16"
}


variable "db_instance_class" {
  description = "RDS instance class"
  type        = string
  default     = "db.t4g.micro"
}

variable "db_name" {
  description = "PostgreSQL database name"
  type        = string
  default     = "rakshasetu"
}

variable "db_username" {
  description = "PostgreSQL master username"
  type        = string
  default     = "rakshasetu_admin"
}

variable "db_password" {
  description = "PostgreSQL master password (use TF_VAR_db_password env var or tfvars)"
  type        = string
  sensitive   = true
}

variable "db_allocated_storage" {
  description = "RDS allocated storage in GB"
  type        = number
  default     = 20
}

variable "backend_cpu" {
  description = "Fargate CPU units for user-be (256 = 0.25 vCPU)"
  type        = number
  default     = 512
}

variable "backend_memory" {
  description = "Fargate memory in MiB for user-be"
  type        = number
  default     = 1024
}

variable "backend_desired_count" {
  description = "Desired number of user-be container instances"
  type        = number
  default     = 2
}

variable "kafka_cpu" {
  description = "Fargate CPU units for Kafka"
  type        = number
  default     = 1024
}

variable "kafka_memory" {
  description = "Fargate memory in MiB for Kafka"
  type        = number
  default     = 2048
}


variable "jwt_secret" {
  description = "JWT signing secret"
  type        = string
  sensitive   = true
}

variable "redis_url" {
  description = "Upstash Redis connection URL"
  type        = string
  sensitive   = true
}

variable "r2_endpoint" {
  description = "Cloudflare R2 endpoint URL"
  type        = string
  default     = ""
}

variable "r2_access_key_id" {
  description = "Cloudflare R2 access key"
  type        = string
  sensitive   = true
  default     = ""
}

variable "r2_secret_access_key" {
  description = "Cloudflare R2 secret key"
  type        = string
  sensitive   = true
  default     = ""
}

variable "r2_bucket_name" {
  description = "Cloudflare R2 bucket name"
  type        = string
  default     = "rakshasetu-media"
}

variable "r2_public_domain" {
  description = "Cloudflare R2 public domain for media URLs"
  type        = string
  default     = ""
}

variable "expo_access_token" {
  description = "Expo push notification access token"
  type        = string
  sensitive   = true
  default     = ""
}

variable "twilio_account_sid" {
  description = "Twilio Account SID"
  type        = string
  sensitive   = true
  default     = ""
}

variable "twilio_auth_token" {
  description = "Twilio Auth Token"
  type        = string
  sensitive   = true
  default     = ""
}

variable "twilio_phone_number" {
  description = "Twilio Phone Number"
  type        = string
  default     = ""
}

variable "domain_name" {
  description = "Custom domain for the ALB (optional, leave empty to use ALB DNS)"
  type        = string
  default     = ""
}

variable "certificate_arn" {
  description = "ACM certificate ARN for HTTPS (required if domain_name is set)"
  type        = string
  default     = ""
}
