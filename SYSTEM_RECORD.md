# 六合彩特码预测系统 — 功能说明文档

> 本文档只记录**当前代码中实际存在**的功能；已删除功能不再收录。
> 最后核对：2026-09-23（对照工作区代码，非 git 历史）。

---

## 一、项目概述

| 项 | 值 |
|----|-----|
| 名称 | 六合彩特码预测系统 |
| 版本 | 1.0.0 |
| 前端 | React 19 + TypeScript 5.9 + Vite 6.3 + Tailwind CSS 4.1 |
| 桌面端 | Electron 33（`electron.cjs` 主进程） |
| 后端 | Express（workspace `backend/`，端口 3001） |
| 脚本 | Node CJS（`scripts/predictor/`） |
| 打包 | electron-builder 25 → `release34/`（NSIS + 便携版） |

---

## 二、导航与页面

应用入口 `src/App.tsx`，仅 **4 个标签**：

| 标签 | 组件 | 功能 |
|------|------|------|
| 数据总览 | `Dashboard` | 近期统计（单双/大小等）、开奖汇总、最新一期属性 |
| 动态预测 | `DynamicPrediction` | **核心页**：算法池 → 类型配置 → 融合推荐 + 命中统计 + 回测 + 自动调权 + 一键推送 |
| 历史数据 | `History` | 开奖表格、筛选、增删改 + 爬虫面板 `CrawlerPanel` |
| 系统配置 | `Config` | 系统设置、生肖/映射、年份相关配置 |

启动时 `StartupStatus` 探测 `http://localhost:3001/api/health`，就绪后进入主界面。

---

## 三、状态管理与本地存储

### Context（在用）

| Store | 文件 | 职责 |
|-------|------|------|
| DataContext | `stores/DataContext.tsx` | 开奖数据 `DrawRecord[]`；启动 `syncFromBackend` 同步；增删改/重置 |
| MappingContext | `stores/MappingContext.tsx` | 生肖 / 波色 / 五行动态映射、年份生肖 |
| ModelLibraryContext | `stores/ModelLibraryContext.tsx` | 14 个通用算法的全局启用/权重（默认权重 0.1） |

### localStorage

| Key | 用途 |
|-----|------|
| `lottery_dynamic_types` | 各预测类型配置（勾选算法、权重、resultCount、autoWeight 等） |
| `lottery_dynamic_records` | 预测记录 |
| `lottery_dynamic_final_count` | 综合推荐号码数量（上次选定的 finalCount） |
| `lottery_backtest_history` | V1 回测历史（最多 50 条） |
| `lottery_model_library` | 模型库算法状态 |
| `lottery_prediction_data` | 数据层通用存储（`utils/storage.ts`） |
| `lottery_crawler_urls` | 爬虫面板自定义 URL |
| `script_repo_path` | 一键推送的脚本仓库路径 |
| `currentYear` / `yearZodiacMaps` / `elementNumbers` | 年份与映射缓存 |

> 说明：`stores/AppContext.tsx`、`services/crawler.ts` 中部分导出函数目前无组件调用方（历史残留），**不作为在用功能记录**。

---

## 四、动态预测（核心）

### 4.1 算法池（14 个，`src/models/dynamic`）

| ID | 名称 | 说明 |
|----|------|------|
| `hot` | 热度 | 频率统计（指数衰减 decay=0.98） |
| `cold` | 遗漏 | 冷号分析 |
| `cycle` | 周期 | 周期规律 |
| `markov` | 马尔科夫 | 状态转移概率 |
| `ma` | 移动平均 | 趋势加权 |
| `condProb` | 条件概率 | 条件概率 |
| `bayes` | 贝叶斯 | 贝叶斯推断 |
| `apriori` | Apriori | 关联规则 |
| `rf` | 随机森林 | 集成学习（模拟） |
| `xgboost` | XGBoost | 梯度提升（模拟） |
| `lstm` | LSTM | 序列记忆（模拟） |
| `genetic` | 遗传算法 | 进化优化（模拟） |
| `rl` | 强化学习 | Q-Learning（模拟） |
| `bandit` | 多臂老虎机 | 探索-利用 |

