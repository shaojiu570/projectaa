#!/usr/bin/env node
/**
 * 六合彩每日自动预测脚本
 *
 * 使用：
 *   node scripts/predictor/index.cjs              # 使用已有缓存数据
 *   node scripts/predictor/index.cjs --refresh    # 先抓最新开奖数据，再预测
 *   node scripts/predictor/index.cjs --auto-weight-print  # 自动调权打印详细日志
 */

const path = require('path');
const fs = require('fs');
const { fetchData } = require('./fetcher.cjs');
const { runPrediction } = require('./predictor.cjs');
const { sendNotifications, getEnabledNotifiers } = require('./notifier.cjs');
const {
  EFFECTIVE_TYPES,
  FINAL_COUNT,
  getYearZodiacMapping,
  getLunarZodiacYear,
  getZodiacByDate,
} = require('./constants.cjs');

const DATA_DIR = path.resolve(__dirname, '..', '..', 'data');
const RECORDS_FILE = path.join(DATA_DIR, 'lottery-data.json');
const SCRIPT_PREDICTION_RECORDS = path.join(DATA_DIR, 'prediction-records.json');

/* ===============  与前端对齐：预测下一期的期号 / 日期  =============== */

function fmtDate(d) {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function calculateNextIssue(lastRecord) {
  if (!lastRecord) return '0';
  const issue = String(lastRecord.issue || lastRecord.Issue || '');
  const last3 = issue.slice(-3);
  const yearPart = issue.length >= 7 ? issue.slice(0, 4) : String(new Date().getFullYear());
  const n = parseInt(last3, 10);
  if (!Number.isFinite(n)) return issue;
  const nextNum = Math.max(1, n + 1);
  return yearPart + String(nextNum).padStart(3, '0');
}

function calculateNextDate(lastRecord) {
  if (!lastRecord) return fmtDate(new Date());
  const d = new Date(lastRecord.date || lastRecord.Date || Date.now());
  d.setDate(d.getDate() + 2);
  return fmtDate(d);
}

/* ===============  号码颜色（终端彩色打印）  =============== */

const COLOR = {
  R: '\x1b[31m', B: '\x1b[34m', G: '\x1b[32m', Y: '\x1b[33m',
  W: '\x1b[37m', RST: '\x1b[0m', BOLD: '\x1b[1m', DIM: '\x1b[2m',
};

function colorOf(n) {
  const red = [1,2,7,8,12,13,18,19,23,24,29,30,34,35,40,45,46];
  const blue = [3,4,9,10,14,15,20,25,26,31,36,37,41,42,47,48];
  if (red.includes(n)) return 'R';
  if (blue.includes(n)) return 'B';
  return 'G';
}
function printBall(n, { pct = null, pad = true } = {}) {
  const col = colorOf(n);
  const code = col === 'R' ? COLOR.R : col === 'B' ? COLOR.B : COLOR.G;
  const suffix = pct != null ? `${COLOR.DIM}(${pct}%)${COLOR.RST}` : '';
  return `${code}${COLOR.BOLD}${pad ? String(n).padStart(2, '0') : String(n).padStart(2, '0')}${COLOR.RST} ${suffix}`;
}

/* ===============  记录持久化（与前端 DynamicPredictionRecord 同结构）  =============== */

function ensureDir(p) { try { fs.mkdirSync(p, { recursive: true }); } catch {} }

function saveScriptPredictionRecord(record) {
  try {
    ensureDir(DATA_DIR);
    let arr = [];
    if (fs.existsSync(SCRIPT_PREDICTION_RECORDS)) {
      try { arr = JSON.parse(fs.readFileSync(SCRIPT_PREDICTION_RECORDS, 'utf8')); } catch {}
      if (!Array.isArray(arr)) arr = [];
    }
    arr.push(record);
    if (arr.length > 1000) arr = arr.slice(-1000);
    fs.writeFileSync(SCRIPT_PREDICTION_RECORDS, JSON.stringify(arr, null, 2));
    return true;
  } catch (e) {
    console.error(`\n⚠️  预测记录保存失败 (${SCRIPT_PREDICTION_RECORDS}):`, e.message);
    return false;
  }
}

/* ===============  主流程  =============== */

async function main() {
  const args = process.argv.slice(2);
  const forceRefresh = args.includes('--refresh') || args.includes('-r');
  const autoPrint = args.includes('--auto-weight-print') || args.includes('-v');
  const noNotify = args.includes('--no-notify') || args.includes('--dry-run');

  ensureDir(DATA_DIR);
  ensureDir(path.dirname(RECORDS_FILE));

  let data;
  try {
    data = await fetchData({ refresh: forceRefresh });
  } catch (e) {
    console.error('❌ 获取开奖数据失败:', e);
    process.exit(1);
  }

  if (!data || data.length === 0) {
    console.error('❌ 开奖数据为空，请检查网络或配置。');
    process.exit(1);
  }

  console.log(`\n📊 已加载 ${data.length} 期开奖数据`);
  const last = data[data.length - 1];
  const lastIssue = last.issue || last.Issue;
  const lastDate = last.date || last.Date;
  const lastSpecial = last.special || last.Special;

  console.log(`  · 最新期号：${lastIssue}`);
  console.log(`  · 开奖日期：${lastDate}`);
  console.log(`  · 特码：${printBall(lastSpecial)}`);

  // 预测目标期：期号 + 日期
  const nextIssue = calculateNextIssue(last);
  const nextDate = calculateNextDate(last);
  const nextDateObj = new Date(nextDate);
  const targetZodiacYear = getLunarZodiacYear(nextDateObj);
  const targetZodiac = getZodiacByDate(nextDateObj);
  const zodiacMap = getYearZodiacMapping(getLunarZodiacYear(nextDateObj));

  console.log(`\n🎯 预测目标期：第 ${nextIssue.slice(-3)} 期 (${nextDate}) · 农历${targetZodiacYear}年（${targetZodiac}年）`);
  console.log(`·`.repeat(40));

  if (autoPrint) console.log('\n⚖️  自动调权开始（autoWeight=true 的类型）：');
  // 关键：使用统一后的 predictor.cjs 接口，参数对齐前端 runPrediction
  const result = runPrediction(data, FINAL_COUNT, EFFECTIVE_TYPES, {
    useAutoWeight: true,
    print: autoPrint,
  });
  if (autoPrint) console.log('');

  // ========== 类型结果打印 ==========
  result.typeResults.forEach(tr => {
    console.log(`\n🟣 ${tr.typeName} · Top ${tr.resultCount}`);
    const cats = tr.predictions || tr.categories || [];
    const lines = cats.map(cp => {
      const numList = (tr.numberRanges[cp.index >= 0 ? cp.index : 0] || []).slice(0, 20);
      const preview = numList.length ? `[${numList.map(n => String(n).padStart(2, '0')).join(',')}]` : '';
      return `  · ${cp.category.padEnd(8)} ${((cp.probability || 0) * 100).toFixed(1)}%  ${preview}`;
    });
    console.log(lines.join('\n'));
  });

  // ========== 综合推荐号码打印 ==========
  console.log(`\n\n${COLOR.BOLD}${COLOR.Y}🌟 综合推荐 Top ${result.finalNumbers.length} 个号码：${COLOR.RST}\n`);
  const nums = result.finalNumbers;
  const chunks = [];
  for (let i = 0; i < nums.length; i += 10) chunks.push(nums.slice(i, i + 10));
  chunks.forEach(row => {
    console.log('  ' + row.map(n => printBall(n.number, { pct: (n.probability * 100).toFixed(1) })).join('  '));
  });

  // ========== 生肖辅助 ==========
  const pickedZodiacCount = {};
  nums.forEach(n => {
    for (const z of Object.keys(zodiacMap)) {
      if (zodiacMap[z].includes(n.number)) {
        pickedZodiacCount[z] = (pickedZodiacCount[z] || 0) + 1;
      }
    }
  });
  const rankedZodiac = Object.entries(pickedZodiacCount)
    .filter(([, c]) => c > 0)
    .sort((a, b) => b[1] - a[1]);
  if (rankedZodiac.length > 0) {
    console.log(`\n${COLOR.DIM}命中生肖：${rankedZodiac.map(([z, c]) => `${z}×${c}`).join('  ')}${COLOR.RST}`);
  }

  // ========== typeHits 自评打印（最后一期已开奖情况） ==========
  if (result.typeHits && result.typeHits.length > 0) {
    console.log(`\n${COLOR.DIM}📝 最近一期自评（仅供参考，不代表下期）：${COLOR.RST}`);
    result.typeHits.forEach(th => {
      const name = (result.typeResults.find(t => t.typeId === th.typeId) || {}).typeName || th.typeId;
      const hit1 = th.algorithmResults && th.algorithmResults[0] && th.algorithmResults[0].rank === 1;
      const top3Count = (th.algorithmResults || []).filter(r => r.rank && r.rank <= 3).length;
      console.log(`  · ${name.padEnd(12)} 实际分类=${String(th.actualCategory).padEnd(6)}  Top1命中=${hit1 ? '✅' : '❌'}  Top3算法数=${top3Count}/${th.algorithmResults.length}`);
    });
  }

  // ========== 保存预测记录（与前端 DynamicPredictionRecord schema 一致） ==========
  const predictionRecord = {
    id: 'script_' + nextIssue + '_' + Date.now(),
    timestamp: new Date().toISOString(),
    issue: nextIssue,
    date: nextDate,
    typeResults: result.typeResults.map(tr => ({
      typeId: tr.typeId,
      typeName: tr.typeName,
      categories: (tr.predictions || tr.categories || []).map(cp => ({
        category: cp.category,
        probability: cp.probability,
      })),
    })),
    finalNumbers: result.finalNumbers.map(n => ({ number: n.number, probability: n.probability })),
    typeHits: result.typeHits,
    _source: 'auto-script',
    _baseSeed: result.baseSeed,
  };
  const saved = saveScriptPredictionRecord(predictionRecord);
  console.log(`\n${saved ? '💾' : '⚠️ '} 预测记录写入：${SCRIPT_PREDICTION_RECORDS}`);

  // ========== 推送通知（新传法：body = { pred, data } 走统一 formatMessage 升级模板） ==========
  if (!noNotify && getEnabledNotifiers().length > 0) {
    const enabledTypesUsed = EFFECTIVE_TYPES || [];
    const resultWithMeta = {
      ...result,
      _rawTypes: enabledTypesUsed,
      _autoWeightApplied: enabledTypesUsed.some(t => t && t.autoWeight && t.enabled),
    };
    try {
      await sendNotifications({
        pred: resultWithMeta,
        data: data,
        title: `六合彩预测 · 第${nextIssue.slice(-3)}期 (${nextDate})`,
      });
    } catch (e) {
      console.error('发送通知时出错:', e.message);
      process.exitCode = 2;
    }
  } else if (!noNotify) {
    console.log('\n📭 未配置推送渠道，跳过通知（配置环境变量或脚本 config.json 内渠道字段即可）。');
  }

  console.log('\n✅ 预测完成。');
}

main().catch(e => {
  console.error('运行异常:', e);
  process.exit(1);
});
