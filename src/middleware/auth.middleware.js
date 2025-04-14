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
 * Authentication middleware that verifies JWT token and attaches user to request
 * @param {string[]} allowedRoles - Array of roles allowed to access the route
 */
const auth = (allowedRoles = ['user', 'professional', 'admin']) => {
  return async (req, res, next) => {
    try {
      // Get token from header
      const authHeader = req.header('Authorization');
      if (!authHeader) {
        return res.status(401).json({ 
          error: 'No authorization token provided',
          details: 'Authorization header is missing'
        });
      }

      const token = authHeader.replace('Bearer ', '');
      
      // Add token format validation
      if (!token || token.split('.').length !== 3) {
        return res.status(401).json({ 
          error: 'Invalid token format',
          details: 'Token does not match JWT format'
        });
      }

      try {
        // Verify token
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        
        // Log successful token verification
        console.log('Token verified successfully:', {
          role: decoded.role,
          userId: decoded.userId,
          id: decoded.id,
          tokenExp: new Date(decoded.exp * 1000)
        });

        if (!decoded.role || (!decoded.id && !decoded.userId)) {
          return res.status(401).json({ 
            error: 'Invalid token payload',
            details: 'Token missing required fields (role and id/userId)'
          });
        }

        // Check if role is allowed
        if (!allowedRoles.includes(decoded.role)) {
          return res.status(403).json({ 
            error: 'Unauthorized access',
            details: `Role '${decoded.role}' not allowed. Allowed roles: ${allowedRoles.join(', ')}`
          });
        }

        // Get user from appropriate model based on role
        const Model = MODEL_MAP[decoded.role];
        if (!Model) {
          return res.status(500).json({ 
            error: 'Invalid user role',
            details: `Role '${decoded.role}' has no corresponding model`
          });
        }

        // Always use the MongoDB _id (decoded.id) to find the user when available
        const documentId = decoded.id || decoded.userId;
        
        // Try to find the user
        let user = null;
        
        // First try to find by _id if it appears to be a valid MongoDB ObjectId
        if (documentId && /^[0-9a-fA-F]{24}$/.test(documentId)) {
          user = await Model.findById(documentId);
        }
        
        // If not found and it's a professional, try to find by userId field
        if (!user && decoded.role === 'professional' && decoded.userId) {
          user = await Professional.findOne({ userId: decoded.userId });
        }

        if (!user) {
          return res.status(401).json({ 
            error: 'User not found',
            details: 'User ID from token does not exist in database'
          });
        }

        // Check if user is active/verified
        if (user.status === 'suspended' || user.status === 'inactive') {
          return res.status(403).json({ 
            error: 'Account is not active',
            details: `Account status is: ${user.status}`
          });
        }

        // Attach user and token to request
        req.user = user;
        req.token = token;
        req.userRole = decoded.role;
        
        next();
      } catch (jwtError) {
        // Log JWT verification failure
        console.error('JWT Verification failed:', {
          error: jwtError.message,
          token: token.substring(0, 10) + '...' // Log part of token safely
        });
        
        if (jwtError.name === 'JsonWebTokenError') {
          return res.status(401).json({ 
            error: 'Invalid token',
            details: jwtError.message
          });
        } else if (jwtError.name === 'TokenExpiredError') {
          return res.status(401).json({ 
            error: 'Token has expired',
            details: `Token expired at ${new Date(jwtError.expiredAt)}`
          });
        }
        
        throw jwtError; // Re-throw unexpected JWT errors
      }
    } catch (error) {
      console.error('Authentication middleware error:', error);
      res.status(500).json({ 
        error: 'Authentication error',
        details: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
      });
    }
  };
};

// Role-specific middleware shortcuts
auth.user = auth(['user']);
auth.professional = auth(['professional']);
auth.admin = auth(['admin']);
auth.any = auth(['user', 'professional', 'admin']);

module.exports = auth;