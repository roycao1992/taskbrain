# Image Paste 实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在随笔和任务 detail 中支持复制粘贴图片，图片以 Base64 嵌入 Markdown，预览时正确渲染。

**Architecture:** 所有改动在 `src/TaskBrain.jsx` 单文件内完成。新增两个纯函数（`compressImageToBase64`、`handleNoteImagePaste`），扩展 `NOTE_MD_COMPONENTS`，在三处 textarea 绑定 `onPaste`，将任务 `detail` 渲染从纯文本升级为 ReactMarkdown，修复随笔摘要与展开逻辑。

**Tech Stack:** React, ReactMarkdown, Browser Canvas API（无新依赖）

---

## 文件结构

- 修改：`src/TaskBrain.jsx`（全部改动）

> **注意：** Tasks 1–2 会在文件顶部插入约 65–70 行，导致后续所有"约第 N 行"的行号失效。**Task 3 起，请根据代码片段内容（`grep` 或编辑器搜索关键字）定位，不要依赖行号。**

---

## Task 1：新增 `compressImageToBase64` 函数

**Files:**
- Modify: `src/TaskBrain.jsx`（在 `NOTE_MD_COMPONENTS` 定义之前，约第 6 行处插入）

- [ ] **Step 1: 在 `NOTE_MD_COMPONENTS` 定义之前插入以下函数**

在 `src/TaskBrain.jsx` 第 6 行（`/** 随笔 Markdown 预览…` 注释之前）插入：

```js
/**
 * 将 File 对象压缩为 Base64 Data URL。
 * PNG 保留透明通道（输出 image/png），其余格式输出 JPEG 80%。
 * 宽度超过 maxW 时等比缩小，否则保持原尺寸。
 */
function compressImageToBase64(file, maxW, quality) {
  return new Promise(function(resolve, reject) {
    var reader = new FileReader();
    reader.onerror = reject;
    reader.onload = function(ev) {
      var img = new Image();
      img.onerror = reject;
      img.onload = function() {
        var w = img.width;
        var h = img.height;
        if (w > maxW) {
          h = Math.round(h * maxW / w);
          w = maxW;
        }
        var canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        var ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, w, h);
        var isPng = file.type === "image/png";
        var dataUrl = isPng
          ? canvas.toDataURL("image/png")
          : canvas.toDataURL("image/jpeg", quality);
        resolve(dataUrl);
      };
      img.src = ev.target.result;
    };
    reader.readAsDataURL(file);
  });
}
```

- [ ] **Step 2: 启动开发服务器验证编译无报错**

```bash
cd /Users/roy/Projects/taskbrain && npm run dev
```

预期：终端输出 `Local: http://localhost:5173/`，无 TypeScript/编译错误。

- [ ] **Step 3: Commit**

```bash
cd /Users/roy/Projects/taskbrain && git add src/TaskBrain.jsx && git commit -m "feat: add compressImageToBase64 helper"
```

---

## Task 2：新增 `handleNoteImagePaste` 函数

**Files:**
- Modify: `src/TaskBrain.jsx`（紧接 `compressImageToBase64` 之后插入）

- [ ] **Step 1: 在 `compressImageToBase64` 函数之后插入以下函数**

```js
/**
 * textarea onPaste 处理器：拦截剪切板中的图片，压缩后插入 Markdown 图片语法。
 * 文本粘贴不受影响。
 */
function handleNoteImagePaste(e, setValue) {
  var items = e.clipboardData && e.clipboardData.items;
  if (!items) return;
  var imageItem = null;
  for (var i = 0; i < items.length; i++) {
    if (items[i].type.startsWith("image/")) { imageItem = items[i]; break; }
  }
  if (!imageItem) return;

  var file = imageItem.getAsFile();
  if (!file) return;  // getAsFile 失败时不拦截原生粘贴

  e.preventDefault();
  // 同步捕获光标位置（await 期间 DOM 状态可能变化）
  var ta = e.target;
  var before = ta.value.slice(0, ta.selectionStart);
  var after = ta.value.slice(ta.selectionEnd);

  compressImageToBase64(file, 1200, 0.8).then(function(dataUrl) {
    var insertion = "![图片](" + dataUrl + ")\n";
    var newVal = before + insertion + after;
    applyNoteValueCaret(setValue, ta, newVal, before.length + insertion.length);
  }).catch(function(err) {
    console.error("[TaskBrain] image paste failed:", err);
  });
}
```

- [ ] **Step 2: 验证编译无报错**

保存文件后检查终端（开发服务器已运行），确认无报错。

- [ ] **Step 3: Commit**

```bash
cd /Users/roy/Projects/taskbrain && git add src/TaskBrain.jsx && git commit -m "feat: add handleNoteImagePaste handler"
```

---

## Task 3：扩展 `NOTE_MD_COMPONENTS`（加 `img` 和 `p`）

**Files:**
- Modify: `src/TaskBrain.jsx`，约第 7-17 行的 `NOTE_MD_COMPONENTS` 对象

