import { useState, useRef, useMemo, useEffect, useCallback } from "react";

/* ═══════════════════════════ CONSTANTS ═══════════════════════════ */

const CATEGORIES = [
  { id: "effects", label: "效果团队", emoji: "📊" },
  { id: "commerce", label: "商销闭环", emoji: "🛒" },
  { id: "ai_tech", label: "AI专项技术", emoji: "🤖" },
  { id: "family", label: "BB家庭", emoji: "👶" },
  { id: "health", label: "爱好健康", emoji: "🏃" },
  { id: "invest", label: "投资", emoji: "💰" },
];

const CAT_COLORS_LIGHT = {
  effects: { bg: "#FFF7ED", color: "#C2410C", border: "#FDBA74" },
  commerce: { bg: "#F5F3FF", color: "#6D28D9", border: "#C4B5FD" },
  ai_tech: { bg: "#ECFEFF", color: "#0E7490", border: "#67E8F9" },
  family: { bg: "#FDF2F8", color: "#BE185D", border: "#F9A8D4" },
  health: { bg: "#ECFDF5", color: "#047857", border: "#6EE7B7" },
  invest: { bg: "#FEFCE8", color: "#A16207", border: "#FDE047" },
};

const CAT_COLORS_DARK = {
  effects: { bg: "#431407", color: "#FDBA74", border: "#92400E" },
  commerce: { bg: "#2E1065", color: "#C4B5FD", border: "#5B21B6" },
  ai_tech: { bg: "#083344", color: "#67E8F9", border: "#155E75" },
  family: { bg: "#500724", color: "#F9A8D4", border: "#9D174D" },
  health: { bg: "#022C22", color: "#6EE7B7", border: "#065F46" },
  invest: { bg: "#422006", color: "#FDE047", border: "#854D0E" },
};

const DIST_COLORS = {
  effects: "#F97316", commerce: "#8B5CF6", ai_tech: "#06B6D4",
  family: "#EC4899", health: "#10B981", invest: "#EAB308",
};

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

function dlWeek(ds) {
  return ds ? getWeekKey(new Date(ds)) : null;
}

/* ═══════════════════════════ DEMO DATA ═══════════════════════════ */

var in5 = new Date(Date.now() + 5 * 864e5).toISOString().split("T")[0];
var in12 = new Date(Date.now() + 12 * 864e5).toISOString().split("T")[0];
var in20 = new Date(Date.now() + 20 * 864e5).toISOString().split("T")[0];

var DEMO = [
  { id: "1", text: "Review效果团队bimonthly数据", category: "effects", priority: "high", type: "week", week: getCW(), deadline: null, done: false, subtasks: [] },
  { id: "2", text: "和技术负责人对齐试点项目checkpoint", category: "ai_tech", priority: "urgent", type: "week", week: getCW(), deadline: null, done: false, subtasks: [
    { id: "2a", text: "准备评估维度文档", done: true },
    { id: "2b", text: "和PM单独聊进展", done: false },
    { id: "2c", text: "确认技术负责人反馈", done: false },
  ]},
  { id: "3", text: "婴儿床下单", category: "family", priority: "high", type: "deadline", week: null, deadline: in5, done: false, subtasks: [
    { id: "3a", text: "看小红书测评", done: true },
    { id: "3b", text: "问朋友推荐", done: false },
    { id: "3c", text: "比价下单", done: false },
  ]},
  { id: "4", text: "约同学们确定跑步时间", category: "health", priority: "medium", type: "week", week: null, deadline: null, done: false, subtasks: [] },
  { id: "5", text: "美股持仓财报日期整理", category: "invest", priority: "medium", type: "week", week: null, deadline: null, done: false, subtasks: [] },
  { id: "6", text: "CID业务数据周报review", category: "commerce", priority: "high", type: "week", week: getCW(), deadline: null, done: false, subtasks: [] },
  { id: "7", text: "PM两周checkpoint评估准备", category: "ai_tech", priority: "high", type: "deadline", week: null, deadline: in12, done: false, subtasks: [] },
  { id: "8", text: "摩托车保养预约", category: "health", priority: "low", type: "week", week: null, deadline: null, done: false, subtasks: [] },
  { id: "9", text: "Q2效果团队KPI方案提交", category: "effects", priority: "high", type: "deadline", week: null, deadline: in20, done: false, subtasks: [] },
];

