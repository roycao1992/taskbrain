import { useState, useRef, useMemo, useEffect, useCallback } from "react";
import ReactMarkdown from "react-markdown";
import { getSupabase } from "./lib/supabase";

/* ═══════════════════════════ CONSTANTS ═══════════════════════════ */

// 个人分类使用：按索引取色，支持任意数量分类
var CAT_PALETTE = [
  { light: { bg: "#FFF7ED", color: "#C2410C", border: "#FDBA74" }, dark: { bg: "#431407", color: "#FDBA74", border: "#92400E" }, dist: "#F97316" },
  { light: { bg: "#F5F3FF", color: "#6D28D9", border: "#C4B5FD" }, dark: { bg: "#2E1065", color: "#C4B5FD", border: "#5B21B6" }, dist: "#8B5CF6" },
  { light: { bg: "#ECFEFF", color: "#0E7490", border: "#67E8F9" }, dark: { bg: "#083344", color: "#67E8F9", border: "#155E75" }, dist: "#06B6D4" },
  { light: { bg: "#FDF2F8", color: "#BE185D", border: "#F9A8D4" }, dark: { bg: "#500724", color: "#F9A8D4", border: "#9D174D" }, dist: "#EC4899" },
  { light: { bg: "#ECFDF5", color: "#047857", border: "#6EE7B7" }, dark: { bg: "#022C22", color: "#6EE7B7", border: "#065F46" }, dist: "#10B981" },
  { light: { bg: "#FEFCE8", color: "#A16207", border: "#FDE047" }, dark: { bg: "#422006", color: "#FDE047", border: "#854D0E" }, dist: "#EAB308" },
  { light: { bg: "#F0FDF4", color: "#15803D", border: "#86EFAC" }, dark: { bg: "#052E16", color: "#86EFAC", border: "#166534" }, dist: "#22C55E" },
  { light: { bg: "#FEF2F2", color: "#B91C1C", border: "#FECACA" }, dark: { bg: "#450A0A", color: "#FECACA", border: "#991B1B" }, dist: "#EF4444" },
];
function getCatColors(categories, catId, dark) {
  var idx = categories.findIndex(function(c) { return c.id === catId; });
  if (idx < 0) return dark ? { bg: "#1E2536", color: "#94A3B8", border: "#334155" } : { bg: "#F3F4F6", color: "#6B7280", border: "#E5E7EB" };
  var p = CAT_PALETTE[idx % CAT_PALETTE.length];
  return dark ? p.dark : p.light;
}
function getDistColor(categories, catId) {
  var idx = categories.findIndex(function(c) { return c.id === catId; });
  if (idx < 0) return "#94A3B8";
  return CAT_PALETTE[idx % CAT_PALETTE.length].dist;
}
function slugForCategory(label) {
  var s = String(label || "").trim().replace(/\s+/g, "_").replace(/[^\w\u4e00-\u9fa5\-_]/g, "");
  return s || "cat_" + Date.now();
}
function escapeRegExp(str) {
  return String(str || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
function normalizeCategoryLabel(label) {
  return String(label || "").trim().toLowerCase().replace(/\s+/g, " ");
}
function findCategoryByLabel(categories, label) {
  var target = normalizeCategoryLabel(label);
  if (!target) return null;
  return (categories || []).find(function(c) {
    return normalizeCategoryLabel(c.label || c.id) === target || normalizeCategoryLabel(c.id) === target;
  }) || null;
}
function ensureCategoryOnProfile(profile, label, emoji) {
  var nextProfile = Object.assign({}, DEF_PROFILE, profile || {});
  var list = Array.isArray(nextProfile.categories) ? nextProfile.categories : [];
  var cleanLabel = String(label || "").trim();
  var existing = findCategoryByLabel(list, cleanLabel) || list.find(function(c) { return c.id === slugForCategory(cleanLabel); }) || null;
  if (existing) return { profile: Object.assign({}, nextProfile, { categories: list }), category: existing, created: false };
  var newCat = {
    id: slugForCategory(cleanLabel),
    label: cleanLabel,
    emoji: emoji && String(emoji).trim() ? String(emoji).trim().slice(0, 2) : "📌",
  };
  return {
    profile: Object.assign({}, nextProfile, { categories: list.concat([newCat]) }),
    category: newCat,
    created: true,
  };
}
function extractExplicitCategory(text, categories) {
  var raw = String(text || "").trim();
  if (!raw) return null;

  var existingHit = null;
  (categories || []).some(function(c) {
    var label = String(c.label || c.id || "").trim();
    if (!label) return false;
    var safe = escapeRegExp(label);
    var patterns = [
      new RegExp("[#＃]\\s*" + safe + "(?=\\s|$)", "i"),
      new RegExp("[【\\[]\\s*" + safe + "\\s*[】\\]]", "i"),
      new RegExp("(?:分类[：: ]*|分类是|分类为|归类到|归到|属于|放到|放进|记到|记进|算作)\\s*" + safe + "(?:分类)?", "i"),
    ];
    return patterns.some(function(re) {
      if (!re.test(raw)) return false;
      existingHit = { mode: "existing", category: c, label: label };
      return true;
    });
  });
  if (existingHit) return existingHit;

  var genericLabels = /^(高|中|低|紧急|优先|优先级|本周|下周|今天|明天|后天|待安排|截止日|周任务)$/;
  var matchers = [
    /(?:分类[：: ]*|分类是|分类为|归类到|归到|属于|放到|放进|记到|记进|算作)\s*([A-Za-z0-9\u4e00-\u9fa5][A-Za-z0-9\u4e00-\u9fa5_\- ]{0,19})/i,
    /^[#＃]\s*([A-Za-z0-9\u4e00-\u9fa5][A-Za-z0-9\u4e00-\u9fa5_\- ]{0,19})(?=\s|$)/i,
    /^[【\[]\s*([^\]】]{1,20})\s*[】\]]/i,
  ];
  for (var i = 0; i < matchers.length; i++) {
    var match = raw.match(matchers[i]);
    if (!match || !match[1]) continue;
    var label = String(match[1]).trim().replace(/分类$/i, "").trim();
    if (!label || genericLabels.test(label)) continue;
    var existing = findCategoryByLabel(categories || [], label);
    if (existing) return { mode: "existing", category: existing, label: existing.label || existing.id };
    return { mode: "new", label: label };
  }
  return null;
}

const PRIORITIES = [
  { id: "urgent", label: "紧急", color: "#DC2626", weight: 4 },
  { id: "high", label: "高", color: "#EA580C", weight: 3 },
  { id: "medium", label: "中", color: "#CA8A04", weight: 2 },
  { id: "low", label: "低", color: "#9CA3AF", weight: 1 },
];

const FONT = "'Instrument Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";

const LIGHT = {
  bg: "#F8F9FB", card: "#FFFFFF", cardBorder: "#F0F0F0", text: "#1F2937", textSec: "#6B7280",
  textMuted: "#9CA3AF", inputBg: "#FFFFFF", inputBorder: "#E5E7EB", tabBg: "#F3F4F6",
  tabActive: "#FFFFFF", tabShadow: "0 1px 3px rgba(0,0,0,0.06)", accent: "#2563EB",
  aiPanel: "#FFFFFF", aiBorder: "#E0E7FF", aiShadow: "0 2px 8px rgba(37,99,235,0.06)",
  secBadge: "#F3F4F6", shadow: "0 1px 2px rgba(0,0,0,0.04)", cardDone: "#FAFAFA",
  profBg: "#F9FAFB", profBorder: "#E5E7EB",
  toastBg: "#ECFDF5", toastBorder: "#6EE7B7", toastText: "#047857",
  warnBg: "#FFFBEB", warnBorder: "#FDE047", warnText: "#A16207",
  userBubble: "#F3F4F6",
};

const DARK = {
  bg: "#0B0F1A", card: "#141926", cardBorder: "#1E2536", text: "#E2E8F0", textSec: "#8892A8",
  textMuted: "#505A6E", inputBg: "#141926", inputBorder: "#1E2536", tabBg: "#141926",
  tabActive: "#1E2536", tabShadow: "0 1px 3px rgba(0,0,0,0.3)", accent: "#3B82F6",
  aiPanel: "#141926", aiBorder: "#1E3A5F", aiShadow: "0 2px 8px rgba(59,130,246,0.1)",
  secBadge: "#1E2536", shadow: "0 1px 2px rgba(0,0,0,0.2)", cardDone: "#0E1219",
  profBg: "#0E1219", profBorder: "#1E2536",
  toastBg: "#022C22", toastBorder: "#065F46", toastText: "#6EE7B7",
  warnBg: "#422006", warnBorder: "#854D0E", warnText: "#FDE047",
  userBubble: "#1E2536",
};

/* ═══════════════════════════ TIME HELPERS ═══════════════════════════ */

function getMondayOfWeek(date) {
  const d = new Date(date);
  const day = d.getDay();
  d.setDate(d.getDate() - day + (day === 0 ? -6 : 1));
  return d;
}

function getWeekKey(date) {
  const m = getMondayOfWeek(date);
  return m.getFullYear() + "-" + String(m.getMonth() + 1).padStart(2, "0") + "-" + String(m.getDate()).padStart(2, "0");
}

function getWeekRange(wk) {
  const parts = wk.split("-").map(Number);
  const mon = new Date(parts[0], parts[1] - 1, parts[2]);
  const sun = new Date(mon);
  sun.setDate(mon.getDate() + 6);
  return { mon, sun };
}

function nextWeekKey(wk) {
  const { mon } = getWeekRange(wk);
  const next = new Date(mon);
  next.setDate(mon.getDate() + 7);
  return getWeekKey(next);
}

function fmtShort(d) {
  return (d.getMonth() + 1) + "/" + d.getDate();
}

function getWeekLabel(wk, cw) {
  if (wk === cw) return "本周";
  const { mon: cm } = getWeekRange(cw);
  const { mon: tm, sun: ts } = getWeekRange(wk);
  const diff = Math.round((tm - cm) / (7 * 86400000));
  const r = fmtShort(tm) + "-" + fmtShort(ts);
  if (diff === 1) return "下周 (" + r + ")";
  if (diff === -1) return "上周 (" + r + ")";
  if (diff > 0) return r + " · " + diff + "周后";
  return r + " · " + (-diff) + "周前";
}

function getCW() { return getWeekKey(new Date()); }

function getWeekOpts(cw) {
  var o = [];
  var { mon } = getWeekRange(cw);
  for (var i = 0; i < 12; i++) {
    var d = new Date(mon);
    d.setDate(mon.getDate() + i * 7);
    var k = getWeekKey(d);
    o.push({ key: k, label: getWeekLabel(k, cw) });
  }
  return o;
}

function daysUntil(ds) {
  if (!ds) return Infinity;
  var n = new Date(); n.setHours(0, 0, 0, 0);
  var d = new Date(ds); d.setHours(0, 0, 0, 0);
  return Math.ceil((d - n) / 86400000);
}

var WEEKDAY_ZH = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"];
function getWeekday(ds) {
  if (!ds) return "";
  return WEEKDAY_ZH[new Date(ds).getDay()];
}
function fmtDate(ds) {
  if (!ds) return "";
  var d = new Date(ds);
  return (d.getMonth() + 1) + "月" + d.getDate() + "日";
}
function fmtDateWithWeekday(ds) {
  if (!ds) return "";
  return fmtDate(ds) + " " + getWeekday(ds);
}
function pad2(n) {
  return String(n).padStart(2, "0");
}
function formatYmd(date) {
  return date.getFullYear() + "-" + pad2(date.getMonth() + 1) + "-" + pad2(date.getDate());
}
function buildValidDate(year, month, day) {
  var y = Number(year);
  var m = Number(month);
  var d = Number(day);
  if (!y || !m || !d) return null;
  var dt = new Date(y, m - 1, d);
  if (dt.getFullYear() !== y || dt.getMonth() !== m - 1 || dt.getDate() !== d) return null;
  return dt;
}
var WEEKDAY_NUM = { "一": 1, "二": 2, "三": 3, "四": 4, "五": 5, "六": 6, "日": 0, "天": 0, "0": 0, "1": 1, "2": 2, "3": 3, "4": 4, "5": 5, "6": 6 };
function resolveWeekdayDate(baseDate, weekOffset, weekdayChar) {
  var weekday = WEEKDAY_NUM[weekdayChar];
  if (weekday === undefined) return null;
  var mon = getMondayOfWeek(baseDate);
  var target = new Date(mon);
  target.setDate(mon.getDate() + weekOffset * 7 + (weekday === 0 ? 6 : weekday - 1));
  return target;
}
function normalizeDateCandidate(value, baseDate) {
  var raw = String(value || "").trim();
  if (!raw || /^null$/i.test(raw) || /^undefined$/i.test(raw)) return null;
  var today = baseDate instanceof Date ? new Date(baseDate) : new Date();
  today.setHours(0, 0, 0, 0);
  var text = raw.replace(/\s+/g, " ");

  if (/今天/.test(text)) return formatYmd(today);
  if (/明天/.test(text)) {
    var tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);
    return formatYmd(tomorrow);
  }
  if (/后天/.test(text)) {
    var afterTomorrow = new Date(today);
    afterTomorrow.setDate(today.getDate() + 2);
    return formatYmd(afterTomorrow);
  }

  var weekdayMatch = text.match(/(本周|这周|下周|下下周)?\s*(周|星期)([一二三四五六日天0-6])/);
  if (weekdayMatch) {
    var weekWord = weekdayMatch[1] || "";
    var weekOffset = weekWord === "下周" ? 1 : weekWord === "下下周" ? 2 : 0;
    var weekdayDate = resolveWeekdayDate(today, weekOffset, weekdayMatch[3]);
    if (weekdayDate) return formatYmd(weekdayDate);
  }

  var ymdMatch = text.match(/(\d{4})\s*[年\/\-.]\s*(\d{1,2})\s*[月\/\-.]\s*(\d{1,2})(?:\s*[日号])?/);
  if (ymdMatch) {
    var fullDate = buildValidDate(ymdMatch[1], ymdMatch[2], ymdMatch[3]);
    return fullDate ? formatYmd(fullDate) : null;
  }

  var mdMatch = text.match(/(\d{1,2})\s*[月\/\-.]\s*(\d{1,2})(?:\s*[日号])?/);
  if (mdMatch) {
    var inferred = buildValidDate(today.getFullYear(), mdMatch[1], mdMatch[2]);
    return inferred ? formatYmd(inferred) : null;
  }

  return null;
}
function normalizeWeekCandidate(value, text, currentWeekKey) {
  var raw = String(value || "").trim();
  if (raw && /^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  var normalized = normalizeDateCandidate(raw, getWeekRange(currentWeekKey).mon);
  if (normalized) return getWeekKey(new Date(normalized));
  var source = String(text || "");
  if (/下下周/.test(source)) return nextWeekKey(nextWeekKey(currentWeekKey));
  if (/下周/.test(source)) return nextWeekKey(currentWeekKey);
  if (/(本周|这周)/.test(source)) return currentWeekKey;
  return null;
}
function parseTaskAIResponse(raw) {
  if (!raw) return null;
  var text = String(raw).replace(/```json|```/gi, "").trim();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch (e) { /* ignore */ }
  var start = text.indexOf("{");
  var end = text.lastIndexOf("}");
  if (start >= 0 && end > start) {
    try {
      return JSON.parse(text.slice(start, end + 1));
    } catch (e) { /* ignore */ }
  }
  return null;
}
function inferPriorityFromText(text) {
  var raw = String(text || "");
  if (/(紧急|加急|立即|马上|尽快|urgent|asap)/i.test(raw)) return "urgent";
  if (/(高优|高优先级|优先级高|重要|high)/i.test(raw)) return "high";
  if (/(低优|低优先级|不急|low)/i.test(raw)) return "low";
  if (/(中优|中优先级|一般|medium)/i.test(raw)) return "medium";
  return null;
}
function hasDeadlineCue(text) {
  var raw = String(text || "");
  return /(截止|截至|之前|以前|前完成|前提交|前处理|前搞定|before|due)/i.test(raw)
    || /(\d{4}[\/\-.]\d{1,2}[\/\-.]\d{1,2}|\d{1,2}月\d{1,2}[日号]?|今天|明天|后天)/.test(raw);
}
function fmtNoteTime(ts) {
  if (!ts) return "";
  var d = new Date(ts);
  return (d.getMonth() + 1) + "月" + d.getDate() + "日 " + String(d.getHours()).padStart(2, "0") + ":" + String(d.getMinutes()).padStart(2, "0");
}
function getTaskPlacementLabel(task, CW) {
  if (!task) return "";
  if (task.type === "deadline" && task.deadline) return "截止 " + fmtDateWithWeekday(task.deadline);
  if (task.type === "week" && task.week) return getWeekLabel(task.week, CW);
  return "待安排";
}
function getRevealView(currentView, task) {
  if (!task) return currentView;
  if (currentView === "deadline" && task.type !== "deadline") return "week";
  if (currentView === "category" && !task.category) return "week";
  return currentView;
}

function dlWeek(ds) {
  return ds ? getWeekKey(new Date(ds)) : null;
}

/* ═══════════════════════════ 默认空数据（未登录/无本地数据时）══════════════════════════ */

var DEF_PROFILE = { company: "", personal: "", invest: "", family: "", categories: [] };
var DEF_STATUS = "";

function normalizeProfileShape(profile) {
  if (!profile || typeof profile !== "object") return Object.assign({}, DEF_PROFILE);
  return Object.assign({}, DEF_PROFILE, profile, {
    categories: Array.isArray(profile.categories) ? profile.categories : [],
  });
}
function normalizeSnapshot(data) {
  return {
    tasks: Array.isArray(data && data.tasks) ? data.tasks : [],
    profile: normalizeProfileShape(data && data.profile),
    status: data && data.status !== undefined ? data.status : "",
    dark: !!(data && data.dark),
    notes: Array.isArray(data && data.notes) ? data.notes : [],
    updatedAt: (data && (data.updatedAt || data.updated_at)) || null,
  };
}
function snapshotToPayload(snapshot) {
  var s = normalizeSnapshot(snapshot);
  return {
    tasks: s.tasks,
    profile: s.profile,
    status: s.status,
    dark: s.dark,
    notes: s.notes,
  };
}
function sortedStringify(obj) {
  if (obj === undefined) return undefined;
  if (Array.isArray(obj)) return "[" + obj.map(sortedStringify).join(",") + "]";
  if (obj !== null && typeof obj === "object") {
    var keys = Object.keys(obj).sort().filter(function(k) { return obj[k] !== undefined; });
    return "{" + keys.map(function(k) { return JSON.stringify(k) + ":" + sortedStringify(obj[k]); }).join(",") + "}";
  }
  return JSON.stringify(obj);
}
function serializePayload(payload) {
  return sortedStringify(snapshotToPayload(payload));
}
function hasSnapshotContent(snapshot) {
  var s = normalizeSnapshot(snapshot);
  return s.tasks.length > 0 || s.notes.length > 0 || Object.keys(s.profile || {}).some(function(k) {
    if (k === "categories") return (s.profile.categories || []).length > 0;
    return !!s.profile[k];
  }) || !!s.status;
}
function toTimeMs(value) {
  var ts = Date.parse(value || "");
  return Number.isFinite(ts) ? ts : 0;
}

/* ═══════════════════════════ STORAGE ═══════════════════════════ */

var SK = "taskbrain-data";

function loadLocal() {
  try {
    if (window.storage && window.storage.get) return null;
    var raw = localStorage.getItem(SK);
    if (raw) return JSON.parse(raw);
  } catch (e) { /* ignore */ }
  return null;
}

function saveLocal(d) {
  try {
    if (window.storage && window.storage.set) return;
    localStorage.setItem(SK, JSON.stringify(d));
  } catch (e) { console.error("Save:", e); }
}

async function loadFromSupabase(supabase, userId) {
  if (!supabase || !userId) return null;
  var r = await supabase.from("user_data").select("tasks, profile, status, dark, notes, updated_at").eq("id", userId).maybeSingle();
  if (r.error) return null;
  if (!r.data) return null;
  return normalizeSnapshot({
    tasks: r.data.tasks,
    profile: r.data.profile,
    status: r.data.status,
    dark: r.data.dark,
    notes: r.data.notes,
    updated_at: r.data.updated_at,
  });
}

async function saveToSupabase(supabase, userId, d, updatedAt) {
  if (!supabase || !userId) return { error: null, updatedAt: null };
  var payload = snapshotToPayload(d);
  var updatedAt = updatedAt || new Date().toISOString();
  var r = await supabase.from("user_data").upsert({
    id: userId,
    tasks: payload.tasks,
    profile: payload.profile,
    status: payload.status,
    dark: payload.dark,
    notes: payload.notes,
    updated_at: updatedAt,
  }, { onConflict: "id" });
  return { error: r.error || null, updatedAt: r.error ? null : updatedAt };
}

/* ═══════════════════════════ AI (DeepSeek) ═══════════════════════════ */

// API key: 默认使用部署时配置的 VITE_DEEPSEEK_API_KEY（roy@yxdigital.com）；用户可在 ⚙️ 设置中覆盖。
function getApiKey() {
  try {
    var fromStorage = localStorage.getItem("taskbrain-api-key") || "";
    if (fromStorage) return fromStorage;
    return (import.meta.env.VITE_DEEPSEEK_API_KEY || "").trim();
  } catch (e) { return ""; }
}
function setApiKey(key) {
  try { localStorage.setItem("taskbrain-api-key", key); } catch (e) { /* ignore */ }
}

async function callAI(sys, msgs, maxTokens) {
  try {
    var apiKey = getApiKey();
    if (!apiKey) return null;
    var messages = [{ role: "system", content: sys }].concat(msgs);
    var r = await fetch("https://api.deepseek.com/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": "Bearer " + apiKey,
      },
      body: JSON.stringify({
        model: "deepseek-chat",
        max_tokens: maxTokens || 1200,
        messages: messages,
      }),
    });
    var d = await r.json();
    if (d.choices && d.choices[0] && d.choices[0].message)
      return d.choices[0].message.content || null;
    return null;
  } catch (e) { return null; }
}

