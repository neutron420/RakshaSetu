resource "aws_ecs_cluster" "main" {
  name = "${var.project_name}-cluster"

  setting {
    name  = "containerInsights"
    value = "enabled"
  }

  tags = { Name = "${var.project_name}-cluster" }
}

resource "aws_cloudwatch_log_group" "backend" {
  name              = "/ecs/${var.project_name}/user-be"
  retention_in_days = 30
  tags              = { Name = "${var.project_name}-backend-logs" }
}

resource "aws_cloudwatch_log_group" "kafka" {
  name              = "/ecs/${var.project_name}/kafka"
  retention_in_days = 14
  tags              = { Name = "${var.project_name}-kafka-logs" }
}

resource "aws_iam_role" "ecs_execution" {
  name = "${var.project_name}-ecs-execution-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Action    = "sts:AssumeRole"
      Effect    = "Allow"
      Principal = { Service = "ecs-tasks.amazonaws.com" }
    }]
  })
}

resource "aws_iam_role_policy_attachment" "ecs_execution_policy" {
  role       = aws_iam_role.ecs_execution.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy"
}

resource "aws_iam_role_policy" "ecs_secrets_access" {
  name = "${var.project_name}-ecs-secrets-policy"
  role = aws_iam_role.ecs_execution.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect   = "Allow"
      Action   = ["secretsmanager:GetSecretValue"]
      Resource = [aws_secretsmanager_secret.app_secrets.arn]
    }]
  })
}

resource "aws_iam_role" "ecs_task" {
  name = "${var.project_name}-ecs-task-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Action    = "sts:AssumeRole"
      Effect    = "Allow"
      Principal = { Service = "ecs-tasks.amazonaws.com" }
    }]
  })
}


resource "aws_secretsmanager_secret" "app_secrets" {
  name                    = "${var.project_name}/${var.environment}/app-secrets"
  description             = "Application secrets for RakshaSetu backend"
  recovery_window_in_days = var.environment == "production" ? 30 : 0

  tags = { Name = "${var.project_name}-app-secrets" }
}

resource "aws_secretsmanager_secret_version" "app_secrets" {
  secret_id = aws_secretsmanager_secret.app_secrets.id

  secret_string = jsonencode({
    DATABASE_URL          = local.database_url
    JWT_SECRET            = var.jwt_secret
    REDIS_URL             = var.redis_url
    R2_ENDPOINT           = var.r2_endpoint
    R2_ACCESS_KEY_ID      = var.r2_access_key_id
    R2_SECRET_ACCESS_KEY  = var.r2_secret_access_key
    R2_BUCKET_NAME        = var.r2_bucket_name
    R2_PUBLIC_DOMAIN      = var.r2_public_domain
    EXPO_ACCESS_TOKEN     = var.expo_access_token
    TWILIO_ACCOUNT_SID    = var.twilio_account_sid
    TWILIO_AUTH_TOKEN     = var.twilio_auth_token
    TWILIO_PHONE_NUMBER   = var.twilio_phone_number
  })
}

resource "aws_service_discovery_private_dns_namespace" "internal" {
  name        = "${var.project_name}.local"
  description = "Internal service discovery for RakshaSetu"
  vpc         = aws_vpc.main.id
}

resource "aws_service_discovery_service" "kafka" {
  name = "kafka"

  dns_config {
    namespace_id = aws_service_discovery_private_dns_namespace.internal.id
    dns_records {
      ttl  = 10
      type = "A"
    }
    routing_policy = "MULTIVALUE"
  }

  health_check_custom_config {
    failure_threshold = 1
  }
}