var DEF_PROFILE = {
  company: "引响合伙人(10%股份)，小红书营销公司，25年营收5.5亿，250人\n管效果投放团队30+人（4个部门）\n管商销/闭环直播15人（CID业务）\n技术产品团队5人，正在做AI改革试点",
  personal: "92年，UC Berkeley CS，前Uber/小红书\nbb即将出生\n爱好：炒股、摩托车、健身、跑步",
  invest: "美股为主，具体持仓待补充",
  family: "bb快出生了，需要准备的东西还比较多",
};
var DEF_STATUS = "最近感觉事情太杂，工作生活多线程并行，脑子经常浆糊\nbb快出生了，有点焦虑准备是否充分\nAI专项刚启动，对技术团队改革的节奏拿不太准";

/* ═══════════════════════════ STORAGE ═══════════════════════════ */

var SK = "taskbrain-data";

async function loadData() {
  try {
    // Try Claude artifact storage first, fall back to localStorage
    if (window.storage && window.storage.get) {
      var r = await window.storage.get(SK);
      if (r && r.value) return JSON.parse(r.value);
    } else {
      var raw = localStorage.getItem(SK);
      if (raw) return JSON.parse(raw);
    }
  } catch (e) { /* ignore */ }
  return null;
}

async function saveData(d) {
  try {
    if (window.storage && window.storage.set) {
      await window.storage.set(SK, JSON.stringify(d));
    } else {
      localStorage.setItem(SK, JSON.stringify(d));
    }
  } catch (e) { console.error("Save:", e); }
}

/* ═══════════════════════════ AI (DeepSeek) ═══════════════════════════ */

// API key: reads from localStorage. Set via the ⚙️ settings panel.
function getApiKey() {
  try { return localStorage.getItem("taskbrain-api-key") || ""; } catch (e) { return ""; }
}
function setApiKey(key) {
  try { localStorage.setItem("taskbrain-api-key", key); } catch (e) { /* ignore */ }
}

async function callAI(sys, msgs) {
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
        max_tokens: 1200,
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
  return "你是Roy的任务管理助手。根据用户的一段描述，你需要：\n"
    + "1) 提炼关键信息 → 生成简洁的任务标题 refinedText（去掉口语、冗余，保留动作+对象）\n"
    + "2) 从描述中识别截止日/时间 → 若有「下周三」「3月20号」「本周五前」等，推算出具体日期，填 deadline（YYYY-MM-DD）；没有则 null\n"
    + "3) 判断是周任务还是截止日任务 → 有明确截止日填 type:deadline，否则 type:week\n"
    + "4) 若是周任务且能推断目标周（如「本周」「下周」）→ 填 week 为该周周一的 YYYY-MM-DD；无法推断或待安排则 week:null\n"
    + "5) 分类与优先级 → category、priority\n\n"
    + (bg ? "【背景】\n" + bg + "\n\n" : "")
    + "分类id: effects, commerce, ai_tech, family, health, invest\n"
    + "优先级id: urgent, high, medium, low\n"
    + "只返回一个JSON，不要markdown包裹：\n"
    + "{\"refinedText\":\"提炼后的任务标题\",\"category\":\"id\",\"priority\":\"id\",\"type\":\"week或deadline\",\"deadline\":\"YYYY-MM-DD或null\",\"week\":\"YYYY-MM-DD或null\",\"reason\":\"一句话\"}";
}