- [ ] **Step 1: 将 `NOTE_MD_COMPONENTS` 替换为以下内容**

当前代码（约第 7-17 行）：
```js
var NOTE_MD_COMPONENTS = {
  ul: function(props) {
    return <ul {...props} style={Object.assign({ marginTop: 4, marginBottom: 4, paddingLeft: "1.25em", listStylePosition: "outside" }, props.style)} />;
  },
  ol: function(props) {
    return <ol {...props} style={Object.assign({ marginTop: 4, marginBottom: 4, paddingLeft: "1.25em", listStylePosition: "outside" }, props.style)} />;
  },
  li: function(props) {
    return <li {...props} style={Object.assign({ marginTop: 2, marginBottom: 2 }, props.style)} />;
  },
};
```

替换为：
```js
var NOTE_MD_COMPONENTS = {
  ul: function(props) {
    return <ul {...props} style={Object.assign({ marginTop: 4, marginBottom: 4, paddingLeft: "1.25em", listStylePosition: "outside" }, props.style)} />;
  },
  ol: function(props) {
    return <ol {...props} style={Object.assign({ marginTop: 4, marginBottom: 4, paddingLeft: "1.25em", listStylePosition: "outside" }, props.style)} />;
  },
  li: function(props) {
    return <li {...props} style={Object.assign({ marginTop: 2, marginBottom: 2 }, props.style)} />;
  },
  p: function(props) {
    return <p {...props} style={Object.assign({ margin: 0, lineHeight: "inherit" }, props.style)} />;
  },
  img: function(props) {
    return <img {...props} style={{ maxWidth: "100%", borderRadius: 6, display: "block", margin: "4px 0" }} />;
  },
};
```

- [ ] **Step 2: 验证编译无报错**

检查开发服务器终端，无报错。

- [ ] **Step 3: Commit**

```bash
cd /Users/roy/Projects/taskbrain && git add src/TaskBrain.jsx && git commit -m "feat: add img and p renderers to NOTE_MD_COMPONENTS"
```

---

## Task 4：随笔 textarea 绑定 `onPaste`

**Files:**
- Modify: `src/TaskBrain.jsx`，约第 2282 行（新建随笔 textarea）和约第 2329 行（编辑随笔 textarea）

- [ ] **Step 1: 新建随笔 textarea 加 `onPaste`**

在约第 2282 行，找到新建随笔的 textarea：
```js
<textarea value={noteNewContent} onChange={function(e) { setNoteNewContent(e.target.value); }} onKeyDownCapture={function(e) { applyNoteListKeyDown(e, noteNewContent, setNoteNewContent); }} placeholder="随便写点什么… 支持 Markdown"
```

在该 textarea 属性中加入 `onPaste`（可加在 `onChange` 之后）：
```js
onPaste={function(e) { handleNoteImagePaste(e, setNoteNewContent); }}
```

- [ ] **Step 2: 编辑随笔 textarea 加 `onPaste`**

在约第 2329 行，找到编辑随笔的 textarea：
```js
<textarea value={noteEditContent} onChange={function(e) { setNoteEditContent(e.target.value); }} onKeyDownCapture={function(e) { applyNoteListKeyDown(e, noteEditContent, setNoteEditContent); }}
```

同样加入：
```js
onPaste={function(e) { handleNoteImagePaste(e, setNoteEditContent); }}
```

- [ ] **Step 3: 手动验证**

在浏览器中：
1. 打开随笔 tab，点击"写随笔"
2. 截一张屏（Cmd+Shift+4）复制到剪切板
3. 在随笔 textarea 中粘贴（Cmd+V）
4. 预期：文本框内出现 `![图片](data:image/...)` 占位文字（长字符串），保存后预览显示图片

- [ ] **Step 4: Commit**

```bash
cd /Users/roy/Projects/taskbrain && git add src/TaskBrain.jsx && git commit -m "feat: bind image paste handler to note textareas"
```

---

## Task 5：任务 detail textarea 绑定 `onPaste`

**Files:**
- Modify: `src/TaskBrain.jsx`（搜索 `value={eDetail}` 定位）

- [ ] **Step 1: 任务编辑 detail textarea 加 `onPaste`**

搜索关键字 `value={eDetail}` 定位 detail textarea，加入 `onPaste`：
```js
onPaste={function(e) { handleNoteImagePaste(e, setEDetail); }}
```

- [ ] **Step 2: 手动验证**

在浏览器中：
1. 打开任意任务，点击"编辑"
2. 截一张屏（Cmd+Shift+4）复制到剪切板
3. 在备注细节 textarea 中粘贴（Cmd+V）
4. 点击保存，展开任务（点击 `▸`）确认 detail 区域出现 `![图片](data:...)` 文字

- [ ] **Step 3: Commit**

```bash
cd /Users/roy/Projects/taskbrain && git add src/TaskBrain.jsx && git commit -m "feat: bind image paste handler to task detail textarea"
```

---

## Task 6：任务 `detail` 渲染升级为 ReactMarkdown