resource "aws_ecs_task_definition" "kafka" {
  family                   = "${var.project_name}-kafka"
  network_mode             = "awsvpc"
  requires_compatibilities = ["FARGATE"]
  cpu                      = var.kafka_cpu
  memory                   = var.kafka_memory
  execution_role_arn       = aws_iam_role.ecs_execution.arn
  task_role_arn            = aws_iam_role.ecs_task.arn

  container_definitions = jsonencode([
    {
      name      = "kafka"
      image     = "apache/kafka:latest"
      essential = true

      portMappings = [
        { containerPort = 9092, protocol = "tcp" },
        { containerPort = 9093, protocol = "tcp" }
      ]

      environment = [
        { name = "KAFKA_NODE_ID", value = "1" },
        { name = "KAFKA_PROCESS_ROLES", value = "broker,controller" },
        { name = "KAFKA_LISTENERS", value = "PLAINTEXT://0.0.0.0:9092,CONTROLLER://0.0.0.0:9093" },
        { name = "KAFKA_ADVERTISED_LISTENERS", value = "PLAINTEXT://kafka.${var.project_name}.local:9092" },
        { name = "KAFKA_CONTROLLER_LISTENER_NAMES", value = "CONTROLLER" },
        { name = "KAFKA_INTER_BROKER_LISTENER_NAME", value = "PLAINTEXT" },
        { name = "KAFKA_CONTROLLER_QUORUM_VOTERS", value = "1@localhost:9093" },
        { name = "KAFKA_OFFSETS_TOPIC_REPLICATION_FACTOR", value = "1" },
        { name = "KAFKA_TRANSACTION_STATE_LOG_REPLICATION_FACTOR", value = "1" },
        { name = "KAFKA_TRANSACTION_STATE_LOG_MIN_ISR", value = "1" },
        { name = "KAFKA_GROUP_INITIAL_REBALANCE_DELAY_MS", value = "0" },
        { name = "KAFKA_LOG_DIRS", value = "/tmp/kraft-combined-logs" },
      ]

      logConfiguration = {
        logDriver = "awslogs"
        options = {
          "awslogs-group"         = aws_cloudwatch_log_group.kafka.name
          "awslogs-region"        = var.aws_region
          "awslogs-stream-prefix" = "kafka"
        }
      }

      healthCheck = {
        command     = ["CMD-SHELL", "/opt/kafka/bin/kafka-topics.sh --bootstrap-server localhost:9092 --list || exit 1"]
        interval    = 30
        timeout     = 10
        retries     = 5
        startPeriod = 90
      }
    }
  ])

  tags = { Name = "${var.project_name}-kafka-task" }
}

resource "aws_ecs_service" "kafka" {
  name            = "${var.project_name}-kafka"
  cluster         = aws_ecs_cluster.main.id
  task_definition = aws_ecs_task_definition.kafka.arn
  desired_count   = 1
  launch_type     = "FARGATE"

  network_configuration {
    subnets         = aws_subnet.private[*].id
    security_groups = [aws_security_group.kafka.id]
  }

  service_registries {
    registry_arn = aws_service_discovery_service.kafka.arn
  }

  tags = { Name = "${var.project_name}-kafka-service" }
}

resource "aws_ecs_task_definition" "backend" {
  family                   = "${var.project_name}-backend"
  network_mode             = "awsvpc"
  requires_compatibilities = ["FARGATE"]
  cpu                      = var.backend_cpu
  memory                   = var.backend_memory
  execution_role_arn       = aws_iam_role.ecs_execution.arn
  task_role_arn            = aws_iam_role.ecs_task.arn

  container_definitions = jsonencode([
    {
      name      = "user-be"
      image     = "${aws_ecr_repository.backend.repository_url}:latest"
      essential = true

      portMappings = [
        { containerPort = 5001, protocol = "tcp" }
      ]

      environment = [
        { name = "NODE_ENV", value = "production" },
        { name = "KAFKA_BROKERS", value = "kafka.${var.project_name}.local:9092" },
        { name = "USER_BE_PORT", value = "5001" },
        { name = "AWS_REGION", value = var.aws_region },
      ]

      secrets = [
        { name = "DATABASE_URL", valueFrom = "${aws_secretsmanager_secret.app_secrets.arn}:DATABASE_URL::" },
        { name = "JWT_SECRET", valueFrom = "${aws_secretsmanager_secret.app_secrets.arn}:JWT_SECRET::" },
        { name = "REDIS_URL", valueFrom = "${aws_secretsmanager_secret.app_secrets.arn}:REDIS_URL::" },
        { name = "R2_ENDPOINT", valueFrom = "${aws_secretsmanager_secret.app_secrets.arn}:R2_ENDPOINT::" },
        { name = "R2_ACCESS_KEY_ID", valueFrom = "${aws_secretsmanager_secret.app_secrets.arn}:R2_ACCESS_KEY_ID::" },
        { name = "R2_SECRET_ACCESS_KEY", valueFrom = "${aws_secretsmanager_secret.app_secrets.arn}:R2_SECRET_ACCESS_KEY::" },
        { name = "R2_BUCKET_NAME", valueFrom = "${aws_secretsmanager_secret.app_secrets.arn}:R2_BUCKET_NAME::" },
        { name = "R2_PUBLIC_DOMAIN", valueFrom = "${aws_secretsmanager_secret.app_secrets.arn}:R2_PUBLIC_DOMAIN::" },
        { name = "EXPO_ACCESS_TOKEN", valueFrom = "${aws_secretsmanager_secret.app_secrets.arn}:EXPO_ACCESS_TOKEN::" },
        { name = "TWILIO_ACCOUNT_SID", valueFrom = "${aws_secretsmanager_secret.app_secrets.arn}:TWILIO_ACCOUNT_SID::" },
        { name = "TWILIO_AUTH_TOKEN", valueFrom = "${aws_secretsmanager_secret.app_secrets.arn}:TWILIO_AUTH_TOKEN::" },
        { name = "TWILIO_PHONE_NUMBER", valueFrom = "${aws_secretsmanager_secret.app_secrets.arn}:TWILIO_PHONE_NUMBER::" },
      ]

      logConfiguration = {
        logDriver = "awslogs"
        options = {
          "awslogs-group"         = aws_cloudwatch_log_group.backend.name
          "awslogs-region"        = var.aws_region
          "awslogs-stream-prefix" = "user-be"
        }
      }

      healthCheck = {
        command     = ["CMD-SHELL", "bun -e \"fetch('http://localhost:5001/health').then(r => r.ok ? process.exit(0) : process.exit(1)).catch(() => process.exit(1))\""]
        interval    = 30
        timeout     = 5
        retries     = 3
        startPeriod = 30
      }
    }
  ])

  tags = { Name = "${var.project_name}-backend-task" }
}

