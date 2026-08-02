# 六合彩特码预测系统 — 功能记录文档

## 一、项目概述

- **名称**: 六合彩特码预测系统
- **版本**: 1.0.0
- **框架**: React 19 + TypeScript 5.9 + Vite 6.3 + Electron 33 + Tailwind CSS 4.1
- **打包**: electron-builder 25（Win NSIS/Portable, Mac DMG, Linux AppImage/deb）
- **输出目录**: `release34/`

---

## 二、导航标签与功能

| 标签 | 组件 | 功能说明 |
|------|------|---------|
| **数据总览** | `<Dashboard>` | 统计概览、开奖数据汇总 |
| **智能预测** | `<SeparatedPredictionPanel>` | 经典分离预测（号码+生肖独立模型，漏斗推理引擎） |
| **动态预测** | `<DynamicPrediction>` | 动态组建算法 → 自定义类型 → 多维度融合推荐 |
| **历史数据** | `<History>` | 开奖记录表格、筛选、增删改管理 |
| **统计分析** | `<Analysis>` | 趋势分析、马尔可夫链分析 |
| **系统配置** | `<Config>` | 爬虫配置、数据源管理、模型参数、系统设置 |

---

## 三、状态管理（Store）

| Store | 文件名 | 管理内容 |
|-------|--------|---------|
| DataContext | `stores/DataContext.tsx` | 开奖数据 `DrawRecord[]`，提供同步/增删改/重置 |
| MappingContext | `stores/MappingContext.tsx` | 生肖/波色/五行映射，年份动态生肖 |
| ModelContext | `stores/ModelContext.tsx` | 8 个基础模型配置（启用/权重） |
| FunnelContext | `stores/FunnelContext.tsx` | 漏斗推理三层参数配置 |
| PredictionHistoryContext | `stores/PredictionHistoryContext.tsx` | 预测历史记录（上限 50 条） |
| SeparatedModelContext | `stores/SeparatedModelContext.tsx` | **分离预测模型配置（5 类型各维护「已选模型」列表，可增删/调权重，从统一模型库获取）** |
| **ModelLibraryContext** | `stores/ModelLibraryContext.tsx` | **动态预测算法库**（14 个通用算法池） |

### 统一模型库（models/library.ts）
- 全系统（智能预测 / 动态预测 / 自动发送脚本）共用**同一套模型元数据与解析函数**，单一数据源，消除多份重复实现
- 由 **14 个通用算法**（`hot,cold,cycle,markov,ma,condProb,bayes,apriori,rf,xgboost,lstm,genetic,rl,bandit`）组成，**不含任何专用模型**
- 通用算法可预测任意分类类型（号码/生肖/头/尾/五行），按类型参数化（号码自动转 49 维）
- 所有专用模型已全部移除：`zodiac_combo, head_combo, tail_combo, element_combo, resnet, color_markov, element_markov, size_markov, parity_markov`
- 去重规则：与通用算法概念重复的专用模型（生肖/头/尾/五行的 freq/markov/trend/pattern/resnet/lstm/bayes/condProb 等）全部移除；号码 5 个纯随机占位已删除（lstm/xgboost 由通用算法提供真实实现）
- `resolveUnifiedModelFn(type, id)`：仅支持 14 个通用算法，未知模型抛 `未知模型: ${id} (${type})`
- 旧的 `separatedModelResolver.ts` 与 `models/registry`（41 个模型的注册表）已删除，不再使用

---

## 四、动态预测详解（DynamicPrediction）

### 4.1 算法池（14 个）
| ID | 名称 | 类型 |
|----|------|------|
| `hot` | 热度 | 频率统计 |
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

> **数据使用**：频率/先验类（hot/condProb/bayes/apriori/bandit）用**全量历史 + 指数衰减**（decay=0.98，半衰期≈34 期，越近权重越高）；cold/cycle 全量扫描；rf/xgboost 最近 300 期自助抽样；genetic/rl 最近 200 期；ma/lstm/markov 维持原窗口（30/60+10/全量）。

