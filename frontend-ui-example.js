// 前端UI配置使用示例
// 展示如何根據不同帳號角色顯示不同的介面

class UIManager {
  constructor() {
    this.uiConfig = null;
    this.user = null;
  }

  // 登入後設置UI配置
  async login(username, password) {
    try {
      const response = await fetch('/api/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ username, password })
      });

      const data = await response.json();
      
      if (data.success) {
        this.user = data.user;
        this.uiConfig = data.uiConfig;
        this.applyUIConfig();
        return data;
      } else {
        throw new Error(data.message);
      }
    } catch (error) {
      console.error('Login failed:', error);
      throw error;
    }
  }

  // 從Profile獲取UI配置
  async getProfile() {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/profile', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      const data = await response.json();
      
      if (data.success) {
        this.user = data.user;
        this.uiConfig = data.uiConfig;
        this.applyUIConfig();
        return data;
      } else {
        throw new Error(data.message);
      }
    } catch (error) {
      console.error('Failed to get profile:', error);
      throw error;
    }
  }

  // 應用UI配置
  applyUIConfig() {
    if (!this.uiConfig) return;

    // 1. 設置主題
    this.applyTheme();
    
    // 2. 設置導航選單
    this.setupNavigation();
    
    // 3. 設置操作按鈕
    this.setupActions();
    
    // 4. 設置權限控制
    this.setupPermissions();
    
    // 5. 設置數據限制
    this.setupDataLimits();
  }

  // 應用主題配置
  applyTheme() {
    const { theme } = this.uiConfig;
    
    // 設置CSS變量
    document.documentElement.style.setProperty('--primary-color', theme.primaryColor);
    document.documentElement.style.setProperty('--accent-color', theme.accentColor);
    
    // 設置深色模式
    if (theme.darkMode) {
      document.body.classList.add('dark-mode');
    } else {
      document.body.classList.remove('dark-mode');
    }
    
    // 更新頁面標題
    document.title = `${this.uiConfig.displayName} - Financial Data API`;
  }

  // 設置導航選單
  setupNavigation() {
    const { navigation } = this.uiConfig;
    const navContainer = document.getElementById('navigation');
    
    if (!navContainer) return;

    navContainer.innerHTML = '';
    
    navigation.forEach(item => {
      const navItem = document.createElement('div');
      navItem.className = 'nav-item';
      navItem.innerHTML = `
        <i class="material-icons">${item.icon}</i>
        <span>${item.label}</span>
      `;
      navItem.onclick = () => this.navigateTo(item.path);
      navContainer.appendChild(navItem);
    });
  }

  // 設置操作按鈕
  setupActions() {
    const { actions } = this.uiConfig;
    const actionsContainer = document.getElementById('actions');
    
    if (!actionsContainer) return;

    actionsContainer.innerHTML = '';
    
    actions.forEach(action => {
      const button = document.createElement('button');
      button.className = 'action-button';
      button.innerHTML = `
        <i class="material-icons">${action.icon}</i>
        <span>${action.label}</span>
      `;
      button.onclick = () => this.handleAction(action.key);
      actionsContainer.appendChild(button);
    });
  }

  // 設置權限控制
  setupPermissions() {
    const { permissions } = this.uiConfig;
    
    // 隱藏/顯示功能區塊
    Object.keys(permissions).forEach(permission => {
      const element = document.getElementById(`permission-${permission}`);
      if (element) {
        element.style.display = permissions[permission] ? 'block' : 'none';
      }
    });
  }

  // 設置數據限制
  setupDataLimits() {
    const { dataLimits } = this.uiConfig;
    
    // 設置查詢限制
    window.maxRecordsPerQuery = dataLimits.maxRecordsPerQuery;
    window.maxExportRecords = dataLimits.maxExportRecords;
    window.maxConcurrentQueries = dataLimits.maxConcurrentQueries;
    
    // 更新UI提示
    this.updateDataLimitHints();
  }

  // 更新數據限制提示
  updateDataLimitHints() {
    const hints = document.querySelectorAll('.data-limit-hint');
    hints.forEach(hint => {
      hint.textContent = `最多可查詢 ${window.maxRecordsPerQuery} 筆記錄`;
    });
  }

  // 導航到指定路徑
  navigateTo(path) {
    // 這裡可以集成路由系統
    console.log(`Navigating to: ${path}`);
    // 例如使用 React Router 或 Vue Router
  }

  // 處理操作按鈕點擊
  handleAction(actionKey) {
    const { permissions } = this.uiConfig;
    
    // 檢查權限
    if (!this.hasPermission(actionKey)) {
      alert('您沒有執行此操作的權限');
      return;
    }

    switch (actionKey) {
      case 'export':
        this.handleExport();
        break;
      case 'create_report':
        this.handleCreateReport();
        break;
      case 'user_management':
        this.handleUserManagement();
        break;
      default:
        console.log(`Action: ${actionKey}`);
    }
  }

  // 檢查權限
  hasPermission(permission) {
    return this.uiConfig.permissions[permission] === true;
  }

  // 處理匯出
  handleExport() {
    if (!this.hasPermission('dataExport')) {
      alert('您沒有匯出數據的權限');
      return;
    }
    
    // 匯出邏輯
    console.log('Exporting data...');
  }

  // 處理建立報告
  handleCreateReport() {
    if (!this.hasPermission('customReports')) {
      alert('您沒有建立報告的權限');
      return;
    }
    
    // 建立報告邏輯
    console.log('Creating report...');
  }

  // 處理用戶管理
  handleUserManagement() {
    if (!this.hasPermission('userManagement')) {
      alert('您沒有用戶管理的權限');
      return;
    }
    
    // 用戶管理邏輯
    console.log('Managing users...');
  }
}

// 使用示例
const uiManager = new UIManager();

// 登入示例
async function loginExample() {
  try {
    // 不同角色的登入
    const users = [
      { username: 'admin', password: 'admin123' },
      { username: 'analyst', password: 'analyst123' },
      { username: 'entrust001', password: '2tTokhjidE' }
    ];

    for (const user of users) {
      console.log(`\n=== 登入用戶: ${user.username} ===`);
      
      const result = await uiManager.login(user.username, user.password);
      
      console.log('用戶信息:', result.user);
      console.log('UI配置:', result.uiConfig);
      console.log('角色:', result.uiConfig.role);
      console.log('顯示名稱:', result.uiConfig.displayName);
      console.log('權限:', result.uiConfig.permissions);
      console.log('導航選單:', result.uiConfig.navigation);
      console.log('操作按鈕:', result.uiConfig.actions);
      console.log('主題配置:', result.uiConfig.theme);
    }
  } catch (error) {
    console.error('登入失敗:', error);
  }
}

// 權限檢查示例
function permissionExample() {
  console.log('\n=== 權限檢查示例 ===');
  
  const permissions = [
    'userManagement',
    'dataExport',
    'analytics',
    'bulkOperations',
    'customReports'
  ];

  permissions.forEach(permission => {
    const hasPermission = uiManager.hasPermission(permission);
    console.log(`${permission}: ${hasPermission ? '✅' : '❌'}`);
  });
}

// 導出模組
export { UIManager, loginExample, permissionExample };