resource "aws_ecs_service" "backend" {
  name            = "${var.project_name}-backend"
  cluster         = aws_ecs_cluster.main.id
  task_definition = aws_ecs_task_definition.backend.arn
  desired_count   = var.backend_desired_count
  launch_type     = "FARGATE"

  network_configuration {
    subnets         = aws_subnet.private[*].id
    security_groups = [aws_security_group.backend.id]
  }

  load_balancer {
    target_group_arn = aws_lb_target_group.backend.arn
    container_name   = "user-be"
    container_port   = 5001
  }

  depends_on = [
    aws_ecs_service.kafka,
    aws_lb_listener.http,
  ]

  tags = { Name = "${var.project_name}-backend-service" }
}

resource "aws_appautoscaling_target" "backend" {
  max_capacity       = 6
  min_capacity       = var.backend_desired_count
  resource_id        = "service/${aws_ecs_cluster.main.name}/${aws_ecs_service.backend.name}"
  scalable_dimension = "ecs:service:DesiredCount"
  service_namespace  = "ecs"
}

resource "aws_appautoscaling_policy" "backend_cpu" {
  name               = "${var.project_name}-backend-cpu-scaling"
  policy_type        = "TargetTrackingScaling"
  resource_id        = aws_appautoscaling_target.backend.resource_id
  scalable_dimension = aws_appautoscaling_target.backend.scalable_dimension
  service_namespace  = aws_appautoscaling_target.backend.service_namespace

  target_tracking_scaling_policy_configuration {
    predefined_metric_specification {
      predefined_metric_type = "ECSServiceAverageCPUUtilization"
    }
    target_value       = 70.0
    scale_in_cooldown  = 300
    scale_out_cooldown = 60
  }
}

resource "aws_appautoscaling_policy" "backend_requests" {
  name               = "${var.project_name}-backend-request-scaling"
  policy_type        = "TargetTrackingScaling"
  resource_id        = aws_appautoscaling_target.backend.resource_id
  scalable_dimension = aws_appautoscaling_target.backend.scalable_dimension
  service_namespace  = aws_appautoscaling_target.backend.service_namespace

  target_tracking_scaling_policy_configuration {
    predefined_metric_specification {
      predefined_metric_type = "ALBRequestCountPerTarget"
      resource_label         = "${aws_lb.main.arn_suffix}/${aws_lb_target_group.backend.arn_suffix}"
    }
    target_value       = 1000.0
    scale_in_cooldown  = 300
    scale_out_cooldown = 60
  }
}