function buildClsSys(prof) {
  var p = prof || {};
  var bg = [p.company, p.personal, p.family, p.invest].filter(Boolean).join("\n");
  var cats = p.categories || [];
  var catHint = cats.length > 0
    ? "当前分类（只能选其一）：\n" + cats.map(function(c) { return "id: " + c.id + " 标签: " + (c.emoji || "") + " " + (c.label || c.id); }).join("\n") + "\n若没有合适分类，可返回 newCategory: \"新分类名\" 与可选 newEmoji（如 📌），将自动创建；否则 category 填上述已有 id。"
    : "用户暂无分类。请返回 newCategory: \"分类名\" 与 newEmoji（如 📌），将自动创建该分类；category 可留空。";
  return "你是任务管理助手。根据用户的一段描述，你需要：\n"
    + "1) 提炼关键信息 → 生成简洁的任务标题 refinedText（去掉口语、冗余，保留动作+对象，控制在 15 字内为宜）\n"
    + "2) 备注 detail：不需要每个任务都有备注。只有信息较复杂、在标题里无法体现的关键信息（如具体时间、地点、规格、人数等）才填 detail；简单任务或标题已能表达清楚的，detail 留空。detail 最多一两句话。\n"
    + "3) 从描述中识别截止日/时间 → 若有「下周三」「3月20号」「本周五前」等，推算出具体日期，填 deadline（YYYY-MM-DD）；没有则 null\n"
    + "4) 判断是周任务还是截止日任务 → 有明确截止日填 type:deadline，否则 type:week\n"
    + "5) 若是周任务且能推断目标周（如「本周」「下周」）→ 填 week 为该周周一的 YYYY-MM-DD；无法推断或待安排则 week:null\n"
    + "6) 分类与优先级 → category 或 newCategory；priority\n\n"
    + (bg ? "【背景】\n" + bg + "\n\n" : "")
    + catHint + "\n\n"
    + "优先级id: urgent, high, medium, low\n"
    + "只返回一个JSON，不要markdown包裹：\n"
    + "{\"refinedText\":\"精简标题\",\"detail\":\"细节备注或留空\",\"category\":\"已有id或留空\",\"newCategory\":\"新分类名或留空\",\"newEmoji\":\"可选如📌\",\"priority\":\"id\",\"type\":\"week或deadline\",\"deadline\":\"YYYY-MM-DD或null\",\"week\":\"YYYY-MM-DD或null\",\"reason\":\"一句话\"}";
}

function buildDiagSys(prof, stat) {
  var p = prof || {};
  return "你是Roy的私人AI助手。你们正在对话，Roy可能追问或反驳，你要像了解他的朋友/顾问一样回应。\n\n【背景】\n公司:" + (p.company || "未填写") + "\n个人:" + (p.personal || "未填写") + "\n投资:" + (p.invest || "未填写") + "\n家庭:" + (p.family || "未填写") + "\n\n【当前状态】\n" + (stat || "未填写") + "\n\n若用户提供了【最近随笔】，可结合随笔内容给建议。\n\n要求：1)简洁直接不客套 2)结合状态给建议 3)关注快到期的截止日 4)本周>8就过载 5)工作生活平衡 6)焦虑给具体建议 7)追问时正面回应不重复 8)中文250字内";
}

var SYS_WK = "你是Roy的任务管理助手。从待安排挑任务到本周。1)合计不超8-10 2)高优先先排 3)空白分类补一个。返回JSON: [{\"taskId\":\"id\",\"reason\":\"一句话\"}]";

function buildNoteToTasksSys(prof) {
  var p = prof || {};
  var cats = p.categories || [];
  var catHint = cats.length > 0
    ? "当前分类：\n" + cats.map(function(c) { return "id: " + c.id + " 标签: " + (c.emoji || "") + " " + (c.label || c.id); }).join("\n") + "\n每个任务可选 category（已有id）或 newCategory（新分类名）+ newEmoji（如📌）。"
    : "用户暂无分类。每个任务可返回 newCategory 与 newEmoji 创建新分类。";
  return "你是任务管理助手。根据用户的一段随笔，需要拆成多个任务。\n"
    + "1) 一条随笔可能包含多个任务（如「买牛奶、约会议、写报告」→ 3条），分别提炼；若只有一件事则返回1条。\n"
    + "2) 每条任务：refinedText（精简标题，15字内）、detail（易丢失的细节，否则留空）、category（已有id）或 newCategory+newEmoji、priority（urgent/high/medium/low）、type（week或deadline）、deadline（YYYY-MM-DD或null）、week（周任务的目标周周一YYYY-MM-DD或null）。\n"
    + "3) 有明确截止日时 type:deadline；否则 type:week。\n\n"
    + catHint + "\n\n"
    + "只返回一个JSON，不要markdown包裹。格式：\n"
    + "{\"tasks\":[{\"refinedText\":\"标题\",\"detail\":\"备注或留空\",\"category\":\"id或留空\",\"newCategory\":\"新分类或留空\",\"newEmoji\":\"📌\",\"priority\":\"id\",\"type\":\"week或deadline\",\"deadline\":\"YYYY-MM-DD或null\",\"week\":\"YYYY-MM-DD或null\"},...]}";
}

function parseTaskArrayResponse(raw) {
  if (!raw) return null;
  var text = String(raw).replace(/```json|```/gi, "").trim();
  if (!text) return null;
  try {
    var parsed = JSON.parse(text);
    if (Array.isArray(parsed)) return parsed;
    if (parsed && Array.isArray(parsed.tasks)) return parsed.tasks;
    return null;
  } catch (e) { /* ignore */ }
  var start = text.indexOf("[");
  var end = text.lastIndexOf("]");
  if (start >= 0 && end > start) {
    try {
      return JSON.parse(text.slice(start, end + 1));
    } catch (e) { /* ignore */ }
  }
  var objStart = text.indexOf("{");
  var objEnd = text.lastIndexOf("}");
  if (objStart >= 0 && objEnd > objStart) {
    try {
      var obj = JSON.parse(text.slice(objStart, objEnd + 1));
      return obj && Array.isArray(obj.tasks) ? obj.tasks : null;
    } catch (e) { /* ignore */ }
  }
  return null;
}

/* ═══════════════════════════ SMALL COMPONENTS ═══════════════════════════ */

function MiniBtn(props) {
  return (
    <button type="button" onClick={props.onClick} style={{
      background: "none", border: "none", fontSize: 12, fontWeight: 500,
      color: props.color, cursor: "pointer", padding: "4px 6px", fontFamily: FONT,
    }}>
      {props.children}
    </button>
  );
}

function QuickBtn(props) {
  return (
    <button type="button" onClick={function(e) { e.preventDefault(); e.stopPropagation(); if (props.onClick) props.onClick(); }} style={{
      background: "none", border: "none", fontSize: 11, fontWeight: 600,
      color: props.color, cursor: "pointer", padding: "6px 10px", fontFamily: FONT,
      textDecoration: "underline", textUnderlineOffset: 2,
    }}>
      {props.children}
    </button>
  );
}

function HeaderBtn(props) {
  return (
    <button type="button" onClick={props.onClick} style={{
      padding: "8px 12px", background: props.T.card,
      border: "1px solid " + (props.active ? props.T.accent : props.T.cardBorder),
      borderRadius: 8, fontSize: 13, cursor: "pointer",
      color: props.active ? props.T.accent : props.T.textSec, fontFamily: FONT,
    }}>
      {props.children}
    </button>
  );
}

function SelectBox(props) {
  return (
    <select value={props.value} onChange={function(e) { props.onChange(e.target.value); }} style={{
      padding: "5px 10px", background: props.T.inputBg,
      border: "1px solid " + props.T.inputBorder, borderRadius: 6,
      color: props.T.text, fontSize: 12, fontFamily: FONT, outline: "none",
    }}>
      {props.children}
    </select>
  );
}

function Toast(props) {
  useEffect(function() {
    var t = setTimeout(props.onDone, 3500);
    return function() { clearTimeout(t); };
  }, []);

  return (
    <div style={{
      position: "fixed", bottom: 24, left: "50%", transform: "translateX(-50%)",
      background: props.T.toastBg, border: "1px solid " + props.T.toastBorder,
      borderRadius: 10, padding: "10px 18px", fontSize: 13, color: props.T.toastText,
      fontWeight: 600, fontFamily: FONT, boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
      zIndex: 100, animation: "toastIn .25s ease-out", maxWidth: "90vw",
      whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
    }}>
      {props.message}
      <style>{`@keyframes toastIn{from{opacity:0;transform:translateX(-50%) translateY(10px)}to{opacity:1;transform:translateX(-50%) translateY(0)}}`}</style>
    </div>
  );
}

function DistBar(props) {
  var tasks = props.tasks;
  var CW = props.CW;
  var T = props.T;
  var categories = props.categories || [];
  var thisWeek = tasks.filter(function(t) {
    return !t.done && ((t.type === "week" && t.week === CW) || (t.type === "deadline" && dlWeek(t.deadline) === CW));
  });
  if (thisWeek.length === 0 || categories.length === 0) return null;

  var counts = {};
  categories.forEach(function(c) {
    counts[c.id] = thisWeek.filter(function(t) { return t.category === c.id; }).length;
  });
  var missing = categories.filter(function(c) { return counts[c.id] === 0; }).map(function(c) { return (c.emoji || "📌") + (c.label || c.id); });

  return (
    <div style={{ marginBottom: 20 }}>
      <div style={{ display: "flex", height: 6, borderRadius: 3, overflow: "hidden", gap: 1, marginBottom: 6 }}>
        {categories.map(function(c) {
          if (counts[c.id] <= 0) return null;
          return <div key={c.id} style={{ flex: counts[c.id], background: getDistColor(categories, c.id), borderRadius: 2 }} title={(c.label || c.id) + ": " + counts[c.id]} />;
        })}
      </div>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", fontSize: 11, color: T.textSec }}>
        {categories.map(function(c) {
          if (counts[c.id] <= 0) return null;
          return <span key={c.id}>{c.emoji || "📌"}{counts[c.id]}</span>;
        })}
        {missing.length > 0 && (
          <span style={{ color: T.textMuted, fontStyle: "italic" }}>本周空白: {missing.join(" ")}</span>
        )}
      </div>
    </div>
  );
}

function DLWarn(props) {
  var task = props.task;
  var T = props.T;
  if (task.type !== "deadline") return null;
  var d = daysUntil(task.deadline);
  if (d > 7 || (task.subtasks && task.subtasks.length > 0)) return null;

  return (
    <div style={{
      marginTop: 6, padding: "6px 10px", background: T.warnBg,
      border: "1px solid " + T.warnBorder, borderRadius: 6, fontSize: 11,
      color: T.warnText, display: "flex", alignItems: "center", justifyContent: "space-between",
    }}>
      <span>{d <= 3 ? "⚡ 紧急！" : "⚡ "}还剩{d}天，还没拆子任务</span>
      <button onClick={props.onExpand} style={{
        background: "none", border: "none", color: T.warnText, fontWeight: 700,
        cursor: "pointer", fontSize: 11, fontFamily: FONT,
      }}>
        拆一下 →
      </button>
    </div>
  );
}

