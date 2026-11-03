# 项目架构说明（Vue 3 + Vite + TypeScript + Tailwind CSS 4）

> 原生的模块化 ES Module 实现已重构为 Vue 3 组合式 API + Vite + TypeScript + Tailwind CSS 4。
> 旧版 `js/` 目录已移除（历史实现可从 git 记录中查阅）。

## 技术栈

- **Vue 3**（`<script setup>` + 组合式 API）
- **Vite 8**（`@vitejs/plugin-vue`、`@tailwindcss/vite`）
- **TypeScript 6**（严格模式，`vue-tsc` 类型检查）
- **Tailwind CSS 4**（通过 `@tailwindcss/vite` 插件，无需 PostCSS）
- **包管理**：pnpm（锁定 `pnpm-lock.yaml`）

## 项目结构

```
src/
├── main.ts                      # 应用入口，挂载 #app，引入样式
├── App.vue                      # 布局骨架（头部 / 两栏内容区 / Toast），根节点 .app-shell
├── config.ts                    # 全局常量 CONFIG 与初始状态 createInitialState
├── style.css                    # Tailwind 入口（@import "tailwindcss"）
│
├── types/index.ts               # 领域类型（Book / Unit / Lyric / 状态等）
│
├── utils/
│   ├── helpers.ts               # clamp / throttle / debounce / formatTime
│   ├── escape.ts                # escapeHtml（XSS 防护）
│   ├── storage.ts               # localStorage 读写 + 进度记忆
│   └── lrc.ts                   # LRCParser（含课号标题行过滤、非负时间钳制）
│
├── managers/CacheManager.ts     # 泛型 LRU 缓存
│
├── services/
│   ├── book.ts                  # 课本目录与单册数据加载（AbortController 竞态处理）
│   └── prefetch.ts              # 相邻单元预取（代际标记 + 在途去重）
│
├── composables/
│   ├── useTheme.ts              # 明暗主题单例（body.dark-theme + theme-color）
│   └── useToast.ts              # 轻提示单例
│
├── stores/reading.ts            # 核心协调器：课本/单元/歌词/播放/偏好（模块级单例）
└── components/
    ├── UnitList.vue             # 左侧课文列表
    ├── PlayerControls.vue       # 播放控制条 + <audio> + 进度条
    ├── LyricsPanel.vue          # 双语歌词面板（高亮/点读/滚动）
    ├── ThemeToggle.vue          # 主题切换按钮
    └── Toast.vue                # 轻提示渲染
```

## 状态管理

不引入 Pinia，采用**模块级 `reactive` 单例**（`stores/reading.ts` 的 `createEngine()`，通过 `useReading()` 暴露）：

- `state`：课本、单元、歌词、循环模式、倍速、翻译模式等响应式数据；
- `currentTime` / `duration` / `paused` / `audioDisabled` / `progressPercent`：音频联动状态；
- 音频元素与进度条通过 `setAudioRef` / `setProgressRef` 绑定（模板函数式 ref）。

## 资源与构建

- `vite.config.ts`：`base: '/nce/'`（GitHub Pages 项目站点子路径）、`publicDir: 'static'`。
- `static/` 作为公共资源目录，构建时整体拷贝到 `dist/` 根：音频（`NCE1~4/*.mp3`）、歌词（`*.lrc`）、封面、图标、`data.json`、`book.json`、截图等。
- 课本目录 `data.json` 通过 `${import.meta.env.BASE_URL}data.json` 请求，兼容子路径部署。
- `scripts/generate-book-json.cjs`：构建前（`prebuild`）由 mp3/lrc 就地生成各册 `book.json`（纯 Node 内置模块）。
- 构建脚本：`pnpm build` = `vue-tsc -b && vite build`，产物输出到 `dist/`。

## 已知坑（URL 编码与 Vite 开发服务器）

`services/book.ts` 的 `encodeSegment()` 对文件名做 `encodeURIComponent` 后，**必须把 `%26`（`&`）与 `%2C`（`,`）还原为原样字符**：

- Vite 开发服务器无法从 publicDir 提供含 `%26` / `%2C` 的路径，会回退返回 `index.html`（200 + text/html），`<audio>` 收到 HTML 即报"音频加载失败"。
- `&` 与 `,` 在 URL 路径中本身合法，原样保留对开发服务器、`vite preview` 与 GitHub Pages 均安全。
- 文件名含这两类字符的课文（NCE1 的 `001&002－Excuse Me.mp3` 等含 `&` 课、含 `,` 的 9 课）曾因此整体不可播。
- 另一个布局坑：Vue 挂载容器的 `id` 不能与组件模板根节点重复（`#app` 嵌套 + `margin: 0 auto` 会使 flex 子项失去 stretch，整页收缩为内容宽度）。根节点使用 `.app-shell`。

## 部署

- `.github/workflows/deploy.yml`：推送 `main` 时用 pnpm 安装依赖 → 构建 → 上传 `dist/` 到 GitHub Pages。
