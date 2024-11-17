# Modulant.js: 隐形网站扩展框架

## 黑客困境：扩展第三方网站

想象一下，你想要增强网站功能，但不想：
- 修改原始源代码
- 请求许可
- 破坏网站的核心体验

**Modulant.js 是你用于网页操作的隐形瑞士军刀。**

## 使用案例：改造受限制的电商平台

### 场景：AliExpress 商品追踪和自定义路由

你对速卖通（AliExpress）的有限追踪功能感到不满，想要：
- 拦截特定的 API 路由
- 注入自定义追踪脚本
- 将特定请求重定向到你自己的后端
- 避免 CORS 限制

**Modulant 的魔法：**
```javascript
const modulant = Modulant.init({
    primaryServerURL: 'https://aliexpress.com',
    secondaryServerURL: 'https://your-tracking-service.com',
    routes: [
        // 重定向特定的 API 端点
        { pattern: '/product/tracking', target: 'secondary' },
        { pattern: '/api/order-details', target: 'secondary' }
    ],
    injectScript: `
        // 自定义追踪逻辑
        window.addEventListener('purchase', (event) => {
            fetch('/custom-tracking-endpoint', {
                method: 'POST',
                body: JSON.stringify(event.detail)
            });
        });
    `,
    defaultHeaders: {
        'X-Custom-Tracker': 'Modulant'
    }
});
```

## 技术超能力

### 🕵️ 隐形拦截
- 捕获所有链接点击
- 拦截 AJAX 和 fetch 请求
- 实时修改请求

### 🛡️ 绕过 CORS
- 使用隐藏 iframe 作为代理
- 绕过同源策略限制
- 透明请求路由

### 🧬 精确操作
- 定向特定路由
- 注入自定义 JavaScript
- 最小化网站干扰

### 🔒 代码混淆
- 自动代码混淆保护
- 隐藏实现细节
- 防止逆向工程

## 实际应用场景（笑）

1. **学术研究**：从研究平台抓取数据
2. **价格追踪**：监控电商价格
3. **自定义分析**：为任何网站添加高级追踪
4. **安全测试**：拦截和分析网络流量

## 道德声明
- 负责任地使用
- 尊重网站服务条款
- 不要用于恶意目的

## 开始使用（尚未在 npm 上发布）
```bash
npm install modulant-js
```

**释放隐形网站扩展的力量！**
