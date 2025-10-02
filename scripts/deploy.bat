@echo off
REM Blog Platform Deployment Script for Windows

setlocal enabledelayedexpansion

set ENVIRONMENT=%1
if "%ENVIRONMENT%"=="" set ENVIRONMENT=development

set COMPOSE_FILE=docker-compose.yml
if "%ENVIRONMENT%"=="production" set COMPOSE_FILE=docker-compose.prod.yml

echo 🚀 Deploying Blog Platform in %ENVIRONMENT% mode

REM Check if Docker is running
docker info >nul 2>&1
if errorlevel 1 (
    echo ❌ Docker is not running. Please start Docker Desktop first.
    exit /b 1
)

REM Check if .env file exists
if not exist .env (
    echo ⚠️  .env file not found. Creating from .env.example
    if exist .env.example (
        copy .env.example .env
        echo 📝 Please update .env file with your configuration
    ) else (
        echo ❌ .env.example file not found
        exit /b 1
    )
)

REM Create necessary directories
echo 📁 Creating necessary directories...
if not exist uploads mkdir uploads
if not exist logs mkdir logs
if not exist nginx\logs mkdir nginx\logs
if not exist backups mkdir backups

REM Pull latest images
echo 📥 Pulling latest Docker images...
docker-compose -f %COMPOSE_FILE% pull

REM Build application image
echo 🔨 Building application image...
docker-compose -f %COMPOSE_FILE% build

REM Stop existing containers
echo 🛑 Stopping existing containers...
docker-compose -f %COMPOSE_FILE% down

REM Start services
echo 🚀 Starting services...
if "%ENVIRONMENT%"=="production" (
    docker-compose -f %COMPOSE_FILE% up -d
) else (
    docker-compose -f %COMPOSE_FILE% --profile development up -d
)

REM Wait for services to be ready
echo ⏳ Waiting for services to be ready...
timeout /t 10 /nobreak >nul

REM Health check
echo 🏥 Performing health check...
set /a attempts=0
:healthcheck
set /a attempts+=1
curl -f http://localhost:3000/health >nul 2>&1
if errorlevel 0 (
    echo ✅ Application is healthy!
    goto :healthy
)

if %attempts% geq 30 (
    echo ❌ Health check failed after 30 attempts
    docker-compose -f %COMPOSE_FILE% logs app
    exit /b 1
)

echo ⏳ Attempt %attempts%/30 - waiting for application...
timeout /t 2 /nobreak >nul
goto :healthcheck

:healthy
REM Show running containers
echo 📋 Running containers:
docker-compose -f %COMPOSE_FILE% ps

REM Show logs
echo 📝 Recent logs:
docker-compose -f %COMPOSE_FILE% logs --tail=20 app

echo 🎉 Deployment completed successfully!

if "%ENVIRONMENT%"=="development" (
    echo 🌐 Application: http://localhost:3000
    echo 📚 API Docs: http://localhost:3000/api-docs
    echo 🗄️  MongoDB Express: http://localhost:8081
    echo 🔴 Redis Commander: http://localhost:8082
) else (
    echo 🌐 Application: %APP_URL%
)

echo 📊 Health Check: http://localhost:3000/health

pause