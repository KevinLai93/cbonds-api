import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import dotenv from 'dotenv';
import https from 'https';
import fs from 'fs';
import path from 'path';

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());
app.use(morgan('dev'));

const PORT = 6667;

// Credentials from environment variables
const CBONDS_LOGIN = process.env.CBONDS_LOGIN;
const CBONDS_PASSWORD = process.env.CBONDS_PASSWORD;

if (!CBONDS_LOGIN || !CBONDS_PASSWORD) {
  console.warn('CBONDS credentials are not set. Set CBONDS_LOGIN and CBONDS_PASSWORD in .env');
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

app.get('/api/get_emissions', async (req, res) => {
  const isin = req.query.isin;
  if (!isin) return res.status(400).json({ error: 'isin required' });

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

    const data = await response.json();
    res.json(data);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Cbonds API error', detail: err.message });
  }
});

// Start HTTPS server if certs exist; otherwise fallback to HTTP
const sslKeyPath = path.resolve('ssl/key.pem');
const sslCertPath = path.resolve('ssl/cert.pem');

if (fs.existsSync(sslKeyPath) && fs.existsSync(sslCertPath)) {
  const credentials = {
    key: fs.readFileSync(sslKeyPath),
    cert: fs.readFileSync(sslCertPath)
  };
  https.createServer(credentials, app).listen(PORT, () => {
    console.log(`Local API running on https://localhost:${PORT}`);
  });
} else {
  app.listen(PORT, () => {
    console.log(`Local API running on http://localhost:${PORT}`);
  });
}

