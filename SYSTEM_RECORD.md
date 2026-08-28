# 六合彩特码预测系统 — 功能记录文档

> 本文档随最新代码维护，反映当前（动态预测架构）的真实状态。

## 一、项目概述

- **名称**: 六合彩特码预测系统
- **版本**: 1.0.0
- **框架**: React 19 + TypeScript 5.9 + Vite 6.3 + Electron 33 + Tailwind CSS 4.1
- **打包**: electron-builder 25（Win NSIS/Portable）
- **输出目录**: `release34/`

---

## 二、导航标签与功能

| 标签 | 组件 | 功能说明 |
|------|------|---------|
| **数据总览** | `<Dashboard>` | 统计概览、开奖数据汇总 |
| **动态预测** | `<DynamicPrediction>` | 算法池 → 类型 → 融合推荐 + 回测 + 一键推送（核心页） |
| **历史数据** | `<History>` | 开奖记录表格、筛选、增删改管理 + 爬虫面板 |
| **统计分析** | `<Analysis>` | 马尔可夫分析、走势分析 |
| **系统配置** | `<Config>` | 系统设置、生肖映射、年份设置 |

> 旧「智能预测（分离预测）」页面已在大改造中删除，当前唯一预测入口为 **动态预测**。

---

## 三、状态管理与存储（Store / localStorage）

| Store / 存储 | 文件名 | 管理内容 |
|-------|--------|---------|
| DataContext | `stores/DataContext.tsx` | 开奖数据 `DrawRecord[]`，同步/增删改/重置 |
| MappingContext | `stores/MappingContext.tsx` | 生肖/波色/五行映射、年份动态生肖 |
| ModelLibraryContext | `stores/ModelLibraryContext.tsx` | **14 个通用算法的统一模型库**（全局启用开关） |
| `lottery_dynamic_types` | localStorage | 动态预测各类型的配置（含每类型的 `selectedAlgorithms` 勾选与权重） |
| `lottery_dynamic_records` | localStorage | 预测记录（按日期降序展示） |
| `lottery_backtest_history` | localStorage | 回测历史（最多 50 条，见 4.6） |

### 统一模型库（src/models/dynamic）
- 全系统（前端预测 / 自动发送脚本）共用**同一套 14 个通用算法**，单一数据源
- 通用算法可预测**任意分类类型**（号码/生肖/头/尾/五行/自定义），按类型参数化
- 旧分区模型（`src/models/{number,zodiac,head,tail,element}` 专用模型）、`src/models/library.ts`、各 `Separated*` / `ModelContext` / `FunnelContext` 等均已删除

---

## 四、动态预测详解（DynamicPrediction）

### 4.1 算法池（14 个通用算法）
| ID | 名称 | 类型 |
|----|------|------|
| `hot` | 热度 | 频率统计（指数衰减） |
| `cold` | 遗漏 | 冷号分析 |
| `cycle` | 周期 | 周期规律 |
| `markov` | 马尔科夫 | 状态转移概率 |
| `ma` | 移动平均 | 加权平均趋势 |
| `condProb` | 条件概率 | 条件概率分析 |
| `bayes` | 贝叶斯 | 贝叶斯推断 |
| `apriori` | Apriori | 关联规则挖掘 |
| `rf` | 随机森林 | 集成学习（模拟） |
| `xgboost` | XGBoost | 梯度提升（模拟） |
| `lstm` | LSTM | 序列记忆（模拟） |
| `genetic` | 遗传算法 | 进化优化（模拟） |
| `rl` | 强化学习 | Q-Learning（模拟） |
| `bandit` | 多臂老虎机 | 探索-利用平衡 |

> **数据使用**：频率/先验类（hot/condProb/bayes/apriori/bandit）用**全量历史 + 指数衰减**（decay=0.98，半衰期≈34 期）；cold/cycle 全量扫描；rf/xgboost 最近 300 期抽样；genetic/rl 最近 200 期；ma/lstm/markov 维持原窗口（30/60/全量）。
> 每类型内部对已勾选算法用 `{id, weight}` 加权融合，权重和归一化后生效。

### 4.2 内置预测类型
前端内置：`number`(号码49) / `tail`(尾数10) / `head`(头数5) / `element`(五行5) / `zodiac`(生肖12) / `color`(波色3，用户自加)。
脚本端内置（`defaultTypes()`）：`number/tail/head/element/zodiac` 5 个（不含波色/单双/大小）。

### 4.3 自定义预测类型
- 可添加自定义类型：自定义名称 + 分类 +
号码映射（支持范围 `1-24` 与列举 `01,03,05`）
- 创建后可用「编辑号码映射」修改；类型可整体启停、删除

