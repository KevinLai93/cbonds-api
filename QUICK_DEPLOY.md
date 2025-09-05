# 快速部署指南

## AWS 部署（推薦）

### 1. 前置準備
```bash
# 安裝 AWS CLI
curl "https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip" -o "awscliv2.zip"
unzip awscliv2.zip
sudo ./aws/install

# 配置 AWS 憑證
aws configure
# 輸入您的 Access Key ID, Secret Access Key, Region, Output format

# 安裝 Serverless Framework
npm install -g serverless
```

### 2. 設定環境變數
```bash
# 設定您的 Financial Data API 憑證
export FINANCIAL_DATA_LOGIN=your_email@domain.com
export FINANCIAL_DATA_PASSWORD=your_password
```

### 3. 一鍵部署
```bash
# 執行部署腳本
./deploy.sh
```

### 4. 驗證部署
部署完成後，您會看到類似以下的輸出：
```
✅ 部署完成！
📋 API 端點: https://abc123def4.execute-api.ap-northeast-1.amazonaws.com/dev
```

測試 API：
```bash
# 健康檢查
curl https://your-api-url/api/health

# 測試登入
curl -X POST https://your-api-url/api/login \
  -H "Content-Type: application/json" \
  -d '{"username":"entrust001","password":"2tTokhjidE"}'

# 測試債券查詢
curl "https://your-api-url/api/get_emissions?isin=US037833DY36&lang=cht"
```

## 架構優勢

### 🔒 安全性
- **HTTPS 自動支援**: AWS API Gateway 提供免費 SSL 證書
- **加密存儲**: 敏感資料存儲在 AWS Parameter Store
- **IAM 權限控制**: 最小權限原則

### 📈 擴展性
- **自動擴展**: 根據流量自動調整
- **無伺服器管理**: 無需維護基礎設施
- **全球可用**: 可部署到多個 AWS 區域

### 💰 成本效益
- **按需付費**: 僅為實際使用付費
- **免費額度**: 每月 100 萬次 Lambda 請求
- **無閒置成本**: 無流量時不產生費用

## 生產環境優化

### 1. 自定義域名
```bash
# 使用 AWS Certificate Manager 申請證書
# 配置 Route 53 進行 DNS 管理
# 在 serverless.yml 中添加自定義域名配置
```

### 2. 安全強化
```yaml
# 在 serverless.yml 中限制 CORS
httpApi:
  cors:
    allowedOrigins:
      - "https://yourdomain.com"  # 替換為您的域名
```

### 3. 監控設定
```bash
# 查看日誌
serverless logs -f api --stage dev --tail

# 監控指標
aws cloudwatch get-metric-statistics \
  --namespace AWS/Lambda \
  --metric-name Invocations \
  --dimensions Name=FunctionName,Value=financial-data-api-dev-api
```

## 故障排除

### 常見問題

**1. CORS 錯誤**
```bash
# 檢查 serverless.yml 中的 CORS 配置
# 確保 allowedOrigins 包含您的域名
```

**2. 認證失敗**
```bash
# 檢查 Parameter Store 中的憑證
aws ssm get-parameter --name "/financial-data-api/dev/FINANCIAL_DATA_LOGIN" --with-decryption
```

**3. 超時錯誤**
```yaml
# 在 serverless.yml 中增加超時時間
functions:
  api:
    timeout: 60  # 增加到 60 秒
```

### 日誌查看
```bash
# 即時日誌
serverless logs -f api --stage dev --tail

# 特定時間範圍
serverless logs -f api --stage dev --startTime 1h --endTime now
```

## 更新和維護

### 代碼更新
```bash
# 重新部署
serverless deploy --stage dev

# 僅更新函數
serverless deploy function -f api --stage dev
```

### 環境變數更新
```bash
# 更新憑證
aws ssm put-parameter \
  --name "/financial-data-api/dev/FINANCIAL_DATA_LOGIN" \
  --value "new_login" \
  --type "SecureString" \
  --overwrite

# 重新部署
serverless deploy --stage dev
```

### 清理資源
```bash
# 刪除整個堆疊
serverless remove --stage dev
```

## 成本監控

### 免費額度
- Lambda: 每月 100 萬次請求
- API Gateway: 每月 100 萬次 API 調用
- Parameter Store: 每月 10,000 次參數查詢

### 成本估算
- Lambda: $0.20 per 100 萬次請求
- API Gateway: $1.00 per 100 萬次 API 調用
- 總計: 通常每月 < $5（低流量應用）

### 設定成本告警
```bash
# 在 AWS Console 中設定 CloudWatch 告警
# 當月費用超過 $10 時發送通知
```
