import swaggerJsdoc from 'swagger-jsdoc';
import swaggerUi from 'swagger-ui-express';
import type { Express } from 'express';
import { config } from './env';

const options: swaggerJsdoc.Options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'CampusVerse AI API',
      version: '1.0.0',
      description:
        'Smart Campus Monitoring & Management System — REST API documentation',
      contact: {
        name: 'CampusVerse AI Team',
      },
    },
    servers: [
      {
        url: `http://localhost:${config.port}`,
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
    },
    security: [{ bearerAuth: [] }],
    tags: [
      { name: 'System', description: 'System health and status endpoints' },
      { name: 'Auth', description: 'Authentication and authorization' },
      { name: 'Departments', description: 'Department management' },
      { name: 'Buildings', description: 'Building and facility management' },
      { name: 'Classrooms', description: 'Classroom management and occupancy' },
      { name: 'Assets', description: 'Campus asset tracking' },
      { name: 'Maintenance', description: 'Maintenance request management' },
      { name: 'Utilities', description: 'Electricity and water monitoring' },
      { name: 'Dashboard', description: 'Live smart campus operations overview' },
      { name: 'Parking', description: 'Parking management' },
      { name: 'Analytics', description: 'Analytics and reporting' },
      { name: 'AI Assistant', description: 'CampusVerse AI conversational assistant' },
      { name: 'Announcements', description: 'Campus announcements and communication' },
      { name: 'Digital Twin', description: 'Campus digital twin and predictive intelligence' },
      { name: 'Notifications', description: 'Notification management' },
      { name: 'Admin Users', description: 'Administrator user management' },
      { name: 'Admin Roles', description: 'Role catalog and assignments' },
      { name: 'Admin Permissions', description: 'Permission catalog and role-permission mapping' },
      { name: 'Parking', description: 'Parking areas, slots, allocation, and availability' },
      { name: 'Analytics', description: 'Campus-wide analytics and reporting' },
    ],
  },
  // Scan all controller and router files for @openapi JSDoc comments
  apis: ['./src/**/*.controller.ts', './src/**/*.router.ts'],
};

export const swaggerSpec = swaggerJsdoc(options);

export function setupSwagger(app: Express): void {
  // Serve the OpenAPI JSON spec
  app.get('/api/v1/docs.json', (_req, res) => {
    res.setHeader('Content-Type', 'application/json');
    res.send(swaggerSpec);
  });

  // Serve Swagger UI
  app.use(
    '/api/v1/docs',
    swaggerUi.serve,
    swaggerUi.setup(swaggerSpec, {
      customSiteTitle: 'CampusVerse AI API Docs',
      customCss: '.swagger-ui .topbar { display: none }',
    }),
  );
}
