# X-Creator-Studio · 独立创作者智能运营工作台 (v2.0)

[![Next.js](https://img.shields.io/badge/Next.js-15-black?logo=next.js)](https://nextjs.org/)
[![React](https://img.shields.io/badge/React-19-blue?logo=react)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.8-blue?logo=typescript)](https://www.typescriptlang.org/)
[![Compliance](https://img.shields.io/badge/X%20Compliance-Level%203%20Guard-cyan)](https://help.x.com/en/rules-and-policies)

面向 **X (Twitter)** 独立创作者的生产级自媒体内容知识库、多层原创性检测、真实联网情报雷达与合规批量图文创作工作台。任何创作者均可绑定自己的 X 账号并在私有持久化环境中沉淀长期创作资产。

---

## 核心原则

- **零虚构数据**：无真实导入数据时明确展示“未导入状态”，绝不预置私人账号数据或虚构互动指标。
- **零虚假联网 / 零假图**：未配置搜索、文本或生图 API 时明确提示状态，允许人工上传真实图片并执行感知哈希查重，绝不返回伪造数据或硬编码占位图。
- **隐私与密钥安全**：所有 API Key 仅存储在服务端 `.env.local`，本地 SQLite 数据库文件（`data/*.db`）默认被 `.gitignore` 忽略，禁止提交至公开仓库。
- **人工确认与平台合规**：默认关闭全自动批量发帖，所有高风险违规内容被合规引擎拦截，仅允许经人工复核确认后的合规导出与发布。

---

## 核心能力模块

### 1. 长期个人创作知识库与知识图谱
- **多格式导入**：支持 X 归档 JSON、Analytics CSV / Excel（`.xlsx`）、多篇纯文本（`---` 分隔）与手动录入。
- **严格幂等去重**：通过 `(creator_handle, post_id)` 联合唯一约束与 `SHA-256` 正文哈希防重，重复导入自动跳过。
- **知识图谱与内容盲区**：自动提取分类占比、核心观点簇、引用案例与内容盲区，并输出可继续深入的选题建议。
- **备份与管理**：支持导出 JSON / CSV 备份文件及删除记录。

### 2. 多层原创性检测实验室
- **SHA-256 精确哈希**：秒级识别完全重复文本。
- **SimHash + 语义实体骨架**：识别同义词替换、语序调整与核心论点高度雷同的改写内容。
- **同批次交叉查重**：防止同批次生成的多个槽位选题撞车。
- **图像感知差异哈希（dHash）**：64 位亮度梯度指纹比对（汉明距离 <= 5 告警），防止重复使用相似配图。
- **结构化破局建议**：发现重复风险时输出具体新切入角度，而非简单同义词替换。

### 3. 真实联网搜索雷达
- **内置真实信源**：GitHub Repositories API、Hacker News Algolia API、官方技术 RSS（GitHub Blog / OpenAI News / ArXiv AI）。
- **可扩展付费/官方信源**：支持 `TAVILY_API_KEY`、`SERPER_API_KEY`，并预留 `XAI_API_KEY` 与 X 官方 API 通道；未配置时明确提示未配置。
- **可信度评估与交叉验证**：每条结果保留原始链接、来源、发布时间与抓取时间，多信源佐证自动加权。

### 4. 批量图文创作工厂
- **批次规模**：支持 1 / 5 / 10 / 20 组独立选题与内容流水线。
- **模型解耦**：文本模型（`LLM_API_KEY` / `LLM_BASE_URL` / `LLM_MODEL`）与生图模型（`IMAGE_API_KEY` / `IMAGE_BASE_URL` / `IMAGE_MODEL`）分别配置。
- **全流程管控**：支持单条重试、文案编辑保存（自动重跑原创性+合规复检）、本地上传真实配图、任务暂停/恢复、Token 与成本统计以及人工确认后导出 X Web Intent。

### 5. 法律与平台规则审核引擎 (Compliance Engine)
- 覆盖隐私泄露、欺诈/误导性营销、诽谤骚扰、版权肖像提醒、平台垃圾信息与 X 自动化规则（参考 `https://help.x.com/en/rules-and-policies` 与 `https://help.x.com/en/rules-and-policies/x-automation`）。
- 3 级裁决：`PASS`（通过）、`FLAGGED`（需人工复核，不承诺绝对合规）、`BLOCKED`（高风险严禁发布）。
- 支持通过接口与页面动态维护规则知识库。

---

## 本地开发与云端部署

### 1. 安装依赖与配置环境
```bash
npm install
cp .env.example .env.local
```
在 `.env.local` 中按需配置服务端密钥（禁止将 `.env.local` 提交到 Git 仓库）。

### 2. 类型检查、测试与构建
```bash
npm run typecheck
npm run test
npm run build
npm run start
```

### 3. 云端持久化部署建议
- **数据库持久化**：本项目使用 Node.js 22+ 原生 `node:sqlite`（WAL 模式）。请勿依赖 Vercel 等无状态 Serverless 平台的临时目录作为正式知识库；推荐部署在支持持久卷（Persistent Volume）的容器环境（如 Railway、Fly.io、Render、Docker VPS），并将 `DATABASE_PATH` 指向持久化挂载卷（例如 `/data/x-creator.db`）。
- **密钥隔离**：所有大模型、生图、搜索与 X 凭证必须通过云平台 Secrets/Environment Variables 注入服务端。
