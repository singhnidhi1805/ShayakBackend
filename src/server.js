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
const testRoutes = require('./routes/test.routes');
const app = express();
const server = http.createServer(app);

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