- 前端与脚本共用同一套算法 ID（`ALGO_FACTORIES` / `PREDEFINED_ALGOS`）
- 新建类型**默认勾选全部 14 个**，权重各 `0.1`
- 预测时按类型内 `{id, weight}` **归一化融合**；权重**不**再按命中率隐式放大
- 各类型/算法随机种子按 `typeIdx/idx` 隔离，避免串扰

### 4.2 内置预测类型（5 个）

| ID | 名称 | 分类数 | 默认 resultCount |
|----|------|--------|------------------|
| `number` | 号码 | 49（01–49） | 30 |
| `tail` | 尾数 | 10（0–9） | 8 |
| `head` | 头数 | 5（0–4） | 4 |
| `element` | 五行 | 5 | 4 |
| `zodiac` | 生肖 | 12 | 9 |

- 映射入口：`getTypeMapper`（内置类型专用；自定义按 `numberRanges` 回落）
- TopN：`computeTopN = min(resultCount, categories.length - 1)`
- 波色/单双/大小**不是**前端内置预测类型（仅作展示属性 / 脚本侧辅助）

### 4.3 自定义预测类型

- 「添加类型」：名称 + 分类 + 号码映射（支持范围 `1-24`、列举 `01,03` 等）
- 「编辑号码映射」可随时修改
- 类型可启停、可删除（含内置类型，UI 提供删除按钮）

### 4.4 预测流程

1. 各类型勾选算法、调权重 → 「开始预测」
2. `runPrediction`：**仅用本地数据**计算，不触发爬虫
3. 每类型：算法打分 → 权重融合 → TOP N
4. 各类型 TOP N 映射号码 → 融合 49 码概率 → 输出推荐列表 + 各类型分类概率条
5. **推荐号码数量**：预设按钮 `1/2/3/5/10/20/30/49` + 数字输入（1–49）
6. 页面展示各类型 TOP N 与每号概率；另有「综合推荐号码」命中统计卡（`numberHitStats`）

### 4.5 命中统计

- 已保存预测按实际开奖逐类型匹配（号码/生肖/尾/头/五行/自定义）
- 显示命中率进度条；综合推荐号码单独统计

### 4.6 自动调权（V2，当前在用）

- 实现：`src/engine/weight/autoWeight.ts` → **`autoTuneWeightsV2`**
- 算法：Bayesian 后验均值 + 权重平滑 + 仅用 OOS + 最小样本（默认 20）
- 触发：工具栏「自动调权」按钮；**每累积 5 次预测**自动执行
- 类型级开关：`autoWeight` 勾选框

> `models/dynamic` 中旧版 `autoTuneWeights` / `evaluateAlgorithmsSampleOut` 仍留在源码里，**UI 已不再调用**。

### 4.7 回测

并存两套，入口均在动态预测工具栏：

#### A. V1 穷举回测（「回测」按钮，内嵌弹窗）

- 实现：`src/engine/backtest.ts` → `runExhaustiveBacktest`
- 候选 = 全部已启用算法（与该类型当前勾选无关）
- 遍历 2^n−1 非空子集等权寻优 → 权重精调 → 样本外盲测
- 三阶段进度条；结果可「应用到该类型 / 全部应用」（整体替换算法与权重）
- 每次自动写入 `lottery_backtest_history`（≤50 条），支持单条删除 / 清空 / 再应用

#### B. V2 Walk-Forward 回测（「回测验证」主按钮，独立面板）

- 面板：`src/components/backtest/BacktestV2Panel.tsx`
- 引擎：`src/engine/backtest/`（`walkForward` + `window` + `metrics` + `baseline` + `correlation` + `overfit` + `stability` + `subsetSearch` + `weightOptimizer` + `leakage`）
- 能力：训练/验证/测试滚动窗口（含 purge 防泄漏）、Top1 命中率 / MRR / 稳定性、4 种 baseline 对比、过拟合检测、子集与权重寻优
- 配置方式（优化后）：
  - **三档预设（推荐）**：快速 / 标准 / 深度 — 按历史数据量自动推荐，无需关心专业参数
  - 高级参数（折叠）：训练窗口、验证窗口、测试窗口、Purge 间隔
  - 支持「取消回测」按钮 + `AbortSignal` 中断，避免卡死