function buildDiagSys(prof, stat) {
  var p = prof || {};
  return "你是Roy的私人AI助手。你们正在对话，Roy可能追问或反驳，你要像了解他的朋友/顾问一样回应。\n\n【背景】\n公司:" + (p.company || "未填写") + "\n个人:" + (p.personal || "未填写") + "\n投资:" + (p.invest || "未填写") + "\n家庭:" + (p.family || "未填写") + "\n\n【当前状态】\n" + (stat || "未填写") + "\n\n要求：1)简洁直接不客套 2)结合状态给建议 3)关注快到期的截止日 4)本周>8就过载 5)工作生活平衡 6)焦虑给具体建议 7)追问时正面回应不重复 8)中文250字内";
}

var SYS_WK = "你是Roy的任务管理助手。从待安排挑任务到本周。1)合计不超8-10 2)高优先先排 3)空白分类补一个。返回JSON: [{\"taskId\":\"id\",\"reason\":\"一句话\"}]";

/* ═══════════════════════════ SMALL COMPONENTS ═══════════════════════════ */

function MiniBtn(props) {
  return (
    <button onClick={props.onClick} style={{
      background: "none", border: "none", fontSize: 12, fontWeight: 500,
      color: props.color, cursor: "pointer", padding: "4px 6px", fontFamily: FONT,
    }}>
      {props.children}
    </button>
  );
}

function QuickBtn(props) {
  return (
    <button onClick={props.onClick} style={{
      background: "none", border: "none", fontSize: 11, fontWeight: 600,
      color: props.color, cursor: "pointer", padding: "2px 0", fontFamily: FONT,
      textDecoration: "underline", textUnderlineOffset: 2,
    }}>
      {props.children}
    </button>
  );
}

