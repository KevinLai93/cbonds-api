// 金融術語中英文對照表
export const financialTerms = {
  // 公司類型
  'corporate': '企業',
  'municipal': '市政',
  'sovereign': '主權',
  'supranational': '超國家',
  
  // 產業類別
  'IT equipment': '資訊科技設備',
  'Banking': '銀行業',
  'Oil & Gas': '石油天然氣',
  'Telecommunications': '電信業',
  'Utilities': '公用事業',
  'Healthcare': '醫療保健',
  'Consumer Goods': '消費品',
  'Industrial': '工業',
  'Real Estate': '房地產',
  'Financial Services': '金融服務',
  
  // 債券類型
  'International bonds': '國際債券',
  'Corporate bonds': '企業債券',
  'Government bonds': '政府債券',
  'Municipal bonds': '市政債券',
  'Senior Unsecured': '高級無擔保',
  'Subordinated': '次級',
  'Secured': '有擔保',
  'Unsecured': '無擔保',
  
  // 狀態
  'outstanding': '流通中',
  'matured': '已到期',
  'defaulted': '違約',
  'cancelled': '已取消',
  
  // 國家
  'USA': '美國',
  'China': '中國',
  'Japan': '日本',
  'Germany': '德國',
  'United Kingdom': '英國',
  'France': '法國',
  'Canada': '加拿大',
  'Australia': '澳洲',
  'Russia': '俄羅斯',
  
  // 貨幣
  'USD': '美元',
  'EUR': '歐元',
  'GBP': '英鎊',
  'JPY': '日圓',
  'CNY': '人民幣',
  'HKD': '港幣',
  'TWD': '台幣',
  
  // 其他常用詞彙
  'Not specified': '未指定',
  'Public': '公開',
  'Private': '私募',
  'Open subscription': '公開認購',
  'Coupon bonds': '附息債券',
  'Zero coupon': '零息債券',
  'Floating rate': '浮動利率',
  'Fixed rate': '固定利率'
};

// 使用Free Translate API進行翻譯
export const translateWithAPI = async (text, targetLang = 'zh-cn') => {
  if (!text || targetLang === 'eng') {
    return text;
  }
  
  try {
    console.log(`🌐 調用翻譯API: ${targetLang}, 文本長度: ${text.length}`);
    const response = await fetch(`https://ftapi.pythonanywhere.com/translate?sl=en&dl=${targetLang}&text=${encodeURIComponent(text)}`);
    const data = await response.json();
    
    if (data && data['destination-text']) {
      console.log(`✅ 翻譯成功: ${text.substring(0, 50)}... → ${data['destination-text'].substring(0, 50)}...`);
      return data['destination-text'];
    } else {
      console.warn('❌ 翻譯API返回空結果:', data);
    }
  } catch (error) {
    console.warn('❌ 翻譯API失敗，使用本地翻譯:', error.message);
  }
  
  return text;
};

// 翻譯函數
export const translateText = (text, targetLang = 'zh') => {
  if (!text || targetLang === 'eng') {
    return text;
  }
  
  // 直接對照翻譯
  if (financialTerms[text]) {
    return financialTerms[text];
  }
  
  // 如果沒有對照，返回原文
  return text;
};

// 異步翻譯函數（使用API）
export const translateTextAsync = async (text, targetLang = 'zh') => {
  if (!text || targetLang === 'eng') {
    return text;
  }
  
  // 先嘗試本地翻譯
  const localTranslation = translateText(text, targetLang);
  if (localTranslation !== text) {
    return localTranslation;
  }
  
  // 如果本地沒有翻譯，使用API
  let apiLang = targetLang;
  if (targetLang === 'zh' || targetLang === 'zh-cn') {
    apiLang = 'zh-cn'; // 簡體中文
  } else if (targetLang === 'cht' || targetLang === 'zh-tw') {
    apiLang = 'zh-TW'; // 繁體中文 (注意大寫TW)
  }
  return await translateWithAPI(text, apiLang);
};

// 翻譯物件中的特定欄位
export const translateObject = (obj, fields, targetLang = 'zh') => {
  if (!obj || targetLang === 'eng') {
    return obj;
  }
  
  const translated = { ...obj };
  
  fields.forEach(field => {
    if (translated[field]) {
      translated[field] = translateText(translated[field], targetLang);
    }
  });
  
  return translated;
};

// 翻譯公司資料
export const translateCompanyData = (companyData, targetLang = 'zh') => {
  if (!companyData || targetLang === 'eng') {
    return companyData;
  }
  
  const translated = { ...companyData };
  
  // 翻譯基本資訊
  const fieldsToTranslate = [
    'type_name_eng',
    'branch_name_eng', 
    'country_name_eng',
    'reg_form_name_eng'
  ];
  
  fieldsToTranslate.forEach(field => {
    if (translated[field]) {
      translated[field] = translateText(translated[field], targetLang);
    }
  });
  
  return translated;
};

// 異步翻譯公司資料（只翻譯產業別和發行者簡介）
export const translateCompanyDataAsync = async (companyData, targetLang = 'zh') => {
  if (!companyData || targetLang === 'eng') {
    return companyData;
  }
  
  const translated = { ...companyData };
  
  // 只翻譯產業別（異步）- 發行人API使用 branch_name_eng
  if (translated.branch_name_eng) {
    translated.branch_name_eng = await translateTextAsync(translated.branch_name_eng, targetLang);
  }
  
  // 只翻譯發行者簡介（異步）- 發行人API使用 profile_eng
  if (translated.profile_eng) {
    translated.profile_eng = await translateTextAsync(translated.profile_eng, targetLang);
  }
  
  return translated;
};

// 翻譯債券資料
export const translateBondData = (bondData, targetLang = 'zh') => {
  if (!bondData || targetLang === 'eng') {
    return bondData;
  }
  
  const translated = { ...bondData };
  
  // 翻譯債券相關欄位
  const fieldsToTranslate = [
    'kind_name_eng',
    'emitent_type_name_eng',
    'emitent_country_name_eng',
    'bond_rank_name_eng',
    'status_name_eng',
    'currency_name',
    'coupon_type_name_eng',
    'placing_type_name_eng',
    'private_offering_name_eng',
    'emitent_branch_name_eng'  // 加入產業別
  ];
  
  fieldsToTranslate.forEach(field => {
    if (translated[field]) {
      translated[field] = translateText(translated[field], targetLang);
    }
  });
  
  return translated;
};

// 異步翻譯債券資料（只翻譯產業別）
export const translateBondDataAsync = async (bondData, targetLang = 'zh') => {
  if (!bondData || targetLang === 'eng') {
    return bondData;
  }
  
  const translated = { ...bondData };
  
  // 只翻譯產業別（異步）
  if (translated.emitent_branch_name_eng) {
    translated.emitent_branch_name_eng = await translateTextAsync(translated.emitent_branch_name_eng, targetLang);
  }
  
  return translated;
};
