import { verifyToken } from './auth.js';

// 公开端点列表 - 不需要认证
const PUBLIC_ENDPOINTS = [
  '/api/health',
  '/api/login'
];

// 全局认证中间件
export const globalAuth = (req, res, next) => {
  // 检查是否是公开端点
  if (PUBLIC_ENDPOINTS.includes(req.path)) {
    return next();
  }

  // 对于非公开端点，检查认证
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

  if (!token) {
    return res.status(401).json({ 
      error: 'Authentication required',
      message: 'Access token required for this endpoint',
      code: 'AUTH_REQUIRED'
    });
  }

  // 验证token
  const result = verifyToken(token);
  if (!result.valid) {
    return res.status(403).json({ 
      error: 'Invalid token',
      message: 'The provided token is invalid or expired',
      code: 'INVALID_TOKEN'
    });
  }

  // 添加用户信息到请求对象
  req.user = result.user;
  next();
};

// 可选认证中间件 - 如果提供token则验证，否则继续
export const optionalGlobalAuth = (req, res, next) => {
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