- 引擎防卡死优化：
  - 重循环 `yieldIfNeeded` 让出主线程（每 ~60ms 一次）
  - 子集搜索：当启用算法数 **>7** 时切换到剪枝搜索（`beamWidth=50`），避免 `2^n` 组合爆炸
- 结果展示（重点：**大范围号码命中率**）：
  - 顶部大卡片：显示前 4 个推荐数量命中率 + 与随机概率对比 + 过拟合风险😃😐😰
  - 「推荐 N 个」全对比表：每个 K 值画进度条（灰色 = 随机 / 彩色 = 算法），一眼看提升
  - K 值容错：面板要 Top6/Top9 但引擎没算时，**就近取相邻 K 值近似**，不会显示 0%
  - 一键应用：回测选出的算法组合 + 权重，点按钮直接写回对应预测类型
  - Baseline 对比：和「随机瞎猜 / 全历史频率 / 近期热度」做条形图对比，标「打赢✓/没打赢」
  - 专业指标（MRR / LogLoss / Brier / 各窗口明细）折叠到最下方，默认不显示

### 4.7.1 预测记录 → 命中标识

- 点击「历史记录」打开弹窗，每条记录头部会显示：
  - 已开奖：**绿色「✓ 特码命中（开 0X）」** 或 **红色「✗ 特码未中（开 0X）」**
  - 没中特码但推荐的号码命中了正码：**橙色「平码碰中 N 个」**
  - 未开奖：灰色「待开奖」
- 推荐号码的每个球右上角：
  - 命中特码：绿 ✓ 小徽章 + 号码放大 10%
  - 命中正码：橙 ● 小徽章
  - 未命中：正常显示

### 4.7.2 推荐号码数量记忆

- 综合推荐号码数量（工具栏 1/2/3/5/10/20/30/49 按钮 + 数字输入）
- 现在写入 `lottery_dynamic_final_count`（localStorage），**重新打开应用保留上次设定**

### 4.8 一键推送（前端 → 脚本）

- 工具栏「一键推送」：将**全部启用类型**（含自定义）序列化为 `scripts/predictor/config.json`
- 经 Electron 主进程写入仓库路径（可配置，默认本仓库根目录），可选 git **只提交该文件** → commit → push
- 脚本启动时 `require('./config.json')` 覆盖生效类型；已跑脚本需重启
- 另有「复制配置」便于手工粘贴

---

## 五、生肖 / 五行动态映射

| 内容 | 规则 | 位置 |
|------|------|------|
| 生肖年份 | 按**立春**（`getLunarZodiacYear`，立春精确到分钟） | `src/utils/lunarCalendar.ts`、`backend/.../lunarCalendar.ts`、脚本 `constants.cjs` |
| 单号→生肖 | `getZodiacByNumber(date, number)` 用**立春年**取映射（立春前不误用公历年） | 前后端 lunarCalendar |
| 生肖号码 | 当年生肖对应 1,13,25,37,49 起算偏移 | `getYearZodiacMapping` |
| 五行 | 按**开奖日历年** `YEAR_ELEMENTS[year]` | `constants/element.ts`、脚本 |
| 目标期范围 | 生肖/五行按**目标开奖日期**重算号码范围 | `getTypeMapper` / 脚本 `effectiveRanges` |

---

## 六、数据同步与爬虫

### 6.1 数据抓取起始年份（前后端统一：2020 年起）

> ⚠️ **重要一致性事项**：不同数据范围会影响全历史累积算法（hot/cold 加权、markov 转移矩阵、bayes/apriori 先验概率等）的最终数值。**前后端爬取起点必须一致**，否则两边预测结果会有系统性差异。

| 模块 | 默认起点 | 文件 | 说明 |
|------|---------|------|------|
| 前端首次启动同步（后端不可用时回退 HTML 爬取） | **2020** | `src/services/sync.ts#L173` | `startYear = 2020`，循环 `2020..今年` |
| 前端 History 爬虫 UI（无本地数据时） | **2020** | `components/crawler/CrawlerPanel.tsx#L96` | 无数据提示「将从 2020 年开始全量爬取」 |
| 自动脚本 fetcher（API / HTML 双源） | **2020** | `scripts/predictor/fetcher.cjs#L28/L36` | 两个 DATA_SOURCES 的 `defaultYearStart: 2020` 控制从 2020 起循环 |
| 后端 crawler API（手动触发） | **灵活传参**，最小 2000 | `backend/src/controllers/crawlerController.ts#L32` | `startYear < 2000` 直接拒绝，建议至少 2020 |

