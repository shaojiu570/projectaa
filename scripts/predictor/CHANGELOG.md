# 六合彩预测系统 - 变更记录

## [2026-07-26] 头数/尾数/五行改用独立模型 + 修复推送格式

### 修改文件

#### `scripts/predictor/constants.cjs`
- 新增 `HEAD_MODELS`（3个：head_freq/head_markov/head_trend）
- 新增 `HEAD_CATEGORIES`（0头~4头）
- 新增 `TAIL_MODELS`（3个：tail_freq/tail_markov/tail_trend）
- 新增 `TAIL_CATEGORIES`（0尾~9尾）
- 新增 `ELEMENT_MODELS`（3个：element_freq/element_markov/element_trend）
- 新增 `ELEMENT_CATEGORIES`（金木水火土）
- 所有新常量均已导出

#### `scripts/predictor/models.cjs`
- 新增 `simulateHeadModel(id, data, baseSeed)` — 3 个子模型：
  - head_freq: 近期特码头数频率加权
  - head_markov: 头数一阶马尔可夫转移矩阵
  - head_trend: 头数间隔周期模式
- 新增 `simulateTailModel(id, data, baseSeed)` — 3 个子模型：
  - tail_freq: 近期特码尾数频率加权
  - tail_markov: 尾数一阶马尔可夫转移矩阵
  - tail_trend: 尾数间隔周期模式
- 新增 `simulateElementModel(id, data, baseSeed)` — 3 个子模型：
  - element_freq: 近期特码五行频率加权
  - element_markov: 五行一阶马尔可夫转移矩阵
  - element_trend: 五行间隔周期模式
- 每个模型算法逻辑与前端 `src/models/head/index.ts` / `tail/index.ts` / `element/index.ts` 一致

#### `scripts/predictor/predictor.cjs`
- 新增 `fuseModels()` 通用融合函数（对应前端 `m0` 方法）
- 头数预测：改为 `fuseModels(HEAD_MODELS, simulateHeadModel, HEAD_CATEGORIES)` 独立模型融合
- 尾数预测：改为 `fuseModels(TAIL_MODELS, simulateTailModel, TAIL_CATEGORIES)` 独立模型融合
- 五行预测：改为 `fuseModels(ELEMENT_MODELS, simulateElementModel, ELEMENT_CATEGORIES)` 独立模型融合
- 移除旧的 `YEAR_ELEMENTS` 推导逻辑（从号码概率累加五行）
- 移除旧的 `fusedNum` 推导头数/尾数逻辑

#### `scripts/predictor/notifier.cjs`
- 修复：头数/尾数 label 已含"头""尾"后缀，去掉多余的 `+'头'`/`+'尾'` 拼接
- 修复：波色显示从 `pred.topColor`（1个）改为 `pred.colors.level1`（2个）
- 新增：五行预测结果推送行 `🔢 五行 Top4`
- 修复：模型数从硬编码 `19个模型` 改为动态计算（当前 13+6+3+2+2+3+3+3=35个模型）

#### `scripts/predictor/index.cjs`
- 控制台输出同步修复：波色显示2个、头尾去掉多余后缀、新增五行输出

#### `scripts/auto-predict.js`
- 同步修复与 `notifier.cjs` 相同的三个问题：波色2个、头尾后缀、动态模型数

#### `.github/workflows/auto-predict.yml`
- Cron 修改：北京时间 10:00 / 13:30 / 13:50 触发
- 新增 `workflow_dispatch` 的 `force` 布尔输入：勾选后可跳过今日缓存强制运行，且不标记已完成

### 关键逻辑变更

```
旧逻辑:
  号码预测 → fusedNum[49] → 按位分组 → 头数/尾数概率
  号码预测 → fusedNum[49] → YEAR_ELEMENTS查表 → 五行概率

新逻辑:
  头数: HEAD_MODELS(3个) → fuseModels → 独立结果
  尾数: TAIL_MODELS(3个) → fuseModels → 独立结果
  五行: ELEMENT_MODELS(3个) → fuseModels → 独立结果
```

### 模型总数
号码(13) + 生肖(6) + 波色(3) + 大小(2) + 单双(2) + 头数(3) + 尾数(3) + 五行(3) = **35个模型**
