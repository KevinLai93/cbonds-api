import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import dotenv from 'dotenv';
import https from 'https';
import http from 'http';
import fs from 'fs';
import path from 'path';
import { findUserByCredentials } from './users.js';
import { generateToken, authenticateToken, requireRole } from './auth.js';
import { globalAuth } from './middleware.js';
import { translateCompanyData, translateBondData, translateText, translateCompanyDataAsync, translateBondDataAsync } from './translations.js';
import { getUserUIConfig } from './ui-config.js';

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());
app.use(morgan('dev'));

// 全局认证中间件 - 保护所有非公开端点
app.use(globalAuth);

const PORT = 3000;

// Credentials from environment variables
const FINANCIAL_DATA_LOGIN = process.env.FINANCIAL_DATA_LOGIN;
const FINANCIAL_DATA_PASSWORD = process.env.FINANCIAL_DATA_PASSWORD;

if (!FINANCIAL_DATA_LOGIN || !FINANCIAL_DATA_PASSWORD) {
  console.warn('Financial Data API credentials are not set. Set FINANCIAL_DATA_LOGIN and FINANCIAL_DATA_PASSWORD in .env');
}

// Explicit CORS headers for all routes (in addition to cors())
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE');
  res.header('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(204);
  }
  next();
});

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
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
    
    // Get UI configuration for this user
    const uiConfig = getUserUIConfig(user.username, user.role);
    
    // Return user info and token (without password)
    const { password: _, ...userWithoutPassword } = user;
    
    res.json({
      success: true,
      message: 'Login successful',
      user: userWithoutPassword,
      token,
      expiresIn: '24h',
      accountType: {
        type: uiConfig.type,
        displayName: uiConfig.displayName,
        category: uiConfig.category
      }
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
  try {
    // Get UI configuration for this user
    const uiConfig = getUserUIConfig(req.user.username, req.user.role);
    
    res.json({
      success: true,
      message: 'Profile retrieved successfully',
      user: req.user,
      accountType: {
        type: uiConfig.type,
        displayName: uiConfig.displayName,
        category: uiConfig.category
      }
    });
  } catch (error) {
    console.error('Profile error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve profile',
      message: error.message
    });
  }
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

app.get('/api/get_emissions', async (req, res) => {
  const isin = req.query.isin;
  const lang = req.query.lang || 'eng'; // 支援語言參數，預設為英文
  if (!isin) return res.status(400).json({ error: 'isin required' });

  try {
    console.log(`🔍 查询ISIN: ${isin}, 语言: ${lang}`);
    console.log(`🔐 使用Financial Data账号: ${FINANCIAL_DATA_LOGIN}`);
    
    const requestBody = {
      auth: { login: FINANCIAL_DATA_LOGIN, password: FINANCIAL_DATA_PASSWORD },
      filters: [{ field: 'isin_code', operator: 'in', value: isin }],
      quantity: { limit: 1, offset: 0 }
    };
    
    console.log(`📤 发送请求到Financial Data API:`, JSON.stringify(requestBody, null, 2));
    
    // 語言參數直接加在URL路徑上
    const apiUrl = `https://ws.cbonds.info/services/json/get_emissions/?lang=${lang}`;
    console.log(`📤 API URL: ${apiUrl}`);
    
    // 使用与curl相同的请求头
    const response = await fetch(apiUrl, {
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
    
    // 如果請求中文，翻譯回應資料
    if (lang === 'zh' || lang === 'cht' || lang === 'zh-cn' || lang === 'zh-tw') {
      console.log(`🔄 翻譯資料到中文...`);
      
      if (data.items && Array.isArray(data.items)) {
        // 使用異步翻譯，包含產業別
        data.items = await Promise.all(
          data.items.map(async item => await translateBondDataAsync(item, 'zh'))
        );
      }
      
      // 更新meta資訊中的語言
      if (data.meta) {
        data.meta.lang = 'zh';
      }
      data.RequestLang = 'zh';
      
      console.log(`✅ 翻譯完成`);
    }
    
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

// 獲取發行人資訊 API
app.get('/api/get_emitents', async (req, res) => {
  const emitentId = req.query.emitent_id;
  const emitentName = req.query.emitent_name;
  const lang = req.query.lang || 'eng';
  
  if (!emitentId && !emitentName) {
    return res.status(400).json({ error: 'emitent_id or emitent_name required' });
  }

  try {
    console.log(`🔍 查询發行人: ${emitentId || emitentName}, 语言: ${lang}`);
    
    const filters = [];
    if (emitentId) {
      filters.push({ field: 'id', operator: 'in', value: emitentId });
    } else if (emitentName) {
      filters.push({ field: 'name_eng', operator: 'in', value: emitentName });
    }
    
    const requestBody = {
      auth: { login: FINANCIAL_DATA_LOGIN, password: FINANCIAL_DATA_PASSWORD },
      filters: filters,
      quantity: { limit: 1, offset: 0 }
    };
    
    console.log(`📤 发送请求到Financial Data API:`, JSON.stringify(requestBody, null, 2));
    
    const apiUrl = `https://ws.cbonds.info/services/json/get_emitents/?lang=${lang}`;
    console.log(`📤 API URL: ${apiUrl}`);
    
    const response = await fetch(apiUrl, {
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
    } catch (parseError) {
      console.error(`❌ JSON解析错误: ${parseError.message}`);
      throw new Error(`Invalid JSON response from Financial Data API: ${responseText}`);
    }

    console.log(`✅ 成功解析Financial Data API响应`);
    
    // 如果請求中文，翻譯回應資料
    if (lang === 'zh' || lang === 'cht' || lang === 'zh-cn' || lang === 'zh-tw') {
      console.log(`🔄 翻譯發行人資料到中文...`);
      
      if (data.items && Array.isArray(data.items)) {
        // 使用異步翻譯，包含產業別和發行者簡介
        data.items = await Promise.all(
          data.items.map(async item => await translateCompanyDataAsync(item, lang))
        );
      }
      
      // 更新meta資訊中的語言
      if (data.meta) {
        data.meta.lang = 'zh';
      }
      data.RequestLang = 'zh';
      
      console.log(`✅ 翻譯完成`);
    }
    
    res.json(data);
    
  } catch (err) {
    console.error(`❌ Financial Data API调用错误:`, err);
    res.status(500).json({ 
      error: 'Financial Data API error', 
      detail: err.message,
      emitent_id: emitentId,
      emitent_name: emitentName,
      timestamp: new Date().toISOString()
    });
  }
});

// 测试端点 - 直接使用成功的curl格式
app.get('/api/test_financial_data', async (req, res) => {
  try {
    console.log(`🧪 测试Financial Data API连接...`);
    
    const requestBody = {
      auth: { login: FINANCIAL_DATA_LOGIN, password: FINANCIAL_DATA_PASSWORD },
      filters: [{ field: 'isin_code', operator: 'in', value: 'US037833DY36' }],
      quantity: { limit: 1, offset: 0 }
    };
    
    console.log(`📤 测试请求体:`, JSON.stringify(requestBody, null, 2));
    
    const response = await fetch('https://ws.cbonds.info/services/json/get_emissions/', {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'User-Agent': 'curl/8.7.1',
        'Accept': '*/*'
      },
      body: JSON.stringify(requestBody)
    });

    console.log(`📥 测试响应状态: ${response.status}`);
    console.log(`📥 测试响应头:`, Object.fromEntries(response.headers.entries()));

    const responseText = await response.text();
    console.log(`📥 测试响应内容: ${responseText}`);
    
    if (!response.ok) {
      return res.status(response.status).json({
        error: 'Financial Data API test failed',
        status: response.status,
        response: responseText,
        headers: Object.fromEntries(response.headers.entries())
      });
    }

    try {
      const data = JSON.parse(responseText);
      res.json({
        success: true,
        message: 'Financial Data API test successful',
        data: data
      });
    } catch (parseError) {
      res.json({
        success: false,
        message: 'Financial Data API test successful but JSON parse failed',
        response: responseText,
        parseError: parseError.message
      });
    }
    
  } catch (err) {
    console.error(`❌ Financial Data API测试错误:`, err);
    res.status(500).json({ 
      error: 'Financial Data API test error', 
      detail: err.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Financial Data API - 获取发行商信息
app.get('/api/financial-data/get_emission_default', async (req, res) => {
  try {
    const lang = req.query.lang || 'eng';
    console.log(`🔍 获取Financial Data债券违约数据... 语言: ${lang}`);
    
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
    
    const apiUrl = `https://ws.cbonds.info/services/json/get_emission_default/?lang=${lang}`;
    const response = await fetch(apiUrl, {
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
    const lang = req.query.lang || 'eng';
    console.log(`🔍 获取Financial Data债券担保人数据... 语言: ${lang}`);
    
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
    
    const apiUrl = `https://ws.cbonds.info/services/json/get_emission_guarantors/?lang=${lang}`;
    const response = await fetch(apiUrl, {
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
    
    // 支持排序参数 - 默认按日期降序排列以获取最新数据
    if (req.query.sort_by === 'date' || req.query.sort_by === 'date_desc') {
      requestBody.sorting = [{ field: 'date', order: 'desc' }];
    } else if (req.query.sort_by === 'date_asc') {
      requestBody.sorting = [{ field: 'date', order: 'asc' }];
    } else if (req.body?.sorting) {
      requestBody.sorting = req.body.sorting;
    }
    
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

// Financial Data API - 获取债券交易报价数据 (POST版本，支持复杂查询)
app.post('/api/financial-data/get_tradings_new', async (req, res) => {
  try {
    console.log(`🔍 获取Financial Data债券交易报价数据 (POST)...`);
    
    const requestBody = {
      auth: { login: FINANCIAL_DATA_LOGIN, password: FINANCIAL_DATA_PASSWORD },
      filters: req.body.filters || [],
      quantity: req.body.quantity || { limit: 100, offset: 0 }
    };
    
    // 支持排序参数
    if (req.body.sorting) {
      requestBody.sorting = req.body.sorting;
    }
    
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

// 整合公司資訊API - 結合多個資料來源
app.get('/api/company/profile', async (req, res) => {
  try {
    const isin = req.query.isin;
    const lang = req.query.lang || 'eng';
    
    if (!isin) {
      return res.status(400).json({ error: 'isin parameter is required' });
    }

    console.log(`🔍 獲取公司完整資訊: ${isin}, 語言: ${lang}`);

    // 1. 從Financial Data獲取基本資訊
    const financialData = await fetch(`http://localhost:${PORT}/api/get_emissions?isin=${isin}&lang=${lang}`, {
      headers: { 'Authorization': req.headers.authorization }
    });
    
    if (!financialData.ok) {
      throw new Error('Failed to fetch Financial Data data');
    }
    
    const financialResult = await financialData.json();
    const companyData = financialResult.items?.[0];

    if (!companyData) {
      return res.status(404).json({ error: 'Company not found' });
    }

    // 2. 構建完整的公司資訊
    const companyProfile = {
      // 基本資訊
      basic_info: {
        name: companyData.emitent_name_eng || companyData.emitent_name_rus,
        full_name: companyData.emitent_full_name_eng || companyData.emitent_full_name_rus,
        industry: companyData.emitent_branch_name_eng || companyData.emitent_branch_name_rus,
        country: companyData.emitent_country_name_eng || companyData.emitent_country_name_rus,
        type: companyData.emitent_type_name_eng || companyData.emitent_type_name_rus,
        ticker: companyData.bbgid_ticker || 'N/A'
      },
      
      // 債券資訊
      bond_info: {
        isin: companyData.isin_code,
        document: companyData.document_eng || companyData.document_rus,
        currency: companyData.currency_name,
        maturity_date: companyData.maturity_date,
        coupon_rate: companyData.emission_coupon_rate,
        outstanding_volume: companyData.outstanding_volume,
        bond_type: companyData.kind_name_eng || companyData.kind_name_rus,
        bond_rank: companyData.bond_rank_name_eng || companyData.bond_rank_name_rus,
        status: companyData.status_name_eng || companyData.status_name_rus
      },
      
      // 金融機構
      financial_institutions: {
        bookrunners: companyData.agents_eng || companyData.agents_rus,
        depositories: companyData.agents_eng || companyData.agents_rus
      },
      
      // 信用評等 (需要額外資料來源)
      credit_ratings: {
        sp: 'N/A', // 需要額外API
        moodys: 'N/A', // 需要額外API
        fitch: 'N/A' // 需要額外API
      },
      
      // 公司介紹 (需要額外資料來源)
      company_introduction: {
        description: 'N/A', // 需要額外API或資料庫
        strengths: [], // 需要額外API或資料庫
        tlac_mrel: 'N/A' // 需要額外API
      },
      
      // 資料來源
      data_sources: {
        financial_data: true,
        additional_apis: false
      }
    };

    res.json({
      success: true,
      data: companyProfile,
      message: 'Company profile retrieved successfully'
    });

  } catch (err) {
    console.error(`❌ 公司資訊獲取錯誤:`, err);
    res.status(500).json({ 
      error: 'Failed to fetch company profile', 
      detail: err.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Start HTTP server
http.createServer(app).listen(PORT, () => {
  console.log(`Local API running on http://localhost:${PORT}`);
});