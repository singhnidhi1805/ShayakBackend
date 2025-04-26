// const swaggerJsDoc = require('swagger-jsdoc');
// const swaggerUi = require('swagger-ui-express');

// const swaggerDefinition = {
//   openapi: '3.0.0',
//   info: {
//     title: 'Sahayak API',
//     version: '1.0.0',
//     description: 'API documentation for Sahayak application',
//   },
//   servers: [
//     {
//       url: 'http://localhost:3000',
//       description: 'Development server',
//     },
//   ],
// };

// const options = {
//   swaggerDefinition,
//   apis: ['./routes/*.js'], // Path to route files with Swagger comments
// };

// const swaggerSpec = swaggerJsDoc(options);

// const setupSwagger = (app) => {
//   app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));
// };

// module.exports = setupSwagger;


const swaggerJsDoc = require('swagger-jsdoc');
const swaggerUi = require('swagger-ui-express');

const swaggerDefinition = {
  openapi: '3.0.1',
  info: {
    title: 'Sahayak API',
    version: '1.0.0',
    description: 'API documentation for Sahayak application',
  },
  servers: [
    {
      url: 'https://shayakbackend-production.up.railway.app/',
      description: 'Development server',
    },
  ],
  components: {
    securitySchemes: {
      bearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
      },
    },

    professionalAuth: {
      type: 'http',
      scheme: 'bearer',
      bearerFormat: 'JWT',
    },
  },
    
  security: [
    {
      bearerAuth: [],
      professionalAuth:[],
    },
  ],
};

const options = {
  swaggerDefinition,
  apis: ['./routes/*.js'], // Path to route files with Swagger comments
};

const swaggerSpec = swaggerJsDoc(options);

const setupSwagger = (app) => {
  // Swagger UI options
  const swaggerUiOptions = {
    explorer: true,
    swaggerOptions: {
      persistAuthorization: true,
      docExpansion: 'none',
      filter: true,
      tryItOutEnabled: true
    },
    customCss: '.swagger-ui .topbar { display: none }',
    customSiteTitle: "Sahayak API Documentation"
  };

  // Setup Swagger routes
  app.get('/api-docs.json', (req, res) => {
    res.setHeader('Content-Type', 'application/json');
    res.send(swaggerSpec);
  });

  app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, swaggerUiOptions));
};

module.exports = setupSwagger;
