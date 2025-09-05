# AWS 架構說明

## 概述

本 Financial Data API 使用 AWS Serverless 架構，提供高可用性、自動擴展和內建 HTTPS 支援。

## 架構組件

### 1. AWS Lambda
- **運行時**: Node.js 18.x
- **記憶體**: 512 MB
- **超時**: 30 秒
- **觸發器**: API Gateway HTTP API

### 2. API Gateway HTTP API
- **協議**: HTTPS (自動提供)
- **CORS**: 已配置支援跨域請求
- **路由**: `/api/{proxy+}` 通配符路由
- **方法**: GET, POST, PUT, DELETE, OPTIONS

### 3. AWS Systems Manager Parameter Store
- **用途**: 安全存儲敏感環境變數
- **參數**:
  - `/financial-data-api/dev/FINANCIAL_DATA_LOGIN`
  - `/financial-data-api/dev/FINANCIAL_DATA_PASSWORD`
- **加密**: 使用 SecureString 類型

### 4. CloudWatch Logs
- **用途**: 集中日誌管理
- **保留期**: 預設 30 天
- **監控**: 自動收集 Lambda 執行日誌

## HTTPS 支援

### 自動 HTTPS
- ✅ AWS API Gateway 自動提供 HTTPS 端點
- ✅ SSL/TLS 證書由 AWS 管理
- ✅ 所有 API 端點都支援 HTTPS
- ✅ 自動重定向 HTTP 到 HTTPS

### 端點格式
```
https://{api-id}.execute-api.{region}.amazonaws.com/{stage}/api/{endpoint}
```

## 安全特性

### 1. 身份驗證
- JWT Token 認證
- 角色基礎存取控制 (RBAC)
- 多種用戶類型支援

### 2. 資料保護
- 環境變數加密存儲
- HTTPS 傳輸加密
- IAM 角色最小權限原則

### 3. CORS 配置
- 支援跨域請求
- 可配置允許的來源域名
- 預設允許所有來源（開發環境）

## 部署流程

### 1. 環境準備
```bash
# 安裝依賴
npm install

# 配置 AWS CLI
aws configure

# 設定環境變數
export FINANCIAL_DATA_LOGIN=your_login
export FINANCIAL_DATA_PASSWORD=your_password
```

### 2. 部署到 AWS
```bash
# 執行部署腳本
./deploy.sh

# 或手動部署
serverless deploy --stage dev
```

### 3. 驗證部署
```bash
# 測試健康檢查
curl https://your-api-url/api/health

# 測試債券查詢
curl "https://your-api-url/api/get_emissions?isin=US037833DY36"
```

## 生產環境建議

### 1. 自定義域名
- 使用 AWS Certificate Manager 申請 SSL 證書
- 配置 Route 53 進行 DNS 管理
- 設定自定義域名映射

### 2. 安全強化
- 限制 CORS 來源到特定域名
- 啟用 API Gateway 限流和節流
- 設定 WAF (Web Application Firewall)

### 3. 監控和告警
- 配置 CloudWatch 監控指標
- 設定異常告警
- 建立日誌分析儀表板

### 4. 成本優化
- 使用 Provisioned Concurrency（如需要）
- 監控 Lambda 執行時間和記憶體使用
- 設定 CloudWatch 成本告警

## 擴展性

### 自動擴展
- Lambda 根據請求量自動擴展
- 無需手動配置負載均衡器
- 支援突發流量處理

### 全球部署
- 可部署到多個 AWS 區域
- 使用 CloudFront 進行全球內容分發
- 支援多區域災難恢復

## 故障排除

### 常見問題
1. **CORS 錯誤**: 檢查 `serverless.yml` 中的 CORS 配置
2. **認證失敗**: 驗證 Parameter Store 中的憑證
3. **超時錯誤**: 增加 Lambda 超時時間或優化代碼

### 日誌查看
```bash
# 查看即時日誌
serverless logs -f api --stage dev --tail

# 查看特定時間範圍日誌
serverless logs -f api --stage dev --startTime 1h
```

### 監控指標
- Lambda 執行次數和錯誤率
- API Gateway 請求數和延遲
- 記憶體使用和執行時間

## 成本估算

### 免費額度
- Lambda: 每月 100 萬次請求
- API Gateway: 每月 100 萬次 API 調用
- Parameter Store: 每月 10,000 次參數查詢

### 付費部分
- 超出免費額度的 Lambda 執行
- 超出免費額度的 API Gateway 請求
- CloudWatch 日誌存儲

## 維護和更新

### 代碼更新
```bash
# 重新部署
serverless deploy --stage dev

# 僅更新函數代碼
serverless deploy function -f api --stage dev
```

### 環境變數更新
```bash
# 更新 Parameter Store
aws ssm put-parameter --name "/financial-data-api/dev/FINANCIAL_DATA_LOGIN" --value "new_value" --type "SecureString" --overwrite

# 重新部署以應用變更
serverless deploy --stage dev
```

### 清理資源
```bash
# 刪除整個堆疊
serverless remove --stage dev
```