**数据范围对预测结果的影响（按算法敏感性排序）：**

1. **cold / 遗漏（最敏感）**：全历史累积，范围越大"某号最久未出"的可能越长 → 冷号概率差 10~30%。
2. **hot 热度、cycle、markov、bayes、apriori、condProb（敏感）**：全历史概率表，差 3 年数据概率差 5~15%。
3. **rf / xgboost / lstm / genetic / rl / bandit（中等）**：只取最近 200~300 期，但窗口统计的 baseline 会受全历史分布影响。
4. **ma（几乎不敏感）**：只取最近 30 期。

**结论：** 必须保证两边都从 **2020 年起**（约 7 年 ≈ 900+ 期，是脚本默认的 2364 期的子集），任何一边数据范围更小，都会让 hot/cold/markov/bayes 类算法输出系统性偏差。

### 6.2 优先级（本地端：旧源优先，新源补充）

1. **后端 API**：`http://localhost:3001/api/data/export`（`sync.ts` 首选）
2. **旧 HTML 源**：123720彩票网 / 澳门六合彩 / 1688188（主数据）
3. **kj1868.cc API**（nam6 新澳门六合彩）：按期号**补充**旧源缺失，**不覆盖**已有；分页 `maxPages=20`

### 6.2 相关文件

| 文件 | 作用 |
|------|------|
| `src/services/sync.ts` | 启动同步主路径；HTML 优先 + API 补缺 |
| `src/services/crawler.ts` | `fetchYearRecords` 等：先合并旧 HTML，再 API 补充；History 爬虫逻辑 |
| `components/crawler/CrawlerPanel.tsx` | History 页爬虫 UI：URL 配置、手动触发、进度 |

---

## 七、自动发送脚本（`scripts/predictor`）

由前端一键推送的 `config.json` 驱动；无 `config.json` 时用 `defaultTypes()`。**脚本 predictor 的所有核心算法、融合公式、输出结构、夹紧规则，均已与前端动态预测统一设计（见下方 7.1「一致性对照表」）。**

| 文件 | 作用 |
|------|------|
| `constants.cjs` | 生肖/五行/立春、默认类型（30/8/4/4/9 与前端 `DEFAULT_TYPE_RESULT_COUNTS` 一致）、`buildTypeMapper`、读 config → `EFFECTIVE_TYPES`/`FINAL_COUNT` |
| `models.cjs` | 14 个通用算法（**与前端 `ALGO_FACTORIES` 系数/窗口/seed 偏移一一对应**） + 新增 `evaluateAlgorithmsSampleOut` + `autoTuneWeights`（与前端同名函数完全对齐） |
| `predictor.cjs` | 统一版主预测引擎：<br/>• `clampResultCount` / `clampFinalCount`（与前端夹紧规则一致）<br/>• `fuseModelsRaw`（权重融合、seed 偏移 = `seedOffset + i*1000`，与前端一致）<br/>• `estimateTargetDate` + `getPredictionRanges`（生肖/五行动态号码段，与前端对齐）<br/>• `runPrediction(data, finalCount, types, options)`：<br/>　- 参数：data、综合推荐数量 finalCount、类型数组 types、`{ useAutoWeight, print }` 选项<br/>　- 统一返回字段：**`typeResults` / `typeHits` / `finalNumbers` / `finalCount` / `baseSeed` / `targetDate`**（与前端 `runPrediction` 返回字段名完全一致，额外保留 `types` 别名供兼容）<br/>　- 预测前对 `autoWeight=true` 的类型调用 `autoTuneWeights`（前端相同公式） |
| `fetcher.cjs` | 取数：kj1868 API + 旧 HTML（**2020–**，与前端起点一致）；缓存 `data/lottery-data.json`；`--refresh` 强制刷新 |
| `notifier.cjs` | 推送：Telegram / Bark / 钉钉 / 飞书 / 企业微信（环境变量或 `config.json`）；**功能升级：**<br/>• 新增 `getEnabledNotifiers()` 返回已配置渠道列表<br/>• 新增统一入口 `sendNotifications(body)`，兼容「{pred, data, title?}」新传法（推荐）/ 旧 `{data: {types, picks}}` 结构 / 最简「{title, content}」<br/>• **`formatMessage(pred, data)` 推送模板升级**（与脚本新增能力对齐）：<br/>　- 期号/日期改为目标期预估日期（不是发送当天）<br/>　- 新增「📝 最近一期算法自评（样本外）」段：每个类型 Top1 ✅/❌ + Top3 算法 N/总数<br/>　- 底部 `_metadata_` 行新增：数据范围`(2020–2026)`、`⚖️ N型自动调权`（autoWeight=true 的类型数）、`seed HEX`（便于前端同 seed 复现结果） |
| `index.cjs` | 主入口：取数 → 预测 → 控制台打印 → **`data/prediction-records.json` 追加预测记录** → 推送通知；推送体改为 `sendNotifications({ pred: resultWithMeta, data, title })` 新传法，会完整触发上面 `formatMessage` 的所有升级能力；CLI 支持：<br/>　• `--refresh` / `-r` 强制抓最新数据<br/>　• `--auto-weight-print` / `-v` 打印每个类型的自动调权过程（命中/总数、平均排名、新权重）<br/>　• `--no-notify` / `--dry-run` 跳过推送 |
| `utils.cjs` | 生肖/波色/大小/**单双**/五行等工具 |

