import serverless from 'serverless-http';
import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import dotenv from 'dotenv';
import { findUserByCredentials } from './users.js';
import { generateToken, authenticateToken, requireRole } from './auth.js';
import { globalAuth } from './middleware.js';

dotenv.config();

const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(morgan('combined'));

// 全局认证中间件 - 保护所有非公开端点
app.use(globalAuth);

// CORS headers
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  next();
});

// Environment variables
const FINANCIAL_DATA_LOGIN = process.env.FINANCIAL_DATA_LOGIN;
const FINANCIAL_DATA_PASSWORD = process.env.FINANCIAL_DATA_PASSWORD;

if (!FINANCIAL_DATA_LOGIN || !FINANCIAL_DATA_PASSWORD) {
  console.warn('Financial Data API credentials are not set. Set FINANCIAL_DATA_LOGIN and FINANCIAL_DATA_PASSWORD in environment variables.');
}

// Health check
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'ok',
    environment: process.env.STAGE || 'dev',
    timestamp: new Date().toISOString()
  });
});

// Login endpoint
app.post('/api/login', async (req, res) => {
  const { username, password } = req.body;
  
  if (!username || !password) {
    return res.status(400).json({ 
      error: 'Missing credentials',
      message: 'Username and password are required' 
    });
  }

  try {
    const user = findUserByCredentials(username, password);
    
    if (!user) {
      return res.status(401).json({ 
        error: 'Invalid credentials',
        message: 'Username or password is incorrect' 
      });
    }

    // Generate JWT token
    const token = generateToken(user);
    
    // Return user info and token (without password)
    const { password: _, ...userWithoutPassword } = user;
    
    res.json({
      success: true,
      message: 'Login successful',
      user: userWithoutPassword,
      token,
      expiresIn: '24h'
    });
    
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ 
      error: 'Login failed',
      message: 'An error occurred during login' 
    });
  }
});

// Protected endpoint example - requires authentication
app.get('/api/profile', (req, res) => {
  res.json({
    success: true,
    message: 'Profile retrieved successfully',
    user: req.user
  });
});

// Admin-only endpoint example
app.get('/api/admin/users', requireRole(['admin']), (req, res) => {
  res.json({
    success: true,
    message: 'Admin users list retrieved',
    users: [
      { id: 1, username: 'admin', role: 'admin', name: 'Administrator' },
      { id: 2, username: 'user1', role: 'user', name: 'Regular User' },
      { id: 3, username: 'analyst', role: 'analyst', name: 'Financial Analyst' }
    ]
  });
});

// Get emissions endpoint
app.get('/api/get_emissions', async (req, res) => {
  const isin = req.query.isin;
  if (!isin) {
    return res.status(400).json({ error: 'isin required' });
  }

  try {
    console.log(`🔍 查询ISIN: ${isin}`);
    console.log(`🔐 使用Financial Data账号: ${FINANCIAL_DATA_LOGIN}`);
    
    const requestBody = {
      auth: { login: FINANCIAL_DATA_LOGIN, password: FINANCIAL_DATA_PASSWORD },
      filters: [{ field: 'isin_code', operator: 'in', value: isin }],
      quantity: { limit: 1, offset: 0 }
    };
    
    console.log(`📤 发送请求到Financial Data API:`, JSON.stringify(requestBody, null, 2));
    
    // 使用与curl相同的请求头
    const response = await fetch('https://ws.cbonds.info/services/json/get_emissions/', {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'User-Agent': 'curl/8.7.1',
        'Accept': '*/*'
      },
      body: JSON.stringify(requestBody)
    });

    console.log(`📥 Financial Data API响应状态: ${response.status}`);
    console.log(`📥 Financial Data API响应头:`, Object.fromEntries(response.headers.entries()));

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`❌ Financial Data API错误响应: ${errorText}`);
      throw new Error(`Financial Data API responded with status: ${response.status} - ${errorText}`);
    }

    const responseText = await response.text();
    console.log(`📥 Financial Data API原始响应: ${responseText}`);
    
    let data;
    try {
      data = JSON.parse(responseText);
    } catch (parseError) {
      console.error(`❌ JSON解析错误: ${parseError.message}`);
      console.error(`❌ 原始响应内容: ${responseText}`);
      throw new Error(`Invalid JSON response from Financial Data API: ${responseText}`);
    }

    console.log(`✅ 成功解析Financial Data API响应:`, data);
    res.json(data);
    
  } catch (err) {
    console.error(`❌ Financial Data API调用错误:`, err);
    res.status(500).json({ 
      error: 'Financial Data API error', 
      detail: err.message,
      isin: isin,
      timestamp: new Date().toISOString()
    });
  }
});

