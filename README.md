# TaskBrain

Roy的AI任务管理工具 — 支持周任务/截止日任务、AI自动分类、全局诊断、本周规划。

## 快速开始

```bash
# 1. 安装依赖
npm install

# 2. 启动开发服务器
npm run dev

# 3. 打开浏览器访问 http://localhost:3000
```

## 云端同步（Supabase）

登录后任务、个人档案、主题会同步到云端，多设备共用同一份数据。

### 1. 创建 Supabase 项目

1. 打开 [supabase.com](https://supabase.com) 登录，**New project** 创建项目（记下密码）。
2. 在 **Settings → API** 中复制 **Project URL** 和 **anon public** key。

### 2. 建表

在 Supabase 控制台 **SQL Editor** 中执行项目里的：

`supabase/migrations/001_user_data.sql`

（或把该文件内容粘贴执行。）

### 3. 配置本机

在项目根目录复制环境变量示例并填入：

```bash
cp .env.example .env
# 编辑 .env，填入 VITE_SUPABASE_URL 和 VITE_SUPABASE_ANON_KEY
```

### 4. 使用

重启 `npm run dev` 后，打开应用点 ⚙️，在「云端同步」下用邮箱注册/登录即可。数据会自动同步；未登录时仍只存本地。

### 5. 实时同步（多端同时更新）

在 A 端改任务后，希望 B 端（另一浏览器/设备）**不刷新也能立刻看到更新**，需要为表开启 Realtime：

1. 打开 Supabase 控制台 → **Database** → **Replication**
2. 在 **Supabase Realtime** 的表格列表中，找到 `user_data` 并**勾选启用**
3. 若列表里没有该表，可在 **SQL Editor** 执行：`supabase/migrations/003_realtime_user_data.sql` 中的语句（`alter publication supabase_realtime add table public.user_data;`）

开启后，多端登录同一账号时，一端修改会实时推到另一端。

---

## 配置 AI 功能

AI 功能使用 DeepSeek API：

1. 打开应用后点右上角 ⚙️
2. 在「DeepSeek API Key」输入框填入你的 API Key
3. Key 保存在浏览器 localStorage 中，仅用于请求 DeepSeek 接口

获取 API Key: https://platform.deepseek.com/

> **注意**: 若浏览器直接调用遇到跨域问题，可加后端代理转发请求，详见下方「部署到生产」。

## 功能

- **两种任务类型**: 周任务（按周节奏安排）+ 截止日任务（有明确deadline）
- **AI自动分类**: 输入任务后AI自动判断分类和优先级
- **三种视图**: 按周 / 按截止日 / 按分类
- **快捷操作**: 一键「→ 本周」和「推到下周 →」
- **子任务**: 每个任务可展开添加checklist
- **🧠 一键诊断**: AI结合你的个人档案和状态给出全局建议，支持追问
- **📋 本周规划**: AI从待安排中挑选任务到本周
- **个人档案**: 存储公司/个人/家庭/投资信息，AI诊断时参考
- **明暗切换**: 浅色/深色主题
- **云端同步**: 登录后多设备共享数据（Supabase）
- **数据导出**: JSON备份
- **自动归档**: 清理完成超过2周的任务

## 部署到 Vercel

已有 Vercel 账号时，按下面任选一种方式即可。

### 方式一：从 GitHub 导入（推荐）

1. 把本仓库推到 GitHub（若尚未推送）。
2. 打开 [vercel.com](https://vercel.com) 并登录，点击 **Add New… → Project**。
3. 在 **Import Git Repository** 里选择你的 `taskbrain` 仓库，点 **Import**。
4. 保持默认即可（Framework 会自动识别为 Vite，Build 用 `npm run build`，输出目录为 `dist`）。
5. 点击 **Deploy**，等构建完成后会得到 `https://xxx.vercel.app` 的访问地址。
6. 若使用云端同步：在 Vercel 项目 **Settings → Environment Variables** 中添加 `VITE_SUPABASE_URL` 和 `VITE_SUPABASE_ANON_KEY`，重新部署一次。

之后每次推送到该仓库的默认分支，Vercel 会自动重新部署。

### 方式二：用 Vercel CLI 部署

```bash
# 安装 CLI（未安装时）
npm i -g vercel

# 在项目根目录执行，按提示登录并关联项目
vercel
```

首次会询问项目名、目录等，直接回车用默认即可。上线到生产环境可执行：

```bash
vercel --prod
```

---

项目里已包含 `vercel.json`，会使用 Vite 构建并把所有路径回退到 `index.html`，无需再改配置。

### 若遇 CORS：加后端代理

若线上在调用 DeepSeek 时出现跨域，可加一层 API 代理，见下方「加后端代理解决 CORS」。

---

## 加后端代理解决 CORS

如果浏览器直接调用 API 遇到跨域问题，可加一个简单的 API 代理：

```javascript
// server.js (Node.js + Express 示例)
import express from 'express';

const app = express();
app.use(express.json());
app.use(express.static('dist'));

app.post('/api/ai', async (req, res) => {
  const { system, messages } = req.body;
  const body = {
    model: 'deepseek-chat',
    max_tokens: 1200,
    messages: [{ role: 'system', content: system }, ...messages],
  };
  const response = await fetch('https://api.deepseek.com/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer ' + process.env.DEEPSEEK_API_KEY,
    },
    body: JSON.stringify(body),
  });
  const data = await response.json();
  res.json(data);
});

app.listen(3000);
```

然后把 `TaskBrain.jsx` 中 `callAI` 的请求改为发往 `/api/ai`，并在后端设置环境变量 `DEEPSEEK_API_KEY`。

## 技术栈

- React 18
- Vite
- DeepSeek API (deepseek-chat)
- Supabase（认证 + 云端数据）
- localStorage 本地缓存

## 后续可以做的

- [ ] PWA支持，手机添加到桌面
- [ ] 拖拽排序
- [ ] 周回顾功能（每周总结完成了什么）
