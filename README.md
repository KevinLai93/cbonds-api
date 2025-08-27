# Cbonds API

A Node.js Express API for querying bond emissions data from Cbonds.

## Features

- Query bond emissions by ISIN code
- HTTPS support with mkcert certificates
- CORS enabled for cross-origin requests
- Environment variable configuration
- AWS Lambda deployment ready

## Local Development

### Prerequisites

- Node.js 18+
- mkcert (for HTTPS)

### Setup

1. Install dependencies:
```bash
npm install
```

2. Create `.env` file:
```bash
CBONDS_LOGIN=your_email@domain.com
CBONDS_PASSWORD=your_password
```

3. Generate SSL certificates:
```bash
mkcert -install
mkdir -p ssl
mkcert -key-file ssl/key.pem -cert-file ssl/cert.pem localhost 127.0.0.1 ::1
```

4. Start the server:
```bash
# HTTP only
npm start

# HTTPS (if SSL certs exist)
npm start

# Development with auto-reload
npm run dev
```

### Local Endpoints

- Health: `https://localhost:6667/api/health`
- Get Emissions: `https://localhost:6667/api/get_emissions?isin=US037833DY36`

## AWS Deployment

### Option 1: Serverless (Lambda + API Gateway) - Recommended

#### Prerequisites

1. Install AWS CLI and configure credentials:
```bash
aws configure
```

2. Install Serverless Framework:
```bash
npm install -g serverless
```

3. Install deployment dependencies:
```bash
npm install
```

#### Deploy

1. Set environment variables in AWS Systems Manager Parameter Store:
```bash
aws ssm put-parameter --name "/cbonds-api/dev/CBONDS_LOGIN" --value "your_email@domain.com" --type "SecureString"
aws ssm put-parameter --name "/cbonds-api/dev/CBONDS_PASSWORD" --value "your_password" --type "SecureString"
```

2. Update `serverless.yml` with your region and environment variable references.

3. Deploy:
```bash
# Deploy to dev
npm run deploy

# Deploy to production
npm run deploy:prod
```

4. The deployment will output your API Gateway URL.

#### Benefits
- Pay per request (very cost-effective for low traffic)
- Auto-scaling
- No server management
- Built-in monitoring

### Option 2: EC2 (Traditional Server)

#### Prerequisites

1. AWS EC2 instance (t3.micro for testing)
2. Security group with port 80/443 open
3. Domain name (optional)

#### Deploy

1. Launch EC2 instance with Ubuntu/Amazon Linux
2. Install Node.js and PM2
3. Clone your repository
4. Set environment variables
5. Use PM2 to run the service

#### Benefits
- Full control over the server
- Fixed IP address
- Can run multiple services

### Option 3: ECS Fargate

#### Prerequisites

1. Docker installed locally
2. AWS ECS cluster
3. Application Load Balancer

#### Deploy

1. Create Dockerfile
2. Build and push to ECR
3. Deploy to ECS Fargate
4. Configure ALB

## Environment Variables

- `CBONDS_LOGIN`: Your Cbonds login email
- `CBONDS_PASSWORD`: Your Cbonds password
- `NODE_ENV`: Environment (development/production)
- `PORT`: Port number (default: 6667)

## API Endpoints

### GET /api/health
Health check endpoint.

**Response:**
```json
{
  "status": "ok",
  "environment": "dev",
  "timestamp": "2025-08-27T12:00:00.000Z"
}
```

### GET /api/get_emissions
Query bond emissions by ISIN.

**Query Parameters:**
- `isin` (required): ISIN code

**Example:**
```
GET /api/get_emissions?isin=US037833DY36
```

**Response:**
Returns Cbonds API response with bond emission data.

## CORS

The API supports CORS with the following headers:
- `Access-Control-Allow-Origin: *`
- `Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS`
- `Access-Control-Allow-Headers: Content-Type, Authorization`

## Monitoring

### CloudWatch Logs (AWS)
- Lambda logs are automatically sent to CloudWatch
- Set up alarms for errors and latency

### Local Logs
- Morgan HTTP request logging
- Error logging to console

## Security

- Environment variables for sensitive data
- HTTPS support with valid certificates
- CORS configuration for cross-origin requests
- Input validation for API parameters

## Troubleshooting

### Common Issues

1. **CORS errors**: Check CORS configuration and browser console
2. **SSL certificate errors**: Ensure mkcert is installed and certificates are valid
3. **Environment variables**: Verify `.env` file exists and variables are set
4. **Port conflicts**: Check if port 6667 is available

### AWS Deployment Issues

1. **Lambda timeout**: Increase timeout in `serverless.yml`
2. **Memory issues**: Increase memory allocation
3. **Environment variables**: Check Parameter Store configuration
4. **IAM permissions**: Verify Lambda execution role permissions

## Support

For issues and questions:
1. Check the logs
2. Verify environment variables
3. Test endpoints locally first
4. Check AWS CloudWatch logs for Lambda issues
