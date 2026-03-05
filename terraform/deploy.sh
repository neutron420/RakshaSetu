#!/usr/bin/env bash
# ============================================================================
# deploy.sh — One-command deployment for RakshaSetu
# ============================================================================
# Usage:
#   ./deploy.sh              # Full deploy (infra + app)
#   ./deploy.sh infra        # Only Terraform apply
#   ./deploy.sh app          # Only build & push Docker image + force deploy
#   ./deploy.sh destroy      # Tear down all infrastructure
# ============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
TF_DIR="$SCRIPT_DIR"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

log()   { echo -e "${CYAN}[RakshaSetu]${NC} $1"; }
ok()    { echo -e "${GREEN}[✓]${NC} $1"; }
warn()  { echo -e "${YELLOW}[!]${NC} $1"; }
err()   { echo -e "${RED}[✗]${NC} $1" >&2; }

# ── Pre-flight checks ───────────────────────────────────────────────────────

check_tools() {
  local missing=()
  for cmd in terraform aws docker; do
    if ! command -v "$cmd" &>/dev/null; then
      missing+=("$cmd")
    fi
  done

  if [ ${#missing[@]} -gt 0 ]; then
    err "Missing required tools: ${missing[*]}"
    echo "Install them:"
    echo "  terraform → https://developer.hashicorp.com/terraform/install"
    echo "  aws cli   → https://docs.aws.amazon.com/cli/latest/userguide/install-cliv2.html"
    echo "  docker    → https://docs.docker.com/get-docker/"
    exit 1
  fi

  ok "All required tools found"
}

check_aws_auth() {
  if ! aws sts get-caller-identity &>/dev/null; then
    err "AWS CLI not authenticated. Run 'aws configure' first."
    exit 1
  fi
  local account_id
  account_id=$(aws sts get-caller-identity --query Account --output text)
  ok "Authenticated as AWS account: $account_id"
}

# ── Terraform Operations ────────────────────────────────────────────────────

terraform_init() {
  log "Initializing Terraform..."
  cd "$TF_DIR"
  terraform init -upgrade
  ok "Terraform initialized"
}

terraform_plan() {
  log "Planning infrastructure changes..."
  cd "$TF_DIR"
  terraform plan -out=tfplan
  ok "Plan created"
}

terraform_apply() {
  log "Applying infrastructure..."
  cd "$TF_DIR"

  if [ -f tfplan ]; then
    terraform apply tfplan
    rm -f tfplan
  else
    terraform apply -auto-approve
  fi

  ok "Infrastructure provisioned"
}

terraform_destroy() {
  warn "This will DESTROY all RakshaSetu infrastructure!"
  read -rp "Type 'yes' to confirm: " confirm
  if [ "$confirm" != "yes" ]; then
    log "Destroy cancelled."
    exit 0
  fi

  cd "$TF_DIR"
  terraform destroy -auto-approve
  ok "Infrastructure destroyed"
}

# ── Docker Build & Push ─────────────────────────────────────────────────────

deploy_app() {
  cd "$TF_DIR"

  local ecr_url
  ecr_url=$(terraform output -raw ecr_repository_url 2>/dev/null)
  local region
  region=$(terraform output -raw 2>/dev/null <<< "" || echo "ap-south-1")
  region="${AWS_REGION:-ap-south-1}"
  local cluster
  cluster=$(terraform output -raw ecs_cluster_name 2>/dev/null)
  local service
  service=$(terraform output -raw ecs_backend_service_name 2>/dev/null)

  if [ -z "$ecr_url" ]; then
    err "Could not read ECR URL from Terraform outputs. Run 'deploy.sh infra' first."
    exit 1
  fi

  # Authenticate Docker with ECR
  log "Authenticating Docker with ECR..."
  aws ecr get-login-password --region "$region" | \
    docker login --username AWS --password-stdin "${ecr_url%%/*}"
  ok "Docker authenticated"

  # Build image
  log "Building Docker image..."
  cd "$ROOT_DIR"
  docker build -t "$ecr_url:latest" \
               -t "$ecr_url:$(git rev-parse --short HEAD 2>/dev/null || echo 'manual')" \
               .
  ok "Image built"

  # Push image
  log "Pushing image to ECR..."
  docker push "$ecr_url:latest"
  docker push "$ecr_url:$(git rev-parse --short HEAD 2>/dev/null || echo 'manual')" 2>/dev/null || true
  ok "Image pushed"

  # Force new deployment
  log "Triggering ECS rolling deployment..."
  aws ecs update-service \
    --cluster "$cluster" \
    --service "$service" \
    --force-new-deployment \
    --region "$region" \
    --no-cli-pager
  ok "Deployment triggered! ECS will perform a rolling update."

  log "Monitor: aws ecs describe-services --cluster $cluster --services $service --region $region"
}

# ── Run Database Migrations ─────────────────────────────────────────────────

run_migrations() {
  log "Running Prisma migrations..."
  cd "$ROOT_DIR"

  # Get DATABASE_URL from Terraform
  cd "$TF_DIR"
  local db_url
  db_url=$(terraform output -raw rds_endpoint 2>/dev/null || echo "")

  if [ -z "$db_url" ]; then
    warn "Could not get DB endpoint. Ensure infra is deployed. Skipping migrations."
    return
  fi

  cd "$ROOT_DIR"
  log "Run migrations manually with:"
  echo "  DATABASE_URL=\"postgresql://...@${db_url}/rakshasetu\" bunx prisma migrate deploy --config prisma/prisma.config.ts"
  echo ""
  warn "For security, set DATABASE_URL as an environment variable rather than inline."
}

# ── Main ─────────────────────────────────────────────────────────────────────

main() {
  local command="${1:-full}"

  echo ""
  echo -e "${CYAN}╔══════════════════════════════════════════╗${NC}"
  echo -e "${CYAN}║     RakshaSetu Deployment Automation     ║${NC}"
  echo -e "${CYAN}╚══════════════════════════════════════════╝${NC}"
  echo ""

  check_tools
  check_aws_auth

  case "$command" in
    infra)
      terraform_init
      terraform_plan
      terraform_apply
      ;;
    app)
      deploy_app
      ;;
    migrate)
      run_migrations
      ;;
    destroy)
      terraform_init
      terraform_destroy
      ;;
    full|*)
      terraform_init
      terraform_plan
      terraform_apply
      deploy_app
      run_migrations
      ;;
  esac

  echo ""
  ok "Done! 🚀"
}

main "$@"