### 4.2 内置预测类型（6 个）
| ID | 名称 | 分类数 | 说明 |
|----|------|--------|------|
| `number` | 号码类 | 49 | 逐个号码预测 |
| `tail` | 尾数类 | 10 | 0-9 尾数 |
| `head` | 头数类 | 5 | 0-4 头数 |
| `element` | 五行类 | 5 | 金木水火土 |
| `zodiac` | 生肖类 | 12 | 鼠牛虎兔龙蛇马羊猴鸡狗猪 |
| `color` | 波色类 | 3 | 红波、蓝波、绿波 |

### 4.3 自定义预测类型
- 用户可添加自定义类型（自定义名称 + 分类 + 号码映射）
- 号码映射支持范围格式（如 `1-24`）和逗号列举（如 `01,03,05`）
- 创建后可通过"编辑号码映射"修改

### 4.4 核心流程
1. 用户配置预测类型 → 选择算法 → 设置权重
2. 点击"开始预测" → 使用当前本地数据直接计算（**不触发爬虫**）
3. 各算法对各分类打分 → 按权重融合 → 归一化 → 排序 TOP N
4. 各类型 TOP N 分类映射到对应号码 → 加权融合 → 49 码概率排序
5. 输出推荐号码（带概率排名） + 各类型分类概率（条形图）

### 4.5 自动调权
- 每累积 **5 次预测**自动触发一次权重调整
- 权重基于**样本外评估**（`evaluateAlgorithmsSampleOut`）：对最近 30 期逐期滚动，训练只用评估期之前的数据，统计各算法真实命中率 → 归一化为权重
- 可手动点击"自动调权"按钮触发
- 按类型独立调权（每类型有独立 `autoWeight` 开关）
- 每次预测的 `typeHits` 自评同样为**样本外**（用最后一期之前的数据重新训练评估，不再用当期数据自测）

### 4.7 统一模型库联动
- 动态预测的算法池（14 个）与智能预测的通用算法**完全一致**，共用 `models/dynamic` 的 `ALGO_FACTORIES` / `PREDEFINED_ALGOS`
- 智能预测/动态预测/自动发送脚本三端共用同一套模型 id、名称、算法实现

### 4.6 文本版结果
- 纯文本格式，一键复制分享
- 格式：期号/日期 → 各类型分类排序 → 推荐号码列表
- 不显示概率，简洁可读

---

## 五、智能预测（经典分离预测）

### 5.1 统一模型库（来自 models/library.ts）
每个类型可用的模型 = **14 个通用算法（全类型可用）**，不再有专用模型：

| 类型 | 可用模型 |
|------|---------|
| 号码 | hot,cold,cycle,markov,ma,condProb,bayes,apriori,rf,xgboost,lstm,genetic,rl,bandit |
| 生肖 | 同上 14 个通用算法 |
| 头数 | 同上 14 个通用算法 |
| 尾数 | 同上 14 个通用算法 |
| 五行 | 同上 14 个通用算法 |

> 曾保留 9 个专用模型（zodiac_combo/head_combo/tail_combo/element_combo/resnet/color_markov/element_markov/size_markov/parity_markov），本次大改已**全部删除**，仅保留统一算法库。

### 5.2 默认选择
- 各类型**默认不选任何模型**（`buildDefaultSelections` 返回空数组），需用户自行勾选后预测
- 修复：从 localStorage 加载历史选择时按当前模型库过滤失效 id（避免 `未知模型: hot_trend` 崩溃）

### 5.6 模型来源（从统一模型库动态获取）
- 所有模型类型（号码/生肖/头/尾/五行）从**统一模型库**（`models/library.ts`）动态获取
- 通用算法打「通用」标签（`isGeneric`），专用模型按 `specificTypes` 归类
- 各类型**自由添加/删除模型**（参考动态预测的算法池交互）