function Section(props) {
  var T = props.T || {};
  return (
    <div style={{ marginBottom: 24 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
        <span style={{ fontSize: 14, fontWeight: 700, color: props.accent || T.text || "#1F2937" }}>{props.title}</span>
        <span style={{ fontSize: 11, fontWeight: 700, color: T.textSec || "#6B7280", background: T.secBadge || "#F3F4F6", borderRadius: 10, padding: "1px 8px" }}>{props.count}</span>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>{props.children}</div>
    </div>
  );
}

function Empty(props) {
  return <div style={{ padding: 16, textAlign: "center", color: "#9CA3AF", fontSize: 13 }}>{props.msg}</div>;
}

/* ═══════════════════════════ TASK ITEM ═══════════════════════════ */

function TaskItem(props) {
  var task = props.task;
  var T = props.T;
  var CC = props.CC;
  var CW = props.CW;
  var nw = props.nw;

  var [isEdit, setIsEdit] = useState(false);
  var [isExp, setIsExp] = useState(false);
  var [confirmDel, setConfirmDel] = useState(false);
  var [eCat, setECat] = useState(task.category);
  var [ePri, setEPri] = useState(task.priority);
  var [eWk, setEWk] = useState(task.week || "");
  var [eType, setEType] = useState(task.type);
  var [eDL, setEDL] = useState(task.deadline || "");
  var [eText, setEText] = useState(task.text);
  var [eDetail, setEDetail] = useState(task.detail || "");
  var [localSub, setLocalSub] = useState("");

  // Force open from parent
  useEffect(function() {
    if (props.forceExpand) setIsExp(true);
  }, [props.forceExpand]);

  var dlD = task.type === "deadline" ? daysUntil(task.deadline) : Infinity;
  var hasSubs = task.subtasks && task.subtasks.length > 0;
  var isBacklog = task.type === "week" && !task.week;
  var isThisWeek = task.type === "week" && task.week === CW;

  var borderColor = T.cardBorder;
  if (task.type === "deadline") {
    if (dlD < 0) borderColor = "#FCA5A5";
    else if (dlD <= 3) borderColor = "#FDBA74";
  }

  var pending = props.classifyingId === task.id;

  var catList = props.categories || [];
  var catObj = catList.find(function(x) { return x.id === task.category; });
  var catColor = CC[task.category] || getCatColors(catList, task.category, props.dark);
  var priObj = PRIORITIES.find(function(x) { return x.id === task.priority; });

  function handleToggleEdit() {
    setIsEdit(!isEdit);
    setECat(task.category);
    setEPri(task.priority);
    setEWk(task.week || "");
    setEType(task.type);
    setEDL(task.deadline || "");
    setEText(task.text);
    setEDetail(task.detail || "");
  }

  function handleSave() {
    props.onUpdate(task.id, {
      text: (eText && String(eText).trim()) || task.text,
      detail: eDetail ? String(eDetail).trim() : "",
      category: eCat, priority: ePri, type: eType,
      week: eType === "week" ? (eWk || null) : null,
      deadline: eType === "deadline" ? (eDL || null) : null,
    });
    setIsEdit(false);
  }

  function handleAddSub() {
    if (localSub.trim()) {
      props.onAddSub(task.id, localSub.trim());
      setLocalSub("");
    }
  }

  return (
    <div id={"task-" + task.id} style={{
      padding: "12px 16px",
      background: task.done ? T.cardDone : T.card,
      borderRadius: 10,
      border: "1px solid " + borderColor,
      opacity: task.done ? 0.5 : 1,
    }}>
      {/* Main row */}
      <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
        <button onClick={function() { if (!pending) props.onToggle(task.id); }} style={{
          width: 20, height: 20, borderRadius: 6, flexShrink: 0, marginTop: 2,
          cursor: pending ? "default" : "pointer", padding: 0,
          border: task.done ? "none" : "2px solid " + T.inputBorder,
          background: task.done ? "#10B981" : "transparent",
          display: "flex", alignItems: "center", justifyContent: "center",
          opacity: pending ? 0.5 : 1,
        }}>
          {task.done && <svg width="11" height="11" viewBox="0 0 12 12" fill="none"><path d="M2 6L5 9L10 3" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" /></svg>}
        </button>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            fontSize: 14, fontWeight: 500,
            color: task.done ? T.textMuted : T.text,
            textDecoration: task.done ? "line-through" : "none",
            lineHeight: 1.5,
          }}>{task.text}</div>
          {(task.detail || "").trim() && (
            <div style={{
              fontSize: 11, color: T.textMuted, lineHeight: 1.4, marginTop: 3, marginBottom: 6,
              paddingLeft: 0, fontStyle: "normal",
            }}>{task.detail.trim()}</div>
          )}
          {!(task.detail || "").trim() && !pending && <div style={{ marginBottom: 6 }} />}
          {pending && <div style={{ fontSize: 11, color: T.textMuted, marginTop: 3, marginBottom: 6 }}>⏳ AI 分析中，请稍候...</div>}
          {!pending && (
            <>
              <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
                {catObj && catColor && (
                  <span style={{ fontSize: 11, fontWeight: 600, color: catColor.color, background: catColor.bg, border: "1px solid " + catColor.border, borderRadius: 6, padding: "1px 7px", whiteSpace: "nowrap" }}>
                    {catObj.emoji} {catObj.label}
                  </span>
                )}
                {priObj && <span style={{ fontSize: 11, fontWeight: 700, color: priObj.color }}>{priObj.label}</span>}
                {task.type === "deadline" && task.deadline && (
                  <span style={{ fontSize: 11, fontWeight: 700, color: dlD < 0 ? "#DC2626" : dlD <= 3 ? "#DC2626" : dlD <= 7 ? "#CA8A04" : T.textSec }}>
                    {"🗓 " + fmtDateWithWeekday(task.deadline) + " · " + (dlD < 0 ? "已过期" + (-dlD) + "天" : dlD === 0 ? "今天截止" : dlD === 1 ? "明天截止" : "还剩" + dlD + "天")}
                  </span>
                )}
                {task.type === "deadline" && !task.deadline && (
                  <span style={{ fontSize: 11, fontWeight: 700, color: "#CA8A04" }}>
                    🗓 待补截止日
                  </span>
                )}
                {task.type === "week" && task.week && (
                  <span style={{ fontSize: 11, color: task.week === CW ? T.accent : T.textSec, fontWeight: task.week === CW ? 700 : 500 }}>
                    {"📌 " + getWeekLabel(task.week, CW)}
                  </span>
                )}
                {isBacklog && <span style={{ fontSize: 11, color: T.textMuted, fontStyle: "italic" }}>待安排</span>}
                {hasSubs && (
                  <span style={{ fontSize: 11, color: task.subtasks.filter(function(s) { return s.done; }).length === task.subtasks.length ? "#10B981" : T.textSec, fontWeight: 600 }}>
                    {"☑ " + task.subtasks.filter(function(s) { return s.done; }).length + "/" + task.subtasks.length}
                  </span>
                )}
              </div>

              {/* Quick actions */}
              {!task.done && (
                <div style={{ display: "flex", gap: 8, marginTop: 6 }}>
                  {isBacklog && <QuickBtn onClick={function() { props.onMoveWeek(task.id, CW); }} color={T.accent}>→ 本周</QuickBtn>}
                  {isThisWeek && <QuickBtn onClick={function() { props.onMoveWeek(task.id, nw); }} color={T.textSec}>推到下周 →</QuickBtn>}
                </div>
              )}

              <DLWarn task={task} T={T} onExpand={function() { setIsExp(true); }} />
            </>
          )}
        </div>

        {/* Action buttons */}
        <div style={{ display: "flex", gap: 2, flexShrink: 0 }}>
          <MiniBtn onClick={function() { setIsExp(!isExp); }} color={T.textMuted}>
            {hasSubs ? (isExp ? "▾" : "▸" + task.subtasks.length) : (isExp ? "▾" : "▸")}
          </MiniBtn>
          <MiniBtn onClick={handleToggleEdit} color={T.textMuted}>{isEdit ? "收起" : "编辑"}</MiniBtn>
          {confirmDel
            ? <>
                <MiniBtn onClick={function() { props.onRemove(task.id); }} color="#EF4444">确认</MiniBtn>
                <MiniBtn onClick={function() { setConfirmDel(false); }} color={T.textMuted}>取消</MiniBtn>
              </>
            : <MiniBtn onClick={function() { setConfirmDel(true); }} color="#EF4444">删除</MiniBtn>
          }
        </div>
      </div>

      {/* Edit panel */}
      {isEdit && (
        <div style={{ marginTop: 10, paddingTop: 10, borderTop: "1px solid " + T.cardBorder }}>
          <div style={{ marginBottom: 10 }}>
            <div style={{ fontSize: 11, color: T.textSec, marginBottom: 4 }}>任务标题</div>
            <input type="text" value={eText} onChange={function(e) { setEText(e.target.value); }} style={{ width: "100%", padding: "8px 10px", background: T.inputBg, border: "1px solid " + T.inputBorder, borderRadius: 6, color: T.text, fontSize: 13, fontFamily: FONT, outline: "none", boxSizing: "border-box", marginBottom: 8 }} />
            <div style={{ fontSize: 11, color: T.textSec, marginBottom: 4 }}>备注细节（可选）</div>
            <textarea value={eDetail} onChange={function(e) { setEDetail(e.target.value); }} placeholder="时间、地点、规格等补充信息" rows={2} style={{ width: "100%", padding: "6px 10px", background: T.inputBg, border: "1px solid " + T.inputBorder, borderRadius: 6, color: T.text, fontSize: 12, fontFamily: FONT, outline: "none", resize: "vertical", lineHeight: 1.4, boxSizing: "border-box" }} />
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          <SelectBox value={eCat} onChange={setECat} T={T}>
            <option value="">未分类</option>
            {(props.categories || []).map(function(c) { return <option key={c.id} value={c.id}>{(c.emoji || "📌") + " " + (c.label || c.id)}</option>; })}
          </SelectBox>
          <SelectBox value={ePri} onChange={setEPri} T={T}>
            {PRIORITIES.map(function(p) { return <option key={p.id} value={p.id}>{p.label}</option>; })}
          </SelectBox>
          <SelectBox value={eType} onChange={setEType} T={T}>
            <option value="week">周任务</option>
            <option value="deadline">截止日</option>
          </SelectBox>
          {eType === "week" && (
            <SelectBox value={eWk} onChange={setEWk} T={T}>
              <option value="">待安排</option>
              {props.weekOpts.map(function(w) { return <option key={w.key} value={w.key}>{w.label}</option>; })}
            </SelectBox>
          )}
          {eType === "deadline" && (
            <input type="date" value={eDL} onChange={function(e) { setEDL(e.target.value); }} style={{
              padding: "5px 10px", background: T.inputBg, border: "1px solid " + T.inputBorder,
              borderRadius: 6, color: T.text, fontSize: 12, fontFamily: FONT, outline: "none",
            }} />
          )}
          <button onClick={handleSave} style={{
            fontSize: 12, fontWeight: 600, color: "#fff", background: T.accent,
            border: "none", borderRadius: 6, padding: "5px 14px", cursor: "pointer", fontFamily: FONT,
          }}>保存</button>
          </div>
        </div>
      )}

      {/* Subtasks */}
      {isExp && (
        <div style={{ marginTop: 10, paddingTop: 10, borderTop: "1px solid " + T.cardBorder }}>
          {(task.subtasks || []).map(function(sub) {
            return (
              <div key={sub.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "4px 0", marginLeft: 30 }}>
                <button onClick={function() { props.onToggleSub(task.id, sub.id); }} style={{
                  width: 16, height: 16, borderRadius: 4, flexShrink: 0, cursor: "pointer", padding: 0,
                  border: sub.done ? "none" : "1.5px solid " + T.inputBorder,
                  background: sub.done ? "#10B981" : "transparent",
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}>
                  {sub.done && <svg width="9" height="9" viewBox="0 0 12 12" fill="none"><path d="M2 6L5 9L10 3" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" /></svg>}
                </button>
                <span style={{ flex: 1, fontSize: 13, color: sub.done ? T.textMuted : T.textSec, textDecoration: sub.done ? "line-through" : "none" }}>{sub.text}</span>
                <MiniBtn onClick={function() { props.onRemoveSub(task.id, sub.id); }} color={T.textMuted}>×</MiniBtn>
              </div>
            );
          })}
          <div style={{ display: "flex", gap: 6, marginLeft: 30, marginTop: 6 }}>
            <input value={localSub} onChange={function(e) { setLocalSub(e.target.value); }}
              onKeyDown={function(e) { if (e.key === "Enter" && !e.nativeEvent.isComposing) handleAddSub(); }}
              placeholder="添加子任务..."
              style={{ flex: 1, padding: "5px 10px", background: T.inputBg, border: "1px solid " + T.inputBorder, borderRadius: 6, fontSize: 12, color: T.text, outline: "none", fontFamily: FONT }} />
            <button onClick={handleAddSub} style={{ fontSize: 11, fontWeight: 600, color: T.accent, background: "none", border: "none", cursor: "pointer", fontFamily: FONT }}>
              + 添加
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════ MAIN APP ═══════════════════════════ */

function useWindowWidth() {
  var [width, setWidth] = useState(
    typeof window !== "undefined" ? window.innerWidth : 1024
  );
  useEffect(function () {
    function onResize() { setWidth(window.innerWidth); }
    window.addEventListener("resize", onResize);
    return function () { window.removeEventListener("resize", onResize); };
  }, []);
  return width;
}

export default function TaskBrain() {
  var [tasks, setTasks] = useState([]);
  var [view, setView] = useState("week");
  var [input, setInput] = useState("");
  var [classifying, setClassifying] = useState(false);
  var [classifyingId, setClassifyingId] = useState(null);
  var [ai, setAi] = useState(null);
  var [dark, setDark] = useState(false);
  var [addDL, setAddDL] = useState("");
  var [showProf, setShowProf] = useState(false);
  var [profile, setProfile] = useState(DEF_PROFILE);
  var [status, setStatus] = useState(DEF_STATUS);
  var [toast, setToast] = useState(null);
  var [aiInput, setAiInput] = useState("");
  var [loaded, setLoaded] = useState(false);
  var [showDone, setShowDone] = useState(false);
  var [showExport, setShowExport] = useState(false);
  var [user, setUser] = useState(null);
  var [authReady, setAuthReady] = useState(false);
  var [authEmail, setAuthEmail] = useState("");
  var [authPassword, setAuthPassword] = useState("");
  var [authError, setAuthError] = useState("");
  var [authLoading, setAuthLoading] = useState(false);
  var [catNewLabel, setCatNewLabel] = useState("");
  var [catNewEmoji, setCatNewEmoji] = useState("");
  var [catEditingId, setCatEditingId] = useState(null);
  var [catEditLabel, setCatEditLabel] = useState("");
  var [catEditEmoji, setCatEditEmoji] = useState("");
  var [notes, setNotes] = useState([]);
  var [noteExpandedId, setNoteExpandedId] = useState(null);
  var [noteEditingId, setNoteEditingId] = useState(null);
  var [noteEditContent, setNoteEditContent] = useState("");
  var [noteEditTags, setNoteEditTags] = useState("");
  var [noteEditTagInput, setNoteEditTagInput] = useState("");
  var [noteNewContent, setNoteNewContent] = useState("");
  var [noteNewTags, setNoteNewTags] = useState("");
  var [noteNewTagInput, setNoteNewTagInput] = useState("");
  var [noteNewExpanded, setNoteNewExpanded] = useState(false);
  var [noteConvertingId, setNoteConvertingId] = useState(null);
  var [noteSearch, setNoteSearch] = useState("");
  var [noteTimeFilter, setNoteTimeFilter] = useState("all");
  var [noteTagFilter, setNoteTagFilter] = useState("");
  var [convertPreview, setConvertPreview] = useState(null);
  var [dataSource, setDataSource] = useState(null);
  var inputRef = useRef(null);
  var saveTimeoutRef = useRef(null);
  var saveFlushRef = useRef(null);
  var profileOrStatusFocusedRef = useRef(false);
  var userIdRef = useRef(null);
  var syncedPayloadRef = useRef("");
  var currentPayloadRef = useRef("");
  var lastCloudUpdatedAtRef = useRef("");
  var saveSeqRef = useRef(0);
  var flushOnNextSaveRef = useRef(false);
  var ownUpdatedAtRef = useRef("");
  var recentlyDeletedRef = useRef(new Set());
  var applySnapshotRef = useRef(null);
  var supabase = getSupabase();

  var CW = getCW();
  var T = dark ? DARK : LIGHT;
  var categories = profile.categories || [];
  var CC = useMemo(function() {
    var o = {};
    categories.forEach(function(c) { o[c.id] = getCatColors(categories, c.id, dark); });
    return o;
  }, [categories, dark]);
  var weekOpts = useMemo(function() { return getWeekOpts(CW); }, [CW]);
  var nw = nextWeekKey(CW);
  var windowWidth = useWindowWidth();
  var isDesktop = windowWidth >= 1024;

  var applySnapshotToState = useCallback(function(data, options) {
    if (!data) return false;
    var snapshot = normalizeSnapshot(data);
    // Filter out recently deleted tasks to prevent Realtime echo from restoring them
    if (recentlyDeletedRef.current.size > 0) {
      snapshot = Object.assign({}, snapshot, {
        tasks: snapshot.tasks.filter(function(t) { return !recentlyDeletedRef.current.has(t.id); })
      });
    }
    var shouldApplyProfile = !profileOrStatusFocusedRef.current || !!(options && options.forceProfile);
    var nextProfile = shouldApplyProfile ? snapshot.profile : normalizeProfileShape(profile);
    var nextStatus = shouldApplyProfile ? snapshot.status : status;
    var nextPayload = {
      tasks: snapshot.tasks,
      profile: nextProfile,
      status: nextStatus,
      dark: snapshot.dark,
      notes: snapshot.notes,
    };
    var serialized = serializePayload(nextPayload);

    if (!(options && options.force)) {
      if (serialized && serialized === currentPayloadRef.current) {
        syncedPayloadRef.current = serialized;
        if (snapshot.updatedAt) lastCloudUpdatedAtRef.current = snapshot.updatedAt;
        return false;
      }
      if (syncedPayloadRef.current && currentPayloadRef.current && syncedPayloadRef.current !== currentPayloadRef.current) {
        return false;
      }
    }

    syncedPayloadRef.current = serialized;
    currentPayloadRef.current = serialized;
    if (snapshot.updatedAt) lastCloudUpdatedAtRef.current = snapshot.updatedAt;

    setTasks(snapshot.tasks);
    if (shouldApplyProfile) {
      setProfile(nextProfile);
      setStatus(nextStatus);
    }
    setDark(snapshot.dark);
    setNotes(snapshot.notes);
    if (options && options.source) setDataSource(options.source);
    return true;
  }, [profile, status]);
  applySnapshotRef.current = applySnapshotToState;

  var persistCloudPayload = useCallback(async function(payload, serialized) {
    if (!supabase || !user?.id || !serialized || serialized === syncedPayloadRef.current) return;
    saveSeqRef.current += 1;
    var seq = saveSeqRef.current;
    var updatedAt = new Date().toISOString();
    if (updatedAt > ownUpdatedAtRef.current) ownUpdatedAtRef.current = updatedAt;
    var result = await saveToSupabase(supabase, user.id, payload, updatedAt);
    if (seq !== saveSeqRef.current) return;
    if (result && result.error) {
      console.error("[TaskBrain] Cloud save failed:", result.error);
      return;
    }
    if (serialized === currentPayloadRef.current) {
      syncedPayloadRef.current = serialized;
      setDataSource("cloud");
    }
    if (result && result.updatedAt) {
      lastCloudUpdatedAtRef.current = result.updatedAt;
      saveLocal(Object.assign({}, snapshotToPayload(payload), { updatedAt: result.updatedAt }));
    }
  }, [supabase, user?.id]);

  function showToast(message) {
    setToast({ id: Date.now().toString() + "_" + Math.random().toString(16).slice(2), message: message });
  }

  /* ── Auth 状态：仅当 user id 变化时 setUser，避免 onAuthStateChange 频繁触发导致重渲染风暴 ── */
  useEffect(function() {
    if (!supabase) {
      setAuthReady(true);
      return;
    }
    supabase.auth.getSession().then(function(_r) {
      var u = _r.data?.session?.user ?? null;
      var id = u?.id ?? null;
      if (id !== userIdRef.current) {
        userIdRef.current = id;
        setUser(u);
      }
      setAuthReady(true);
    });
    var sub = supabase.auth.onAuthStateChange(function(_e, s) {
      var u = s?.user ?? null;
      var id = u?.id ?? null;
      if (id !== userIdRef.current) {
        userIdRef.current = id;
        setUser(u);
      }
    });
    return function() { sub.data.subscription.unsubscribe(); };
  }, [supabase]);

  /* ── 初始加载：有账号则从 Supabase 拉取，否则从本地；用 cancelled 避免竞态时用旧结果覆盖 ── */
  useEffect(function() {
    if (!authReady) return;
    var cancelled = false;
    (async function() {
      var local = loadLocal();
      var localSnapshot = normalizeSnapshot(local);
      var localHasData = hasSnapshotContent(localSnapshot);
      var uid = user?.id ?? null;
      if (supabase && uid) {
        var remote = await loadFromSupabase(supabase, uid);
        if (cancelled) return;
        if (remote) {
          var remoteMs = toTimeMs(remote.updatedAt);
          var localMs = toTimeMs(localSnapshot.updatedAt);
          if (localHasData && localMs && (!remoteMs || localMs > remoteMs + 1000)) {
            applySnapshotRef.current(localSnapshot, { source: "local", force: true, forceProfile: true });
            var resync = await saveToSupabase(supabase, uid, localSnapshot);
            if (resync && !resync.error) {
              syncedPayloadRef.current = serializePayload(localSnapshot);
              currentPayloadRef.current = syncedPayloadRef.current;
              if (resync.updatedAt) lastCloudUpdatedAtRef.current = resync.updatedAt;
            }
          } else {
          applySnapshotRef.current(remote, { source: "cloud", force: true, forceProfile: true });
          }
        } else if (localHasData) {
          applySnapshotRef.current(localSnapshot, { source: "local", force: true, forceProfile: true });
          var upload = await saveToSupabase(supabase, uid, localSnapshot);
          if (upload && !upload.error) {
            syncedPayloadRef.current = serializePayload(localSnapshot);
            currentPayloadRef.current = syncedPayloadRef.current;
            if (upload.updatedAt) lastCloudUpdatedAtRef.current = upload.updatedAt;
          }
        } else {
          applySnapshotRef.current(localSnapshot, { source: "local", force: true, forceProfile: true });
        }
      } else {
        if (cancelled) return;
        if (localHasData) {
          applySnapshotRef.current(localSnapshot, { source: "local", force: true, forceProfile: true });
        } else {
          applySnapshotRef.current(normalizeSnapshot(null), { source: "local", force: true, forceProfile: true });
        }
      }
      if (!cancelled) setLoaded(true);
    })();
    return function() { cancelled = true; };
  }, [authReady, supabase, user?.id]);

  /* ── 保存：始终写本地；已登录则防抖写 Supabase；blur 时通过 saveFlushRef 立即写入 ── */
  useEffect(function() {
    if (!loaded) return;
    var payload = snapshotToPayload({ tasks: tasks, profile: profile, status: status, dark: dark, notes: notes });
    var serialized = serializePayload(payload);
    var localUpdatedAt = serialized === syncedPayloadRef.current && lastCloudUpdatedAtRef.current
      ? lastCloudUpdatedAtRef.current
      : new Date().toISOString();
    currentPayloadRef.current = serialized;
    saveLocal(Object.assign({}, payload, { updatedAt: localUpdatedAt }));
    saveFlushRef.current = function() {
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
      saveTimeoutRef.current = null;
      if (supabase && user && serialized !== syncedPayloadRef.current) persistCloudPayload(payload, serialized);
    };
    if (supabase && user && serialized !== syncedPayloadRef.current) {
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
      if (flushOnNextSaveRef.current) {
        flushOnNextSaveRef.current = false;
        persistCloudPayload(payload, serialized);
      } else {
        saveTimeoutRef.current = setTimeout(function() {
          persistCloudPayload(payload, serialized);
          saveTimeoutRef.current = null;
        }, 800);
      }
    }
    return function() {
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    };
  }, [tasks, profile, status, dark, notes, loaded, supabase, user?.id, persistCloudPayload]);

  /* ── Realtime：订阅当前用户的 user_data 变更，A 端修改后 B 端自动更新 ── */
  useEffect(function() {
    if (!supabase || !user?.id || !loaded) return;
    var uid = user.id;
    function onRealtimePayload(payload) {
      if (payload && payload.new) {
        var ua = payload.new.updated_at || "";
        if (ua && ownUpdatedAtRef.current && ua <= ownUpdatedAtRef.current) {
          // Own echo or stale event from before our latest save — suppress
          syncedPayloadRef.current = currentPayloadRef.current;
          return;
        }
        // Content-based echo suppression: compare serialized payload to avoid loops
        // when server-side triggers modify updated_at
        var incomingSerialized = serializePayload(snapshotToPayload(normalizeSnapshot(payload.new)));
        if (incomingSerialized && incomingSerialized === currentPayloadRef.current) {
          syncedPayloadRef.current = currentPayloadRef.current;
          if (ua) ownUpdatedAtRef.current = ua;
          return;
        }
        applySnapshotRef.current(payload.new, { source: "cloud" });
        if (typeof console !== "undefined" && console.debug) console.debug("[TaskBrain] 已从其他端同步", payload.event);
      }
    }
    var channel = supabase
      .channel("user_data:" + uid)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "user_data", filter: "id=eq." + uid }, onRealtimePayload)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "user_data", filter: "id=eq." + uid }, onRealtimePayload)
      .subscribe(function(status) {
        if (status === "SUBSCRIBED" && typeof console !== "undefined" && console.debug) console.debug("[TaskBrain] Realtime 已连接");
        if (status === "CHANNEL_ERROR") console.warn("[TaskBrain] Realtime 未连接：请在 Supabase Dashboard → Database → Replication 中勾选 user_data，或在 SQL Editor 执行 migrations/003_realtime_user_data.sql");
      });
    return function() { supabase.removeChannel(channel); };
  }, [supabase, user?.id, loaded]);

  /* ── 切回标签页时拉取一次：Realtime 未触发时，回到本页可拿到最新数据 ── */
  useEffect(function() {
    if (!supabase || !user?.id || !loaded) return;
    var uid = user.id;
    function onVisible() {
      if (document.visibilityState !== "visible") return;
      loadFromSupabase(supabase, uid).then(function(remote) { applySnapshotRef.current(remote, { source: "cloud" }); });
    }
    document.addEventListener("visibilitychange", onVisible);
    return function() { document.removeEventListener("visibilitychange", onVisible); };
  }, [supabase, user?.id, loaded]);

  var refreshFromCloud = useCallback(function() {
    if (!supabase || !user?.id) return;
    loadFromSupabase(supabase, user.id).then(function(remote) {
      if (!remote) { showToast("拉取失败，请稍后重试"); return; }
      applySnapshotRef.current(remote, { source: "cloud", force: true, forceProfile: true });
      showToast("已从云端拉取最新");
    });
  }, [supabase, user?.id]);

  /* ── Task CRUD ── */
  var addTask = async function(text) {
    var id = Date.now().toString();
    var hasDL = addDL !== "";
    var today = new Date().toISOString().split("T")[0];
    var cwMon = getWeekRange(CW).mon;
    var cwMonStr = cwMon.getFullYear() + "-" + String(cwMon.getMonth() + 1).padStart(2, "0") + "-" + String(cwMon.getDate()).padStart(2, "0");
    var explicitCategory = extractExplicitCategory(text, categories);
    var explicitCatObj = explicitCategory && explicitCategory.mode === "existing" ? explicitCategory.category : null;
    if (explicitCategory && explicitCategory.mode === "new") {
      var explicitCreated = ensureCategoryOnProfile(profile, explicitCategory.label, "📌");
      if (explicitCreated.created) setProfile(explicitCreated.profile);
      explicitCatObj = explicitCreated.category;
    }
    var defaultCat = explicitCatObj ? explicitCatObj.id : (categories.length > 0 ? categories[0].id : "");

    var newTask = { id: id, text: text, detail: "", category: defaultCat, priority: "medium", type: hasDL ? "deadline" : "week", week: null, deadline: hasDL ? addDL : null, done: false, subtasks: [] };
    flushOnNextSaveRef.current = true;
    setTasks(function(p) { return [newTask].concat(p); });
    setInput(""); setAddDL(""); setClassifying(true); setClassifyingId(id);
    showToast("已添加任务，正在整理：" + text);

    var explicitHint = explicitCategory
      ? "\n用户已明确指定分类：" + (explicitCatObj ? ((explicitCatObj.label || explicitCatObj.id) + "（必须优先使用该分类）") : (explicitCategory.label + "（若不存在请创建该分类）"))
      : "";
    var userMsg = "任务描述：「" + text + "」\n今日日期：" + today + "，本周周一：" + cwMonStr + (hasDL ? "；用户已选截止日：" + addDL : "") + explicitHint + "\n请提炼并分配。";
    var r = await callAI(buildClsSys(profile), [{ role: "user", content: userMsg }]);
    var parsed = parseTaskAIResponse(r);
    var baseNow = new Date();
    var refined = (parsed && parsed.refinedText && String(parsed.refinedText).trim()) || text;
    var rawDeadline = parsed ? parsed.deadline : null;
    var aiWantsDeadline = parsed && (parsed.type === "deadline" || !!(rawDeadline && String(rawDeadline).trim()));
    var localDeadline = normalizeDateCandidate(text, baseNow);
    var dl = hasDL ? addDL : (normalizeDateCandidate(rawDeadline, baseNow) || ((aiWantsDeadline || hasDeadlineCue(text)) ? localDeadline : null));
    var wk = normalizeWeekCandidate(parsed ? parsed.week : null, text, CW) || null;
    var typ = hasDL || dl ? "deadline" : "week";
    if (typ === "deadline") wk = null;
    if (typ === "week" && !wk) wk = null;

    var resolvedCat = explicitCatObj;
    if (!resolvedCat && parsed && parsed.newCategory && String(parsed.newCategory).trim()) {
      var aiCreated = ensureCategoryOnProfile(profile, String(parsed.newCategory).trim(), parsed.newEmoji);
      if (aiCreated.created) setProfile(aiCreated.profile);
      resolvedCat = aiCreated.category;
    } else if (!resolvedCat && parsed && parsed.category) {
      resolvedCat = (profile.categories || []).find(function(c) { return c.id === parsed.category; }) || findCategoryByLabel(profile.categories || [], parsed.category);
    }
    var resolvedCatId = resolvedCat ? resolvedCat.id : defaultCat;
    var cat = resolvedCat || (profile.categories || []).find(function(c) { return c.id === resolvedCatId; }) || (resolvedCatId ? { id: resolvedCatId, label: resolvedCatId, emoji: "📌" } : null);
    var priorityId = (parsed && parsed.priority) || inferPriorityFromText(text) || newTask.priority;
    var pri = PRIORITIES.find(function(x) { return x.id === priorityId; });
    var detailStr = (parsed && parsed.detail && String(parsed.detail).trim()) || "";
    var finalTask = {
      id: id,
      text: refined,
      detail: detailStr,
      category: resolvedCatId,
      priority: (pri && pri.id) || newTask.priority,
      type: typ,
      deadline: typ === "deadline" ? dl : null,
      week: typ === "week" ? wk : null,
      done: false,
      subtasks: [],
    };
    flushOnNextSaveRef.current = true;
    setTasks(function(prev) {
      return prev.map(function(t) {
        return t.id === id ? finalTask : t;
      });
    });
    var msg = (refined !== text ? "已提炼为：「" + refined + "」" + (detailStr ? "（含备注）" : "") + " · " : "")
      + (cat ? (cat.emoji || "📌") + " " + (cat.label || resolvedCatId) : "")
      + (pri ? " · " + pri.label : "")
      + " · 已放到" + getTaskPlacementLabel(finalTask, CW)
      + (parsed && parsed.reason ? " — " + parsed.reason : "")
      + (!parsed && r ? " · AI结果解析失败，已按本地规则整理" : !r ? " · AI暂不可用，已按本地规则整理" : "");
    showToast(msg);
    setClassifying(false); setClassifyingId(null);
  };

  function toggle(id) { flushOnNextSaveRef.current = true; setTasks(function(p) { return p.map(function(t) { return t.id === id ? Object.assign({}, t, { done: !t.done, doneAt: !t.done ? Date.now() : null }) : t; }); }); }
  function remove(id) {
    recentlyDeletedRef.current.add(id);
    setTimeout(function() { recentlyDeletedRef.current.delete(id); }, 10000);
    flushOnNextSaveRef.current = true;
    setTasks(function(p) { return p.filter(function(t) { return t.id !== id; }); });
    showToast("已删除任务");
  }
  function update(id, u) { flushOnNextSaveRef.current = true; setTasks(function(p) { return p.map(function(t) { return t.id === id ? Object.assign({}, t, u) : t; }); }); }
  function moveToWeek(id, wk) { flushOnNextSaveRef.current = true; setTasks(function(p) { return p.map(function(t) { return t.id === id ? Object.assign({}, t, { week: wk }) : t; }); }); }
  function addSub(tid, text) { flushOnNextSaveRef.current = true; setTasks(function(p) { return p.map(function(t) { return t.id === tid ? Object.assign({}, t, { subtasks: (t.subtasks || []).concat([{ id: tid + "_" + Date.now(), text: text, done: false }]) }) : t; }); }); }
  function toggleSub(tid, sid) { flushOnNextSaveRef.current = true; setTasks(function(p) { return p.map(function(t) { return t.id === tid ? Object.assign({}, t, { subtasks: (t.subtasks || []).map(function(s) { return s.id === sid ? Object.assign({}, s, { done: !s.done }) : s; }) }) : t; }); }); }
  function removeSub(tid, sid) { flushOnNextSaveRef.current = true; setTasks(function(p) { return p.map(function(t) { return t.id === tid ? Object.assign({}, t, { subtasks: (t.subtasks || []).filter(function(s) { return s.id !== sid; }) }) : t; }); }); }
  function addNote(content) {
    var c = String(content || "").trim();
    if (!c) return;
    var now = Date.now();
    var tags = (noteNewTags || "").split(/[,，\s]+/).map(function(t) { return t.trim(); }).filter(Boolean);
    flushOnNextSaveRef.current = true;
    setNotes(function(p) { return [{ id: now.toString(), content: c, createdAt: now, updatedAt: now, tags: tags, pinned: false }].concat(p); });
    setNoteNewContent(""); setNoteNewTags(""); setNoteNewTagInput(""); setNoteNewExpanded(false);
  }
  function updateNote(id, content, tags) {
    var c = String(content || "").trim();
    var tagArr = Array.isArray(tags) ? tags : (String(tags || "").split(/[,，\s]+/).map(function(t) { return t.trim(); }).filter(Boolean));
    flushOnNextSaveRef.current = true;
    setNotes(function(p) { return p.map(function(n) { return n.id === id ? Object.assign({}, n, { content: c, tags: tagArr, updatedAt: Date.now() }) : n; }); });
    setNoteEditingId(null); setNoteEditContent(""); setNoteEditTags(""); setNoteEditTagInput("");
  }
  function toggleNotePinned(id) {
    flushOnNextSaveRef.current = true;
    setNotes(function(p) { return p.map(function(n) { return n.id === id ? Object.assign({}, n, { pinned: !n.pinned }) : n; }); });
  }
  function removeNote(id) {
    if (!window.confirm("确定删除这条随笔？")) return;
    flushOnNextSaveRef.current = true;
    setNotes(function(p) { return p.filter(function(n) { return n.id !== id; }); });
    if (noteEditingId === id) { setNoteEditingId(null); setNoteEditContent(""); }
  }

  function resolveParsedTaskToPreview(parsed, sourceText, explicitCatObj) {
    var baseNow = new Date();
    var refined = (parsed && parsed.refinedText && String(parsed.refinedText).trim()) || sourceText.slice(0, 200);
    var aiWantsDeadline = parsed && (parsed.type === "deadline" || !!(parsed.deadline && String(parsed.deadline).trim()));
    var dl = (parsed ? normalizeDateCandidate(parsed.deadline, baseNow) : null) || ((aiWantsDeadline || hasDeadlineCue(sourceText)) ? normalizeDateCandidate(sourceText, baseNow) : null);
    var wk = normalizeWeekCandidate(parsed ? parsed.week : null, sourceText, CW) || null;
    var typ = dl ? "deadline" : "week";
    if (typ === "deadline") wk = null;
    if (typ === "week" && !wk) wk = null;
    var defaultCat = explicitCatObj ? explicitCatObj.id : (categories.length > 0 ? categories[0].id : "");
    var resolvedCat = explicitCatObj;
    if (!resolvedCat && parsed && parsed.newCategory && String(parsed.newCategory).trim()) {
      var aiCreated = ensureCategoryOnProfile(profile, String(parsed.newCategory).trim(), parsed.newEmoji);
      if (aiCreated.created) setProfile(aiCreated.profile);
      resolvedCat = aiCreated.category;
    } else if (!resolvedCat && parsed && parsed.category) {
      resolvedCat = (profile.categories || []).find(function(c) { return c.id === parsed.category; }) || findCategoryByLabel(profile.categories || [], parsed.category);
    }
    var resolvedCatId = resolvedCat ? resolvedCat.id : defaultCat;
    var priorityId = (parsed && parsed.priority) || inferPriorityFromText(sourceText) || "medium";
    var pri = PRIORITIES.find(function(x) { return x.id === priorityId; });
    var detailStr = (parsed && parsed.detail && String(parsed.detail).trim()) || "";
    return { text: refined, detail: detailStr, category: resolvedCatId, priority: (pri && pri.id) || "medium", type: typ, week: typ === "week" ? wk : null, deadline: typ === "deadline" ? dl : null };
  }

  var convertNoteToTask = async function(n) {
    if (!n || !n.content || noteConvertingId) return;
    setNoteConvertingId(n.id);
    var today = new Date().toISOString().split("T")[0];
    var cwMon = getWeekRange(CW).mon;
    var cwMonStr = cwMon.getFullYear() + "-" + String(cwMon.getMonth() + 1).padStart(2, "0") + "-" + String(cwMon.getDate()).padStart(2, "0");
    var explicitCategory = extractExplicitCategory(n.content || "", categories);
    var explicitCatObj = explicitCategory && explicitCategory.mode === "existing" ? explicitCategory.category : null;
    if (explicitCategory && explicitCategory.mode === "new") {
      var explicitCreated = ensureCategoryOnProfile(profile, explicitCategory.label, "📌");
      if (explicitCreated.created) setProfile(explicitCreated.profile);
      explicitCatObj = explicitCreated.category;
    }
    var explicitHint = explicitCategory
      ? "\n用户已明确指定分类：" + (explicitCatObj ? ((explicitCatObj.label || explicitCatObj.id) + "（必须优先使用该分类）") : (explicitCategory.label + "（若不存在请创建该分类）"))
      : "";
    var userMsg = "把下面这段随笔整理成任务（可能多条），今日日期：" + today + "，本周周一：" + cwMonStr + explicitHint + "\n\n" + (n.content || "").trim();
    var r = await callAI(buildNoteToTasksSys(profile), [{ role: "user", content: userMsg }], 2000);
    var arr = parseTaskArrayResponse(r);
    var sourceText = (n.content || "").trim();
    var defaultCat = explicitCatObj ? explicitCatObj.id : (categories.length > 0 ? categories[0].id : "");
    var tasks = [];
    if (Array.isArray(arr) && arr.length > 0) {
      tasks = arr.map(function(p) { return resolveParsedTaskToPreview(p, sourceText, explicitCatObj); });
    } else {
      tasks = [resolveParsedTaskToPreview(null, sourceText, explicitCatObj)];
    }
    setConvertPreview({ tasks: tasks, sourceNote: n, parsed: !!arr?.length, aiAvailable: !!r, markProcessed: false });
    setNoteConvertingId(null);
  };

  function updateConvertPreviewTask(idx, updates) {
    if (!convertPreview) return;
    setConvertPreview(function(p) {
      var next = p.tasks.slice();
      next[idx] = Object.assign({}, next[idx], updates);
      return Object.assign({}, p, { tasks: next });
    });
  }
  function removeConvertPreviewTask(idx) {
    if (!convertPreview) return;
    setConvertPreview(function(p) {
      var next = p.tasks.filter(function(_, i) { return i !== idx; });
      return next.length ? Object.assign({}, p, { tasks: next }) : null;
    });
  }
  function addConvertPreviewTask() {
    if (!convertPreview) return;
    var defaultCat = categories.length > 0 ? categories[0].id : "";
    setConvertPreview(function(p) {
      return Object.assign({}, p, { tasks: p.tasks.concat([{ text: "", detail: "", category: defaultCat, priority: "medium", type: "week", week: null, deadline: null }]) });
    });
  }

  function confirmConvertTask() {
    if (!convertPreview || !convertPreview.tasks.length) return;
    var sourceNoteId = convertPreview.sourceNote?.id;
    var validTasks = convertPreview.tasks.filter(function(t) { return (t.text || "").trim(); });
    if (validTasks.length === 0) { showToast("请至少填写一条任务的标题"); return; }
    var newTasks = validTasks.map(function(t) {
      var id = Date.now().toString() + "-" + Math.random().toString(36).slice(2, 6);
      return { id: id, text: (t.text || "").trim(), detail: (t.detail || "").trim() || "", category: t.category || "", priority: t.priority || "medium", type: t.type || "week", week: t.type === "week" ? t.week : null, deadline: t.type === "deadline" ? t.deadline : null, done: false, subtasks: [], sourceNoteId: sourceNoteId };
    });
    flushOnNextSaveRef.current = true;
    setTasks(function(prev) { return newTasks.concat(prev); });
    if (convertPreview.markProcessed && sourceNoteId) {
      setNotes(function(p) { return p.map(function(n) { return n.id === sourceNoteId ? Object.assign({}, n, { convertedAt: Date.now() }) : n; }); });
    }
    showToast("已创建 " + newTasks.length + " 条任务" + (convertPreview.markProcessed ? "，随笔已标记已处理" : ""));
    setConvertPreview(null);
  }

  async function handleLogin() {
    if (!supabase) return;
    setAuthError("");
    if (!authEmail.trim() || !authPassword) {
      setAuthError("请填写邮箱和密码");
      return;
    }
    setAuthLoading(true);
    try {
      var r = await supabase.auth.signInWithPassword({ email: authEmail.trim(), password: authPassword });
      if (r.error) throw r.error;
      showToast("已登录，数据将同步到云端");
      setAuthPassword("");
    } catch (e) {
      setAuthError(e.message || "登录失败");
    }
    setAuthLoading(false);
  }
  async function handleSignup() {
    if (!supabase) return;
    setAuthError("");
    if (!authEmail.trim() || !authPassword) {
      setAuthError("请填写邮箱和密码");
      return;
    }
    if (authPassword.length < 6) {
      setAuthError("密码至少 6 位");
      return;
    }
    setAuthLoading(true);
    try {
      var r = await supabase.auth.signUp({ email: authEmail.trim(), password: authPassword });
      if (r.error) throw r.error;
      showToast("注册成功，请查收邮件确认（若需）");
      setAuthPassword("");
    } catch (e) {
      setAuthError(e.message || "注册失败");
    }
    setAuthLoading(false);
  }
  async function handleLogout() {
    await supabase?.auth.signOut();
    setUser(null);
    showToast("已退出，数据仅存于本机");
  }

  function archiveOld() {
    var cutoff = Date.now() - 14 * 864e5;
    var archived = tasks.filter(function(t) { return t.done && t.doneAt && t.doneAt < cutoff; });
    if (archived.length === 0) { showToast("没有需要归档的任务（完成2周以上才会清理）"); return; }
    flushOnNextSaveRef.current = true;
    setTasks(function(p) { return p.filter(function(t) { return !(t.done && t.doneAt && t.doneAt < cutoff); }); });
    showToast("已归档 " + archived.length + " 个任务");
  }

  function exportJSON() {
    var data = JSON.stringify({ tasks: tasks, profile: profile, status: status, notes: notes, exportedAt: new Date().toISOString() }, null, 2);
    var blob = new Blob([data], { type: "application/json" });
    var url = URL.createObjectURL(blob);
    var a = document.createElement("a");
    a.href = url; a.download = "taskbrain-backup-" + new Date().toISOString().split("T")[0] + ".json";
    document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
    showToast("已导出备份文件"); setShowExport(false);
  }

  /* ── AI ── */
  function buildSummary() {
    var today = new Date().toISOString().split("T")[0];
    var lines = tasks.filter(function(t) { return !t.done; }).map(function(t) {
      var c = categories.find(function(x) { return x.id === t.category; });
      var p = PRIORITIES.find(function(x) { return x.id === t.priority; });
      var time = t.type === "deadline" ? "截止:" + fmtDateWithWeekday(t.deadline) + "(还剩" + daysUntil(t.deadline) + "天)" : (t.week === CW ? "本周" : t.week ? getWeekLabel(t.week, CW) : "待安排");
      var subs = (t.subtasks || []).length > 0 ? " [子任务:" + t.subtasks.filter(function(s) { return s.done; }).length + "/" + t.subtasks.length + "]" : "";
      return "[" + (t.type === "deadline" ? "截止日" : "周") + "][" + (c ? c.label : "") + "][" + (p ? p.label : "") + "][" + time + "] " + t.text + subs;
    });
    var out = "今天=" + today + "，" + getWeekLabel(CW, CW) + "\n\n未完成(" + lines.length + "个):\n" + lines.join("\n");
    var threeDaysAgo = Date.now() - 3 * 864e5;
    var recentNotes = (notes || []).filter(function(n) { return (n.createdAt || 0) >= threeDaysAgo; }).slice(0, 5);
    if (recentNotes.length > 0) {
      out += "\n\n【最近随笔】\n" + recentNotes.map(function(n) { return "- " + fmtNoteTime(n.createdAt) + "：" + (n.content || "").slice(0, 80).replace(/\n/g, " "); }).join("\n");
    }
    return out;
  }

  var diagnose = async function() {
    var userMsg = buildSummary() + "\n\n请给出全局诊断。";
    var msgs = [{ role: "user", content: userMsg }];
    setAi({ title: "AI诊断对话", messages: [], loading: true, suggestions: null });
    var sys = buildDiagSys(profile, status);
    var r = await callAI(sys, msgs);
    var reply = r || "AI暂时不可用。";
    setAi({
      title: "AI诊断对话",
      messages: [{ role: "user", content: "全局诊断" }, { role: "assistant", content: reply }],
      loading: false,
      systemPrompt: sys,
      fullHistory: msgs.concat([{ role: "assistant", content: reply }]),
    });
  };

  var continueChat = async function(text) {
    if (!ai || !text.trim()) return;
    var newMsg = { role: "user", content: text.trim() };
    var dispMsgs = ai.messages.concat([newMsg]);
    var fullH = (ai.fullHistory || []).concat([newMsg]);
    setAi(function(p) { return Object.assign({}, p, { messages: dispMsgs, loading: true, fullHistory: fullH }); });
    setAiInput("");
    var sys = ai.systemPrompt || buildDiagSys(profile, status);
    var r = await callAI(sys, fullH);
    var reply = r || "AI暂时不可用。";
    setAi(function(p) { return Object.assign({}, p, { messages: dispMsgs.concat([{ role: "assistant", content: reply }]), loading: false, fullHistory: fullH.concat([{ role: "assistant", content: reply }]) }); });
  };

  var planWeek = async function() {
    setAi({ title: "本周规划", messages: [], loading: true, suggestions: null });
    var wt = tasks.filter(function(t) { return t.type === "week" && t.week === CW && !t.done; });
    var dl = tasks.filter(function(t) { return t.type === "deadline" && !t.done && dlWeek(t.deadline) === CW; });
    var pool = tasks.filter(function(t) { return t.type === "week" && !t.week && !t.done; });
    if (!pool.length) { setAi({ title: "本周规划", messages: [{ role: "assistant", content: "待安排里没有任务，无需规划。" }], loading: false }); return; }

    var msg = "本周周任务(" + wt.length + "):\n" + (wt.map(function(t) { return t.text; }).join("\n") || "无") + "\n\n本周截止日(" + dl.length + "):\n" + (dl.map(function(t) { return t.text + "(截止" + fmtDateWithWeekday(t.deadline) + ")"; }).join("\n") || "无") + "\n\n待安排:\n" + pool.map(function(t) {
      var c = categories.find(function(x) { return x.id === t.category; });
      var p = PRIORITIES.find(function(x) { return x.id === t.priority; });
      return "id:" + t.id + " [" + (c ? c.label : "") + "][" + (p ? p.label : "") + "] " + t.text;
    }).join("\n");
    var threeDaysAgo = Date.now() - 3 * 864e5;
    var recentNotes = (notes || []).filter(function(n) { return (n.createdAt || 0) >= threeDaysAgo; }).slice(0, 5);
    if (recentNotes.length > 0) {
      msg += "\n\n【最近随笔】\n" + recentNotes.map(function(n) { return "- " + fmtNoteTime(n.createdAt) + "：" + (n.content || "").slice(0, 80).replace(/\n/g, " "); }).join("\n");
    }

    var r = await callAI(SYS_WK, [{ role: "user", content: msg }]);
    if (r) {
      try {
        var arr = JSON.parse(r.replace(/```json|```/g, "").trim());
        var lines = arr.map(function(s) { var t = tasks.find(function(x) { return x.id === s.taskId; }); return t ? "• " + t.text + "\n  → " + s.reason : null; }).filter(Boolean).join("\n\n");
        setAi({ title: "本周规划", messages: [{ role: "assistant", content: lines }], loading: false, suggestions: arr, systemPrompt: SYS_WK, fullHistory: [{ role: "user", content: msg }, { role: "assistant", content: lines }] });
      } catch (e) {
        setAi({ title: "本周规划", messages: [{ role: "assistant", content: r }], loading: false, systemPrompt: SYS_WK, fullHistory: [{ role: "user", content: msg }, { role: "assistant", content: r }] });
      }
    } else {
      setAi({ title: "本周规划", messages: [{ role: "assistant", content: "AI暂时不可用" }], loading: false });
    }
  };

  function applySugg() {
    if (!ai || !ai.suggestions) return;
    setTasks(function(p) { return p.map(function(t) { return !t.done && ai.suggestions.find(function(s) { return s.taskId === t.id; }) ? Object.assign({}, t, { week: CW }) : t; }); });
    setAi(null);
  }

  /* ── Derived ── */
  var active = tasks.filter(function(t) { return !t.done; });
  function isAssignedThisWeek(t) {
    return (t.type === "week" && t.week === CW) || (t.type === "deadline" && dlWeek(t.deadline) === CW);
  }
  var doneThisWeek = tasks.filter(function(t) { return t.done && isAssignedThisWeek(t); });
  var doneList = tasks.filter(function(t) { return t.done && !isAssignedThisWeek(t); });

  function sortP(list) {
    return list.slice().sort(function(a, b) {
      var pa = PRIORITIES.find(function(p) { return p.id === a.priority; });
      var pb = PRIORITIES.find(function(p) { return p.id === b.priority; });
      return (pb ? pb.weight : 0) - (pa ? pa.weight : 0);
    });
  }

  var twW = active.filter(function(t) { return t.type === "week" && t.week === CW; });
  var twDL = active.filter(function(t) { return t.type === "deadline" && dlWeek(t.deadline) === CW; });
  var overdue = active.filter(function(t) { return t.type === "week" && t.week && t.week < CW; });
  var backlog = active.filter(function(t) { return t.type === "week" && !t.week; });
  var undatedDL = active.filter(function(t) { return t.type === "deadline" && !t.deadline; });
  var allDL = active.filter(function(t) { return t.type === "deadline"; }).sort(function(a, b) { return daysUntil(a.deadline) - daysUntil(b.deadline); });

  var taskItemProps = {
    T: T, CC: CC, CW: CW, nw: nw, weekOpts: weekOpts, categories: categories, dark: dark, classifyingId: classifyingId,
    onToggle: toggle, onRemove: remove, onUpdate: update,
    onMoveWeek: moveToWeek, onAddSub: addSub, onToggleSub: toggleSub, onRemoveSub: removeSub,
  };

  var filteredNotes = useMemo(function() {
    var list = notes.slice();
    var search = (noteSearch || "").trim().toLowerCase();
    if (search) {
      list = list.filter(function(n) { return (n.content || "").toLowerCase().includes(search); });
    }
    var tagFilter = (noteTagFilter || "").trim();
    if (tagFilter) {
      list = list.filter(function(n) { return (n.tags || []).some(function(t) { return t.toLowerCase() === tagFilter.toLowerCase(); }); });
    }
    var now = Date.now();
    var dayStart = new Date();
    dayStart.setHours(0, 0, 0, 0);
    var dayStartMs = dayStart.getTime();
    var weekRange = getWeekRange(CW);
    var weekStartMs = weekRange.mon.getTime();
    var weekEndMs = weekRange.sun.getTime() + 864e5;
    var monthStart = new Date(dayStart.getFullYear(), dayStart.getMonth(), 1);
    var monthStartMs = monthStart.getTime();
    if (noteTimeFilter === "today") {
      list = list.filter(function(n) { var ts = n.updatedAt || n.createdAt || 0; return ts >= dayStartMs; });
    } else if (noteTimeFilter === "week") {
      list = list.filter(function(n) { var ts = n.updatedAt || n.createdAt || 0; return ts >= weekStartMs && ts < weekEndMs; });
    } else if (noteTimeFilter === "month") {
      list = list.filter(function(n) { var ts = n.updatedAt || n.createdAt || 0; return ts >= monthStartMs; });
    }
    return list.slice().sort(function(a, b) {
      if (!!a.pinned !== !!b.pinned) return a.pinned ? -1 : 1;
      return (b.updatedAt || b.createdAt || 0) - (a.updatedAt || a.createdAt || 0);
    });
  }, [notes, noteSearch, noteTagFilter, noteTimeFilter, CW]);

  var allNoteTags = useMemo(function() {
    var set = new Set();
    notes.forEach(function(n) { (n.tags || []).forEach(function(t) { if (t) set.add(t); }); });
    return Array.from(set).sort();
  }, [notes]);

  /* ── Loading ── */
  if (!loaded) {
    return (
      <div style={{ minHeight: "100vh", background: T.bg, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: FONT, color: T.textMuted }}>
        加载中...
      </div>
    );
  }

  /* ── Main render ── */
  var weekRange = getWeekRange(CW);

  /* Shared JSX fragments */
  var settingsJSX = showExport ? (
    <div style={{ background: T.card, border: "1px solid " + T.cardBorder, borderRadius: 10, padding: 14, marginBottom: 16 }}>
      {/* 云端同步：仅手机端在设置里展示，PC 端由侧栏单独展示 */}
      {!isDesktop && (
        <div style={{ marginBottom: 16, paddingBottom: 16, borderBottom: "1px solid " + T.cardBorder }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: T.textSec, marginBottom: 8 }}>☁️ 云端同步</div>
          {!supabase ? (
            <div style={{ fontSize: 11, color: T.textMuted }}>
              未配置 Supabase。本地：在 .env 填写 VITE_SUPABASE_URL 和 VITE_SUPABASE_ANON_KEY；Vercel：在项目 Settings → Environment Variables 添加后重新部署。
            </div>
          ) : user ? (
            <div>
              <div style={{ fontSize: 11, color: T.textMuted, marginBottom: 6 }}>已登录：{user.email}</div>
              {dataSource && <div style={{ fontSize: 11, color: dataSource === "cloud" ? "#059669" : T.textMuted, marginBottom: 6 }}>数据来源：{dataSource === "cloud" ? "云端" : "本地（未连上云端或仅用缓存）"}</div>}
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <button type="button" onClick={refreshFromCloud} style={{ padding: "6px 12px", border: "1px solid " + T.accent, borderRadius: 6, fontSize: 12, cursor: "pointer", fontFamily: FONT, background: "transparent", color: T.accent }}>从云端刷新</button>
                <button onClick={handleLogout} style={{ padding: "6px 12px", border: "1px solid " + T.cardBorder, borderRadius: 6, fontSize: 12, cursor: "pointer", fontFamily: FONT, background: "transparent", color: T.textSec }}>退出登录</button>
              </div>
            </div>
          ) : (
            <div>
              <div style={{ fontSize: 11, color: T.textMuted, marginBottom: 8 }}>登录后电脑与手机将同步同一份数据，请用同一账号在两端登录。</div>
              <input type="email" value={authEmail} onChange={function(e) { setAuthEmail(e.target.value); setAuthError(""); }} placeholder="邮箱"
                style={{ width: "100%", padding: "6px 10px", marginBottom: 6, background: T.inputBg, border: "1px solid " + T.inputBorder, borderRadius: 6, color: T.text, fontSize: 12, fontFamily: FONT, outline: "none", boxSizing: "border-box" }} />
              <input type="password" value={authPassword} onChange={function(e) { setAuthPassword(e.target.value); setAuthError(""); }} placeholder="密码（至少 6 位）"
                style={{ width: "100%", padding: "6px 10px", marginBottom: 6, background: T.inputBg, border: "1px solid " + T.inputBorder, borderRadius: 6, color: T.text, fontSize: 12, fontFamily: FONT, outline: "none", boxSizing: "border-box" }} />
              {authError && <div style={{ fontSize: 11, color: "#DC2626", marginBottom: 6 }}>{authError}</div>}
              <div style={{ display: "flex", gap: 8 }}>
                <button onClick={handleLogin} disabled={authLoading} style={{ padding: "6px 12px", border: "none", borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: authLoading ? "default" : "pointer", fontFamily: FONT, background: T.accent, color: "#fff" }}>登录</button>
                <button onClick={handleSignup} disabled={authLoading} style={{ padding: "6px 12px", border: "1px solid " + T.cardBorder, borderRadius: 6, fontSize: 12, cursor: authLoading ? "default" : "pointer", fontFamily: FONT, background: "transparent", color: T.textSec }}>注册</button>
              </div>
            </div>
          )}
        </div>
      )}
      {/* 分类管理：个人分类，默认新用户为空；可在此添加/编辑，或通过添加任务由 AI 智能创建 */}
      <div style={{ marginBottom: 16, paddingBottom: 16, borderBottom: "1px solid " + T.cardBorder }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: T.textSec, marginBottom: 8 }}>🏷 分类管理</div>
        <div style={{ fontSize: 11, color: T.textMuted, marginBottom: 10 }}>新用户默认无分类。在此添加或编辑分类，或在添加任务时由 AI 智能创建。</div>
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", marginBottom: 10 }}>
          <input type="text" value={catNewEmoji} onChange={function(e) { setCatNewEmoji(e.target.value); }} placeholder="表情" maxLength={4}
            style={{ width: 48, padding: "6px 8px", background: T.inputBg, border: "1px solid " + T.inputBorder, borderRadius: 6, color: T.text, fontSize: 12, fontFamily: FONT, outline: "none", boxSizing: "border-box" }} />
          <input type="text" value={catNewLabel} onChange={function(e) { setCatNewLabel(e.target.value); }} placeholder="分类名称"
            style={{ flex: 1, minWidth: 80, padding: "6px 10px", background: T.inputBg, border: "1px solid " + T.inputBorder, borderRadius: 6, color: T.text, fontSize: 12, fontFamily: FONT, outline: "none", boxSizing: "border-box" }} />
          <button type="button" onClick={function() {
            var label = (catNewLabel || "").trim();
            if (!label) return;
            var emoji = (catNewEmoji || "").trim() || "📌";
            var ensured = ensureCategoryOnProfile(profile, label, emoji);
            if (!ensured.created) return;
            setProfile(ensured.profile);
            setCatNewLabel(""); setCatNewEmoji("");
          }} style={{ padding: "6px 14px", border: "none", borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: FONT, background: T.accent, color: "#fff" }}>添加</button>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {(profile.categories || []).map(function(c) {
            if (catEditingId === c.id) {
              return (
                <div key={c.id} style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                  <input type="text" value={catEditEmoji} onChange={function(e) { setCatEditEmoji(e.target.value); }} maxLength={4}
                    style={{ width: 44, padding: "5px 6px", background: T.inputBg, border: "1px solid " + T.inputBorder, borderRadius: 6, color: T.text, fontSize: 12, fontFamily: FONT, outline: "none", boxSizing: "border-box" }} />
                  <input type="text" value={catEditLabel} onChange={function(e) { setCatEditLabel(e.target.value); }}
                    style={{ flex: 1, minWidth: 80, padding: "5px 8px", background: T.inputBg, border: "1px solid " + T.inputBorder, borderRadius: 6, color: T.text, fontSize: 12, fontFamily: FONT, outline: "none", boxSizing: "border-box" }} />
                  <button type="button" onClick={function() {
                    var label = (catEditLabel || "").trim();
                    if (!label) return;
                    var emoji = (catEditEmoji || "").trim() || "📌";
                    setProfile(function(prev) {
                      var list = (prev.categories || []).map(function(x) {
                        if (x.id !== c.id) return x;
                        return Object.assign({}, x, { label: label, emoji: emoji });
                      });
                      return Object.assign({}, prev, { categories: list });
                    });
                    setCatEditingId(null);
                  }} style={{ padding: "5px 10px", border: "none", borderRadius: 6, fontSize: 11, fontWeight: 600, cursor: "pointer", fontFamily: FONT, background: T.accent, color: "#fff" }}>保存</button>
                  <button type="button" onClick={function() { setCatEditingId(null); }} style={{ padding: "5px 10px", border: "1px solid " + T.cardBorder, borderRadius: 6, fontSize: 11, cursor: "pointer", fontFamily: FONT, background: "transparent", color: T.textSec }}>取消</button>
                </div>
              );
            }
            return (
              <div key={c.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "6px 10px", background: T.secBadge, borderRadius: 6 }}>
                <span style={{ fontSize: 12, color: T.text }}>{(c.emoji || "📌") + " " + (c.label || c.id)}</span>
                <div style={{ display: "flex", gap: 6 }}>
                  <button type="button" onClick={function() { setCatEditingId(c.id); setCatEditLabel(c.label || c.id); setCatEditEmoji(c.emoji || "📌"); }} style={{ padding: "4px 8px", border: "none", borderRadius: 4, fontSize: 11, cursor: "pointer", fontFamily: FONT, background: "transparent", color: T.textSec }}>编辑</button>
                  <button type="button" onClick={function() {
                    var remaining = (profile.categories || []).filter(function(x) { return x.id !== c.id; });
                    var fallbackId = remaining[0] ? remaining[0].id : "";
                    setProfile(function(prev) { return Object.assign({}, prev, { categories: (prev.categories || []).filter(function(x) { return x.id !== c.id; }) }); });
                    setTasks(function(prev) { return prev.map(function(t) { return t.category === c.id ? Object.assign({}, t, { category: fallbackId }) : t; }); });
                  }} style={{ padding: "4px 8px", border: "none", borderRadius: 4, fontSize: 11, cursor: "pointer", fontFamily: FONT, background: "transparent", color: "#DC2626" }}>删除</button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
        <button onClick={exportJSON} style={{ padding: "8px 16px", border: "none", borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: FONT, background: T.accent, color: "#fff" }}>📦 导出JSON备份</button>
        <button onClick={archiveOld} style={{ padding: "8px 16px", border: "1px solid " + T.cardBorder, borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: FONT, background: "transparent", color: T.textSec }}>🗑 清理已完成(&gt;2周)</button>
      </div>
      <div>
        <div style={{ fontSize: 12, fontWeight: 600, color: T.textSec, marginBottom: 4 }}>🔑 DeepSeek API Key</div>
        <input
          type="password"
          defaultValue={(() => { try { return localStorage.getItem("taskbrain-api-key") || ""; } catch (e) { return ""; } })()}
          onChange={function(e) { setApiKey(e.target.value); }}
          placeholder={ (import.meta.env.VITE_DEEPSEEK_API_KEY || "").trim() ? "未填写时使用默认 Key（roy@yxdigital.com）" : "在此填入 DeepSeek API Key" }
          style={{ width: "100%", padding: "8px 12px", background: T.inputBg, border: "1px solid " + T.inputBorder, borderRadius: 6, color: T.text, fontSize: 12, fontFamily: FONT, outline: "none", boxSizing: "border-box" }}
        />
        <div style={{ fontSize: 11, color: T.textMuted, marginTop: 4 }}>{(import.meta.env.VITE_DEEPSEEK_API_KEY || "").trim() ? "未填写时使用默认 Key（roy@yxdigital.com）；留空或填入自己的 Key 可覆盖。" : "在 "}<a href="https://platform.deepseek.com/" target="_blank" rel="noopener noreferrer" style={{ color: T.accent }}>DeepSeek 开放平台</a>{(import.meta.env.VITE_DEEPSEEK_API_KEY || "").trim() ? " 可管理 Key。" : " 创建 API Key 后填入即可使用 AI 功能。"}</div>
      </div>
    </div>
  ) : null;

  var profileJSX = showProf ? (
    <div
      style={{ background: T.profBg, border: "1px solid " + T.profBorder, borderRadius: 12, padding: 18, marginBottom: 20 }}
      onFocusOut={function(e) {
        if (!e.currentTarget.contains(e.relatedTarget)) {
          profileOrStatusFocusedRef.current = false;
          saveFlushRef.current?.();
        }
      }}
    >
      {[
        { key: "company", label: "🏢 公司", hint: "公司、团队、业务" },
        { key: "personal", label: "👤 个人", hint: "背景、日常" },
        { key: "family", label: "👶 家庭", hint: "家庭状态" },
        { key: "invest", label: "💰 投资", hint: "持仓、策略" },
      ].map(function(f) {
        return (
          <div key={f.key} style={{ marginBottom: 12 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: T.text, marginBottom: 4 }}>{f.label}</div>
            <textarea
              value={profile[f.key] || ""}
              onChange={function(e) { setProfile(function(p) { var next = Object.assign({}, p); next[f.key] = e.target.value; return next; }); }}
              onFocus={function() { profileOrStatusFocusedRef.current = true; }}
              placeholder={f.hint}
              style={{ width: "100%", minHeight: 52, padding: 10, background: T.inputBg, border: "1px solid " + T.inputBorder, borderRadius: 8, fontSize: 13, color: T.text, fontFamily: FONT, outline: "none", resize: "vertical", lineHeight: 1.5, boxSizing: "border-box" }}
            />
          </div>
        );
      })}
      <div style={{ borderTop: "1px solid " + T.profBorder, paddingTop: 12, marginTop: 4 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: T.text, marginBottom: 4 }}>💭 当前状态</div>
        <textarea
          value={status}
          onChange={function(e) { setStatus(e.target.value); }}
          onFocus={function() { profileOrStatusFocusedRef.current = true; }}
          style={{ width: "100%", minHeight: 56, padding: 10, background: T.inputBg, border: "1px solid " + T.inputBorder, borderRadius: 8, fontSize: 13, color: T.text, fontFamily: FONT, outline: "none", resize: "vertical", lineHeight: 1.5, boxSizing: "border-box" }}
        />
      </div>
      <div style={{ fontSize: 11, color: T.textMuted, marginTop: 8 }}>💡 一键诊断时AI会参考这些信息</div>
    </div>
  ) : null;

  var aiPanelJSX = ai ? (
    <div style={{ background: T.aiPanel, border: "1px solid " + T.aiBorder, borderRadius: 12, padding: 18, marginBottom: 20, boxShadow: T.aiShadow }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: T.accent }}>{"🧠 " + ai.title}</span>
        <MiniBtn onClick={function() { setAi(null); }} color={T.textMuted}>×</MiniBtn>
      </div>
      <div style={{ maxHeight: 320, overflowY: "auto", marginBottom: 10 }}>
        {(ai.messages || []).filter(function(m) { return !(m.role === "user" && m.content === "全局诊断"); }).map(function(m, i) {
          return (
            <div key={i} style={{ marginBottom: 10, padding: "8px 12px", borderRadius: 8, background: m.role === "user" ? T.userBubble : "transparent", fontSize: 14, color: T.text, lineHeight: 1.75, whiteSpace: "pre-wrap" }}>
              {m.role === "user" && <div style={{ fontSize: 11, color: T.textMuted, marginBottom: 2, fontWeight: 600 }}>你</div>}
              {m.content}
            </div>
          );
        })}
        {ai.loading && (
          <div style={{ display: "flex", alignItems: "center", gap: 8, color: T.textSec, fontSize: 13, padding: "8px 0" }}>
            <span style={{ display: "inline-block", width: 14, height: 14, border: "2px solid " + T.cardBorder, borderTopColor: T.accent, borderRadius: "50%", animation: "spin .7s linear infinite" }} />
            AI正在思考...
          </div>
        )}
      </div>
      {(ai.title === "AI诊断对话" || ai.title === "本周规划") && !ai.loading && (
        <div style={{ display: "flex", gap: 8, borderTop: "1px solid " + T.cardBorder, paddingTop: 10 }}>
          <input value={aiInput} onChange={function(e) { setAiInput(e.target.value); }}
            onKeyDown={function(e) { if (e.key === "Enter" && !e.nativeEvent.isComposing && aiInput.trim()) continueChat(aiInput); }}
            placeholder="追问或反驳..."
            style={{ flex: 1, padding: "8px 12px", background: T.inputBg, border: "1px solid " + T.inputBorder, borderRadius: 8, fontSize: 13, color: T.text, outline: "none", fontFamily: FONT }} />
          <button onClick={function() { if (aiInput.trim()) continueChat(aiInput); }}
            style={{ padding: "8px 16px", background: T.accent, color: "#fff", border: "none", borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: FONT }}>发送</button>
        </div>
      )}
      {ai.suggestions && !ai.loading && (
        <button onClick={applySugg} style={{ marginTop: 10, width: "100%", padding: "10px 0", background: T.accent, color: "#fff", border: "none", borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: FONT }}>
          ✅ 应用建议，分配到本周
        </button>
      )}
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  ) : null;

  var taskInputJSX = (
    <div style={{ marginBottom: 24 }}>
      <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
        <input ref={inputRef} value={input} onChange={function(e) { setInput(e.target.value); }}
          onKeyDown={function(e) { if (e.key === "Enter" && !e.nativeEvent.isComposing && input.trim()) addTask(input.trim()); }}
          placeholder="描述任务即可，如：下周三前和PM对齐试点进展、本周五婴儿床下单..."
          style={{ flex: 1, padding: "12px 16px", background: T.inputBg, border: "1px solid " + T.inputBorder, borderRadius: 10, fontSize: 14, color: T.text, outline: "none", fontFamily: FONT, boxShadow: T.shadow }} />
        <button onClick={function() { if (input.trim()) addTask(input.trim()); }} disabled={!input.trim()}
          style={{ padding: "12px 22px", background: input.trim() ? T.accent : T.inputBorder, color: input.trim() ? "#fff" : T.textMuted, border: "none", borderRadius: 10, fontSize: 14, fontWeight: 600, cursor: input.trim() ? "pointer" : "default", fontFamily: FONT, whiteSpace: "nowrap" }}>
          {classifying ? "分析中..." : "添加"}
        </button>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
        <label style={{ fontSize: 12, color: T.textSec, whiteSpace: "nowrap" }}>截止日（可选）</label>
        <input type="date" value={addDL} onChange={function(e) { setAddDL(e.target.value); }}
          style={{ padding: "4px 8px", background: T.inputBg, border: "1px solid " + T.inputBorder, borderRadius: 6, color: T.text, fontSize: 12, fontFamily: FONT, outline: "none" }} />
        {addDL && <MiniBtn onClick={function() { setAddDL(""); }} color={T.textMuted}>清除</MiniBtn>}
        <span style={{ fontSize: 11, color: T.textMuted }}>不选则从描述中自动识别</span>
      </div>
    </div>
  );

  var taskListsJSX = (
    <div>
      {/* ── WEEK VIEW ── */}
      {view === "week" && (
        <div>
          <Section T={T} title="📌 本周聚焦" count={twW.length + twDL.length} accent={T.text}>
            {twDL.map(function(t) { return <TaskItem key={t.id} task={t} {...taskItemProps} />; })}
            {sortP(twW).map(function(t) { return <TaskItem key={t.id} task={t} {...taskItemProps} />; })}
            {(twW.length + twDL.length) === 0 && doneThisWeek.length === 0 && <Empty msg="本周没有任务，试试「本周规划」" />}
            {doneThisWeek.length > 0 && doneThisWeek.map(function(t) { return <TaskItem key={t.id} task={t} {...taskItemProps} />; })}
          </Section>

          {overdue.length > 0 && (
            <Section T={T} title="⚠️ 往周未完成" count={overdue.length} accent="#DC2626">
              {sortP(overdue).map(function(t) { return <TaskItem key={t.id} task={t} {...taskItemProps} />; })}
            </Section>
          )}

          {(function() {
            var future = {};
            active.filter(function(t) { return t.type === "week" && t.week && t.week > CW; }).forEach(function(t) {
              future[t.week] = (future[t.week] || []).concat([t]);
            });
            active.filter(function(t) { return t.type === "deadline" && !t.done; }).forEach(function(t) {
              var w = dlWeek(t.deadline);
              if (w && w !== CW) future[w] = (future[w] || []).concat([t]);
            });
            return Object.keys(future).sort().map(function(wk) {
              return (
                <Section T={T} key={wk} title={"📅 " + getWeekLabel(wk, CW)} count={future[wk].length}>
                  {sortP(future[wk]).map(function(t) { return <TaskItem key={t.id} task={t} {...taskItemProps} />; })}
                </Section>
              );
            });
          })()}

          {undatedDL.length > 0 && (
            <Section T={T} title="⚠️ 待补截止日" count={undatedDL.length} accent="#CA8A04">
              {sortP(undatedDL).map(function(t) { return <TaskItem key={t.id} task={t} {...taskItemProps} />; })}
            </Section>
          )}

          <Section T={T} title="📥 待安排" count={backlog.length} accent={T.textSec}>
            {backlog.length > 0
              ? sortP(backlog).map(function(t) { return <TaskItem key={t.id} task={t} {...taskItemProps} />; })
              : <Empty msg="待安排为空" />
            }
          </Section>
        </div>
      )}

      {/* ── DEADLINE VIEW ── */}
      {view === "deadline" && (
        <div>
          {allDL.length === 0 ? <Empty msg="没有截止日任务" /> : (function() {
            var overdue = allDL.filter(function(t) { return daysUntil(t.deadline) < 0; });
            var soon = allDL.filter(function(t) { var d = daysUntil(t.deadline); return d >= 0 && d <= 7; });
            var later = allDL.filter(function(t) { return daysUntil(t.deadline) > 7; });
            return (
              <div>
                {overdue.length > 0 && <Section T={T} title="🔴 已过期" count={overdue.length} accent="#DC2626">{overdue.map(function(t) { return <TaskItem key={t.id} task={t} {...taskItemProps} />; })}</Section>}
                {soon.length > 0 && <Section T={T} title="🟡 7天内" count={soon.length} accent="#CA8A04">{soon.map(function(t) { return <TaskItem key={t.id} task={t} {...taskItemProps} />; })}</Section>}
                {later.length > 0 && <Section T={T} title="📅 更远" count={later.length} accent={T.textSec}>{later.map(function(t) { return <TaskItem key={t.id} task={t} {...taskItemProps} />; })}</Section>}
              </div>
            );
          })()}
        </div>
      )}

      {/* ── CATEGORY VIEW ── */}
      {view === "category" && (
        <div>
          {categories.length === 0
            ? active.length > 0
              ? <Section T={T} title="📥 未分类" count={active.length} accent={T.textSec}>{sortP(active).map(function(t) { return <TaskItem key={t.id} task={t} {...taskItemProps} />; })}</Section>
              : <Empty msg="暂无分类，请在设置中添加分类或通过添加任务智能创建" />
            : active.length === 0
            ? <Empty msg="暂无任务" />
            : (
              <div>
                {categories.map(function(cat) {
                  var list = active.filter(function(t) { return t.category === cat.id; });
                  if (!list.length) return null;
                  var clr = CC[cat.id];
                  return (
                    <Section T={T} key={cat.id} title={(cat.emoji || "📌") + " " + (cat.label || cat.id)} count={list.length} accent={clr ? clr.color : undefined}>
                      {sortP(list).map(function(t) { return <TaskItem key={t.id} task={t} {...taskItemProps} />; })}
                    </Section>
                  );
                })}
                {(function() {
                  var uncategorized = active.filter(function(t) {
                    return !t.category || !categories.some(function(cat) { return cat.id === t.category; });
                  });
                  if (uncategorized.length === 0) return null;
                  return (
                    <Section T={T} title="📥 未分类" count={uncategorized.length} accent={T.textSec}>
                      {sortP(uncategorized).map(function(t) { return <TaskItem key={t.id} task={t} {...taskItemProps} />; })}
                    </Section>
                  );
                })()}
              </div>
            )
          }
        </div>
      )}

      {/* ── NOTES VIEW ── */}
      {view === "notes" && (
        <div>
          <div style={{ marginBottom: 16, display: "flex", flexDirection: "column", gap: 12 }}>
            <input type="text" value={noteSearch} onChange={function(e) { setNoteSearch(e.target.value); }} placeholder="搜索随笔内容…"
              style={{ padding: "8px 12px", background: T.inputBg, border: "1px solid " + T.inputBorder, borderRadius: 8, fontSize: 13, color: T.text, fontFamily: FONT, outline: "none", boxSizing: "border-box" }} />
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
              <span style={{ fontSize: 12, color: T.textSec, marginRight: 4 }}>时间</span>
              {[{ v: "all", l: "全部" }, { v: "today", l: "今天" }, { v: "week", l: "本周" }, { v: "month", l: "本月" }].map(function(o) {
                return (
                  <button key={o.v} type="button" onClick={function() { setNoteTimeFilter(o.v); }} style={{ padding: "4px 10px", border: "1px solid " + (noteTimeFilter === o.v ? T.accent : T.cardBorder), borderRadius: 6, fontSize: 12, cursor: "pointer", fontFamily: FONT, background: noteTimeFilter === o.v ? T.accent : "transparent", color: noteTimeFilter === o.v ? "#fff" : T.textSec }}>{o.l}</button>
                );
              })}
            </div>
            {allNoteTags.length > 0 && (
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center", paddingTop: 4, borderTop: "1px solid " + T.cardBorder }}>
                <span style={{ fontSize: 12, color: T.textSec, marginRight: 4 }}>标签</span>
                {allNoteTags.map(function(tag) {
                  var active = noteTagFilter.toLowerCase() === tag.toLowerCase();
                  return (
                    <button key={tag} type="button" onClick={function() { setNoteTagFilter(active ? "" : tag); }} style={{ padding: "2px 8px", border: "1px solid " + (active ? T.accent : T.cardBorder), borderRadius: 6, fontSize: 11, cursor: "pointer", fontFamily: FONT, background: active ? T.accent : "transparent", color: active ? "#fff" : T.textSec }}>{tag}</button>
                  );
                })}
              </div>
            )}
          </div>
          <div style={{ marginBottom: 20 }}>
            {!noteNewExpanded ? (
              <button type="button" onClick={function() { setNoteNewExpanded(true); }} style={{ padding: "10px 18px", background: T.card, border: "1px dashed " + T.cardBorder, borderRadius: 10, fontSize: 14, fontWeight: 600, color: T.textSec, cursor: "pointer", fontFamily: FONT, width: "100%", textAlign: "left" }}>📝 写随笔</button>
            ) : (
              <div style={{ background: T.card, border: "1px solid " + T.cardBorder, borderRadius: 10, padding: 14 }}>
                <textarea value={noteNewContent} onChange={function(e) { setNoteNewContent(e.target.value); }} placeholder="随便写点什么… 支持 Markdown"
                  style={{ width: "100%", minHeight: 100, padding: 12, background: T.inputBg, border: "1px solid " + T.inputBorder, borderRadius: 8, fontSize: 14, color: T.text, fontFamily: FONT, outline: "none", resize: "vertical", lineHeight: 1.6, boxSizing: "border-box", marginBottom: 8 }} />
                <div style={{ marginBottom: 10 }}>
                  <div style={{ fontSize: 11, color: T.textSec, marginBottom: 4 }}>标签</div>
                  <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginBottom: 6 }}>
                    {(noteNewTags || "").split(/[,，\s]+/).map(function(t) { return t.trim(); }).filter(Boolean).map(function(t) {
                      return (
                        <span key={t} style={{ display: "inline-flex", alignItems: "center", gap: 2, fontSize: 11, color: T.textSec, background: T.secBadge, borderRadius: 4, padding: "2px 6px" }}>
                          {t}
                          <button type="button" onClick={function() { setNoteNewTags((noteNewTags || "").split(/[,，\s]+/).map(function(x) { return x.trim(); }).filter(Boolean).filter(function(x) { return x !== t; }).join(", ")); }} style={{ padding: 0, margin: 0, border: "none", background: "none", cursor: "pointer", fontSize: 12, color: T.textMuted, lineHeight: 1 }}>×</button>
                        </span>
                      );
                    })}
                  </div>
                  {allNoteTags.length > 0 && (
                    <div style={{ marginBottom: 6 }}>
                      <div style={{ fontSize: 10, color: T.textMuted, marginBottom: 4 }}>可选：</div>
                      <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                      {allNoteTags.filter(function(t) { return !(noteNewTags || "").split(/[,，\s]+/).map(function(x) { return x.trim().toLowerCase(); }).filter(Boolean).includes(t.toLowerCase()); }).map(function(t) {
                        return (
                          <button key={t} type="button" onClick={function() { var arr = (noteNewTags || "").split(/[,，\s]+/).map(function(x) { return x.trim(); }).filter(Boolean); if (!arr.map(function(x) { return x.toLowerCase(); }).includes(t.toLowerCase())) setNoteNewTags(arr.concat([t]).join(", ")); }} style={{ padding: "2px 8px", border: "1px solid " + T.cardBorder, borderRadius: 4, fontSize: 11, cursor: "pointer", fontFamily: FONT, background: "transparent", color: T.textSec }}>{t}</button>
                        );
                      })}
                      </div>
                    </div>
                  )}
                  <input type="text" value={noteNewTagInput} onChange={function(e) { setNoteNewTagInput(e.target.value); }} onKeyDown={function(e) { if (e.key === "Enter" || e.key === "," || e.key === "，") { e.preventDefault(); var v = noteNewTagInput.trim(); if (v) { var arr = (noteNewTags || "").split(/[,，\s]+/).map(function(x) { return x.trim(); }).filter(Boolean); if (!arr.map(function(x) { return x.toLowerCase(); }).includes(v.toLowerCase())) setNoteNewTags(arr.concat([v]).join(", ")); setNoteNewTagInput(""); } } }} placeholder="输入新标签，回车或逗号添加"
                    style={{ width: "100%", padding: "6px 10px", background: T.inputBg, border: "1px solid " + T.inputBorder, borderRadius: 6, fontSize: 12, color: T.text, fontFamily: FONT, outline: "none", boxSizing: "border-box" }} />
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <button type="button" onClick={function() { addNote(noteNewContent); }} disabled={!noteNewContent.trim()} style={{ padding: "8px 16px", background: noteNewContent.trim() ? T.accent : T.inputBorder, color: noteNewContent.trim() ? "#fff" : T.textMuted, border: "none", borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: noteNewContent.trim() ? "pointer" : "default", fontFamily: FONT }}>保存</button>
                  <button type="button" onClick={function() { setNoteNewExpanded(false); setNoteNewContent(""); setNoteNewTags(""); setNoteNewTagInput(""); }} style={{ padding: "8px 16px", background: "transparent", border: "1px solid " + T.cardBorder, borderRadius: 8, fontSize: 13, cursor: "pointer", fontFamily: FONT, color: T.textSec }}>取消</button>
                </div>
              </div>
            )}
          </div>
          {filteredNotes.length === 0 ? (
            <Empty msg={notes.length === 0 ? "还没有随笔，点击上方写一条吧" : "没有符合条件的随笔"} />
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {filteredNotes.map(function(n) {
                var isEditing = noteEditingId === n.id;
                var summary = (n.content || "").length > 80 ? (n.content || "").slice(0, 80) + "…" : (n.content || "");
                return (
                  <div key={n.id} style={{ background: T.card, border: "1px solid " + T.cardBorder, borderRadius: 10, padding: 14, position: "relative" }}>
                    {isEditing ? (
                      <div>
                        <textarea value={noteEditContent} onChange={function(e) { setNoteEditContent(e.target.value); }} style={{ width: "100%", minHeight: 80, padding: 10, background: T.inputBg, border: "1px solid " + T.inputBorder, borderRadius: 8, fontSize: 14, color: T.text, fontFamily: FONT, outline: "none", resize: "vertical", lineHeight: 1.5, boxSizing: "border-box", marginBottom: 8 }} />
                        <div style={{ marginBottom: 10 }}>
                          <div style={{ fontSize: 11, color: T.textSec, marginBottom: 4 }}>标签</div>
                          <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginBottom: 6 }}>
                            {(noteEditTags || "").split(/[,，\s]+/).map(function(t) { return t.trim(); }).filter(Boolean).map(function(t) {
                              return (
                                <span key={t} style={{ display: "inline-flex", alignItems: "center", gap: 2, fontSize: 11, color: T.textSec, background: T.secBadge, borderRadius: 4, padding: "2px 6px" }}>
                                  {t}
                                  <button type="button" onClick={function() { setNoteEditTags((noteEditTags || "").split(/[,，\s]+/).map(function(x) { return x.trim(); }).filter(Boolean).filter(function(x) { return x !== t; }).join(", ")); }} style={{ padding: 0, margin: 0, border: "none", background: "none", cursor: "pointer", fontSize: 12, color: T.textMuted, lineHeight: 1 }}>×</button>
                                </span>
                              );
                            })}
                          </div>
                          {allNoteTags.length > 0 && (
                            <div style={{ marginBottom: 6 }}>
                              <div style={{ fontSize: 10, color: T.textMuted, marginBottom: 4 }}>可选：</div>
                              <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                              {allNoteTags.filter(function(t) { return !(noteEditTags || "").split(/[,，\s]+/).map(function(x) { return x.trim().toLowerCase(); }).filter(Boolean).includes(t.toLowerCase()); }).map(function(t) {
                                return (
                                  <button key={t} type="button" onClick={function() { var arr = (noteEditTags || "").split(/[,，\s]+/).map(function(x) { return x.trim(); }).filter(Boolean); if (!arr.map(function(x) { return x.toLowerCase(); }).includes(t.toLowerCase())) setNoteEditTags(arr.concat([t]).join(", ")); }} style={{ padding: "2px 8px", border: "1px solid " + T.cardBorder, borderRadius: 4, fontSize: 11, cursor: "pointer", fontFamily: FONT, background: "transparent", color: T.textSec }}>{t}</button>
                                );
                              })}
                              </div>
                            </div>
                          )}
                          <input type="text" value={noteEditTagInput} onChange={function(e) { setNoteEditTagInput(e.target.value); }} onKeyDown={function(e) { if (e.key === "Enter" || e.key === "," || e.key === "，") { e.preventDefault(); var v = noteEditTagInput.trim(); if (v) { var arr = (noteEditTags || "").split(/[,，\s]+/).map(function(x) { return x.trim(); }).filter(Boolean); if (!arr.map(function(x) { return x.toLowerCase(); }).includes(v.toLowerCase())) setNoteEditTags(arr.concat([v]).join(", ")); setNoteEditTagInput(""); } } }} placeholder="输入新标签，回车或逗号添加"
                            style={{ width: "100%", padding: "6px 10px", background: T.inputBg, border: "1px solid " + T.inputBorder, borderRadius: 6, fontSize: 12, color: T.text, fontFamily: FONT, outline: "none", boxSizing: "border-box" }} />
                        </div>
                        <div style={{ display: "flex", gap: 8 }}>
                          <button type="button" onClick={function() { updateNote(n.id, noteEditContent, noteEditTags); }} style={{ padding: "6px 14px", background: T.accent, color: "#fff", border: "none", borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: FONT }}>保存</button>
                          <button type="button" onClick={function() { setNoteEditingId(null); setNoteEditContent(""); setNoteEditTags(""); setNoteEditTagInput(""); }} style={{ padding: "6px 14px", background: "transparent", border: "1px solid " + T.cardBorder, borderRadius: 6, fontSize: 12, cursor: "pointer", fontFamily: FONT, color: T.textSec }}>取消</button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <button type="button" onClick={function() { toggleNotePinned(n.id); }} style={{ position: "absolute", top: 10, right: 10, padding: 4, border: "none", background: "none", cursor: "pointer", fontSize: 14 }} title={n.pinned ? "取消置顶" : "置顶"}>{n.pinned ? "📌" : "📍"}</button>
                        <div
                          role="button"
                          tabIndex={0}
                          onClick={function() { if ((n.content || "").length > 80) setNoteExpandedId(noteExpandedId === n.id ? null : n.id); }}
                          onKeyDown={function(e) { if ((n.content || "").length > 80 && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); setNoteExpandedId(noteExpandedId === n.id ? null : n.id); } }}
                          style={{
                            fontSize: 14, color: T.text, lineHeight: 1.6, marginBottom: 8, paddingRight: 28,
                            cursor: (n.content || "").length > 80 ? "pointer" : "default",
                            userSelect: "text",
                          }}
                          className="note-content"
                        >
                          {noteExpandedId === n.id ? (
                            <div style={{ whiteSpace: "pre-wrap" }}><ReactMarkdown>{n.content || ""}</ReactMarkdown></div>
                          ) : (
                            <div style={{ whiteSpace: "pre-wrap" }}><ReactMarkdown>{summary}</ReactMarkdown></div>
                          )}
                          {(n.content || "").length > 80 && (
                            <span style={{ fontSize: 12, color: T.accent, marginLeft: 6 }}>{noteExpandedId === n.id ? " 收起 ▴" : " 展开 ▾"}</span>
                          )}
                        </div>
                        {(n.tags || []).length > 0 && (
                          <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginBottom: 6 }}>
                            {(n.tags || []).map(function(t) { return (
                              <span key={t} style={{ fontSize: 10, color: T.textSec, background: T.secBadge, borderRadius: 4, padding: "1px 6px" }}>{t}</span>
                            ); })}
                          </div>
                        )}
                        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8, flexWrap: "wrap" }}>
                          <span style={{ fontSize: 11, color: T.textMuted }}>{fmtNoteTime(n.updatedAt || n.createdAt)}</span>
                          {n.convertedAt && <span style={{ fontSize: 10, color: "#10B981", background: "rgba(16,185,129,0.15)", borderRadius: 4, padding: "1px 6px" }}>已处理</span>}
                        </div>
                        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                          <button type="button" onClick={function() { setNoteEditingId(n.id); setNoteEditContent(n.content || ""); setNoteEditTags((n.tags || []).join(", ")); setNoteEditTagInput(""); }} style={{ padding: "4px 10px", border: "none", borderRadius: 6, fontSize: 11, cursor: "pointer", fontFamily: FONT, background: "transparent", color: T.textSec }}>编辑</button>
                          <button type="button" onClick={function() { removeNote(n.id); }} style={{ padding: "4px 10px", border: "none", borderRadius: 6, fontSize: 11, cursor: "pointer", fontFamily: FONT, background: "transparent", color: "#DC2626" }}>删除</button>
                          <button type="button" onClick={function() { convertNoteToTask(n); }} disabled={noteConvertingId === n.id} style={{ padding: "4px 10px", border: "none", borderRadius: 6, fontSize: 11, cursor: noteConvertingId === n.id ? "default" : "pointer", fontFamily: FONT, background: "transparent", color: T.accent }}>{noteConvertingId === n.id ? "转化中…" : "AI 转为任务"}</button>
                        </div>
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── DONE (collapsed) ── */}
      {doneList.length > 0 && (
        <div style={{ marginTop: 8 }}>
          <button onClick={function() { setShowDone(!showDone); }} style={{
            display: "flex", alignItems: "center", gap: 8, background: "none", border: "none",
            cursor: "pointer", padding: "8px 0", fontFamily: FONT, width: "100%",
          }}>
            <span style={{ fontSize: 14, fontWeight: 700, color: "#10B981" }}>✅ 已完成</span>
            <span style={{ fontSize: 11, fontWeight: 700, color: T.textSec, background: T.secBadge, borderRadius: 10, padding: "1px 8px" }}>{doneList.length}</span>
            <span style={{ fontSize: 11, color: T.textMuted, marginLeft: "auto" }}>{showDone ? "收起 ▴" : "展开 ▾"}</span>
          </button>
          {showDone && (
            <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 6 }}>
              {doneList.map(function(t) { return <TaskItem key={t.id} task={t} {...taskItemProps} />; })}
            </div>
          )}
        </div>
      )}
    </div>
  );

  return (
    <div style={{ minHeight: "100vh", background: T.bg, fontFamily: FONT, transition: "background 0.2s" }}>
      <link href="https://fonts.googleapis.com/css2?family=Instrument+Sans:wght@400;500;600;700&display=swap" rel="stylesheet" />

      {isDesktop ? (
        /* ════════════════ DESKTOP LAYOUT ════════════════ */
        <div style={{ maxWidth: 1280, margin: "0 auto", padding: "24px 32px", display: "flex", gap: 24, alignItems: "flex-start" }}>

          {/* ── LEFT SIDEBAR ── */}
          <div style={{ width: 220, flexShrink: 0, paddingRight: 20, borderRight: "1px solid " + T.cardBorder, position: "sticky", top: 24, alignSelf: "flex-start", maxHeight: "calc(100vh - 48px)", overflowY: "auto" }}>
            <div style={{ marginBottom: 24 }}>
              <h1 style={{ fontSize: 22, fontWeight: 700, color: T.text, margin: 0, letterSpacing: -0.5 }}>TaskBrain</h1>
              <span style={{ fontSize: 11, color: T.textMuted, fontWeight: 500 }}>
                {"本周 " + fmtShort(weekRange.mon) + "-" + fmtShort(weekRange.sun)}
              </span>
            </div>

            {/* Vertical Nav */}
            <div style={{ display: "flex", flexDirection: "column", gap: 2, marginBottom: 20 }}>
              {[{ id: "week", l: "📌 按周" }, { id: "deadline", l: "📅 截止日" }, { id: "category", l: "🏷 按分类" }, { id: "notes", l: "📝 随笔" }].map(function(v) {
                return (
                  <button key={v.id} onClick={function() { setView(v.id); }} style={{
                    padding: "9px 12px", border: "none", borderRadius: 8, fontSize: 13, fontWeight: 600,
                    cursor: "pointer", fontFamily: FONT, textAlign: "left",
                    background: view === v.id ? T.tabActive : "transparent",
                    color: view === v.id ? T.text : T.textMuted,
                    borderLeft: view === v.id ? "3px solid " + T.accent : "3px solid transparent",
                    boxShadow: view === v.id ? T.tabShadow : "none",
                  }}>{v.l}</button>
                );
              })}
            </div>

            {/* 云端同步：始终可见 */}
            <div style={{ marginBottom: 16, padding: "10px 12px", background: T.card, border: "1px solid " + T.cardBorder, borderRadius: 10, fontSize: 12 }}>
              <div style={{ fontWeight: 600, color: T.textSec, marginBottom: 4 }}>☁️ 云端同步</div>
              {!supabase ? (
                <div style={{ fontSize: 11, color: T.textMuted }}>未配置。请在 Vercel 项目 Settings → Environment Variables 添加 VITE_SUPABASE_URL 和 VITE_SUPABASE_ANON_KEY 后<strong>重新部署</strong>（Redeploy）。</div>
              ) : user ? (
                <div>
                  <div style={{ fontSize: 11, color: T.textMuted, marginBottom: 6 }}>已登录：{user.email}</div>
                  {dataSource && <div style={{ fontSize: 11, color: dataSource === "cloud" ? "#059669" : T.textMuted, marginBottom: 6 }}>数据来源：{dataSource === "cloud" ? "云端" : "本地"}</div>}
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                    <button type="button" onClick={refreshFromCloud} style={{ padding: "4px 10px", border: "1px solid " + T.accent, borderRadius: 6, fontSize: 11, cursor: "pointer", fontFamily: FONT, background: "transparent", color: T.accent }}>从云端刷新</button>
                    <button onClick={handleLogout} style={{ padding: "4px 10px", border: "1px solid " + T.cardBorder, borderRadius: 6, fontSize: 11, cursor: "pointer", fontFamily: FONT, background: "transparent", color: T.textSec }}>退出</button>
                  </div>
                </div>
              ) : (
                <div>
                  <div style={{ fontSize: 11, color: T.textMuted, marginBottom: 8 }}>登录后电脑与手机将同步同一份数据，请用同一账号在两端登录。</div>
                  <input type="email" value={authEmail} onChange={function(e) { setAuthEmail(e.target.value); setAuthError(""); }} placeholder="邮箱"
                    style={{ width: "100%", padding: "6px 10px", marginBottom: 6, background: T.inputBg, border: "1px solid " + T.inputBorder, borderRadius: 6, color: T.text, fontSize: 12, fontFamily: FONT, outline: "none", boxSizing: "border-box" }} />
                  <input type="password" value={authPassword} onChange={function(e) { setAuthPassword(e.target.value); setAuthError(""); }} placeholder="密码（至少 6 位）"
                    style={{ width: "100%", padding: "6px 10px", marginBottom: 6, background: T.inputBg, border: "1px solid " + T.inputBorder, borderRadius: 6, color: T.text, fontSize: 12, fontFamily: FONT, outline: "none", boxSizing: "border-box" }} />
                  {authError && <div style={{ fontSize: 11, color: "#DC2626", marginBottom: 6 }}>{authError}</div>}
                  <div style={{ display: "flex", gap: 6 }}>
                    <button onClick={handleLogin} disabled={authLoading} style={{ padding: "4px 10px", border: "none", borderRadius: 6, fontSize: 11, fontWeight: 600, cursor: authLoading ? "default" : "pointer", fontFamily: FONT, background: T.accent, color: "#fff" }}>登录</button>
                    <button onClick={handleSignup} disabled={authLoading} style={{ padding: "4px 10px", border: "1px solid " + T.cardBorder, borderRadius: 6, fontSize: 11, cursor: authLoading ? "default" : "pointer", fontFamily: FONT, background: "transparent", color: T.textSec }}>注册</button>
                  </div>
                </div>
              )}
            </div>

            {/* Icon Buttons：仅 ⚙️ 用延迟关闭避免输入框聚焦时卡住；👤 与 ⚙️ 互斥，只展开一个 */}
            <div style={{ display: "flex", gap: 6, marginBottom: 16 }}>
              <HeaderBtn onClick={function() { setShowExport(false); setShowProf(function(p) { return !p; }); }} active={showProf} T={T}>👤</HeaderBtn>
              <HeaderBtn onClick={function() { if (document.activeElement?.closest?.("input")) { document.activeElement.blur(); requestAnimationFrame(function() { setShowProf(false); setShowExport(function(p) { return !p; }); }); } else { setShowProf(false); setShowExport(function(p) { return !p; }); } }} active={showExport} T={T}>⚙️</HeaderBtn>
              <HeaderBtn onClick={function() { setDark(function(p) { return !p; }); }} T={T}>{dark ? "☀️" : "🌙"}</HeaderBtn>
            </div>

            {settingsJSX}
            {profileJSX}
          </div>

          {/* ── MAIN CONTENT ── */}
          <div style={{ flex: 1, minWidth: 0 }}>
            {view !== "notes" && taskInputJSX}
            {taskListsJSX}
          </div>

          {/* ── RIGHT PANEL ── */}
          <div style={{ width: 280, flexShrink: 0, position: "sticky", top: 24, alignSelf: "flex-start", display: "flex", flexDirection: "column", gap: 16 }}>

            {/* Section: 数据概览 */}
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: T.textMuted, letterSpacing: 0.5, marginBottom: 8 }}>数据概览</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 12 }}>
                {[
                  { l: "本周", v: twW.length + twDL.length, w: (twW.length + twDL.length) > 10, a: T.accent },
                  { l: "待安排", v: backlog.length, a: T.textSec },
                  { l: "截止日", v: allDL.length, a: "#DC2626", w: allDL.some(function(t) { return daysUntil(t.deadline) <= 3; }) },
                  { l: "完成", v: doneList.length, a: "#10B981" },
                  { l: "随笔", v: notes.length, a: T.textSec },
                ].map(function(s) {
                  return (
                    <div key={s.l} style={{ padding: "12px 14px", background: T.card, borderRadius: 10, border: "1px solid " + (s.w ? "#FCA5A5" : T.cardBorder), boxShadow: T.shadow }}>
                      <div style={{ fontSize: 20, fontWeight: 700, color: s.a }}>{s.v}{s.w ? " ⚠️" : ""}</div>
                      <div style={{ fontSize: 11, color: T.textMuted, fontWeight: 500, marginTop: 2 }}>{s.l}</div>
                    </div>
                  );
                })}
              </div>
              <DistBar tasks={tasks} CW={CW} T={T} categories={categories} />
            </div>

            {/* Divider */}
            <div style={{ borderTop: "1px solid " + T.cardBorder }} />

            {/* Section: AI 助手 */}
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: T.textMuted, letterSpacing: 0.5, marginBottom: 8 }}>AI 助手</div>
              <div style={{ display: "flex", gap: 8, marginBottom: aiPanelJSX ? 0 : 0 }}>
                <button onClick={diagnose} style={{ flex: 1, padding: "11px 0", background: T.card, border: "1px solid " + T.cardBorder, borderRadius: 10, fontSize: 13, fontWeight: 600, color: T.text, cursor: "pointer", fontFamily: FONT, boxShadow: T.shadow }}>🧠 一键诊断</button>
                <button onClick={planWeek} style={{ flex: 1, padding: "11px 0", background: T.card, border: "1px solid " + T.cardBorder, borderRadius: 10, fontSize: 13, fontWeight: 600, color: T.text, cursor: "pointer", fontFamily: FONT, boxShadow: T.shadow }}>📋 本周规划</button>
              </div>
              {aiPanelJSX && <div style={{ marginTop: 12 }}>{aiPanelJSX}</div>}
            </div>

          </div>

        </div>
      ) : (
        /* ════════════════ MOBILE LAYOUT ════════════════ */
        <div style={{ maxWidth: 640, margin: "0 auto", padding: "40px 20px 80px" }}>

          {/* Header */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
            <div>
              <h1 style={{ fontSize: 26, fontWeight: 700, color: T.text, margin: 0, letterSpacing: -0.5 }}>TaskBrain</h1>
              <span style={{ fontSize: 12, color: T.textMuted, fontWeight: 500 }}>
                {"本周 " + fmtShort(weekRange.mon) + "-" + fmtShort(weekRange.sun)}
              </span>
            </div>
            <div style={{ display: "flex", gap: 6 }}>
              <HeaderBtn onClick={function() { setShowExport(false); setShowProf(function(p) { return !p; }); }} active={showProf} T={T}>👤</HeaderBtn>
              <HeaderBtn onClick={function() { if (document.activeElement?.closest?.("input")) { document.activeElement.blur(); requestAnimationFrame(function() { setShowProf(false); setShowExport(function(p) { return !p; }); }); } else { setShowProf(false); setShowExport(function(p) { return !p; }); } }} active={showExport} T={T}>⚙️</HeaderBtn>
              <HeaderBtn onClick={function() { setDark(function(p) { return !p; }); }} T={T}>{dark ? "☀️" : "🌙"}</HeaderBtn>
            </div>
          </div>

          {settingsJSX}
          {profileJSX}

          {view !== "notes" && taskInputJSX}

          {/* Stats */}
          <div style={{ display: "flex", gap: 10, marginBottom: 16, flexWrap: "wrap" }}>
            {[
              { l: "本周", v: twW.length + twDL.length, w: (twW.length + twDL.length) > 10, a: T.accent },
              { l: "待安排", v: backlog.length, a: T.textSec },
              { l: "截止日", v: allDL.length, a: "#DC2626", w: allDL.some(function(t) { return daysUntil(t.deadline) <= 3; }) },
              { l: "完成", v: doneList.length, a: "#10B981" },
              { l: "随笔", v: notes.length, a: T.textSec },
            ].map(function(s) {
              return (
                <div key={s.l} style={{ flex: 1, minWidth: 70, padding: "12px 14px", background: T.card, borderRadius: 10, border: "1px solid " + (s.w ? "#FCA5A5" : T.cardBorder), boxShadow: T.shadow }}>
                  <div style={{ fontSize: 20, fontWeight: 700, color: s.a }}>{s.v}{s.w ? " ⚠️" : ""}</div>
                  <div style={{ fontSize: 11, color: T.textMuted, fontWeight: 500, marginTop: 2 }}>{s.l}</div>
                </div>
              );
            })}
          </div>

          <DistBar tasks={tasks} CW={CW} T={T} categories={categories} />

          {/* AI Buttons */}
          <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
            <button onClick={diagnose} style={{ flex: 1, padding: "11px 0", background: T.card, border: "1px solid " + T.cardBorder, borderRadius: 10, fontSize: 13, fontWeight: 600, color: T.text, cursor: "pointer", fontFamily: FONT, boxShadow: T.shadow }}>🧠 一键诊断</button>
            <button onClick={planWeek} style={{ flex: 1, padding: "11px 0", background: T.card, border: "1px solid " + T.cardBorder, borderRadius: 10, fontSize: 13, fontWeight: 600, color: T.text, cursor: "pointer", fontFamily: FONT, boxShadow: T.shadow }}>📋 本周规划</button>
          </div>

          {aiPanelJSX}

          {/* View Tabs */}
          <div style={{ display: "flex", gap: 2, marginBottom: 20, background: T.tabBg, borderRadius: 10, padding: 3 }}>
            {[{ id: "week", l: "按周" }, { id: "deadline", l: "📅 截止日" }, { id: "category", l: "按分类" }, { id: "notes", l: "📝 随笔" }].map(function(v) {
              return (
                <button key={v.id} onClick={function() { setView(v.id); }} style={{
                  flex: 1, padding: "9px 0", border: "none", borderRadius: 8, fontSize: 13, fontWeight: 600,
                  cursor: "pointer", fontFamily: FONT,
                  background: view === v.id ? T.tabActive : "transparent",
                  color: view === v.id ? T.text : T.textMuted,
                  boxShadow: view === v.id ? T.tabShadow : "none",
                }}>{v.l}</button>
              );
            })}
          </div>

          {taskListsJSX}
        </div>
      )}

      {toast && <Toast key={toast.id} message={toast.message} T={T} onDone={function() { setToast(null); }} />}

      {/* AI 转为任务：可编辑预览确认弹窗 */}
      {convertPreview && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 9999, padding: 20, overflowY: "auto" }} onClick={function(e) { if (e.target === e.currentTarget) setConvertPreview(null); }}>
          <div style={{ background: T.card, border: "1px solid " + T.cardBorder, borderRadius: 12, padding: 20, maxWidth: 480, width: "100%", maxHeight: "90vh", overflowY: "auto", boxShadow: "0 8px 32px rgba(0,0,0,0.2)" }} onClick={function(e) { e.stopPropagation(); }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: T.text, marginBottom: 16 }}>确认转为任务（可编辑）</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 16 }}>
              {convertPreview.tasks.map(function(t, idx) {
                return (
                  <div key={idx} style={{ background: T.inputBg, border: "1px solid " + T.inputBorder, borderRadius: 10, padding: 12, position: "relative" }}>
                    <button type="button" onClick={function() { removeConvertPreviewTask(idx); }} style={{ position: "absolute", top: 8, right: 8, padding: 2, border: "none", background: "none", cursor: "pointer", fontSize: 14, color: T.textMuted }} title="删除">×</button>
                    <input type="text" value={t.text} onChange={function(e) { updateConvertPreviewTask(idx, { text: e.target.value }); }} placeholder="任务标题"
                      style={{ width: "100%", padding: "6px 10px", marginBottom: 6, background: T.card, border: "1px solid " + T.cardBorder, borderRadius: 6, fontSize: 13, color: T.text, fontFamily: FONT, outline: "none", boxSizing: "border-box" }} />
                    <input type="text" value={t.detail} onChange={function(e) { updateConvertPreviewTask(idx, { detail: e.target.value }); }} placeholder="备注（可选）"
                      style={{ width: "100%", padding: "4px 8px", marginBottom: 8, background: T.card, border: "1px solid " + T.cardBorder, borderRadius: 4, fontSize: 12, color: T.textSec, fontFamily: FONT, outline: "none", boxSizing: "border-box" }} />
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
                      <select value={t.category} onChange={function(e) { updateConvertPreviewTask(idx, { category: e.target.value }); }} style={{ padding: "4px 8px", background: T.card, border: "1px solid " + T.cardBorder, borderRadius: 4, fontSize: 11, color: T.text, fontFamily: FONT, outline: "none" }}>
                        <option value="">未分类</option>
                        {(categories || []).map(function(c) { return <option key={c.id} value={c.id}>{(c.emoji || "📌") + " " + (c.label || c.id)}</option>; })}
                      </select>
                      <select value={t.priority} onChange={function(e) { updateConvertPreviewTask(idx, { priority: e.target.value }); }} style={{ padding: "4px 8px", background: T.card, border: "1px solid " + T.cardBorder, borderRadius: 4, fontSize: 11, color: T.text, fontFamily: FONT, outline: "none" }}>
                        {PRIORITIES.map(function(p) { return <option key={p.id} value={p.id}>{p.label}</option>; })}
                      </select>
                      <select value={t.type} onChange={function(e) { var typ = e.target.value; updateConvertPreviewTask(idx, { type: typ, week: typ === "week" ? t.week : null, deadline: typ === "deadline" ? t.deadline : null }); }} style={{ padding: "4px 8px", background: T.card, border: "1px solid " + T.cardBorder, borderRadius: 4, fontSize: 11, color: T.text, fontFamily: FONT, outline: "none" }}>
                        <option value="week">周任务</option>
                        <option value="deadline">截止日</option>
                      </select>
                      {t.type === "week" && (
                        <select value={t.week || ""} onChange={function(e) { updateConvertPreviewTask(idx, { week: e.target.value || null }); }} style={{ padding: "4px 8px", background: T.card, border: "1px solid " + T.cardBorder, borderRadius: 4, fontSize: 11, color: T.text, fontFamily: FONT, outline: "none" }}>
                          <option value="">待安排</option>
                          {weekOpts.map(function(w) { return <option key={w.key} value={w.key}>{w.label}</option>; })}
                        </select>
                      )}
                      {t.type === "deadline" && (
                        <input type="date" value={t.deadline || ""} onChange={function(e) { updateConvertPreviewTask(idx, { deadline: e.target.value || null }); }} style={{ padding: "4px 8px", background: T.card, border: "1px solid " + T.cardBorder, borderRadius: 4, fontSize: 11, color: T.text, fontFamily: FONT, outline: "none" }} />
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
            <button type="button" onClick={addConvertPreviewTask} style={{ width: "100%", padding: "8px 0", marginBottom: 16, border: "1px dashed " + T.cardBorder, borderRadius: 8, fontSize: 12, color: T.textSec, cursor: "pointer", fontFamily: FONT, background: "transparent" }}>+ 添加一条</button>
            <label style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16, fontSize: 13, color: T.textSec, cursor: "pointer" }}>
              <input type="checkbox" checked={convertPreview.markProcessed} onChange={function(e) { setConvertPreview(function(p) { return Object.assign({}, p, { markProcessed: e.target.checked }); }); }} />
              转完后标记随笔已处理
            </label>
            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
              <button type="button" onClick={function() { setConvertPreview(null); }} style={{ padding: "8px 16px", border: "1px solid " + T.cardBorder, borderRadius: 8, fontSize: 13, cursor: "pointer", fontFamily: FONT, background: "transparent", color: T.textSec }}>取消</button>
              <button type="button" onClick={confirmConvertTask} style={{ padding: "8px 16px", border: "none", borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: FONT, background: T.accent, color: "#fff" }}>确认创建 {convertPreview.tasks.length} 条</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
