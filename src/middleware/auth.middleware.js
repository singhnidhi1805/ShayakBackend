const jwt = require('jsonwebtoken');
const User = require('../models/user.model');
const Professional = require('../models/professional.model');
const Admin = require('../models/admin.model');

// Map of role to model
const MODEL_MAP = {
  user: User,
  professional: Professional,
  admin: Admin
};

/**
 * SIMPLIFIED auth middleware - fixes the infinite loading issue
 * This version eliminates the complex dual-calling pattern
 */
const auth = (allowedRoles = ['user', 'professional', 'admin']) => {
  return async (req, res, next) => {
    console.log('🔐 [AUTH] Auth middleware called for:', req.path);
    console.log('🔐 [AUTH] Allowed roles:', allowedRoles);
    
    try {
      // Get token from header
      const authHeader = req.header('Authorization');
      if (!authHeader) {
        console.log('❌ [AUTH] No authorization header');
        return res.status(401).json({ 
          success: false,
          message: 'No authorization token provided'
        });
      }

      const token = authHeader.replace('Bearer ', '');
      
      // Add token format validation
      if (!token || token.split('.').length !== 3) {
        console.log('❌ [AUTH] Invalid token format');
        return res.status(401).json({ 
          success: false,
          message: 'Invalid token format'
        });
      }

      console.log('🔐 [AUTH] Token found, verifying...');

      // Verify token
      let decoded;
      try {
        decoded = jwt.verify(token, process.env.JWT_SECRET);
        console.log('✅ [AUTH] Token verified:', {
          role: decoded.role,
          userId: decoded.userId,
          id: decoded.id
        });
      } catch (jwtError) {
        console.error('❌ [AUTH] JWT Verification failed:', jwtError.message);
        
        if (jwtError.name === 'JsonWebTokenError') {
          return res.status(401).json({ 
            success: false,
            message: 'Invalid token'
          });
        } else if (jwtError.name === 'TokenExpiredError') {
          return res.status(401).json({ 
            success: false,
            message: 'Token has expired'
          });
        }
        
        return res.status(401).json({
          success: false,
          message: 'Token verification failed'
        });
      }

      if (!decoded.role || (!decoded.id && !decoded.userId)) {
        console.log('❌ [AUTH] Invalid token payload');
        return res.status(401).json({ 
          success: false,
          message: 'Invalid token payload'
        });
      }

      // Check if role is allowed
      if (!allowedRoles.includes(decoded.role)) {
        console.log('❌ [AUTH] Role not allowed:', decoded.role);
        return res.status(403).json({ 
          success: false,
          message: `Role '${decoded.role}' not allowed`
        });
      }

      console.log('🔐 [AUTH] Finding user in database...');

      // Get user from appropriate model based on role
      const Model = MODEL_MAP[decoded.role];
      if (!Model) {
        console.log('❌ [AUTH] Invalid user role:', decoded.role);
        return res.status(500).json({ 
          success: false,
          message: 'Invalid user role'
        });
      }

      // Always use the MongoDB _id (decoded.id) to find the user when available
      const documentId = decoded.id || decoded.userId;
      
      // Try to find the user with timeout protection
      let user = null;
      
      try {
        const findUserPromise = async () => {
          // First try to find by _id if it appears to be a valid MongoDB ObjectId
          if (documentId && /^[0-9a-fA-F]{24}$/.test(documentId)) {
            user = await Model.findById(documentId);
          }
          
          // If not found and it's a professional, try to find by userId field
          if (!user && decoded.role === 'professional' && decoded.userId) {
            user = await Professional.findOne({ userId: decoded.userId });
          }
          
          return user;
        };
        
        // Add timeout
        const timeoutPromise = new Promise((_, reject) => {
          setTimeout(() => reject(new Error('Database query timeout')), 5000);
        });
        
        user = await Promise.race([findUserPromise(), timeoutPromise]);
        
      } catch (dbError) {
        console.error('❌ [AUTH] Database error:', dbError.message);
        
        if (dbError.message === 'Database query timeout') {
          return res.status(500).json({
            success: false,
            message: 'Database connection timeout'
          });
        }
        
        return res.status(500).json({
          success: false,
          message: 'Database error'
        });
      }

      if (!user) {
        console.log('❌ [AUTH] User not found in database for ID:', documentId);
        return res.status(401).json({ 
          success: false,
          message: 'User not found'
        });
      }

      console.log('✅ [AUTH] User found:', user._id, user.name || user.email || user.phone);

      // Check if user is active/verified (skip strict status check for testing)
      if (user.status === 'suspended') {
        console.log('❌ [AUTH] User account suspended');
        return res.status(403).json({ 
          success: false,
          message: 'Account is suspended'
        });
      }

      // Attach user and token to request
      req.user = user;
      req.token = token;
      req.userRole = decoded.role;
      
      console.log('✅ [AUTH] Auth middleware completed successfully');
      console.log('✅ [AUTH] Calling next()');
      
      // Call next middleware
      next();
      
    } catch (error) {
      console.error('❌ [AUTH] Authentication middleware error:', error.message);
      console.error('📚 [AUTH] Error stack:', error.stack);
      
      // Make sure response hasn't been sent already
      if (!res.headersSent) {
        res.status(500).json({ 
          success: false,
          message: 'Authentication error'
        });
      }
    }
  };
};

// Role-specific middleware shortcuts
auth.user = () => auth(['user']);
auth.professional = () => auth(['professional']);
auth.admin = () => auth(['admin']);
auth.any = () => auth(['user', 'professional', 'admin']);

module.exports = auth;