**Files:**
- Modify: `src/TaskBrain.jsx`，约第 1008-1013 行（任务卡片 detail 显示区域）

- [ ] **Step 1: 将 detail 渲染从纯文本改为 ReactMarkdown**

找到约第 1008-1013 行：
```js
{(task.detail || "").trim() && (
  <div style={{
    fontSize: 11, color: T.textMuted, lineHeight: 1.4, marginTop: 3, marginBottom: 6,
    paddingLeft: 0, fontStyle: "normal",
  }}>{task.detail.trim()}</div>
)}
```

替换为：
```js
{(task.detail || "").trim() && (
  <div style={{
    fontSize: 11, color: T.textMuted, lineHeight: 1.4, marginTop: 3, marginBottom: 6,
    paddingLeft: 0, fontStyle: "normal", whiteSpace: "pre-wrap",
  }}>
    <ReactMarkdown components={NOTE_MD_COMPONENTS}>{task.detail.trim()}</ReactMarkdown>
  </div>
)}
```

- [ ] **Step 2: 手动验证**

在浏览器中编辑任意任务 → 在 detail textarea 粘贴一张图 → 保存 → 确认任务卡片展开后显示图片（点击 `▸` 展开任务详情查看）。

- [ ] **Step 3: Commit**

```bash
cd /Users/roy/Projects/taskbrain && git add src/TaskBrain.jsx && git commit -m "feat: render task detail as Markdown with ReactMarkdown"
```

---

## Task 7：修复随笔摘要与展开逻辑

**Files:**
- Modify: `src/TaskBrain.jsx`，约第 2322-2384 行（`filteredNotes.map` 渲染块）

- [ ] **Step 1: 在 `filteredNotes.map` 里替换 `summary` 计算并修复所有长度判断**

找到约第 2322-2324 行：
```js
{filteredNotes.map(function(n) {
  var isEditing = noteEditingId === n.id;
  var summary = (n.content || "").length > 80 ? (n.content || "").slice(0, 80) + "…" : (n.content || "");
```

替换为：
```js
{filteredNotes.map(function(n) {
  var isEditing = noteEditingId === n.id;
  var displayContent = (n.content || "").replace(/!\[[^\]]*\]\(data:[^)]+\)/g, "[图片]");
  var summary = displayContent.length > 80 ? displayContent.slice(0, 80) + "…" : displayContent;
```

- [ ] **Step 2: 替换卡片内所有 `(n.content || "").length > 80` 为 `displayContent.length > 80`**

在同一 `filteredNotes.map` 渲染块内，找到以下 4 处并全部替换：

| 约行号 | 原代码 | 替换为 |
|--------|--------|--------|
| ~2368 | `if ((n.content \|\| "").length > 80) setNoteExpandedId(...)` | `if (displayContent.length > 80) setNoteExpandedId(...)` |
| ~2369 | `if ((n.content \|\| "").length > 80 && (e.key === ...))` | `if (displayContent.length > 80 && (e.key === ...))` |
| ~2372 | `cursor: (n.content \|\| "").length > 80 ? "pointer" : "default"` | `cursor: displayContent.length > 80 ? "pointer" : "default"` |
| ~2382 | `{(n.content \|\| "").length > 80 && (` | `{displayContent.length > 80 && (` |

- [ ] **Step 3: 手动验证**

1. 新建一条只有图片的随笔（粘贴一张图，不写文字）→ 保存
2. 确认摘要显示 `[图片]` 而非乱码的 base64 字符串
3. 确认卡片不显示"展开 ▾"（因为 displayContent 长度 ≤ 80）
4. 新建一条含很长文字 + 图片的随笔 → 确认展开/收起正常工作

- [ ] **Step 4: Commit**

```bash
cd /Users/roy/Projects/taskbrain && git add src/TaskBrain.jsx && git commit -m "fix: use displayContent for note summary and expand threshold to handle embedded images"
```

---

## 完成检查

- [ ] 随笔新建时粘贴截图（PNG）→ 保存后显示图片，透明区域不变黑 ✓
- [ ] 随笔编辑时粘贴图片 → 保存后显示图片 ✓
- [ ] 粘贴宽度 > 1200px 的大图 → 预览图片明显缩小（说明压缩生效）✓
- [ ] 任务编辑 detail 粘贴图片 → 保存后任务卡片展开显示图片 ✓
- [ ] 任务 detail 使用纯文字（如"下午3点"）的现有任务 → 渲染正常，无样式破坏 ✓
- [ ] 文本粘贴（Cmd+V 粘贴文字）在随笔和任务中均不受影响 ✓
- [ ] 含图片随笔的摘要显示 `[图片]` 而非 base64 乱码 ✓
- [ ] 仅含图片的随笔不显示"展开 ▾"按钮 ✓
- [ ] 含较多文字 + 图片的随笔 → 展开/收起行为正常 ✓
- [ ] 刷新页面后随笔和任务 detail 的图片仍然显示（持久化正常）✓
