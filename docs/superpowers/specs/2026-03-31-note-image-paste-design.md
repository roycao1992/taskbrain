# 随笔图片粘贴功能设计文档

**日期：** 2026-03-31  
**状态：** 已批准  
**文件范围：** `src/TaskBrain.jsx`（单文件修改，无新依赖）

---

## 背景

TaskBrain 随笔模块支持 Markdown 格式，使用 `ReactMarkdown` 渲染。目前不支持在随笔中嵌入图片。用户希望能直接复制粘贴图片（截图、剪切板图片等）到随笔文本框，图片自动嵌入并在预览时显示。

---

## 存储方案

图片以 **Base64 Data URL** 形式嵌入 Markdown 内容（`![图片](data:image/jpeg;base64,...)`），随笔内容整体存储在 Supabase `user_data.notes` JSON 字段中。无需额外的 Storage bucket 或后端改动。

**压缩策略：** 粘贴时用 Canvas 等比缩放至最大宽 1200px，JPEG 质量 80%，大幅减少 base64 体积。

---

## 变更点

### 1. `compressImageToBase64(file, maxW, quality)`

新增纯函数，接受 `File` 对象，返回 `Promise<string>`（压缩后的 JPEG data URL）。

实现：
- `FileReader.readAsDataURL` 读取原始图片
- 在 `<canvas>` 上 `drawImage`，等比缩放（宽度超过 `maxW` 才缩放，否则保持原尺寸）
- `canvas.toDataURL("image/jpeg", quality)` 输出

调用参数：`maxW = 1200`，`quality = 0.8`。

### 2. `handleNoteImagePaste(e, value, setValue)`

新增事件处理函数，供两个 textarea 的 `onPaste` 属性使用。

逻辑：
1. 遍历 `e.clipboardData.items`，找第一个 `type.startsWith("image/")` 的 item
2. 若找到：`e.preventDefault()`，调用 `compressImageToBase64` 获取 data URL
3. 在光标位置（`e.target.selectionStart` / `selectionEnd`）插入 `![图片](dataURL)\n`，替换选中文本
4. 用已有的 `applyNoteValueCaret` 函数更新 value 并恢复光标位置
5. 若无图片 item，不拦截，让原生粘贴继续（文本粘贴不受影响）

### 3. 绑定 `onPaste`

- 新建随笔 textarea（`noteNewContent`）：添加 `onPaste` 属性
- 编辑随笔 textarea（`noteEditContent`）：添加 `onPaste` 属性

### 4. `NOTE_MD_COMPONENTS` 新增 `img`

```js
img: function(props) {
  return <img {...props} style={{ maxWidth: "100%", borderRadius: 6, display: "block", margin: "4px 0" }} />;
},
```

确保 base64 图片在预览卡片内自适应宽度，不撑破布局。

### 5. 摘要截断修复

当前逻辑：
```js
var summary = content.length > 80 ? content.slice(0, 80) + "…" : content;
```

问题：base64 data URL 很长，截断后 Markdown 图片语法残缺，ReactMarkdown 渲染成乱码。

修改：生成摘要前先将 `![...](data:...)` 替换为 `[图片]`，再按 80 字符截断。

```js
var displayContent = content.replace(/!\[[^\]]*\]\(data:[^)]+\)/g, "[图片]");
var summary = displayContent.length > 80 ? displayContent.slice(0, 80) + "…" : displayContent;
```

---

## 数据流

```
用户 Cmd+V（含图片）
  → onPaste 拦截
  → compressImageToBase64 压缩
  → 插入 Markdown 图片语法到 textarea value
  → setNoteNewContent / setNoteEditContent 更新 state
  → ReactMarkdown + NOTE_MD_COMPONENTS.img 渲染显示
  → 防抖保存 → Supabase user_data.notes 字段更新
```

---

## 不在范围内

- 拖拽上传（Drag & Drop）
- 图片独立存储（Supabase Storage）
- 图片删除管理 UI
- 粘贴进度提示 UI（压缩通常 < 200ms，无需 loading 状态）

---

## 测试要点

- 粘贴截图（PNG），图片嵌入并在预览中显示
- 粘贴大图（> 1200px 宽），确认被压缩缩小
- 文本粘贴不受影响
- 含图片的随笔，摘要显示 `[图片]` 而非乱码
- 编辑模式下粘贴图片正常工作
- 保存后刷新，图片仍然显示（持久化验证）
