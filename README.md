# 🚀 Blog Platform - Modern AI-Powered Blogging System

A comprehensive, modern blog platform built with Node.js, Express, MongoDB, and AI integration. Features real-time notifications, advanced analytics, subscription management, and social media integration.

## ✨ Features

### 🤖 AI-Powered Content Creation
- **Content Generation**: AI-assisted article writing with OpenAI integration
- **Content Improvement**: Automatic content enhancement and optimization
- **SEO Optimization**: AI-powered meta descriptions and keyword suggestions
- **Image Generation**: DALL-E integration for featured images
- **Content Ideas**: AI-generated topic suggestions

### 📊 Advanced Analytics & Reporting
- **Real-time Analytics**: View tracking, engagement metrics, user behavior
- **Interactive Dashboards**: User and admin dashboards with charts
- **Export Functionality**: CSV/JSON data export capabilities
- **Performance Metrics**: Article performance and engagement tracking
- **Search Analytics**: Search term analysis and trending topics

### 💳 Subscription & Payment System
- **Multi-tier Plans**: Free, Basic, Pro, Enterprise subscription tiers
- **Payment Integration**: Midtrans, Xendit, and Stripe support
- **Usage Tracking**: Feature limits and usage monitoring
- **Automated Billing**: Recurring payments and renewal management
- **Webhook Processing**: Real-time payment status updates

### 🔍 Advanced Search & SEO
- **Full-text Search**: MongoDB text search with relevance scoring
- **Search Suggestions**: Auto-complete and search recommendations
- **SEO Optimization**: Meta tags, structured data, XML sitemaps
- **SEO Analysis**: Content scoring with actionable recommendations
- **Search Analytics**: Popular terms and search performance tracking

### 🔔 Real-time Notifications
- **Socket.IO Integration**: Real-time notifications and updates
- **Email Notifications**: Welcome, comment, subscription alerts
- **Push Notifications**: Browser push notification support
- **Notification Preferences**: User-controlled notification settings
- **Admin Alerts**: System monitoring and user activity alerts

### 🛡️ Enterprise Security
- **Multi-layer Security**: Rate limiting, input sanitization, CORS protection
- **Authentication**: JWT-based auth with social login support
- **Authorization**: Role-based access control (RBAC)
- **Security Headers**: Comprehensive HTTP security headers
- **Audit Logging**: Security event tracking and monitoring

### 🐳 Production-Ready Infrastructure
- **Docker Support**: Multi-stage builds for development and production
- **Load Balancing**: Nginx reverse proxy with scaling support
- **Caching**: Redis-based caching for performance optimization
- **Monitoring**: Health checks and performance monitoring
- **CI/CD Ready**: Automated deployment scripts and configurations

## 🏗️ Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Frontend      │    │   Backend API   │    │   Database      │
│   (EJS Views)   │◄──►│   (Express.js)  │◄──►│   (MongoDB)     │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                              │
                              ▼
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Cache Layer   │    │   AI Services   │    │   External APIs │
│   (Redis)       │    │   (OpenAI)      │    │   (Payments)    │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

## 🚀 Quick Start

### Prerequisites
- Node.js 18+ 
- MongoDB 7.0+
- Redis 7.0+
- Docker & Docker Compose (optional)

### Installation

1. **Clone the repository**
```bash
git clone <repository-url>
cd blog-platform
```

2. **Install dependencies**
```bash
npm install
```

3. **Environment setup**
```bash
cp .env.example .env
# Edit .env with your configuration
```

4. **Start with Docker (Recommended)**
```bash
# Windows
scripts\deploy.bat development

# Linux/Mac
./scripts/deploy.sh development
```

5. **Manual setup**
```bash
# Start MongoDB and Redis
# Then run:
npm run dev
```

### 🌐 Access Points

- **Application**: http://localhost:3000
- **API Documentation**: http://localhost:3000/api-docs
- **Admin Dashboard**: http://localhost:3000/admin
- **User Dashboard**: http://localhost:3000/dashboard
- **MongoDB Express**: http://localhost:8081 (dev only)
- **Redis Commander**: http://localhost:8082 (dev only)

## 📚 API Documentation

The platform includes comprehensive API documentation powered by Swagger/OpenAPI 3.0:

- **Interactive Documentation**: Try API endpoints directly from the browser
- **Authentication Support**: JWT and API key authentication
- **Complete Coverage**: All endpoints, models, and responses documented
- **Environment Aware**: Different configurations for development and production

Access the API documentation at `/api-docs` when running in development mode.

## 🔧 Configuration

### Environment Variables

```env
# Application
NODE_ENV=development
PORT=3000
APP_URL=http://localhost:3000
APP_NAME=Blog Platform

# Database
MONGODB_URI=mongodb://localhost:27017/blog-platform
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=

# Authentication
JWT_SECRET=your-super-secret-jwt-key
JWT_EXPIRES_IN=7d

# Email
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password

# AI Services
OPENAI_API_KEY=your-openai-api-key

# Payment Gateways
MIDTRANS_SERVER_KEY=your-midtrans-server-key
MIDTRANS_CLIENT_KEY=your-midtrans-client-key
XENDIT_SECRET_KEY=your-xendit-secret-key
STRIPE_SECRET_KEY=your-stripe-secret-key

# Social Auth
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
FACEBOOK_APP_ID=your-facebook-app-id
FACEBOOK_APP_SECRET=your-facebook-app-secret
```

## 🏛️ Project Structure

```
blog-platform/
├── src/
│   ├── config/          # Configuration files
│   ├── controllers/     # Route controllers
│   ├── middleware/      # Custom middleware
│   ├── models/          # Database models
│   ├── routes/          # API routes
│   ├── services/        # Business logic services
│   ├── utils/           # Utility functions
│   └── views/           # EJS templates
├── scripts/             # Deployment and utility scripts
├── nginx/               # Nginx configuration
├── tests/               # Test files
├── uploads/             # File uploads (created at runtime)
├── logs/                # Application logs (created at runtime)
├── docker-compose.yml   # Development Docker setup
├── docker-compose.prod.yml # Production Docker setup
├── Dockerfile           # Multi-stage Docker build
└── package.json         # Dependencies and scripts
```

## 🧪 Testing

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run test setup
npm run test:setup
```

## 🚀 Deployment

### Docker Deployment (Recommended)

**Development:**
```bash
# Windows
scripts\deploy.bat development

# Linux/Mac
./scripts/deploy.sh development
```

**Production:**
```bash
# Windows
scripts\deploy.bat production

# Linux/Mac
./scripts/deploy.sh production
```

### Manual Deployment

1. **Build the application**
```bash
npm run build  # If you have build scripts
```

2. **Set production environment**
```bash
export NODE_ENV=production
```

3. **Start the application**
```bash
npm start
```

## 📊 Monitoring & Logging

The platform includes comprehensive monitoring and logging:

- **Application Logs**: Winston-based structured logging
- **Access Logs**: Nginx access and error logs
- **Health Checks**: Built-in health check endpoints
- **Performance Monitoring**: Request duration and resource usage tracking
- **Error Tracking**: Comprehensive error logging and reporting

### Health Check

```bash
curl http://localhost:3000/health
```

Response:
```json
{
  "status": "OK",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "uptime": 3600,
  "environment": "production",
  "version": "1.0.0"
}
```

## 🔐 Security Features

- **Input Sanitization**: NoSQL injection and XSS prevention
- **Rate Limiting**: Configurable rate limits for different endpoints
- **CORS Protection**: Strict cross-origin resource sharing policies
- **Security Headers**: Comprehensive HTTP security headers
- **Authentication**: JWT-based authentication with refresh tokens
- **Authorization**: Role-based access control
- **Audit Logging**: Security event tracking

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🆘 Support

- **Documentation**: Check the `/api-docs` endpoint for API documentation
- **Issues**: Report bugs and request features via GitHub Issues
- **Discussions**: Join community discussions for questions and ideas

## 🙏 Acknowledgments

- **Express.js** - Fast, unopinionated web framework
- **MongoDB** - Document database for flexible data storage
- **Redis** - In-memory data structure store for caching
- **Socket.IO** - Real-time bidirectional event-based communication
- **OpenAI** - AI-powered content generation and improvement
- **Docker** - Containerization platform for consistent deployments

---

**Built with ❤️ for the modern web**