### 5.7 设置面板（自由添加/删除模型）
- 5 种模型类型各一个卡片，只展示**已选模型**（名称 + 描述 + 权重输入 + 移除按钮）
- 「添加/管理模型」按钮 → 弹出模型库选择器（勾选添加、取消移除）
- 自动权重优化开关（仅号码/生肖生效）
- 重置为默认、清空历史
- 「复制配置」「推送配置到脚本」按钮（见 5.10）

### 5.8 回测调优（只回测已选模型 + 样本外盲测）
- 支持 5 种目标类型：号码/生肖/头数/尾数/五行
- **只对当前已选模型**搜索最优权重组合
- 网格搜索（≤9 模型）或随机搜索（≥10 模型）
- 异步分块执行，不阻塞 UI（每 0.5% 组合 yield）
- 进度条实时显示
- **屏蔽期数（样本外盲测）**：可设置屏蔽最近 N 期（默认 5 期），被屏蔽期**完全不参与权重寻优**，仅用于验证最优权重，输出**盲测命中率**（反映真实泛化能力，避免权重过拟合训练区间）
- **保存最近 50 条回测记录**（类型/权重/命中率/盲测命中率/期数/时间戳），每条含**盲测逐期明细**（期数/预测TopN/实际开奖/命中）
- 结果面板显示**寻优窗口期号范围**（如最新 213 期、回测 10、屏蔽 5 → 寻优 199~208）与**盲测窗口期号范围**（209~213）
- 历史记录中可一键「应用」权重到当前设置
- 通过更换模型 + 对比命中率，判断各类型哪些模型更合适

### 5.3 命中统计
- 已保存的预测按 `predictIssue` 匹配实际开奖记录，自动统计号码/生肖命中率
- 当前记录显示该期实际号码/生肖是否命中（待开奖则标注「该期尚未开奖」）
- 顶部汇总条：预测总数 / 已开奖 / 待开奖 / 号码命中率 / 生肖命中率

### 5.9 漏斗推理引擎
- 三层漏斗串联：号码预测 → 分类预测 → 综合排序
- 可配置各层参数（保留比例、权重等）

### 5.10 推送到自动发送脚本
- 控制面板顶部「**一键推送**」快捷按钮（绿色），直接按已保存的仓库路径执行推送，无需进入设置面板、无需重复输入路径
- 设置面板「推送配置到脚本」：将当前 5 个类型的已选模型 + 权重打包，POST 到后端 `/api/models/push`
- Electron 主进程将配置写入 `scripts/predictor/config.json`（开发模式直接写仓库；打包版写失败时可用「复制配置」手动保存）
- `scripts/predictor/constants.cjs` 启动时读取 `config.json`，若存在则用推送的模型替换 `EFFECTIVE_NUMBER_MODELS`/`EFFECTIVE_ZODIAC_MODELS`/`HEAD_MODELS`/`TAIL_MODELS`/`ELEMENT_MODELS`
- `scripts/predictor/predictor.cjs` 的 `fuseModels` 支持带权重的 `{id, weight}` 对象（头/尾/五行），号码/生肖用 `EFFECTIVE_*` 列表
- **每 10 期自动调权**：脚本对全部 5 个预测类型（号码/生肖/头/尾/五行）使用 `computeAdaptiveWeights`，对**最近 10 期**逐期样本外评估（训练只用该期之前数据），统计每个模型 TopN 是否命中 → softmax 放大命中率 → 归一化为权重；数据不足 10 期时回退为推送/默认权重。命中 TopN：号码 30 / 生肖 9 / 头 4 / 尾 8 / 五行 4
- **注意**：config.json 在脚本启动时读取（require 缓存），已在运行的脚本需重启才生效；脚本需从该仓库运行（或服务器端 `git pull` 后再运行）；某类型未选任何模型时脚本回退到默认（14 个通用算法），不会同步为"无模型"

---

## 六、数据同步服务

### 6.1 `sync.ts` — 数据同步
- 优先从后端 `http://localhost:3001/api/data/export` 获取
- 后端不可用时降级到网页爬虫
- 网页爬虫从多源（123720c.com、澳门六合彩、1688188.com）抓取，逐年从 2023 年开始
- 启动时自动同步一次（`useRef` 防重复）

