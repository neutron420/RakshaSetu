# RakshaSetu — Terraform Deployment Guide

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                        AWS (ap-south-1)                     │
│  ┌──────────────────── VPC 10.0.0.0/16 ──────────────────┐  │
│  │                                                        │  │
│  │  ┌─ Public Subnets ──────────────────────────────────┐ │  │
│  │  │  Internet GW ──► ALB (HTTP/HTTPS)                 │ │  │
│  │  │                  NAT Gateway                       │ │  │
│  │  └───────────────────────┬───────────────────────────┘ │  │
│  │                          │                              │  │
│  │  ┌─ Private Subnets ────┼────────────────────────────┐ │  │
│  │  │  ECS Fargate:        │                            │ │  │
│  │  │  ├─ user-be (×2, auto-scaling up to 6)            │ │  │
│  │  │  └─ kafka (×1)                                    │ │  │
│  │  └───────────────────────┬───────────────────────────┘ │  │
│  │                          │                              │  │
│  │  ┌─ Database Subnets ───┼────────────────────────────┐ │  │
│  │  │  RDS PostgreSQL 16 + PostGIS (Multi-AZ)           │ │  │
│  │  └───────────────────────────────────────────────────┘ │  │
│  └────────────────────────────────────────────────────────┘  │
│                                                              │
│  ECR (Docker images)  │  Secrets Manager  │  CloudWatch      │
└──────────────────────────────────────────────────────────────┘

External: Upstash Redis  │  Cloudflare R2  │  Twilio  │  Expo Push
```

## Prerequisites

1. **AWS CLI** configured with appropriate IAM permissions
2. **Terraform** >= 1.5.0 installed
3. **Docker** installed and running

```powershell
# Verify installations
aws --version
terraform --version
docker --version

# Configure AWS (if not already done)
aws configure
```

## Quick Start (5 Steps)

### Step 1: Configure Variables

```powershell
cd terraform
Copy-Item terraform.tfvars.example terraform.tfvars
```

Edit `terraform.tfvars` with your actual values:
- `db_password` — strong PostgreSQL password
- `jwt_secret` — random secret string  
- `redis_url` — your Upstash Redis URL
- Other service credentials (R2, Twilio, Expo)

### Step 2: Initialize Terraform

```powershell
terraform init
```

### Step 3: Preview Changes

```powershell
terraform plan
```

Review the plan output — it will show all resources to be created.

### Step 4: Deploy Infrastructure

```powershell
terraform apply
```

Type `yes` to confirm. This provisions:
- VPC, subnets, NAT Gateway
- RDS PostgreSQL database
- ECS Fargate cluster
- ALB load balancer
- ECR container registry
- All security groups and IAM roles

**Estimated time:** ~10-15 minutes (RDS takes the longest).

### Step 5: Build & Deploy the Application

```powershell
# Get the ECR URL from Terraform outputs
$ECR_URL = terraform output -raw ecr_repository_url

# Authenticate Docker with ECR
aws ecr get-login-password --region ap-south-1 | docker login --username AWS --password-stdin ($ECR_URL -split '/')[0]

# Build the Docker image (from project root)
cd ..
docker build -t "${ECR_URL}:latest" .

# Push to ECR
docker push "${ECR_URL}:latest"

# Force ECS to deploy the new image
$CLUSTER = terraform output -raw ecs_cluster_name
$SERVICE = terraform output -raw ecs_backend_service_name
aws ecs update-service --cluster $CLUSTER --service $SERVICE --force-new-deployment --region ap-south-1
```

### Step 6: Run Database Migrations

```powershell
# Get the database endpoint
$DB_ENDPOINT = terraform output -raw rds_endpoint

# Run Prisma migrations (from project root)
$env:DATABASE_URL = "postgresql://rakshasetu_admin:YOUR_PASSWORD@${DB_ENDPOINT}/rakshasetu"
bunx prisma migrate deploy --config prisma/prisma.config.ts

# Enable PostGIS extension
bun run packages/user-be/scripts/enable-postgis.ts
```

## CI/CD (GitHub Actions)

The project includes a GitHub Actions workflow at `.github/workflows/deploy.yml` that automates the full pipeline:

**On push to `main`:**
1. Terraform plan + apply
2. Docker build + push to ECR
3. ECS rolling deployment
4. Wait for service stability

**On pull request:**
1. Terraform plan only (review changes)

### Required GitHub Secrets

| Secret | Description |
|--------|-------------|
| `AWS_ACCESS_KEY_ID` | IAM access key |
| `AWS_SECRET_ACCESS_KEY` | IAM secret key |
| `TF_VAR_db_password` | PostgreSQL password |
| `TF_VAR_jwt_secret` | JWT signing secret |
| `TF_VAR_redis_url` | Upstash Redis URL |
| `TF_VAR_r2_access_key_id` | Cloudflare R2 key |
| `TF_VAR_r2_secret_access_key` | Cloudflare R2 secret |
| `TF_VAR_expo_access_token` | Expo push token |
| `TF_VAR_twilio_account_sid` | Twilio SID |
| `TF_VAR_twilio_auth_token` | Twilio token |

## Useful Commands

```powershell
# View all outputs
cd terraform
terraform output

# Check your API endpoint
terraform output alb_dns_name

# View backend logs
aws logs tail /ecs/rakshasetu/user-be --follow --region ap-south-1

# SSH into a running container (for debugging)
aws ecs execute-command --cluster rakshasetu-cluster --task TASK_ID --container user-be --interactive --command "/bin/sh"

# Scale backend manually
aws ecs update-service --cluster rakshasetu-cluster --service rakshasetu-backend --desired-count 4

# Destroy everything (careful!)
terraform destroy
```

## Cost Estimate (ap-south-1)

| Resource | Monthly Cost (approx) |
|----------|----------------------|
| ECS Fargate (user-be × 2) | ~$30 |
| ECS Fargate (Kafka × 1) | ~$25 |
| RDS db.t4g.micro (Multi-AZ) | ~$25 |
| NAT Gateway | ~$35 |
| ALB | ~$18 |
| ECR + CloudWatch | ~$5 |
| **Total** | **~$138/month** |

> Tip: For dev/staging, set `environment = "dev"`, `backend_desired_count = 1`, and use `db.t4g.micro` with single-AZ to cut costs to ~$70/month.

## Files Reference

| File | Purpose |
|------|---------|
| `main.tf` | Provider config, Terraform settings |
| `variables.tf` | All input variables |
| `network.tf` | VPC, subnets, IGW, NAT, route tables |
| `security-groups.tf` | Security groups for ALB, backend, Kafka, RDS |
| `ecr.tf` | ECR container registry |
| `rds.tf` | PostgreSQL database with PostGIS |
| `alb.tf` | Application Load Balancer + target groups |
| `ecs.tf` | ECS cluster, task definitions, services, auto-scaling |
| `outputs.tf` | Output values and deployment helper commands |
| `deploy.sh` | Bash deployment script |
| `terraform.tfvars.example` | Template for secrets |
