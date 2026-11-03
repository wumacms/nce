#!/usr/bin/env node
/**
 * 扫描 static 下的各册目录，生成本地化的 book.json
 *
 * 规则：
 * - filename 取本地文件名去掉扩展名（与本地 mp3/lrc 实际命名严格一致）
 * - title 截去编号前缀（如 "001&002－" / "01－"），并优先从 lrc 头部提取中文标题，
 *   拼成 "英文｜中文" 双语标题；lrc 无标题行时回退到 scripts/title-zh.json 词典
 * - mp3 与 lrc 必须成对存在，缺失即报错退出
 * - 可选参数 --expect N：校验单元数量（如 NCE1 期望 72）
 *
 * 用法：node scripts/generate-book-json.js [NCE1 NCE2 ...]
 */
const fs = require('fs');
const path = require('path');

const STATIC_DIR = path.resolve(__dirname, '..', 'static');
const TITLE_ZH_PATH = path.resolve(__dirname, 'title-zh.json');

/** 人工补充的中文标题词典（key: "册/英文标题"，仅兜底 lrc 中无标题行的情况） */
const TITLE_ZH = fs.existsSync(TITLE_ZH_PATH)
  ? JSON.parse(fs.readFileSync(TITLE_ZH_PATH, 'utf8'))
  : {};

/** 各册元数据（取自远程 book.json）与期望单元数 */
const BOOK_META = {
  NCE1: { name: 'NCE', level: '1st Level', cover: 'NCE1.jpg', expect: 72 },
  NCE2: { name: 'NCE', level: '2nd Level', cover: 'NCE2.jpg', expect: 96 },
  NCE3: { name: 'NCE', level: '3rd Level', cover: 'NCE3.jpg', expect: 60 },
  NCE4: { name: 'NCE', level: '4th Level', cover: 'NCE4.jpg', expect: 48 },
};

/** 截去文件名中的编号前缀："001&002－Excuse Me" -> "Excuse Me" */
function extractTitle(filename) {
  const stripped = filename.replace(/^\d+(?:&\d+)?[－\-—_.]+\s*/, '');
  return stripped || filename;
}

/** 归一化用于标题匹配：忽略大小写、标点与空白 */
function normalizeTitle(s) {
  return s.toLowerCase().replace(/[^a-z0-9\u4e00-\u9fff]/g, '');
}

/**
 * 从 lrc 头部提取中文标题：匹配 "英文标题|中文标题" 行
 * 兼容行首时间戳（如 "[00:02.71]Excuse me!|打扰一下！"）
 */
function extractZhFromLrc(lrcPath, enTitle) {
  const lines = fs.readFileSync(lrcPath, 'utf8').split('\n').slice(0, 12);
  for (const line of lines) {
    const stripped = line.replace(/^\[[^\]]*\]/, '').trim();
    const idx = stripped.indexOf('|');
    if (idx < 1) continue;
    const left = stripped.slice(0, idx).trim();
    const right = stripped.slice(idx + 1).trim();
    if (/[\u4e00-\u9fff]/.test(right) && normalizeTitle(left) === normalizeTitle(enTitle)) {
      return right;
    }
  }
  return null;
}

/** 生成双语标题：优先 lrc 提取，回退词典，均无则保留英文并计入缺失 */
function buildBilingualTitle(bookKey, enTitle, lrcPath, misses) {
  const zh = extractZhFromLrc(lrcPath, enTitle) ?? TITLE_ZH[`${bookKey}/${enTitle}`];
  if (zh) return `${enTitle}｜${zh}`;
  misses.push(enTitle);
  return enTitle;
}

function generate(bookKey) {
  const meta = BOOK_META[bookKey];
  if (!meta) {
    throw new Error(`未知课本: ${bookKey}（请在 BOOK_META 中补充元数据）`);
  }

  const bookDir = path.join(STATIC_DIR, bookKey);
  if (!fs.existsSync(bookDir)) {
    throw new Error(`目录不存在: ${bookDir}`);
  }

  const files = fs.readdirSync(bookDir).filter((f) => f.endsWith('.mp3'));
  const units = [];
  const errors = [];
  const misses = [];

  for (const mp3 of files.sort()) {
    const filename = mp3.replace(/\.mp3$/, '');
    const lrc = `${filename}.lrc`;
    const lrcPath = path.join(bookDir, lrc);

    if (!fs.existsSync(lrcPath)) {
      errors.push(`缺少歌词文件: ${bookKey}/${lrc}`);
      continue;
    }

    units.push({
      title: buildBilingualTitle(bookKey, extractTitle(filename), lrcPath, misses),
      filename,
    });
  }

  if (errors.length) {
    throw new Error(`${bookKey} 校验失败:\n  - ${errors.join('\n  - ')}`);
  }

  if (meta.expect && units.length !== meta.expect) {
    throw new Error(
      `${bookKey} 单元数不符: 期望 ${meta.expect}，实际 ${units.length}`
    );
  }

  const bookJson = {
    name: meta.name,
    level: meta.level,
    cover: meta.cover,
    units,
  };

  const outPath = path.join(bookDir, 'book.json');
  fs.writeFileSync(outPath, JSON.stringify(bookJson, null, 2) + '\n', 'utf8');
  console.log(`[OK] ${bookKey}: ${units.length} 单元 -> ${outPath}`);
  if (misses.length) {
    console.warn(
      `[WARN] ${bookKey} 有 ${misses.length} 条未取到中文标题（已保留英文，可补充到 scripts/title-zh.json）:\n  - ${misses.join('\n  - ')}`
    );
  }
}

const targets = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const books = targets.length ? targets : Object.keys(BOOK_META);

for (const book of books) {
  try {
    generate(book);
  } catch (err) {
    console.error(`[FAIL] ${err.message}`);
    process.exitCode = 1;
  }
}
