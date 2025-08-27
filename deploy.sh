#!/bin/bash

# AWS Deployment Script for Cbonds API
# This script helps deploy your API to AWS Lambda + API Gateway

set -e

echo "🚀 AWS Deployment Script for Cbonds API"
echo "========================================"

# Check prerequisites
echo "📋 Checking prerequisites..."

if ! command -v aws &> /dev/null; then
    echo "❌ AWS CLI not found. Please install and configure it first:"
    echo "   https://docs.aws.amazon.com/cli/latest/userguide/getting-started-install.html"
    exit 1
fi

if ! command -v serverless &> /dev/null; then
    echo "❌ Serverless Framework not found. Installing..."
    npm install -g serverless
fi

# Check AWS credentials
echo "🔐 Checking AWS credentials..."
if ! aws sts get-caller-identity &> /dev/null; then
    echo "❌ AWS credentials not configured. Please run:"
    echo "   aws configure"
    exit 1
fi

echo "✅ AWS credentials configured for: $(aws sts get-caller-identity --query 'Account' --output text)"

# Check environment variables
echo "🔍 Checking environment variables..."
if [ ! -f .env ]; then
    echo "❌ .env file not found. Please create it with your Cbonds credentials:"
    echo "   CBONDS_LOGIN=your_email@domain.com"
    echo "   CBONDS_PASSWORD=your_password"
    exit 1
fi

# Load environment variables
source .env

if [ -z "$CBONDS_LOGIN" ] || [ -z "$CBONDS_PASSWORD" ]; then
    echo "❌ CBONDS_LOGIN or CBONDS_PASSWORD not set in .env file"
    exit 1
fi

echo "✅ Environment variables loaded"

# Set environment variables in AWS Parameter Store
echo "🔐 Setting environment variables in AWS Parameter Store..."
aws ssm put-parameter \
    --name "/cbonds-api/dev/CBONDS_LOGIN" \
    --value "$CBONDS_LOGIN" \
    --type "SecureString" \
    --overwrite

aws ssm put-parameter \
    --name "/cbonds-api/dev/CBONDS_PASSWORD" \
    --value "$CBONDS_PASSWORD" \
    --type "SecureString" \
    --overwrite

echo "✅ Environment variables stored in Parameter Store"

# Update serverless.yml with Parameter Store references
echo "📝 Updating serverless.yml..."
cat > serverless.yml << 'EOF'
service: cbonds-api

frameworkVersion: '3'

provider:
  name: aws
  runtime: nodejs18.x
  region: ap-northeast-1  # Tokyo region, change as needed
  stage: ${opt:stage, 'dev'}
  environment:
    CBONDS_LOGIN: ${ssm:/cbonds-api/${self:provider.stage}/CBONDS_LOGIN}
    CBONDS_PASSWORD: ${ssm:/cbonds-api/${self:provider.stage}/CBONDS_PASSWORD}
  iam:
    role:
      statements:
        - Effect: Allow
          Action:
            - ssm:GetParameter
            - ssm:GetParameters
          Resource: 
            - "arn:aws:ssm:${self:provider.region}:${aws:accountId}:parameter/cbonds-api/*"
        - Effect: Allow
          Action:
            - logs:CreateLogGroup
            - logs:CreateLogStream
            - logs:PutLogEvents
          Resource: "*"

functions:
  api:
    handler: src/handler.handler
    events:
      - httpApi:
          path: /api/{proxy+}
          method: '*'
    timeout: 30
    memorySize: 512

plugins:
  - serverless-offline

custom:
  serverless-offline:
    httpPort: 3000
    noPrependStageInUrl: true
EOF

echo "✅ serverless.yml updated"

# Deploy to AWS
echo "🚀 Deploying to AWS..."
serverless deploy --stage dev

echo ""
echo "🎉 Deployment completed!"
echo ""
echo "📋 Next steps:"
echo "1. Your API is now available at the URL shown above"
echo "2. Test the health endpoint: <your-api-url>/api/health"
echo "3. Test the emissions endpoint: <your-api-url>/api/get_emissions?isin=US037833DY36"
echo ""
echo "🔧 To remove the deployment:"
echo "   serverless remove --stage dev"
echo ""
echo "📊 To view logs:"
echo "   serverless logs -f api --stage dev"
echo ""
echo "🌐 To update environment variables:"
echo "   aws ssm put-parameter --name '/cbonds-api/dev/CBONDS_LOGIN' --value 'new_value' --type 'SecureString' --overwrite"
echo "   aws ssm put-parameter --name '/cbonds-api/dev/CBONDS_PASSWORD' --value 'new_value' --type 'SecureString' --overwrite"
echo "   serverless deploy --stage dev"
