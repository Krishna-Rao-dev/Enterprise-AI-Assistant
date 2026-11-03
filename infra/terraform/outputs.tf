output "cloudfront_domain_name" {
  description = "CloudFront distribution hostname for application access."
  value       = aws_cloudfront_distribution.app.domain_name
}

output "cloudfront_distribution_id" {
  description = "CloudFront distribution ID."
  value       = aws_cloudfront_distribution.app.id
}

output "jira_credentials_secret_arn" {
  description = "Empty Secrets Manager secret reserved for future Jira MCP integration. No secret value is created."
  value       = aws_secretsmanager_secret.jira_credentials.arn
}

output "ecs_cluster_name" {
  description = "ECS cluster name."
  value       = aws_ecs_cluster.app.name
}

output "frontend_ecr_repository_url" {
  description = "ECR repository URI for the frontend image."
  value       = aws_ecr_repository.frontend.repository_url
}

output "backend_ecr_repository_url" {
  description = "ECR repository URI for the backend image."
  value       = aws_ecr_repository.backend.repository_url
}

output "alb_dns_name" {
  description = "ALB origin DNS name. Requests without the CloudFront origin header receive 404."
  value       = aws_lb.app.dns_name
}