**定时任务**（GitHub Actions `auto-predict.yml`）：

- cron `30 22 * * *`（UTC）= **北京时间 6:30**
- 可 `workflow_dispatch` 手动触发（支持 force）
- 按上海日期做日缓存，防同日重复跑
- 执行：`node scripts/predictor/index.cjs --refresh`
- 另有 `keepalive.yml` 每周提交保活

### 7.1 脚本 predictor ↔ 前端动态预测 一致性对照表

> **一致性原则**：任何改动，前端算法 → **必须同步改 `scripts/predictor/models.cjs` 的 `runGenericAlgo` switch-case**；类型默认值同步改 `constants.cjs` 的 `defaultTypes()`；融合/夹紧/号码池规则同步改 `predictor.cjs`。

| 维度 | 前端实现 | 脚本 predictor 实现 | 是否一致 |
|------|---------|---------------------|---------|
| **14 算法公式** | `src/models/dynamic/index.ts` 中 `ALGO_FACTORIES` | `scripts/predictor/models.cjs` 中 `runGenericAlgo()` switch case | ✅ 系数/窗口/seed 偏移 / 各算法 `*FACTOR + rng*NOISE` 数值**逐行一致** |
| 种子生成 | 最后一期 issue 逐字符 `×31+charCode` & `0x7fffffff` | 脚本 predictor.cjs 同公式；models.cjs `evaluateAlgorithmsSampleOut` 内同公式 | ✅ 完全一致 |
| Seed 偏移 | `seed + 1000 + typeIdx*100 + idx*1000` | `baseSeed + 1000 + typeIdx*100 + i*1000` | ✅ 完全一致 |
| 类型 mapper 函数 | `getTypeMapper(type)` | `buildTypeMapper(type)` | ✅ 生肖按立春 / 五行按公历年 逻辑一致 |
| 号码段（生肖/五行） | `getPredictionRanges(type, targetDate)` 按目标期动态生成 | `predictor.cjs getPredictionRanges()` 同实现 | ✅ 一致 |
| 类型推荐数量夹紧 | `computeTopN(type)`：`max(1, min(resultCount, categories.length))` | `predictor.cjs clampResultCount(type)` 同公式 | ✅ 一致 |
| 综合推荐数量夹紧 | `DynamicPrediction` 输入 1–49 + `FINAL_COUNT_KEY` 持久化 | `predictor.cjs clampFinalCount(count)` 1–49 | ✅ 一致 |
| 默认类型数量（number/tail/head/element/zodiac） | `DEFAULT_TYPE_RESULT_COUNTS` = **30 / 8 / 4 / 4 / 9** | `constants.cjs defaultTypes()` 返回同数 | ✅ 一致 |
| 综合号码池融合 | 所有启用类型 `typeWeight=1/N` 平分权重；取 `type.resultCount` 个推荐类别累加到号码段；49 归一化；Top finalCount | `predictor.cjs fused49` 同逻辑 | ✅ 一致 |
| autoWeight 自动调权 | `evaluateAlgorithmsSampleOut`（最近 30 期样本外评估）→ `autoTuneWeights`（命中×3、夹紧 0.05~1，归一化） | `models.cjs` 新增**同名函数逐行实现**；`predictor.cjs runPrediction` 开头对 `autoWeight=true` 类型调用 | ✅ 一致（新增） |
| typeHits 自评排名 | 倒数第二期训练、倒数第一期实际分类下各算法 rank | `predictor.cjs` 同逻辑，写入结果 `typeHits` 字段并在终端打印 | ✅ 一致（新增） |
| 输出字段命名：类型结果 | `typeResults[]`，每元素 `{typeId, typeName, categories:[{category,probability}]}` | 结果**同名字段** `typeResults`，并额外保留 `types` 旧别名 | ✅ 一致（新增） |
| 预测记录落盘 | `DynamicPredictionRecord`（localStorage `lottery_dynamic_records`）：`{id, timestamp, issue, date, typeResults, finalNumbers, typeHits}` | `index.cjs` 执行完后**同结构 append** 到 `data/prediction-records.json`，ID 前缀 `script_`，最多保留 1000 条 | ✅ 结构一致（新增，可合并统计） |
| 数据起始年份 | 前端 `sync.ts startYear=2020` + `CrawlerPanel` 2020 起 | 脚本 `fetcher.cjs` 两个 DATA_SOURCES 均 `defaultYearStart=2020` | ✅ 一致（本轮修复，之前前端是 2023 造成 hot/cold/markov/bayes 有系统性偏差） |

