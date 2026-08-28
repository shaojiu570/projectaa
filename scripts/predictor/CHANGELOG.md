# 六合彩预测系统 - 变更记录

## 当前架构（最新）

`scripts/predictor` 由前端「动态预测 → 一键推送」生成的 `config.json` **完全驱动**，使用与前端相同的 **14 个通用算法**（`hot/cold/cycle/markov/ma/condProb/bayes/apriori/rf/xgboost/lstm/genetic/rl/bandit`），**不再按号码/生肖/头/尾/五行分类型固定模型**，也不再包含旧的波色/单双/大小独立模型。

```text
config.json (types: 任意 号码/生肖/头/尾/五行/自定义 )
   └─ constants.cjs  EFFECTIVE_TYPES / FINAL_COUNT
        ├─ models.cjs     runGenericAlgo(14算法) + simulateTypeModel(按类型参数化)
        └─ predictor.cjs  fuseModels(按权重融合) + computeAdaptiveWeights(每10期自适应) + runPrediction
             └─ index.cjs  取数→预测→控制台→notifier.cjs 多渠道推送
```

关键行为：
- 每类型的算法勾选与权重 = 前端推送的 `selectedAlgorithms`（权重按总和归一化融合，TopN = `resultCount`）
- **自适应权重**：`computeAdaptiveWeights` 每 10 期对最近 10 期逐期样本外评估（训练只用该期之前数据）统计各算法命中 → softmax → 归一化；数据不足 10 期回退默认权重
- **生肖/五行按记录日期动态映射**：生肖按立春/农历年（`getZodiacByRecord`），五行按开奖日历年（`getElementByYear`）；目标期号码范围由 `effectiveRanges(type, targetDate)` 动态生成
- 数据不足 100 期则失败并推送通知
- 推送渠道：Telegram / Bark / 钉钉 / 飞书 / 企业微信（凭环境变量 `TELEGRAM_BOT_TOKEN`、`BARK_KEY`、`DINGTALK_WEBHOOK`/`SECRET`、`FEISHU_WEBHOOK`、`WEWORK_WEBHOOK_KEY`）

---

## 历史变更摘要

### [2026-07-26] 旧版：头/尾/五行独立模型（已废弃，仅留档）
- 曾为 `HEAD_MODELS`/`TAIL_MODELS`/`ELEMENT_MODELS` 各自独立 3 个模型（freq/markov/trend），与旧前端分区模型一致
- 曾为波色/大小/单双独立预测，模型总数 35 个
- **此架构已被「统一 14 通用算法 + config.json 驱动任意类型」完全取代**

### 后续大改造（现行）
- 删除分类型固定模型，改为统一 `GENERIC_ALGO_NAMES`（14 个）驱动的通用预测
- `models.cjs` 以 `runGenericAlgo` 实现 14 个通用算法；`simulateTypeModel` 按类型 `categories + numberRanges` 参数化运行
- `constants.cjs` 读取 `config.json` 得 `EFFECTIVE_TYPES`/`FINAL_COUNT`；无配置时回退 `defaultTypes()`（number/tail/head/element/zodiac 5 个内置类型）
- 生肖/五行映射改为 per-record 动态（立春年生肖、日历年五行），修复旧固定 2024 基准
- 移除「综合推荐」块，直接输出各类型 TopN 与综合 49 码
