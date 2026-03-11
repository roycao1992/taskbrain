#!/usr/bin/env node
/**
 * 输出建表 SQL，复制到 Supabase 控制台 → SQL Editor 执行即可。
 * 用法：node scripts/run-migration.js
 */

import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const sql = readFileSync(join(__dirname, "..", "supabase", "migrations", "001_user_data.sql"), "utf8");

console.log("请复制以下整段 SQL，到 Supabase 控制台 → SQL Editor 粘贴并点击 Run：\n");
console.log(sql);