### 4.4 核心预测流程
1. 各类型勾选算法、调权重 → 点「开始预测」
2. `runPrediction`：用**当前本地数据直接计算**（不触发爬虫）
3. 每类型：各算法对分类打分 → 按权重(归一化)融合 → 排序 TOP N（`computeTopN = resultCount`）
4. 各类型 TOP N 分类映射到号码 → 加权融合 49 码 → 输出推荐号码 + 各类型分类概率
5. 无「综合推荐」单独块，直接展示每类型 TOP N 与每号概率条

### 4.5 命中统计与自动调权
- **命中统计**：已保存的预测逐类型按实际开奖匹配验证（号码/生肖/尾数/头数/五行等全部类型），显示命中率条
- **自动调权**：每累积 **5 次预测**自动触发；权重基于**样本外评估**（`evaluateAlgorithmsSampleOut`，recent 30 期逐期滚动，训练只用该期之前数据）统计真实命中归一化；按类型独立开关 `autoWeight`
- 预测 `typeHits` 自评为样本外（用最后一期之前数据重训）

### 4.6 回测（N+N 全部子集穷举）
入口：动态预测顶部「回测」按钮弹出回测面板。

流程（`src/engine/backtest.ts` 的 `runExhaustiveBacktest`）：
1. **候选池 = 全部门已启用算法**（14 个，与该类型当前勾选无关）
2. **预计算**：寻优窗口内每期 × 每候选算法，只算一次类别概率分布
3. **N+N 穷举**：遍历全部 **2^n − 1** 个非空算法子集，以**等权融合**的样本内 TopN 命中数为准则，取**全局最优**子集（不再用贪心）
4. **权重精调**：对最优子集做网格（小组合）/随机搜索（含 0 权重自动剔除）
5. **样本外盲测**：`blindN` 期逐期重算分布验证；输出盲测命中率与逐期明细
6. **一键应用 = 整体替换**：选中的类型仅保留胜出算法及其权重（`applyWeightsToType` 用函数式 state 更新，支持一次性应用到全部类型）

UI：结果卡显示「入选 X/Y 算法」徽章、「候选模型单独命中」明细（胜出高亮）、样本内/盲测命中；运行中显示三阶段进度条（预计算 → 穷举 → 精调/盲测）。

> **历史记录**：每次回测自动保存（每类型一条，最多 50 条，本地持久化），可在「记录」列表中单条删除 / 清空全部；每条可「应用到该类型」整体替换。

### 4.7 一键推送（前端 → 自动发送脚本仓库）
- 顶部「一键推送」，将当前**全部启用的预测类型**（含自定义）序列化为 `scripts/predictor/config.json`
- Electron 主进程写入仓库路径下 `scripts/predictor/config.json`（`DEFAULT_SCRIPT_REPO_PATH='D:\\ailiuhecai\\lottery-system'`），并 git **只提交该文件** → commit → push
- 脚本启动时 `require('./config.json')` 覆盖 `EFFECTIVE_TYPES`；已运行脚本需重启生效

---

## 五、生肖 / 五行动态映射

关键修复：不再用固定基准年（旧 2024=龙年是硬编码错误基准），改为**按记录日期动态映射**。

| 内容 | 规则 | 位置 |
|------|------|------|
| 生肖年份 | 按**立春/农历年**（`getLunarZodiacYear(date)`，立春精确到分钟） | `lunarCalendar.ts` / `constants.cjs` |
| 生肖号码映射 | `getYearZodiacMapping(lunarYear)`，当年生肖对应 1,13,25,37,49 | 同上 |
| 单号→生肖 | `getZodiacByNumber(num,年份)`（已修复 pre-lichun bug：用立春年而非公历年） | `lunarCalendar.ts` |
| 记录级生肖 | `getZodiacByRecord(record)`：`getZodiacByNumber(record.special, 立春年)` | 前端 mapper / 脚本 |
| 五行 | 按**开奖日历年** `YEAR_ELEMENTS[year]` 逐年映射 | `constants/element.ts` / `constants.cjs` |
| 马尔可夫分析 | 生肖用 `getZodiacByNumber`（立春）、五行用 `getElement(n, year)` | `utils/markov.ts` |

前端 `getTypeMapper`（日期感知）+ 目标期动态范围；脚本端 per-record 映射 + `effectiveRanges(type, targetDate)` 动态生成生肖/五行目标期号码范围。

---

## 六、自动发送脚本（scripts/predictor，Node CJS）

由前端「一键推送」的 `config.json` 完全驱动（任意类型：号码/生肖/头/尾/五行/自定义），**不再有分类型专用模型**。