### 6.2 `crawler.ts` — 网页爬虫
- 支持多数据源 URL 格式尝试
- 请求重试（最多 3 次）+ 退避策略
- HTML 解析：兼容 `kj-tit/kj-box` 块结构和全局球元素扫描
- 增量更新：只爬取本地最新日期之后的数据

---

## 七、其他组件

| 组件 | 功能 |
|------|------|
| `CrawlerPanel` | 爬虫控制面板（配置 URL、手动触发爬取、进度显示） |
| `NumberBall` | 号码球 UI 组件（支持 xs/sm 尺寸） |
| `StartupStatus` | 启动等待界面（后端健康检查 10 次尝试） |
| `Config` | 系统配置页（数据源、模型参数、爬虫参数） |
| `Analysis` | 统计页（趋势/马尔可夫分析） |
| `History` | 历史数据管理（表格/筛选/增删改） |
| `Evaluation` | 模型评估 |

---

## 八、Electron 主进程（electron.cjs）

### 生产模式
- 内置 HTTP 服务器（端口 3001）
- API 路由：`/api/health`, `/api/config`, `/api/crawler/start`, `/api/crawler/fetch`, `/api/crawler/status/:id`, `/api/crawler/tasks`, `/api/data/export`
- 窗口 1200x800，`contextIsolation: true`

### 开发模式
- `NODE_ENV=development` → 通过 `spawn` 启动 `npm run dev:backend`
- 前端加载 `http://localhost:5173`

---

## 九、最近修改记录

