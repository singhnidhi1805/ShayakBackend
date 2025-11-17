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
const paymentRoutes = require('./routes/payment.routes');
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

// ✅ FIXED: Comprehensive CORS configuration
const corsOptions = {
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    
    const allowedOrigins = [
      'https://shyakadmin.vercel.app',
      'http://localhost:3000',
      'http://localhost:3001',
      process.env.CLIENT_URL
    ].filter(Boolean); // Remove undefined values
    
    if (allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  exposedHeaders: ['Content-Length', 'X-Requested-With'],
  maxAge: 86400 // 24 hours
};

// ✅ Apply CORS middleware BEFORE other middleware
app.use(cors(corsOptions));

// Handle preflight requests
app.options('*', cors(corsOptions));

// Middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// ✅ Serve static files for uploaded images
app.use('/uploads', express.static('uploads'));

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

// Initialize socket service
socketService.initializeSocket(server);

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/services', require('./routes/service.routes'));
app.use('/api/bookings', require('./routes/booking.routes'));
app.use('/api/professionals', professionalRoutes);
app.use('/api/professionals', require('./routes/professional-onboarding.routes'));
app.use('/api/professional', professionalLocationRoutes);
app.use('/api/professional', earningRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/professionals', require('./routes/document-verification.routes'));
app.use('/api/location', require('./routes/location.routes'));
app.use('/api/admin', servicemanagement); // ✅ FIXED: Service management routes now under /api/admin
app.use('/api/admin', adminRoutes);
app.use('/api/support', supportRoutes);
app.use('/api/test', testRoutes);
app.use('/api/professional/schedule', scheduleRoutes);
app.use('/api/tracking', trackingRoutes);

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

// ✅ Error handling middleware
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
  if (process.env.NODE_ENV === 'production') {
    server.close(() => process.exit(1));
  }
});

module.exports = { app, server, socketService };