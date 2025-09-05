// 簡化的UI配置系統 - 基於帳號類型分類
// 根據用戶名前綴自動識別帳號類型

export const ACCOUNT_TYPES = {
  admin: {
    type: 'admin',
    displayName: '系統管理員',
    category: 'management'
  },
  analyst: {
    type: 'analyst', 
    displayName: '財務分析師',
    category: 'analysis'
  },
  entrust: {
    type: 'entrust',
    displayName: '信託用戶',
    category: 'investment'
  },
  ubot: {
    type: 'ubot',
    displayName: 'UBot用戶',
    category: 'automation'
  },
  user: {
    type: 'user',
    displayName: '一般用戶',
    category: 'basic'
  }
};

// 根據用戶名自動識別帳號類型
export const getAccountType = (username) => {
  if (!username) return ACCOUNT_TYPES.user;
  
  // 根據用戶名前綴識別類型
  if (username.startsWith('admin')) return ACCOUNT_TYPES.admin;
  if (username.startsWith('analyst')) return ACCOUNT_TYPES.analyst;
  if (username.startsWith('entrust')) return ACCOUNT_TYPES.entrust;
  if (username.startsWith('ubot')) return ACCOUNT_TYPES.ubot;
  
  // 默認為一般用戶
  return ACCOUNT_TYPES.user;
};

// 簡化的UI配置獲取函數
export const getUserUIConfig = (username, role) => {
  const accountType = getAccountType(username);
  
  return {
    type: accountType.type,
    displayName: accountType.displayName,
    category: accountType.category,
    username: username,
    role: role
  };
};
