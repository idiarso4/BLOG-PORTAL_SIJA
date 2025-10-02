const swaggerJsdoc = require('swagger-jsdoc');
const swaggerUi = require('swagger-ui-express');

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Blog Platform API',
      version: '1.0.0',
      description: 'Modern blog platform with AI integration and social media features',
      contact: {
        name: 'API Support',
        email: 'support@blogplatform.com'
      },
      license: {
        name: 'MIT',
        url: 'https://opensource.org/licenses/MIT'
      }
    },
    servers: [
      {
        url: process.env.APP_URL || 'http://localhost:3000',
        description: process.env.NODE_ENV === 'production' ? 'Production server' : 'Development server'
      }
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT'
        },
        apiKey: {
          type: 'apiKey',
          in: 'header',
          name: 'X-API-Key'
        }
      },
      schemas: {
        User: {
          type: 'object',
          properties: {
            _id: {
              type: 'string',
              description: 'User ID'
            },
            username: {
              type: 'string',
              description: 'Unique username'
            },
            email: {
              type: 'string',
              format: 'email',
              description: 'User email address'
            },
            role: {
              type: 'string',
              enum: ['user', 'author', 'admin'],
              description: 'User role'
            },
            profile: {
              type: 'object',
              properties: {
                nama: { type: 'string' },
                bio: { type: 'string' },
                avatar: { type: 'string' },
                website: { type: 'string' },
                twitter: { type: 'string' }
              }
            },
            isActive: {
              type: 'boolean',
              description: 'Account status'
            },
            createdAt: {
              type: 'string',
              format: 'date-time'
            },
            updatedAt: {
              type: 'string',
              format: 'date-time'
            }
          }
        },
        Article: {
          type: 'object',
          properties: {
            _id: {
              type: 'string',
              description: 'Article ID'
            },
            judul: {
              type: 'string',
              description: 'Article title'
            },
            slug: {
              type: 'string',
              description: 'URL-friendly slug'
            },
            konten: {
              type: 'string',
              description: 'Article content (HTML)'
            },
            ringkasan: {
              type: 'string',
              description: 'Article summary'
            },
            gambarUtama: {
              type: 'string',
              description: 'Featured image URL'
            },
            tags: {
              type: 'array',
              items: { type: 'string' },
              description: 'Article tags'
            },
            status: {
              type: 'string',
              enum: ['draft', 'published', 'archived'],
              description: 'Article status'
            },
            views: {
              type: 'number',
              description: 'View count'
            },
            author: {
              $ref: '#/components/schemas/User'
            },
            kategori: {
              $ref: '#/components/schemas/Category'
            },
            createdAt: {
              type: 'string',
              format: 'date-time'
            },
            updatedAt: {
              type: 'string',
              format: 'date-time'
            }
          }
        },
        Category: {
          type: 'object',
          properties: {
            _id: {
              type: 'string',
              description: 'Category ID'
            },
            nama: {
              type: 'string',
              description: 'Category name'
            },
            slug: {
              type: 'string',
              description: 'URL-friendly slug'
            },
            deskripsi: {
              type: 'string',
              description: 'Category description'
            },
            parent: {
              type: 'string',
              description: 'Parent category ID'
            },
            createdAt: {
              type: 'string',
              format: 'date-time'
            },
            updatedAt: {
              type: 'string',
              format: 'date-time'
            }
          }
        },
        Comment: {
          type: 'object',
          properties: {
            _id: {
              type: 'string',
              description: 'Comment ID'
            },
            konten: {
              type: 'string',
              description: 'Comment content'
            },
            author: {
              $ref: '#/components/schemas/User'
            },
            article: {
              type: 'string',
              description: 'Article ID'
            },
            parent: {
              type: 'string',
              description: 'Parent comment ID for replies'
            },
            isApproved: {
              type: 'boolean',
              description: 'Approval status'
            },
            createdAt: {
              type: 'string',
              format: 'date-time'
            }
          }
        },
        Subscription: {
          type: 'object',
          properties: {
            _id: {
              type: 'string',
              description: 'Subscription plan ID'
            },
            name: {
              type: 'string',
              description: 'Plan name'
            },
            slug: {
              type: 'string',
              description: 'URL-friendly slug'
            },
            description: {
              type: 'string',
              description: 'Plan description'
            },
            pricing: {
              type: 'object',
              properties: {
                monthly: {
                  type: 'object',
                  properties: {
                    price: { type: 'number' },
                    currency: { type: 'string' },
                    discountPercentage: { type: 'number' }
                  }
                },
                yearly: {
                  type: 'object',
                  properties: {
                    price: { type: 'number' },
                    currency: { type: 'string' },
                    discountPercentage: { type: 'number' }
                  }
                }
              }
            },
            features: {
              type: 'object',
              description: 'Plan features and limits'
            },
            isActive: {
              type: 'boolean',
              description: 'Plan availability'
            },
            isPopular: {
              type: 'boolean',
              description: 'Popular plan flag'
            },
            isFree: {
              type: 'boolean',
              description: 'Free plan flag'
            }
          }
        },
        Error: {
          type: 'object',
          properties: {
            success: {
              type: 'boolean',
              example: false
            },
            error: {
              type: 'object',
              properties: {
                code: {
                  type: 'string',
                  description: 'Error code'
                },
                message: {
                  type: 'string',
                  description: 'Error message'
                },
                details: {
                  type: 'array',
                  items: { type: 'object' },
                  description: 'Validation error details'
                }
              }
            }
          }
        },
        Success: {
          type: 'object',
          properties: {
            success: {
              type: 'boolean',
              example: true
            },
            message: {
              type: 'string',
              description: 'Success message'
            },
            data: {
              type: 'object',
              description: 'Response data'
            }
          }
        },
        PaginatedResponse: {
          type: 'object',
          properties: {
            success: {
              type: 'boolean',
              example: true
            },
            data: {
              type: 'object',
              properties: {
                items: {
                  type: 'array',
                  items: { type: 'object' }
                },
                pagination: {
                  type: 'object',
                  properties: {
                    page: { type: 'number' },
                    limit: { type: 'number' },
                    total: { type: 'number' },
                    pages: { type: 'number' },
                    hasNext: { type: 'boolean' },
                    hasPrev: { type: 'boolean' }
                  }
                }
              }
            }
          }
        }
      },
      responses: {
        UnauthorizedError: {
          description: 'Authentication required',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/Error'
              },
              example: {
                success: false,
                error: {
                  code: 'UNAUTHORIZED',
                  message: 'Authentication required'
                }
              }
            }
          }
        },
        ForbiddenError: {
          description: 'Insufficient permissions',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/Error'
              },
              example: {
                success: false,
                error: {
                  code: 'FORBIDDEN',
                  message: 'Insufficient permissions'
                }
              }
            }
          }
        },
        NotFoundError: {
          description: 'Resource not found',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/Error'
              },
              example: {
                success: false,
                error: {
                  code: 'NOT_FOUND',
                  message: 'Resource not found'
                }
              }
            }
          }
        },
        ValidationError: {
          description: 'Validation error',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/Error'
              },
              example: {
                success: false,
                error: {
                  code: 'VALIDATION_ERROR',
                  message: 'Invalid input data',
                  details: [
                    {
                      field: 'email',
                      message: 'Valid email is required'
                    }
                  ]
                }
              }
            }
          }
        },
        RateLimitError: {
          description: 'Rate limit exceeded',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/Error'
              },
              example: {
                success: false,
                error: {
                  code: 'RATE_LIMIT_EXCEEDED',
                  message: 'Too many requests, please try again later'
                }
              }
            }
          }
        }
      },
      parameters: {
        PageParam: {
          name: 'page',
          in: 'query',
          description: 'Page number for pagination',
          required: false,
          schema: {
            type: 'integer',
            minimum: 1,
            default: 1
          }
        },
        LimitParam: {
          name: 'limit',
          in: 'query',
          description: 'Number of items per page',
          required: false,
          schema: {
            type: 'integer',
            minimum: 1,
            maximum: 100,
            default: 10
          }
        },
        SortParam: {
          name: 'sort',
          in: 'query',
          description: 'Sort field and direction (e.g., createdAt:desc)',
          required: false,
          schema: {
            type: 'string'
          }
        },
        SearchParam: {
          name: 'q',
          in: 'query',
          description: 'Search query',
          required: false,
          schema: {
            type: 'string'
          }
        }
      }
    },
    tags: [
      {
        name: 'Authentication',
        description: 'User authentication and authorization'
      },
      {
        name: 'Articles',
        description: 'Article management operations'
      },
      {
        name: 'Categories',
        description: 'Category management operations'
      },
      {
        name: 'Comments',
        description: 'Comment management operations'
      },
      {
        name: 'Users',
        description: 'User management operations'
      },
      {
        name: 'Search',
        description: 'Search functionality'
      },
      {
        name: 'Analytics',
        description: 'Analytics and reporting'
      },
      {
        name: 'Subscriptions',
        description: 'Subscription management'
      },
      {
        name: 'Payments',
        description: 'Payment processing'
      },
      {
        name: 'AI',
        description: 'AI-powered features'
      },
      {
        name: 'Social Media',
        description: 'Social media integration'
      },
      {
        name: 'Notifications',
        description: 'Notification management'
      },
      {
        name: 'Admin',
        description: 'Administrative operations'
      }
    ]
  },
  apis: [
    './src/routes/*.js',
    './src/controllers/*.js',
    './src/models/*.js'
  ]
};

const specs = swaggerJsdoc(options);

const swaggerOptions = {
  explorer: true,
  swaggerOptions: {
    docExpansion: 'none',
    filter: true,
    showRequestDuration: true,
    tryItOutEnabled: true,
    requestInterceptor: (req) => {
      // Add API key or token if available
      const token = localStorage.getItem('token');
      if (token) {
        req.headers.Authorization = `Bearer ${token}`;
      }
      return req;
    }
  },
  customCss: `
    .swagger-ui .topbar { display: none; }
    .swagger-ui .info { margin: 20px 0; }
    .swagger-ui .scheme-container { background: #fafafa; padding: 10px; }
  `,
  customSiteTitle: 'Blog Platform API Documentation',
  customfavIcon: '/favicon.ico'
};

module.exports = {
  specs,
  swaggerUi,
  swaggerOptions
};