// Financial Data API - 获取发行商信息
app.get('/api/financial-data/get_emission_default', async (req, res) => {
  try {
    console.log(`🔍 获取Financial Data债券违约数据...`);
    
    // 支持ISIN查询参数
    const filters = req.body?.filters || [];
    if (req.query.isin) {
      filters.push({ field: 'isin_code', operator: 'in', value: req.query.isin });
    }
    
    const requestBody = {
      auth: { login: FINANCIAL_DATA_LOGIN, password: FINANCIAL_DATA_PASSWORD },
      filters: filters,
      quantity: req.body?.quantity || { limit: 100, offset: 0 }
    };
    
    console.log(`📤 发送请求到Financial Data API:`, JSON.stringify(requestBody, null, 2));
    
    const response = await fetch('https://ws.cbonds.info/services/json/get_emission_default/', {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'User-Agent': 'curl/8.7.1',
        'Accept': '*/*'
      },
      body: JSON.stringify(requestBody)
    });

    console.log(`📥 Financial Data API响应状态: ${response.status}`);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error(`❌ Financial Data API错误响应: ${errorText}`);
      throw new Error(`Financial Data API responded with status: ${response.status} - ${errorText}`);
    }

    const responseText = await response.text();
    console.log(`📥 Financial Data API原始响应长度: ${responseText.length} 字符`);
    
    let data;
    try {
      data = JSON.parse(responseText);
      console.log(`✅ 成功解析Financial Data API响应`);
    } catch (parseError) {
      console.error(`❌ JSON解析错误: ${parseError.message}`);
      throw new Error(`Invalid JSON response from Financial Data API: ${responseText}`);
    }

    res.json(data);
    
  } catch (err) {
    console.error(`❌ Financial Data API调用错误:`, err);
    res.status(500).json({ 
      error: 'Financial Data API error', 
      detail: err.message,
      endpoint: 'get_emission_default',
      timestamp: new Date().toISOString()
    });
  }
});

