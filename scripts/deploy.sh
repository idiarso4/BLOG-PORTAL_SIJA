#!/bin/bash

# Blog Platform Deployment Script

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
ENVIRONMENT=${1:-development}
COMPOSE_FILE="docker-compose.yml"

if [ "$ENVIRONMENT" = "production" ]; then
    COMPOSE_FILE="docker-compose.prod.yml"
fi

echo -e "${GREEN}🚀 Deploying Blog Platform in $ENVIRONMENT mode${NC}"

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    echo -e "${RED}❌ Docker is not running. Please start Docker first.${NC}"
    exit 1
fi

# Check if .env file exists
if [ ! -f .env ]; then
    echo -e "${YELLOW}⚠️  .env file not found. Creating from .env.example${NC}"
    if [ -f .env.example ]; then
        cp .env.example .env
        echo -e "${YELLOW}📝 Please update .env file with your configuration${NC}"
    else
        echo -e "${RED}❌ .env.example file not found${NC}"
        exit 1
    fi
fi

# Create necessary directories
echo -e "${GREEN}📁 Creating necessary directories...${NC}"
mkdir -p uploads logs nginx/logs backups

# Pull latest images
echo -e "${GREEN}📥 Pulling latest Docker images...${NC}"
docker-compose -f $COMPOSE_FILE pull

# Build application image
echo -e "${GREEN}🔨 Building application image...${NC}"
docker-compose -f $COMPOSE_FILE build

# Stop existing containers
echo -e "${GREEN}🛑 Stopping existing containers...${NC}"
docker-compose -f $COMPOSE_FILE down

# Start services
echo -e "${GREEN}🚀 Starting services...${NC}"
if [ "$ENVIRONMENT" = "production" ]; then
    docker-compose -f $COMPOSE_FILE up -d
else
    docker-compose -f $COMPOSE_FILE --profile development up -d
fi

# Wait for services to be ready
echo -e "${GREEN}⏳ Waiting for services to be ready...${NC}"
sleep 10

# Health check
echo -e "${GREEN}🏥 Performing health check...${NC}"
for i in {1..30}; do
    if curl -f http://localhost:${PORT:-3000}/health > /dev/null 2>&1; then
        echo -e "${GREEN}✅ Application is healthy!${NC}"
        break
    fi
    
    if [ $i -eq 30 ]; then
        echo -e "${RED}❌ Health check failed after 30 attempts${NC}"
        docker-compose -f $COMPOSE_FILE logs app
        exit 1
    fi
    
    echo -e "${YELLOW}⏳ Attempt $i/30 - waiting for application...${NC}"
    sleep 2
done

# Show running containers
echo -e "${GREEN}📋 Running containers:${NC}"
docker-compose -f $COMPOSE_FILE ps

# Show logs
echo -e "${GREEN}📝 Recent logs:${NC}"
docker-compose -f $COMPOSE_FILE logs --tail=20 app

echo -e "${GREEN}🎉 Deployment completed successfully!${NC}"

if [ "$ENVIRONMENT" = "development" ]; then
    echo -e "${GREEN}🌐 Application: http://localhost:${PORT:-3000}${NC}"
    echo -e "${GREEN}📚 API Docs: http://localhost:${PORT:-3000}/api-docs${NC}"
    echo -e "${GREEN}🗄️  MongoDB Express: http://localhost:8081${NC}"
    echo -e "${GREEN}🔴 Redis Commander: http://localhost:8082${NC}"
else
    echo -e "${GREEN}🌐 Application: ${APP_URL:-http://localhost}${NC}"
fi

echo -e "${GREEN}📊 Health Check: http://localhost:${PORT:-3000}/health${NC}"