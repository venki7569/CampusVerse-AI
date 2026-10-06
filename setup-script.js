const fs = require('fs');
const path = require('path');

const webDir = path.join(__dirname, 'apps/web');
const apiDir = path.join(__dirname, 'apps/api');

// Setup Tailwind CSS
const tailwindConfigPath = path.join(webDir, 'tailwind.config.js');
const tailwindConfigContent = `/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {},
  },
  plugins: [],
}`;
if (fs.existsSync(webDir)) fs.writeFileSync(tailwindConfigPath, tailwindConfigContent);

const indexCssPath = path.join(webDir, 'src/index.css');
const indexCssContent = `@tailwind base;
@tailwind components;
@tailwind utilities;`;
if (fs.existsSync(webDir)) fs.writeFileSync(indexCssPath, indexCssContent);

// Setup Backend structure
const backendDirs = [
  'src/config',
  'src/modules/health',
  'src/middleware',
  'src/utils',
  'src/types'
];

backendDirs.forEach(dir => {
  const fullPath = path.join(apiDir, dir);
  if (!fs.existsSync(fullPath)) {
    fs.mkdirSync(fullPath, { recursive: true });
  }
});

// Setup .env.example
const envExampleContent = `PORT=5000
NODE_ENV=development

# Database
POSTGRES_URI=postgresql://user:password@localhost:5432/campusverse
MONGODB_URI=mongodb://localhost:27017/campusverse

# Redis
REDIS_URI=redis://localhost:6379

# JWT
JWT_SECRET=your_jwt_secret
JWT_EXPIRES_IN=1d
`;
fs.writeFileSync(path.join(apiDir, '.env.example'), envExampleContent);
fs.writeFileSync(path.join(apiDir, '.env'), envExampleContent);

// config/env.ts
const envConfigContent = `import dotenv from 'dotenv';
dotenv.config();

export const config = {
  port: process.env.PORT || 5000,
  env: process.env.NODE_ENV || 'development',
  db: {
    postgresUri: process.env.POSTGRES_URI || '',
    mongoUri: process.env.MONGODB_URI || '',
    redisUri: process.env.REDIS_URI || '',
  }
};
`;
fs.writeFileSync(path.join(apiDir, 'src/config/env.ts'), envConfigContent);

// utils/logger.ts
const loggerContent = `import winston from 'winston';
import { config } from '../config/env';

export const logger = winston.createLogger({
  level: config.env === 'development' ? 'debug' : 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      )
    })
  ]
});
`;
fs.writeFileSync(path.join(apiDir, 'src/utils/logger.ts'), loggerContent);

// middleware/error.middleware.ts
const errorMiddlewareContent = `import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';

export const errorHandler = (err: any, req: Request, res: Response, next: NextFunction) => {
  logger.error(err.message, { stack: err.stack });
  
  const statusCode = err.statusCode || 500;
  res.status(statusCode).json({
    success: false,
    error: {
      code: err.code || 'INTERNAL_SERVER_ERROR',
      message: err.message || 'An unexpected error occurred',
      details: err.details || []
    }
  });
};
`;
fs.writeFileSync(path.join(apiDir, 'src/middleware/error.middleware.ts'), errorMiddlewareContent);

// utils/apiResponse.ts
const apiResponseContent = `import { Response } from 'express';

export const sendSuccess = (res: Response, data: any, meta: any = {}, statusCode = 200) => {
  res.status(statusCode).json({
    success: true,
    data,
    meta
  });
};
`;
fs.writeFileSync(path.join(apiDir, 'src/utils/apiResponse.ts'), apiResponseContent);

// modules/health/health.controller.ts
const healthControllerContent = `import { Request, Response } from 'express';
import { sendSuccess } from '../../utils/apiResponse';

export const getHealth = (req: Request, res: Response) => {
  sendSuccess(res, { status: 'ok', timestamp: new Date() }, { version: '1.0.0' });
};
`;
fs.writeFileSync(path.join(apiDir, 'src/modules/health/health.controller.ts'), healthControllerContent);

// server.ts
const serverContent = `import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { config } from './config/env';
import { logger } from './utils/logger';
import { errorHandler } from './middleware/error.middleware';
import { getHealth } from './modules/health/health.controller';

const app = express();

app.use(helmet());
app.use(cors());
app.use(express.json());

// Request logging middleware
app.use((req, res, next) => {
  logger.info(\`\${req.method} \${req.url}\`);
  next();
});

// Routes
app.get('/api/v1/health', getHealth);

app.use(errorHandler);

app.listen(config.port, () => {
  logger.info(\`Server is running on port \${config.port} in \${config.env} mode\`);
});
`;
fs.writeFileSync(path.join(apiDir, 'src/server.ts'), serverContent);

console.log('Setup script completed.');