| 文件 | 作用 |
|------|------|
| `constants.cjs` | 生肖/五行/立春库、`defaultTypes()`、`buildTypeMapper`、读取 `config.json` 得 `EFFECTIVE_TYPES`/`FINAL_COUNT` |
| `models.cjs` | `runGenericAlgo(algoId,...)`（14 个通用算法实现，与前端一致）+ `simulateTypeModel(id,type,...)` 按类型参数化调用 |
| `predictor.cjs` | `fuseModels` 按权重融合各类型；`computeAdaptiveWeights`（**每 10 期**逐期样本外评估命中 → softmax → 权重复位）；`runPrediction` → 每类型 TopN + 综合 49 码 |
| `fetcher.cjs` | 抓取开奖数据（数据不足 100 期则失败并通知） |
| `notifier.cjs` | 多渠道推送：Telegram / Bark / 钉钉 / 飞书 / 企业微信（环境变量配置）；`formatMessage` 与本地格式一致 |
| `index.cjs` | 主入口：取数 → 预测 → 控制台输出 → 推送 |

脚本内置默认类型 `number(30)/tail(8)/head(4)/element(4)/zodiac(9)`；配置中的类别/号码范围由前端推送生成，生肖/五行在脚本端仍按记录日期动态映射。

---

## 七、数据同步与爬虫

- `sync.ts`：优先后端 `http://localhost:3001/api/data/export`，后端不可用降级网页爬虫（多源 123720c / 澳门六合彩 / 1688188），启动自动同步一次
- `crawler.ts`：多源 URL 尝试、重试+退避、HTML 解析、增量更新
- `History` 页含「爬虫」子页（`CrawlerPanel`）：配置 URL、手动触发、进度显示

---

## 八、Electron 主进程（electron.cjs）

- 生产模式：内置 HTTP 服务器（端口 3001），API `/api/health` `/api/config` `/api/crawler/start` `/api/crawler/fetch` `/api/crawler/status/:id` `/api/crawler/tasks` `/api/data/export`；窗口 1200x800，`contextIsolation: true`
- 开发模式：`NODE_ENV=development` spawn `npm run dev:backend`，前端加载 `http://localhost:5173`
- 提供「一键推送」：写 `scripts/predictor/config.json` + git 提交推送指定单文件

---

## 九、最近修改记录

| 修改 | 说明 |
|------|------|
| **大改造：删智能预测** | 删除分离预测/SeparatedPrediction*/ModelContext/FunnelContext/PredictionHistoryContext/library.ts 等，唯一入口为动态预测 |
| **统一 14 通用算法** | 全系统共用 `ALGO_FACTORIES`/`PREDEFINED_ALGOS`，支持任意分类类型参数化 |
| **生肖/五行动态映射** | 前端日期感知 mapper + 脚本 per-record 映射 + `getZodiacByNumber` pre-lichun 修复 + 马尔可夫动态映射 |
| **去综合推荐** | 前端/脚本都不再输出「综合推荐」块，直接展示各类型 TOP N |
| **预测按日期降序** | `displayRecords` 按 date 降序展示 |
| **回测重建 + 全候选** | `runTypeBacktest` 候选 = 全部已启用算法（与该类型勾选无关） |
| **回测 N+N 穷举** | 改为遍历 2^n−1 全部子集等权寻优全局最优 + 权重精调 + 三阶段进度条（本次） |
| **回测历史记录** | 每次回测自动保存（50 条上限），支持应用/删除/清空 |
| **回测全部应用修复** | `applyWeightsToType` 改函数式 state 更新，修复批量仅最后一个类型生效的 bug |
| **TopN 跟随 resultCount** | `computeTopN = min(max(1,resultCount), categories.length)` |

---

## 十、构建与部署

### 构建命令
```bash
npm run build:frontend    # Vite 构建前端 → dist/
npm run build:backend     # 构建后端
npm run build             # 前后端同时构建
npm run build:app         # 构建前端 + electron-builder 打包
npm run electron:build    # 完整构建 + 打包
```
> 常用：`vite build` 成功后 `electron-builder --config electron-builder.json`（本仓库的打包方式）

### 输出产物（release34/）
| 文件 | 说明 |
|------|------|
| `六合彩特码预测系统 Setup 1.0.0.exe` | NSIS 安装包 |
| `六合彩特码预测系统 1.0.0.exe` | 便携版（单 exe，推荐） |
| `win-unpacked/` | 解压版（调试用） |

---

## 附：当前待办 / 已知事项
- 本地已有多个功能提交（贪心→穷举回测、回测记录、全部应用修复等）**尚未推送远端**（`origin/master`）——远端推送需等网络恢复 / 按约定通知后再执行
- `config.json` 中存在若干 `selectedAlgorithms` 条目有 weight 无 id 的旧残留数据，脚本 `constants.cjs` 会 `.filter(sa => sa && sa.id)` 过滤，不影响运行；前端重新一键推送后会覆盖为干净数据