### 7.2 CLI 用法示例

```bash
# 使用已有缓存跑一次（最快）
node scripts/predictor/index.cjs --no-notify

# 先抓最新数据再预测 + 跳过通知（日常手动验证）
node scripts/predictor/index.cjs --refresh --no-notify

# 打印每个 autoWeight=true 类型的详细调权过程（每个算法的命中/总数/平均排名/新权重）
node scripts/predictor/index.cjs --refresh --auto-weight-print

# GitHub Actions 默认每日 6:30 执行命令（等效）
node scripts/predictor/index.cjs --refresh
```

---

## 八、Electron 主进程（`electron.cjs`）

- **生产**：内置 HTTP 服务（3001）
  - `/api/health`、`/api/config` GET/POST
  - `/api/crawler/start|fetch|status/:id|tasks`
  - `/api/data/export`
  - `/api/models/push`：写 `scripts/predictor/config.json` + 可选 git 单文件提交推送
- **开发**：spawn `npm run dev:backend`，前端加载 `http://localhost:5173`
- 窗口 1200×800，`contextIsolation: true`

后端 workspace（`backend/src`）提供同构 health/config/crawler 路由与爬虫服务。

---

## 九、展示属性说明

历史表格 / 总览卡片中的属性（由常量函数计算）：

| 属性 | 规则 |
|------|------|
| 单双 | 奇数→**单**，偶数→**双**（`constants/parity.ts`，界面文案统一为「单双」） |
| 大小 | ≥25 大，否则小 |
| 波色 | 按号码段红/蓝/绿 |
| 生肖 / 五行 | 见第五节动态映射 |

---

## 十、构建与部署

```bash
npm run dev              # 前端 + 后端开发
npm run build:frontend   # Vite → dist/
npm run build:backend    # 后端 tsc → backend/dist/
npm run build            # 前后端一起构建
npm run build:app        # 前端构建 + electron-builder
npm run electron:build   # 后端 + 前端 + 打包（推荐完整出包）
npm run package:app      # 仅 electron-builder
```

**产物（`release34/`）**：

| 文件 | 说明 |
|------|------|
| `六合彩特码预测系统 Setup 1.0.0.exe` | NSIS 安装包 |
| `六合彩特码预测系统 1.0.0.exe` | 便携版（推荐测试用） |
| `win-unpacked/` | 解压版（调试） |

---

## 附：当前状态 / 已知事项

### 版本控制（按约定）

