variable "name" {
  description = "Prefix used for AWS resource names."
  type        = string
  default     = "enterprise-knowledge-assistant"
}

variable "aws_region" {
  description = "AWS region for the VPC, ALB, and ECS services."
  type        = string
  default     = "us-east-1"
}

variable "availability_zones" {
  description = "Two availability zones. Defaults to the first two available in aws_region."
  type        = list(string)
  default     = []

  validation {
    condition     = length(var.availability_zones) == 0 || length(var.availability_zones) == 2
    error_message = "Provide either no availability zones or exactly two."
  }
}

variable "vpc_cidr" {
  description = "CIDR block for the application VPC."
  type        = string
  default     = "10.40.0.0/16"
}

variable "public_subnet_cidrs" {
  description = "CIDR blocks for the two public ALB/NAT subnets."
  type        = list(string)
  default     = ["10.40.0.0/24", "10.40.1.0/24"]

  validation {
    condition     = length(var.public_subnet_cidrs) == 2
    error_message = "Provide exactly two public subnet CIDRs."
  }
}

variable "private_subnet_cidrs" {
  description = "CIDR blocks for the two private ECS task subnets."
  type        = list(string)
  default     = ["10.40.10.0/24", "10.40.11.0/24"]

  validation {
    condition     = length(var.private_subnet_cidrs) == 2
    error_message = "Provide exactly two private subnet CIDRs."
  }
}

variable "frontend_image_tag" {
  description = "Existing frontend ECR image tag used by the ECS task definition."
  type        = string
  default     = "latest"
}

variable "backend_image_tag" {
  description = "Existing backend ECR image tag used by the ECS task definition."
  type        = string
  default     = "latest"
}

variable "groq_api_key_secret_arn" {
  description = "Secrets Manager ARN containing the Groq API key as its SecretString."
  type        = string
}

variable "postgres_dsn_secret_arn" {
  description = "Secrets Manager ARN containing the async PostgreSQL DSN as its SecretString."
  type        = string
}

variable "mongo_uri_secret_arn" {
  description = "Secrets Manager ARN containing the MongoDB URI as its SecretString."
  type        = string
}

variable "mongo_db" {
  description = "MongoDB database name."
  type        = string
  default     = "enterprise_rag"
}

variable "llm_model" {
  description = "Groq model identifier."
  type        = string
  default     = "llama-3.3-70b-versatile"
}

variable "frontend_cpu" {
  description = "Frontend Fargate task CPU units."
  type        = number
  default     = 256
}

variable "frontend_memory" {
  description = "Frontend Fargate task memory in MiB."
  type        = number
  default     = 512
}

variable "backend_cpu" {
  description = "Backend Fargate task CPU units. Increase if model initialization exceeds this allocation."
  type        = number
  default     = 2048
}

variable "backend_memory" {
  description = "Backend Fargate task memory in MiB. Validate against embedding/reranker model memory use."
  type        = number
  default     = 8192
}

variable "desired_count" {
  description = "Desired task count for each ECS service."
  type        = number
  default     = 1
}

variable "cloudfront_aliases" {
  description = "Optional DNS aliases for CloudFront. Requires an ACM certificate in us-east-1."
  type        = list(string)
  default     = []
}

variable "cloudfront_acm_certificate_arn" {
  description = "Optional ACM certificate ARN in us-east-1 for CloudFront aliases."
  type        = string
  default     = null
}

variable "waf_rate_limit" {
  description = "Maximum requests per five-minute window per IP before AWS WAF blocks."
  type        = number
  default     = 2000

  validation {
    condition     = var.waf_rate_limit >= 10 && var.waf_rate_limit <= 2000000
    error_message = "waf_rate_limit must be between 10 and 2,000,000."
  }
}
