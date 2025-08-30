require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const professionalRoutes = require('./routes/professional.routes');
const connectDB = require('./config/database');
const authRoutes = require('./routes/auth.routes');
const professionalLocationRoutes = require('./routes/professional-location.routes');
const servicemanagement = require('./routes/service-management.routes');
const earningRoutes = require('./routes/earnings.routes');
const adminRoutes = require('./routes/admin.routes');
const documentVerificationRoutes = require('./routes/document-verification.routes');
const supportRoutes = require('./routes/support.routes');
const setupSwagger = require('./config/swagger');
const logger = require('./config/logger');
const http = require('http');
const socketService = require('./services/socket.service');
const locationRoutes = require('./routes/location.routes');
const trackingRoutes = require('./routes/tracking.routes');
const testRoutes = require('./routes/test.routes');
const scheduleRoutes = require('./routes/schedule.routes');
const app = express();
const server = http.createServer(app);
const EnhancedSocketService = require('./services/socket.service');



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
// Middleware
app.use(cors());
app.use(express.json());

// Initialize socket service
socketService.initializeSocket(server);

// Routes
app.use('/api/auth', authRoutes);  // This includes user, professional, and admin OTP routes
app.use('/api/services', require('./routes/service.routes'));
app.use('/api/bookings', require('./routes/booking.routes'));
app.use('/api/professionals', professionalRoutes);
app.use('/api/professionals', require('./routes/professional-onboarding.routes'));
app.use('/api/professional', professionalLocationRoutes);
app.use('/api/professional', earningRoutes);
app.use('/api/professionals', require('./routes/document-verification.routes'));
app.use('/api/location', require('./routes/location.routes'));
app.use('/api', servicemanagement);
app.use('/api/admin', adminRoutes);
app.use('/api/support', supportRoutes);
app.use('/api/test', testRoutes);
app.use('/api/professional/schedule', scheduleRoutes);
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
connectDB();

setupSwagger(app);

app.use((err, req, res, next) => {
  logger.error(err.stack);
  res.status(err.status || 500).json({
      error: process.env.NODE_ENV === 'development' ? err.message : 'Internal server error'
  });
});

// Start server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  logger.info(`Server running on port ${PORT}`);
  logger.info('Environment:', process.env.NODE_ENV);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (err) => {
  logger.error('Unhandled Promise Rejection:', err);
  // Don't exit the process in development
  if (process.env.NODE_ENV === 'production') {
      server.close(() => process.exit(1));
  }
});

module.exports = { app, server, socketService };