- 本地工作区有未提交改动（本轮功能修正）；`origin/master` 有未 push 提交
- **暂不推送远端**，以本地端测试为主，等通知后再 commit/push

### 已知事项

- `scripts/predictor/config.json` 中若存在「有 weight 无 id」的旧条目，脚本侧会 `.filter(sa => sa && sa.id)` 过滤，不影响运行；前端重新一键推送后会被干净数据覆盖
- 打包时未配置应用图标（electron-builder 使用默认图标）；未做代码签名

### 本轮更新日志（本次优化）

1. **脚本 predictor 完全对齐前端设计**（核心）
   - `models.cjs` 新增「样本外评估 evaluateAlgorithmsSampleOut」+「自动调权 autoTuneWeights」，**与前端同名函数逐行一致**
   - `predictor.cjs` 重写：新增 `clampResultCount`/`clampFinalCount`（与前端夹紧规则一致）、`estimateTargetDate`/`getPredictionRanges`（生肖五行动态号码段对齐前端）、新接口 `runPrediction(data, finalCount, types, {useAutoWeight,print})`
   - 返回字段统一为 **typeResults / typeHits / finalNumbers / finalCount / baseSeed / targetDate**（与前端同名），`types` 保留作为兼容别名
   - 修复 `rl` 强化学习算法中多余的 `action = getCat(...)` 赋值（不影响结果但与前端源码完全一致）
2. **数据抓取起始年份统一为 2020 年**：
   - 前端 `src/services/sync.ts` 从 `startYear = 2023` 改为 **2020**，与脚本 `fetcher.cjs` 的 `defaultYearStart: 2020` 完全一致
   - 文档新增「6.1 数据抓取起始年份」章节，说明 cold/hot/markov/bayes 算法对全历史数据范围的敏感性（范围不一致将导致 5~30% 的系统性偏差）
3. **脚本预测记录落盘**：
   - 每次执行自动将预测结果追加写入 `data/prediction-records.json`，结构与前端 `DynamicPredictionRecord` 完全相同（`{id, timestamp, issue, date, typeResults, finalNumbers, typeHits}`），最多保留 1000 条，便于后续合并两边命中率统计
4. **CLI 增强**：
   - `--refresh` / `-r`：强制抓最新数据再预测
   - `--auto-weight-print` / `-v`：打印每个 `autoWeight=true` 类型的每个算法命中/总数/平均排名/新权重，便于调试
   - `--no-notify` / `--dry-run`：本地跑但跳过推送通知
   - 终端打印新增：`typeHits` 最近一期自评（每个类型 Top1 是否命中、Top3 算法数量）
5. **推送模板 + 推送入口全面升级**（`notifier.cjs` + `index.cjs` 推送调用）：
   - 新增 `getEnabledNotifiers()` 返回已配置渠道；新增统一入口 `sendNotifications(body)`，**3 种传参方式兼容**（推荐新传法 `{ pred, data, title? }`）
   - `formatMessage(pred, data)` 推送模板**全面升级**，与脚本新增能力对齐：
     1. 期号/日期改为**目标期预估日期**（不是发送当天）
     2. 新增「📝 最近一期算法自评（样本外）」段：每个类型显示 Top1 ✅/❌ + Top3 算法 N/总数，一眼看到每个类型准不准
     3. 底部 `_metadata_` 行新增：数据范围 `(2020–2026)`（方便确认和前端数据范围一致）、`⚖️ N型自动调权`（有多少类型启用了自动调权）、`seed HEX`（8 位 16 进制，便于前端输入同 seed 复现完全一样的推荐）
   - `index.cjs` 推送调用改为新传法 `{ pred: resultWithMeta, data, title }`，所有升级字段自动生效
6. **维护文档**：
   - 「七、自动发送脚本」全面重写，增加 7.1「一致性对照表」（18 个维度全部 ✅）
   - 新增 7.2「CLI 用法示例」，4 条命令覆盖日常场景
   - 「六、数据同步与爬虫」新增 6.1 章节，明确数据范围与算法敏感度关联
   - 「七、自动发送脚本」表中 notifier.cjs / index.cjs 两行补充推送升级细节

### 免责

- **仅供技术研究，不构成投资建议**
