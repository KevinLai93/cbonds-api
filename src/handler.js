import serverless from 'serverless-http';
import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import dotenv from 'dotenv';

dotenv.config();

const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(morgan('combined'));

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
const CBONDS_LOGIN = process.env.CBONDS_LOGIN;
const CBONDS_PASSWORD = process.env.CBONDS_PASSWORD;

if (!CBONDS_LOGIN || !CBONDS_PASSWORD) {
  console.warn('CBONDS credentials are not set. Set CBONDS_LOGIN and CBONDS_PASSWORD in environment variables.');
}

// Health check
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'ok',
    environment: process.env.STAGE || 'dev',
    timestamp: new Date().toISOString()
  });
});

// Get emissions endpoint
app.get('/api/get_emissions', async (req, res) => {
  const isin = req.query.isin;
  if (!isin) {
    return res.status(400).json({ error: 'isin required' });
  }

  try {
    const response = await fetch('https://ws.cbonds.info/services/json/get_emissions/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        auth: { login: CBONDS_LOGIN, password: CBONDS_PASSWORD },
        filters: [{ field: 'isin_code', operator: 'in', value: isin }],
        quantity: { limit: 1, offset: 0 }
      })
    });

    if (!response.ok) {
      throw new Error(`Cbonds API responded with status: ${response.status}`);
    }

    const data = await response.json();
    res.json(data);
  } catch (err) {
    console.error('Error calling Cbonds API:', err);
    res.status(500).json({ 
      error: 'Cbonds API error', 
      detail: err.message,
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
