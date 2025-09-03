import jwt from 'jsonwebtoken';
import { findUserById } from './users.js';

// JWT secret key - in production, use a strong secret and store in environment variables
const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-in-production';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '24h';

// Generate JWT token
export const generateToken = (user) => {
  const payload = {
    id: user.id,
    username: user.username,
    role: user.role,
    name: user.name
  };
  
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
};

// Verify JWT token
export const verifyToken = (token) => {
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    return { valid: true, user: decoded };
  } catch (error) {
    return { valid: false, error: error.message };
  }
};

// Middleware to authenticate requests
export const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

  if (!token) {
    return res.status(401).json({ 
      error: 'Access token required',
      message: 'Please provide a valid access token in Authorization header'
    });
  }

  const result = verifyToken(token);
  if (!result.valid) {
    return res.status(403).json({ 
      error: 'Invalid token',
      message: 'The provided token is invalid or expired'
    });
  }

  // Add user info to request object
  req.user = result.user;
  next();
};

// Optional authentication middleware (for endpoints that can work with or without auth)
export const optionalAuth = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (token) {
    const result = verifyToken(token);
    if (result.valid) {
      req.user = result.user;
    }
  }
  
  next();
};

// Role-based access control middleware
export const requireRole = (roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ 
        error: 'Authentication required',
        message: 'Please login to access this resource'
      });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ 
        error: 'Insufficient permissions',
        message: `Role '${req.user.role}' is not authorized to access this resource`
      });
    }

    next();
  };
};