| 修改 | 说明 |
|------|------|
| 算法池扩展 | 从 4 个基础算法恢复到 14 个通用算法 |
| 每算法独立权重 | 按类型配置，每个算法独立权重滑块 |
| 自动权重调整 | 每 5 次预测自动调整 + 手动触发按钮 |
| 自定义预测类型 | 用户自定义分类名称 + 号码映射 |
| 类型卡片默认折叠 | 默认收起算法配置区，点击展开 |
| 文本版结果 | 纯文本格式，一键复制分享 |
| 预测不触发爬虫 | 点击预测直接用本地数据，不再先爬取 |
| 死循环修复 | DataContext 中 `syncFromBackend` 不再依赖 `data` 闭包 |
| 自定义弹窗重设计 | 三栏布局：分类名 → 号码映射（支持范围格式） |
| 安装包问题 | NSIS oneClick 模式不创建快捷方式 → 推荐便携版 |
| **经典预测重构** | 分离预测设置面板改为两列卡片布局；**从头/尾/五行只读标签改为完整配置区（复选框+权重）** |
| **统一模型注册表** | `SeparatedModelContext` 从 `modelRegistry` 动态获取模型列表，**不再硬编码** |
| **注册表补齐** | `hot_cold` 和 `interval` 号码模型加入系统模型注册表 |
| **回测记录保存** | 每轮回测自动保存结果（最近 50 条），支持历史查看和「应用」权重 |
| **回测不阻塞 UI** | 分块 setTimeout 异步执行，进度条实时刷新 |
| **自由增删模型** | 智能预测各类型改为「已选模型」列表 + 模型库弹窗选择器，不再展示全部模型 |
| **回测只测已选模型** | `buildBacktestType` 按当前已选模型子集搜索最优权重 |
| **头/尾/五行接线修复** | `runSeparatedPrediction` 接收全部 5 类型已选模型 + 权重（此前头尾五行设置不生效） |
| **推送配置到脚本** | `/api/models/push` 接口 + `config.json` 覆盖机制，自动发送脚本使用智能预测的模型选择 |
| **统一模型库** | 新建 `models/library.ts`，智能预测/动态预测/自动发送脚本共用一套模型元数据与解析函数（14 通用 + 9 专用） |
| **模型去重** | 删除 41 个模型的旧注册表（`models/registry`）与 `separatedModelResolver`；移除号码 5 个纯随机占位（lstm/xgboost 换通用算法真实实现，lightgbm/hot_cold/interval 删除）；删除与通用算法重复的生肖/头/尾/五行专用模型 |
| **回测样本外盲测** | `runBacktest` + 智能预测回测新增「屏蔽期数」：最近 N 期完全屏蔽、不参与寻优，输出盲测命中率 |
| **动态预测样本外自评** | `runPrediction` 移除样本内 self-eval；新增 `evaluateAlgorithmsSampleOut`；`autoTuneWeights` 改用样本外评估 |
| **盲测逐期明细** | 回测结果新增 `blindDetails`（每期预测TopN/实际开奖/命中），结果面板显示明细表 |
| **推送配置到 Git 仓库** | `/api/models/push` 支持 `repoPath`+`autoGit`：写入 `scripts/predictor/config.json` → `git add` 该文件 → commit `chore: 更新预测模型配置` → push，复用本机 git 凭据不存 token |
| **stale 选择修复** | `loadPersisted` 按当前模型库过滤失效 id，修复 localStorage 残留已删模型导致的 `未知模型: hot_trend` 崩溃 |
| **专用模型全移除** | 删除 `src/models/{number,zodiac,head,tail,element}/index.ts`（resnet/zodiac_combo/head_combo/tail_combo/element_combo 及 4 个 markov），统一模型库仅剩 14 个通用算法 |
| **默认全不选** | 智能预测各类型默认不勾选任何模型（`buildDefaultSelections` 返回空数组） |
| **号码 38→30** | 漏斗 level1 38→30、权重 top38→top30、动态预测号码 presets 改为 `[5,10,20,30,49]`；脚本同步 Level1 30 个 |
| **数据全量+指数衰减** | 14 个通用算法改用**全量历史 + 指数衰减**（`weightedCounts` decay=0.98，半衰期≈34 期）：hot/condProb/bayes/apriori/bandit 全量衰减，cold/cycle 全量扫描，rf/xgboost 最近 300 期抽样，genetic/rl 最近 200 期，ma(30)/lstm(60)/markov(全量) 维持 |
| **命中统计** | 已保存预测按 predictIssue 匹配实际开奖，统计号码/生肖命中率（当前记录命中判定 + 汇总条） |
| **回测期号范围** | 回测结果显示寻优窗口（`[N-lookback-blind, N-blind-1]`）与盲测窗口（`[N-blind, N-1]`）的期号范围 |
| **移除特征分析页** | 删除 `FeatureAnalysis.tsx` 与 `Analysis` 的「特征分析」tab（原为静态说明+近 50 期图表，与预测无关） |
| **tsc 零警告** | 删除遗留死代码（`Prediction.tsx`/`Evaluation.tsx`/`prediction/`目录/`utils/prediction.ts`），清理活动文件未用导入与隐式 any |
| **一键推送快捷入口** | 控制面板顶部新增绿色「一键推送」按钮，直接使用已保存的仓库路径，无需进入设置面板 |
| **脚本每 10 期自动调权** | `computeAdaptiveWeights` 改为对最近 10 期逐期样本外评估命中率 → softmax 权重；扩展到头/尾/五行（5 类型全覆盖），命中 TopN 号码30/生肖9/头4/尾8/五行4 |

---

## 十、构建与部署

### 构建命令
```bash
npm run build:frontend    # Vite 构建前端 → dist/
npm run build:backend     # 构建后端
npm run build             # 前后端同时构建
npm run build:app         # 构建前端 + electron-builder 打包
npm run electron:build    # 完整构建+打包
```

### 输出产物（release34/）
| 文件 | 说明 |
|------|------|
| `六合彩特码预测系统 Setup 1.0.0.exe` | NSIS 安装包（oneClick 简洁安装） |
| `六合彩特码预测系统 1.0.0.exe` | 便携版（单 exe，推荐使用） |
| `win-unpacked/` | 解压版（调试用） |