// Financial Data API - 获取公司信息
app.get('/api/financial-data/get_emission_guarantors', async (req, res) => {
  try {
    console.log(`🔍 获取Financial Data债券担保人数据...`);
    
    // 支持ISIN查询参数
    const filters = req.body?.filters || [];
    if (req.query.isin) {
      filters.push({ field: 'isin_code', operator: 'in', value: req.query.isin });
    }
    
    const requestBody = {
      auth: { login: FINANCIAL_DATA_LOGIN, password: FINANCIAL_DATA_PASSWORD },
      filters: filters,
      quantity: req.body?.quantity || { limit: 100, offset: 0 }
    };
    
    console.log(`📤 发送请求到Financial Data API:`, JSON.stringify(requestBody, null, 2));
    
    const response = await fetch('https://ws.cbonds.info/services/json/get_emission_guarantors/', {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'User-Agent': 'curl/8.7.1',
        'Accept': '*/*'
      },
      body: JSON.stringify(requestBody)
    });

    console.log(`📥 Financial Data API响应状态: ${response.status}`);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error(`❌ Financial Data API错误响应: ${errorText}`);
      throw new Error(`Financial Data API responded with status: ${response.status} - ${errorText}`);
    }

    const responseText = await response.text();
    console.log(`📥 Financial Data API原始响应长度: ${responseText.length} 字符`);
    
    let data;
    try {
      data = JSON.parse(responseText);
      console.log(`✅ 成功解析Financial Data API响应`);
    } catch (parseError) {
      console.error(`❌ JSON解析错误: ${parseError.message}`);
      throw new Error(`Invalid JSON response from Financial Data API: ${responseText}`);
`);
    }

    res.json(data);
    
  } catch (err) {
    console.error(`❌ Financial Data API调用错误:`, err);
    res.status(500).json({ 
      error: 'Financial Data API error', 
      detail: err.message,
      endpoint: 'get_emission_guarantors',
      timestamp: new Date().toISOString()
    });
  }
});

// Financial Data API - 获取最新报价
app.get('/api/financial-data/get_flow_new', async (req, res) => {
  try {
    console.log(`🔍 获取Financial Data债券付息计划...`);
    
    // 支持ISIN查询参数 - get_flow_new需要使用emission_id
    const filters = req.body?.filters || [];
    if (req.query.isin) {
      // 对于get_flow_new，需要先通过ISIN获取emission_id
      try {
        const emissionResponse = await fetch('https://ws.cbonds.info/services/json/get_emissions/', {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            'User-Agent': 'curl/8.7.1',
            'Accept': '*/*'
          },
          body: JSON.stringify({
            auth: { login: FINANCIAL_DATA_LOGIN, password: FINANCIAL_DATA_PASSWORD },
            filters: [{ field: 'isin_code', operator: 'in', value: req.query.isin }],
            quantity: { limit: 1, offset: 0 }
          })
        });
        
        if (emissionResponse.ok) {
          const emissionData = await emissionResponse.json();
          if (emissionData.items && emissionData.items.length > 0) {
            const emissionId = emissionData.items[0].id;
            filters.push({ field: 'emission_id', operator: 'in', value: emissionId });
          }
        }
      } catch (err) {
        console.error('获取emission_id失败:', err);
        // 如果获取失败，回退到isin_code过滤
        filters.push({ field: 'isin_code', operator: 'in', value: req.query.isin });
      }
    }
    
    // 为get_flow_new添加额外的过滤条件以减少数据量
    if (filters.length === 0) {
      // 如果没有ISIN过滤，添加日期范围过滤以减少数据量
      const today = new Date();
      const oneYearAgo = new Date(today.getFullYear() - 1, today.getMonth(), today.getDate());
      filters.push({ 
        field: 'date', 
        operator: 'gte', 
        value: oneYearAgo.toISOString().split('T')[0] 
      });
    }
    
    const requestBody = {
      auth: { login: FINANCIAL_DATA_LOGIN, password: FINANCIAL_DATA_PASSWORD },
      filters: filters,
      quantity: req.body?.quantity || { limit: 50, offset: 0 }  // 减少默认limit
    };
    
    console.log(`📤 发送请求到Financial Data API:`, JSON.stringify(requestBody, null, 2));
    
    const response = await fetch('https://ws.cbonds.info/services/json/get_flow_new/', {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'User-Agent': 'curl/8.7.1',
        'Accept': '*/*'
      },
      body: JSON.stringify(requestBody)
    });

    console.log(`📥 Financial Data API响应状态: ${response.status}`);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error(`❌ Financial Data API错误响应: ${errorText}`);
      throw new Error(`Financial Data API responded with status: ${response.status} - ${errorText}`);
    }

    const responseText = await response.text();
    console.log(`📥 Financial Data API原始响应长度: ${responseText.length} 字符`);
    
    let data;
    try {
      data = JSON.parse(responseText);
      console.log(`✅ 成功解析Financial Data API响应`);
    } catch (parseError) {
      console.error(`❌ JSON解析错误: ${parseError.message}`);
      throw new Error(`Invalid JSON response from Financial Data API: ${responseText}`);
    }

    res.json(data);
    
  } catch (err) {
    console.error(`❌ Financial Data API调用错误:`, err);
    res.status(500).json({ 
      error: 'Financial Data API error', 
      detail: err.message,
      endpoint: 'get_flow_new',
      timestamp: new Date().toISOString()
    });
  }
});

// Financial Data API - 获取债券期权数据
app.get('/api/financial-data/get_offert', async (req, res) => {
  try {
    console.log(`🔍 获取Financial Data债券期权数据...`);
    
    // 支持ISIN查询参数
    const filters = req.body?.filters || [];
    if (req.query.isin) {
      filters.push({ field: 'isin_code', operator: 'in', value: req.query.isin });
    }
    
    const requestBody = {
      auth: { login: FINANCIAL_DATA_LOGIN, password: FINANCIAL_DATA_PASSWORD },
      filters: filters,
      quantity: req.body?.quantity || { limit: 100, offset: 0 }
    };
    
    console.log(`📤 发送请求到Financial Data API:`, JSON.stringify(requestBody, null, 2));
    
    const response = await fetch('https://ws.cbonds.info/services/json/get_offert/', {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'User-Agent': 'curl/8.7.1',
        'Accept': '*/*'
      },
      body: JSON.stringify(requestBody)
    });

    console.log(`📥 Financial Data API响应状态: ${response.status}`);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error(`❌ Financial Data API错误响应: ${errorText}`);
      throw new Error(`Financial Data API responded with status: ${response.status} - ${errorText}`);
    }

    const responseText = await response.text();
    console.log(`📥 Financial Data API原始响应长度: ${responseText.length} 字符`);
    
    let data;
    try {
      data = JSON.parse(responseText);
      console.log(`✅ 成功解析Financial Data API响应`);
    } catch (parseError) {
      console.error(`❌ JSON解析错误: ${parseError.message}`);
      throw new Error(`Invalid JSON response from Financial Data API: ${responseText}`);
    }

    res.json(data);
    
  } catch (err) {
    console.error(`❌ Financial Data API调用错误:`, err);
    res.status(500).json({ 
      error: 'Financial Data API error', 
      detail: err.message,
      endpoint: 'get_offert',
      timestamp: new Date().toISOString()
    });
  }
});

// Financial Data API - 获取债券交易报价数据
app.get('/api/financial-data/get_tradings_new', async (req, res) => {
  try {
    console.log(`🔍 获取Financial Data债券交易报价数据...`);
    
    // 支持ISIN查询参数
    const filters = req.body?.filters || [];
    if (req.query.isin) {
      filters.push({ field: 'isin_code', operator: 'in', value: req.query.isin });
    }
    
    const requestBody = {
      auth: { login: FINANCIAL_DATA_LOGIN, password: FINANCIAL_DATA_PASSWORD },
      filters: filters,
      quantity: req.body?.quantity || { limit: 100, offset: 0 }
    };
    
    console.log(`📤 发送请求到Financial Data API:`, JSON.stringify(requestBody, null, 2));
    
    const response = await fetch('https://ws.cbonds.info/services/json/get_tradings_new/', {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'User-Agent': 'curl/8.7.1',
        'Accept': '*/*'
      },
      body: JSON.stringify(requestBody)
    });

    console.log(`📥 Financial Data API响应状态: ${response.status}`);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error(`❌ Financial Data API错误响应: ${errorText}`);
      throw new Error(`Financial Data API responded with status: ${response.status} - ${errorText}`);
    }

    const responseText = await response.text();
    console.log(`📥 Financial Data API原始响应长度: ${responseText.length} 字符`);
    
    let data;
    try {
      data = JSON.parse(responseText);
      console.log(`✅ 成功解析Financial Data API响应`);
    } catch (parseError) {
      console.error(`❌ JSON解析错误: ${parseError.message}`);
      throw new Error(`Invalid JSON response from Financial Data API: ${responseText}`);
    }

    res.json(data);
    
  } catch (err) {
    console.error(`❌ Financial Data API调用错误:`, err);
    res.status(500).json({ 
      error: 'Financial Data API error', 
      detail: err.message,
      endpoint: 'get_tradings_new',
      timestamp: new Date().toISOString()
    });
  }
});

// Catch-all for undefined routes
app.use('*', (req, res) => {
  res.status(404).json({ 
    error: 'Route not found',
    path: req.originalUrl,
    method: req.method
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ 
    error: 'Internal server error',
    message: err.message,
    timestamp: new Date().toISOString()
  });
});

// Export for Lambda
export const handler = serverless(app);

// For local development
if (process.env.NODE_ENV !== 'production') {
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => {
    console.log(`Local server running on http://localhost:${PORT}`);
  });
}

