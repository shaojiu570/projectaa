# 六合彩预测系统 - 变更记录

## 当前架构（最新）

`scripts/predictor` 由前端「动态预测 → 一键推送」生成的 `config.json` **完全驱动**，使用与前端相同的 **14 个通用算法**（`hot/cold/cycle/markov/ma/condProb/bayes/apriori/rf/xgboost/lstm/genetic/rl/bandit`），**不再按号码/生肖/头/尾/五行分类型固定模型**，也不再包含旧的波色/单双/大小独立模型。

```text
config.json (types: 任意 号码/生肖/头/尾/五行/自定义 )
   └─ constants.cjs  EFFECTIVE_TYPES / FINAL_COUNT
        ├─ models.cjs     runGenericAlgo(14算法) + simulateTypeModel(按类型参数化)
        └─ predictor.cjs  fuseModels(按权重融合) + runPrediction
             └─ index.cjs  取数→预测→控制台→notifier.cjs 多渠道推送
```

关键行为：
- 每类型的算法勾选与权重 = 前端推送的 `selectedAlgorithms`（权重按总和归一化融合，TopN = `resultCount`）
- **生肖/五行按记录日期动态映射**：生肖按立春/农历年（`getZodiacByRecord`），五行按开奖日历年（`getElementByYear`）；目标期号码范围由 `effectiveRanges(type, targetDate)` 动态生成
- **数据源**：kj1868.cc API（nam6 新澳门六合彩，仅 2026 年）+ 旧 HTML 源（123720c，2020-2025 历史数据）
- 数据不足 100 期则失败并推送通知
- 推送渠道：Telegram / Bark / 钉钉 / 飞书 / 企业微信（凭环境变量 `TELEGRAM_BOT_TOKEN`、`BARK_KEY`、`DINGTALK_WEBHOOK`/`SECRET`、`FEISHU_WEBHOOK`、`WEWORK_WEBHOOK_KEY`）
- **定时任务**：北京时间早上 6:30 自动执行

---

## 历史变更摘要

### [2026-09-12] 自定义类型三个问题修复
- 修复回测 100% 命中率：`computeTopN` 限制 topN 不超过 categories.length-1
- 修复待开奖状态：`getActualCategory` 对自定义类型兜底返回第一个分类
- 修复综合推荐不含新类型：`RangeEditor` handleSave 同步过滤空行

### [2026-09-11] 推荐数量自定义输入
- 预设按钮 + 数字输入框，支持任意 1-49 推荐数量

### [2026-09-09] 自动脚本数据源修复
- fetcher.cjs 从 xg6（香港）→ nam6（新澳门六合彩）
- 添加旧 HTML 源获取 2020-2025 历史数据（API 仅 2026）

### [2026-09-07] 前端爬虫添加备用源
- crawler.ts + sync.ts 添加 kj1868.cc API 作为第三数据源
- 旧源失效时自动切换到 kj1868 API

### [2026-09-06] 脚本更新
- 数据源换 kj1868（新澳门六合彩 nam6）
- 去掉自适应权重（computeAdaptiveWeights）
- 开奖记录加波色五行
- 定时任务改为北京时间早上 6:30

### [2026-08-28] 回测 N+N 穷举
- 改为遍历 2^n-1 全部子集等权寻优全局最优
- 权重精调 + 三阶段进度条

### 后续大改造（现行）
- 删除分类型固定模型，改为统一 `GENERIC_ALGO_NAMES`（14 个）驱动的通用预测
- `models.cjs` 以 `runGenericAlgo` 实现 14 个通用算法；`simulateTypeModel` 按类型 `categories + numberRanges` 参数化运行
- `constants.cjs` 读取 `config.json` 得 `EFFECTIVE_TYPES`/`FINAL_COUNT`；无配置时回退 `defaultTypes()`（number/tail/head/element/zodiac 5 个内置类型）
- 生肖/五行映射改为 per-record 动态（立春年生肖、日历年五行），修复旧固定 2024 基准
- 移除「综合推荐」块，直接输出各类型 TopN 与综合 49 码