function HeaderBtn(props) {
  return (
    <button onClick={props.onClick} style={{
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
  }, [props.onDone]);

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
  var thisWeek = tasks.filter(function(t) {
    return !t.done && ((t.type === "week" && t.week === CW) || (t.type === "deadline" && dlWeek(t.deadline) === CW));
  });
  if (thisWeek.length === 0) return null;

  var counts = {};
  CATEGORIES.forEach(function(c) {
    counts[c.id] = thisWeek.filter(function(t) { return t.category === c.id; }).length;
  });
  var missing = CATEGORIES.filter(function(c) { return counts[c.id] === 0; }).map(function(c) { return c.emoji + c.label; });

  return (
    <div style={{ marginBottom: 20 }}>
      <div style={{ display: "flex", height: 6, borderRadius: 3, overflow: "hidden", gap: 1, marginBottom: 6 }}>
        {CATEGORIES.map(function(c) {
          if (counts[c.id] <= 0) return null;
          return <div key={c.id} style={{ flex: counts[c.id], background: DIST_COLORS[c.id], borderRadius: 2 }} title={c.label + ": " + counts[c.id]} />;
        })}
      </div>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", fontSize: 11, color: T.textSec }}>
        {CATEGORIES.map(function(c) {
          if (counts[c.id] <= 0) return null;
          return <span key={c.id}>{c.emoji}{counts[c.id]}</span>;
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

  var catObj = CATEGORIES.find(function(x) { return x.id === task.category; });
  var catColor = CC[task.category];
  var priObj = PRIORITIES.find(function(x) { return x.id === task.priority; });

  function handleToggleEdit() {
    setIsEdit(!isEdit);
    setECat(task.category);
    setEPri(task.priority);
    setEWk(task.week || "");
    setEType(task.type);
    setEDL(task.deadline || "");
  }

  function handleSave() {
    props.onUpdate(task.id, {
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
    <div style={{
      padding: "12px 16px",
      background: task.done ? T.cardDone : T.card,
      borderRadius: 10,
      border: "1px solid " + borderColor,
      opacity: task.done ? 0.5 : 1,
    }}>
      {/* Main row */}
      <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
        <button onClick={function() { props.onToggle(task.id); }} style={{
          width: 20, height: 20, borderRadius: 6, flexShrink: 0, marginTop: 2,
          cursor: "pointer", padding: 0,
          border: task.done ? "none" : "2px solid " + T.inputBorder,
          background: task.done ? "#10B981" : "transparent",
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          {task.done && <svg width="11" height="11" viewBox="0 0 12 12" fill="none"><path d="M2 6L5 9L10 3" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" /></svg>}
        </button>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            fontSize: 14, fontWeight: 500,
            color: task.done ? T.textMuted : T.text,
            textDecoration: task.done ? "line-through" : "none",
            lineHeight: 1.5, marginBottom: 6,
          }}>{task.text}</div>

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
        <div style={{ display: "flex", gap: 8, marginTop: 10, paddingTop: 10, borderTop: "1px solid " + T.cardBorder, flexWrap: "wrap", alignItems: "center" }}>
          <SelectBox value={eCat} onChange={setECat} T={T}>
            {CATEGORIES.map(function(c) { return <option key={c.id} value={c.id}>{c.emoji + " " + c.label}</option>; })}
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
  var inputRef = useRef(null);

  var CW = getCW();
  var T = dark ? DARK : LIGHT;
  var CC = dark ? CAT_COLORS_DARK : CAT_COLORS_LIGHT;
  var weekOpts = useMemo(function() { return getWeekOpts(CW); }, [CW]);
  var nw = nextWeekKey(CW);
  var windowWidth = useWindowWidth();
  var isDesktop = windowWidth >= 1024;

  /* ── Persistence ── */
  useEffect(function() {
    (async function() {
      var s = await loadData();
      if (s) {
        if (s.tasks) setTasks(s.tasks);
        if (s.profile) setProfile(s.profile);
        if (s.status !== undefined) setStatus(s.status);
        if (s.dark !== undefined) setDark(s.dark);
      } else {
        setTasks(DEMO);
      }
      setLoaded(true);
    })();
  }, []);

  useEffect(function() {
    if (loaded) saveData({ tasks: tasks, profile: profile, status: status, dark: dark });
  }, [tasks, profile, status, dark, loaded]);

  /* ── Task CRUD ── */
  var addTask = async function(text) {
    var id = Date.now().toString();
    var hasDL = addDL !== "";
    var today = new Date().toISOString().split("T")[0];
    var cwMon = getWeekRange(CW).mon;
    var cwMonStr = cwMon.getFullYear() + "-" + String(cwMon.getMonth() + 1).padStart(2, "0") + "-" + String(cwMon.getDate()).padStart(2, "0");

    var newTask = { id: id, text: text, category: "effects", priority: "medium", type: hasDL ? "deadline" : "week", week: null, deadline: hasDL ? addDL : null, done: false, subtasks: [] };
    setTasks(function(p) { return [newTask].concat(p); });
    setInput(""); setAddDL(""); setClassifying(true);

    var userMsg = "任务描述：「" + text + "」\n今日日期：" + today + "，本周周一：" + cwMonStr + (hasDL ? "；用户已选截止日：" + addDL : "") + "\n请提炼并分配。";
    var r = await callAI(buildClsSys(profile), [{ role: "user", content: userMsg }]);
    if (r) {
      try {
        var raw = r.replace(/```json|```/g, "").trim();
        var parsed = JSON.parse(raw);
        var refined = (parsed.refinedText && String(parsed.refinedText).trim()) || text;
        var dl = hasDL ? addDL : (parsed.deadline && /^\d{4}-\d{2}-\d{2}$/.test(String(parsed.deadline)) ? parsed.deadline : null);
        var wk = (parsed.week && /^\d{4}-\d{2}-\d{2}$/.test(String(parsed.week)) ? parsed.week : null) || null;
        var typ = hasDL ? "deadline" : (parsed.type === "deadline" || dl ? "deadline" : "week");
        if (typ === "deadline") wk = null;
        if (typ === "week" && !wk) wk = null;

        var cat = CATEGORIES.find(function(c) { return c.id === parsed.category; });
        var pri = PRIORITIES.find(function(x) { return x.id === parsed.priority; });
        setTasks(function(prev) {
          return prev.map(function(t) {
            if (t.id !== id) return t;
            return Object.assign({}, t, {
              text: refined,
              category: (cat && cat.id) || t.category,
              priority: (pri && pri.id) || t.priority,
              type: typ,
              deadline: typ === "deadline" ? dl : null,
              week: typ === "week" ? wk : null,
            });
          });
        });
        var msg = (refined !== text ? "已提炼为：「" + refined + "」 · " : "") + (cat ? cat.emoji + " " + cat.label : "") + (pri ? " · " + pri.label : "") + (parsed.reason ? " — " + parsed.reason : "");
        setToast(msg);
      } catch (e) { /* parse error */ }
    }
    setClassifying(false);
  };

  function toggle(id) { setTasks(function(p) { return p.map(function(t) { return t.id === id ? Object.assign({}, t, { done: !t.done, doneAt: !t.done ? Date.now() : null }) : t; }); }); }
  function remove(id) { setTasks(function(p) { return p.filter(function(t) { return t.id !== id; }); }); }
  function update(id, u) { setTasks(function(p) { return p.map(function(t) { return t.id === id ? Object.assign({}, t, u) : t; }); }); }
  function moveToWeek(id, wk) { setTasks(function(p) { return p.map(function(t) { return t.id === id ? Object.assign({}, t, { week: wk }) : t; }); }); }
  function addSub(tid, text) { setTasks(function(p) { return p.map(function(t) { return t.id === tid ? Object.assign({}, t, { subtasks: (t.subtasks || []).concat([{ id: tid + "_" + Date.now(), text: text, done: false }]) }) : t; }); }); }
  function toggleSub(tid, sid) { setTasks(function(p) { return p.map(function(t) { return t.id === tid ? Object.assign({}, t, { subtasks: (t.subtasks || []).map(function(s) { return s.id === sid ? Object.assign({}, s, { done: !s.done }) : s; }) }) : t; }); }); }
  function removeSub(tid, sid) { setTasks(function(p) { return p.map(function(t) { return t.id === tid ? Object.assign({}, t, { subtasks: (t.subtasks || []).filter(function(s) { return s.id !== sid; }) }) : t; }); }); }

  function archiveOld() {
    var cutoff = Date.now() - 14 * 864e5;
    var archived = tasks.filter(function(t) { return t.done && t.doneAt && t.doneAt < cutoff; });
    if (archived.length === 0) { setToast("没有需要归档的任务（完成2周以上才会清理）"); return; }
    setTasks(function(p) { return p.filter(function(t) { return !(t.done && t.doneAt && t.doneAt < cutoff); }); });
    setToast("已归档 " + archived.length + " 个任务");
  }

  function exportJSON() {
    var data = JSON.stringify({ tasks: tasks, profile: profile, status: status, exportedAt: new Date().toISOString() }, null, 2);
    var blob = new Blob([data], { type: "application/json" });
    var url = URL.createObjectURL(blob);
    var a = document.createElement("a");
    a.href = url; a.download = "taskbrain-backup-" + new Date().toISOString().split("T")[0] + ".json";
    document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
    setToast("已导出备份文件"); setShowExport(false);
  }

  /* ── AI ── */
  function buildSummary() {
    var today = new Date().toISOString().split("T")[0];
    var lines = tasks.filter(function(t) { return !t.done; }).map(function(t) {
      var c = CATEGORIES.find(function(x) { return x.id === t.category; });
      var p = PRIORITIES.find(function(x) { return x.id === t.priority; });
      var time = t.type === "deadline" ? "截止:" + fmtDateWithWeekday(t.deadline) + "(还剩" + daysUntil(t.deadline) + "天)" : (t.week === CW ? "本周" : t.week ? getWeekLabel(t.week, CW) : "待安排");
      var subs = (t.subtasks || []).length > 0 ? " [子任务:" + t.subtasks.filter(function(s) { return s.done; }).length + "/" + t.subtasks.length + "]" : "";
      return "[" + (t.type === "deadline" ? "截止日" : "周") + "][" + (c ? c.label : "") + "][" + (p ? p.label : "") + "][" + time + "] " + t.text + subs;
    });
    return "今天=" + today + "，" + getWeekLabel(CW, CW) + "\n\n未完成(" + lines.length + "个):\n" + lines.join("\n");
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
      var c = CATEGORIES.find(function(x) { return x.id === t.category; });
      var p = PRIORITIES.find(function(x) { return x.id === t.priority; });
      return "id:" + t.id + " [" + (c ? c.label : "") + "][" + (p ? p.label : "") + "] " + t.text;
    }).join("\n");

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
    setTasks(function(p) { return p.map(function(t) { return ai.suggestions.find(function(s) { return s.taskId === t.id; }) ? Object.assign({}, t, { week: CW }) : t; }); });
    setAi(null);
  }

  /* ── Derived ── */
  var active = tasks.filter(function(t) { return !t.done; });
  var doneList = tasks.filter(function(t) { return t.done; });

  function sortP(list) {
    return list.slice().sort(function(a, b) {
      var pa = PRIORITIES.find(function(p) { return p.id === a.priority; });
      var pb = PRIORITIES.find(function(p) { return p.id === b.priority; });
      return (pb ? pb.weight : 0) - (pa ? pa.weight : 0);
    });
  }

  var twW = active.filter(function(t) { return t.type === "week" && t.week === CW; });
  var twDL = active.filter(function(t) { return t.type === "deadline" && dlWeek(t.deadline) === CW; });
  var backlog = active.filter(function(t) { return t.type === "week" && !t.week; });
  var allDL = active.filter(function(t) { return t.type === "deadline"; }).sort(function(a, b) { return daysUntil(a.deadline) - daysUntil(b.deadline); });

  var taskItemProps = {
    T: T, CC: CC, CW: CW, nw: nw, weekOpts: weekOpts,
    onToggle: toggle, onRemove: remove, onUpdate: update,
    onMoveWeek: moveToWeek, onAddSub: addSub, onToggleSub: toggleSub, onRemoveSub: removeSub,
  };

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
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
        <button onClick={exportJSON} style={{ padding: "8px 16px", border: "none", borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: FONT, background: T.accent, color: "#fff" }}>📦 导出JSON备份</button>
        <button onClick={archiveOld} style={{ padding: "8px 16px", border: "1px solid " + T.cardBorder, borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: FONT, background: "transparent", color: T.textSec }}>🗑 清理已完成(&gt;2周)</button>
      </div>
      <div>
        <div style={{ fontSize: 12, fontWeight: 600, color: T.textSec, marginBottom: 4 }}>🔑 DeepSeek API Key</div>
        <input
          type="password"
          defaultValue={getApiKey()}
          onChange={function(e) { setApiKey(e.target.value); }}
          placeholder="在此填入 DeepSeek API Key"
          style={{ width: "100%", padding: "8px 12px", background: T.inputBg, border: "1px solid " + T.inputBorder, borderRadius: 6, color: T.text, fontSize: 12, fontFamily: FONT, outline: "none", boxSizing: "border-box" }}
        />
        <div style={{ fontSize: 11, color: T.textMuted, marginTop: 4 }}>在 <a href="https://platform.deepseek.com/" target="_blank" rel="noopener noreferrer" style={{ color: T.accent }}>DeepSeek 开放平台</a> 创建 API Key 后填入即可使用 AI 功能</div>
      </div>
    </div>
  ) : null;

  var profileJSX = showProf ? (
    <div style={{ background: T.profBg, border: "1px solid " + T.profBorder, borderRadius: 12, padding: 18, marginBottom: 20 }}>
      {[
        { key: "company", label: "🏢 公司", hint: "公司、团队、业务" },
        { key: "personal", label: "👤 个人", hint: "背景、日常" },
        { key: "family", label: "👶 家庭", hint: "家庭状态" },
        { key: "invest", label: "💰 投资", hint: "持仓、策略" },
      ].map(function(f) {
        return (
          <div key={f.key} style={{ marginBottom: 12 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: T.text, marginBottom: 4 }}>{f.label}</div>
            <textarea value={profile[f.key] || ""} onChange={function(e) { setProfile(function(p) { var next = Object.assign({}, p); next[f.key] = e.target.value; return next; }); }} placeholder={f.hint}
              style={{ width: "100%", minHeight: 52, padding: 10, background: T.inputBg, border: "1px solid " + T.inputBorder, borderRadius: 8, fontSize: 13, color: T.text, fontFamily: FONT, outline: "none", resize: "vertical", lineHeight: 1.5, boxSizing: "border-box" }} />
          </div>
        );
      })}
      <div style={{ borderTop: "1px solid " + T.profBorder, paddingTop: 12, marginTop: 4 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: T.text, marginBottom: 4 }}>💭 当前状态</div>
        <textarea value={status} onChange={function(e) { setStatus(e.target.value); }}
          style={{ width: "100%", minHeight: 56, padding: 10, background: T.inputBg, border: "1px solid " + T.inputBorder, borderRadius: 8, fontSize: 13, color: T.text, fontFamily: FONT, outline: "none", resize: "vertical", lineHeight: 1.5, boxSizing: "border-box" }} />
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
        <button onClick={function() { if (input.trim()) addTask(input.trim()); }} disabled={!input.trim() || classifying}
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
            {(twW.length + twDL.length) === 0 && <Empty msg="本周没有任务，试试「本周规划」" />}
          </Section>

          {(function() {
            var future = {};
            active.filter(function(t) { return t.type === "week" && t.week && t.week !== CW; }).forEach(function(t) {
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
          {active.length === 0
            ? <Empty msg="暂无任务" />
            : CATEGORIES.map(function(cat) {
                var list = active.filter(function(t) { return t.category === cat.id; });
                if (!list.length) return null;
                var clr = CC[cat.id];
                return (
                  <Section T={T} key={cat.id} title={cat.emoji + " " + cat.label} count={list.length} accent={clr ? clr.color : undefined}>
                    {sortP(list).map(function(t) { return <TaskItem key={t.id} task={t} {...taskItemProps} />; })}
                  </Section>
                );
              })
          }
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
              {[{ id: "week", l: "📌 按周" }, { id: "deadline", l: "📅 截止日" }, { id: "category", l: "🏷 按分类" }].map(function(v) {
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

            {/* Icon Buttons */}
            <div style={{ display: "flex", gap: 6, marginBottom: 16 }}>
              <HeaderBtn onClick={function() { setShowProf(!showProf); }} active={showProf} T={T}>👤</HeaderBtn>
              <HeaderBtn onClick={function() { setShowExport(!showExport); }} active={showExport} T={T}>⚙️</HeaderBtn>
              <HeaderBtn onClick={function() { setDark(!dark); }} T={T}>{dark ? "☀️" : "🌙"}</HeaderBtn>
            </div>

            {settingsJSX}
            {profileJSX}
          </div>

          {/* ── MAIN CONTENT ── */}
          <div style={{ flex: 1, minWidth: 0 }}>
            {taskInputJSX}
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
                ].map(function(s) {
                  return (
                    <div key={s.l} style={{ padding: "12px 14px", background: T.card, borderRadius: 10, border: "1px solid " + (s.w ? "#FCA5A5" : T.cardBorder), boxShadow: T.shadow }}>
                      <div style={{ fontSize: 20, fontWeight: 700, color: s.a }}>{s.v}{s.w ? " ⚠️" : ""}</div>
                      <div style={{ fontSize: 11, color: T.textMuted, fontWeight: 500, marginTop: 2 }}>{s.l}</div>
                    </div>
                  );
                })}
              </div>
              <DistBar tasks={tasks} CW={CW} T={T} />
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
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 32 }}>
            <div>
              <h1 style={{ fontSize: 26, fontWeight: 700, color: T.text, margin: 0, letterSpacing: -0.5 }}>TaskBrain</h1>
              <span style={{ fontSize: 12, color: T.textMuted, fontWeight: 500 }}>
                {"本周 " + fmtShort(weekRange.mon) + "-" + fmtShort(weekRange.sun)}
              </span>
            </div>
            <div style={{ display: "flex", gap: 6 }}>
              <HeaderBtn onClick={function() { setShowProf(!showProf); }} active={showProf} T={T}>👤</HeaderBtn>
              <HeaderBtn onClick={function() { setShowExport(!showExport); }} active={showExport} T={T}>⚙️</HeaderBtn>
              <HeaderBtn onClick={function() { setDark(!dark); }} T={T}>{dark ? "☀️" : "🌙"}</HeaderBtn>
            </div>
          </div>

          {settingsJSX}
          {profileJSX}

          {taskInputJSX}

          {/* Stats */}
          <div style={{ display: "flex", gap: 10, marginBottom: 16, flexWrap: "wrap" }}>
            {[
              { l: "本周", v: twW.length + twDL.length, w: (twW.length + twDL.length) > 10, a: T.accent },
              { l: "待安排", v: backlog.length, a: T.textSec },
              { l: "截止日", v: allDL.length, a: "#DC2626", w: allDL.some(function(t) { return daysUntil(t.deadline) <= 3; }) },
              { l: "完成", v: doneList.length, a: "#10B981" },
            ].map(function(s) {
              return (
                <div key={s.l} style={{ flex: 1, minWidth: 70, padding: "12px 14px", background: T.card, borderRadius: 10, border: "1px solid " + (s.w ? "#FCA5A5" : T.cardBorder), boxShadow: T.shadow }}>
                  <div style={{ fontSize: 20, fontWeight: 700, color: s.a }}>{s.v}{s.w ? " ⚠️" : ""}</div>
                  <div style={{ fontSize: 11, color: T.textMuted, fontWeight: 500, marginTop: 2 }}>{s.l}</div>
                </div>
              );
            })}
          </div>

          <DistBar tasks={tasks} CW={CW} T={T} />

          {/* AI Buttons */}
          <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
            <button onClick={diagnose} style={{ flex: 1, padding: "11px 0", background: T.card, border: "1px solid " + T.cardBorder, borderRadius: 10, fontSize: 13, fontWeight: 600, color: T.text, cursor: "pointer", fontFamily: FONT, boxShadow: T.shadow }}>🧠 一键诊断</button>
            <button onClick={planWeek} style={{ flex: 1, padding: "11px 0", background: T.card, border: "1px solid " + T.cardBorder, borderRadius: 10, fontSize: 13, fontWeight: 600, color: T.text, cursor: "pointer", fontFamily: FONT, boxShadow: T.shadow }}>📋 本周规划</button>
          </div>

          {aiPanelJSX}

          {/* View Tabs */}
          <div style={{ display: "flex", gap: 2, marginBottom: 20, background: T.tabBg, borderRadius: 10, padding: 3 }}>
            {[{ id: "week", l: "按周" }, { id: "deadline", l: "📅 截止日" }, { id: "category", l: "按分类" }].map(function(v) {
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

      {toast && <Toast message={toast} T={T} onDone={function() { setToast(null); }} />}
    </div>
  );
}
