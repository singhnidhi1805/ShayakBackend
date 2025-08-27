require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const http = require('http');

// Import routes
const authRoutes = require('./routes/auth.routes');
const bookingRoutes = require('./routes/booking.routes');
const professionalRoutes = require('./routes/professional.routes');
const locationRoutes = require('./routes/location.routes');
const trackingRoutes = require('./routes/tracking.routes');
const professionalLocationRoutes = require('./routes/professional-location.routes');

// Import services and config
const connectDB = require('./config/database');
const setupSwagger = require('./config/swagger');
const logger = require('./config/logger');
const EnhancedSocketService = require('./services/socket.service');

const app = express();
const server = http.createServer(app);

// CORS configuration for tracking
const corsOptions = {
  origin: process.env.CLIENT_URL || '*',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
};

// Middleware
app.use(cors(corsOptions));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Request logging middleware
app.use((req, res, next) => {
  logger.info(`${req.method} ${req.path} - ${req.ip}`);
  next();
});

// Initialize Enhanced Socket Service for tracking
EnhancedSocketService.initializeSocket(server);

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    services: {
      database: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
      socket: EnhancedSocketService.getIO() ? 'active' : 'inactive'
    }
  });
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/bookings', bookingRoutes);
app.use('/api/professionals', professionalRoutes);
app.use('/api/location', locationRoutes);
app.use('/api/professional', professionalLocationRoutes);

// NEW: Tracking routes for real-time location updates
app.use('/api/tracking', trackingRoutes);

// Additional routes (if they exist)
if (require.resolve('./routes/service.routes')) {
  app.use('/api/services', require('./routes/service.routes'));
}

if (require.resolve('./routes/admin.routes')) {
  app.use('/api/admin', require('./routes/admin.routes'));
}

// Socket connection status endpoint
app.get('/api/tracking/status', (req, res) => {
  const activeConnections = EnhancedSocketService.getActiveConnections();
  const activeTrackingSessions = EnhancedSocketService.getActiveTrackingSessions();
  
  res.json({
    success: true,
    data: {
      activeConnections: activeConnections.length,
      activeTrackingSessions: activeTrackingSessions.length,
      connections: activeConnections,
      trackingSessions: activeTrackingSessions
    }
  });
});

// Connect to database
connectDB();

// Setup Swagger documentation
setupSwagger(app);

// Error handling middleware
app.use((err, req, res, next) => {
  logger.error('Unhandled error:', err);
  
  // Don't send error details in production
  const isDevelopment = process.env.NODE_ENV === 'development';
  
  res.status(err.status || 500).json({
    success: false,
    message: err.message || 'Internal server error',
    ...(isDevelopment && { stack: err.stack })
  });
});

// Handle 404
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    message: `Route ${req.method} ${req.originalUrl} not found`
  });
});

// Start server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  logger.info(`Server running on port ${PORT}`);
  logger.info(`Environment: ${process.env.NODE_ENV || 'development'}`);
  logger.info(`Enhanced tracking system initialized`);
});

// Handle graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM received, shutting down gracefully');
  server.close(() => {
    logger.info('Process terminated');
    process.exit(0);
  });
});

process.on('unhandledRejection', (err) => {
  logger.error('Unhandled Promise Rejection:', err);
  if (process.env.NODE_ENV === 'production') {
    server.close(() => process.exit(1));
  }
});

module.exports = { app, server };