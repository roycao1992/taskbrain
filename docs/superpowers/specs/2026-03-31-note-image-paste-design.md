# 随笔与任务图片粘贴功能设计文档

**日期：** 2026-03-31  
**状态：** 已批准  
**文件范围：** `src/TaskBrain.jsx`（单文件修改，无新依赖）

---

## 背景

TaskBrain 随笔（notes）模块支持 Markdown，任务（tasks）的 `detail` 备注字段目前为纯文本。用户希望在随笔和任务 detail 中都能直接复制粘贴图片（截图、剪切板图片等），图片自动嵌入并在预览时显示。顺势将任务 `detail` 字段升级为 Markdown，与随笔保持一致体验。

---

## 存储方案

图片以 **Base64 Data URL** 形式嵌入 Markdown 内容（`![图片](data:image/jpeg;base64,...)`）：
- 随笔：存储在 Supabase `user_data.notes` JSON 字段
- 任务 detail：存储在 Supabase `user_data.tasks` JSON 字段的 `detail` 属性

无需额外的 Storage bucket 或后端改动。

**压缩策略：** 粘贴时用 Canvas 等比缩放至最大宽 1200px，JPEG 质量 80%，大幅减少 base64 体积。

---

## 变更点

### 1. `compressImageToBase64(file, maxW, quality)`

新增纯函数，接受 `File` 对象，返回 `Promise<string>`（压缩后的 data URL）。

实现：
- `FileReader.readAsDataURL` 读取原始图片
- 在 `<canvas>` 上 `drawImage`，等比缩放（宽度超过 `maxW` 才缩放，否则保持原尺寸）
- **格式选择（处理透明度问题）**：
  - 若 `file.type === "image/png"`：输出 `image/png`，保留透明通道，避免透明区域变黑
  - 其他格式（JPEG、WebP 等）：输出 `image/jpeg`，`quality = 0.8`
- PNG 不压缩质量，但仍做等比缩放降低尺寸

调用参数：`maxW = 1200`，`quality = 0.8`（仅用于非 PNG 格式）。

### 2. `handleNoteImagePaste(e, setValue)`

新增事件处理函数，供两个 textarea 的 `onPaste` 属性使用。

逻辑：
1. 遍历 `e.clipboardData.items`，找第一个 `type.startsWith("image/")` 的 item
2. 若找到：立即 `e.preventDefault()`，**同步**读取 `e.target.value`、`e.target.selectionStart`、`e.target.selectionEnd` 并存入局部变量（后续 `await` 期间 DOM 状态可能变化，必须在此刻捕获）
3. 调用 `compressImageToBase64` 获取 data URL（`await`）
4. 在捕获的光标位置插入 `![图片](dataURL)\n`，替换选中文本
5. 用已有的 `applyNoteValueCaret` 函数更新 value 并恢复光标位置
6. 整个 async 流程用 `try/catch` 包裹；出错时静默记录 `console.error`，不插入任何内容，不影响文本粘贴
7. 若无图片 item，不拦截，让原生粘贴继续（文本粘贴不受影响）

### 3. 绑定 `onPaste`

- 新建随笔 textarea（`noteNewContent`）：添加 `onPaste` 属性
- 编辑随笔 textarea（`noteEditContent`）：添加 `onPaste` 属性
- 任务编辑 detail textarea（`eDetail`，`setEDetail`）：添加 `onPaste` 属性

### 4. `NOTE_MD_COMPONENTS` 新增 `img`

```js
img: function(props) {
  return <img {...props} style={{ maxWidth: "100%", borderRadius: 6, display: "block", margin: "4px 0" }} />;
},
```

此组件同时用于随笔和任务 detail 的 Markdown 渲染，确保图片在卡片内自适应宽度，不撑破布局。

### 5. 任务 `detail` 渲染升级为 Markdown

**任务卡片视图（只读）：** 将 `task.detail` 的渲染从：
```js
<div style={{ fontSize: 11, ... }}>{task.detail.trim()}</div>
```
改为：
```js
<div style={{ fontSize: 11, ... }}>
  <ReactMarkdown components={NOTE_MD_COMPONENTS}>{task.detail.trim()}</ReactMarkdown>
</div>
```

**base64 图片的 detail 显示处理：** 任务卡片不做摘要截断，但 base64 长字符串直接渲染影响性能，在渲染前用同样的正则将 `![...](data:...)` 替换为 `[图片]` 再判断 `detail` 是否有内容（不影响真正的渲染，仅用于"是否显示 detail 区域"的 `.trim()` 判断）。实际渲染仍使用原始 `task.detail`，ReactMarkdown 会正确处理图片。

### 6. 摘要与展开逻辑修复（随笔）

当前逻辑用 `content.length > 80` 既控制摘要截断，也控制展开/收起 UI（点击行为、鼠标指针样式、展开按钮显示）。含 base64 图片的 note 原始长度达数万字符，会导致所有判断误触。

修改：在渲染 note 卡片时，**首先**计算 `displayContent`（剥除 base64 图片 Markdown），再将其长度用于全部 5 处判断：

```js
var displayContent = (n.content || "").replace(/!\[[^\]]*\]\(data:[^)]+\)/g, "[图片]");
var summary = displayContent.length > 80 ? displayContent.slice(0, 80) + "…" : displayContent;
```

以下代码中 `(n.content || "").length > 80` 均改为 `displayContent.length > 80`：
- `onClick` 展开/收起切换
- `onKeyDown` 键盘展开/收起切换
- `cursor` 样式判断
- "展开 ▾ / 收起 ▴" 指示器显示条件

---

## 数据流

**随笔：**
```
用户 Cmd+V（含图片）
  → onPaste 拦截
  → compressImageToBase64 压缩
  → 插入 Markdown 图片语法到 textarea value
  → setNoteNewContent / setNoteEditContent 更新 state
  → ReactMarkdown + NOTE_MD_COMPONENTS.img 渲染显示
  → 防抖保存 → Supabase user_data.notes 字段更新
```

**任务 detail：**
```
用户 Cmd+V（含图片）（在任务编辑面板的 detail textarea 中）
  → onPaste 拦截
  → compressImageToBase64 压缩
  → 插入 Markdown 图片语法到 eDetail value
  → setEDetail 更新 state
  → 用户点击"保存" → ReactMarkdown + NOTE_MD_COMPONENTS.img 渲染显示
  → 防抖保存 → Supabase user_data.tasks 字段更新
```

---

## 不在范围内

- 拖拽上传（Drag & Drop）
- 图片独立存储（Supabase Storage）
- 图片删除管理 UI
- 粘贴进度提示 UI（压缩通常 < 200ms，无需 loading 状态）

---

## 测试要点

**随笔：**
- 粘贴截图（PNG），图片嵌入并在预览中显示，透明区域不变黑
- 粘贴大图（> 1200px 宽），确认被压缩缩小
- 文本粘贴不受影响
- 含图片的随笔，摘要显示 `[图片]` 而非乱码
- 随笔编辑模式下粘贴图片正常工作
- 含图片的随笔展开/收起行为正常（不因 base64 长度误触发）
- 保存后刷新，图片仍然显示（持久化验证）

**任务 detail：**
- 任务编辑面板 detail textarea 可粘贴图片
- 保存后任务卡片以 Markdown 渲染 detail（含图片）
- 纯文本 detail 的现有任务渲染行为不变
- 保存后刷新，任务 detail 图片仍然显示
