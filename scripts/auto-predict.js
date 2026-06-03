/**
 * 六合彩自动预测 - 企业微信 Webhook 专用版
 * 
 * 使用方法：
 *   WEWORK_WEBHOOK_KEY=your-key DATA_SOURCE=https://kj.123720c.com/kj/ node scripts/auto-predict.js
 */

const { runPrediction } = require('./predictor/predictor.cjs');
const { fetchData } = require('./predictor/fetcher.cjs');
const { getZodiac, getColor, getSize, getParity, getElement, formatDate } = require('./predictor/utils.cjs');

const WEWORK_WEBHOOK_KEY = process.env.WEWORK_WEBHOOK_KEY || '';

/**
 * 企业微信推送
 */
async function sendToWeWork(content) {
  if (!WEWORK_WEBHOOK_KEY) {
    console.log('⚠️ 未配置 WEWORK_WEBHOOK_KEY');
    return false;
  }
  try {
    const url = `https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=${WEWORK_WEBHOOK_KEY}`;
    const resp = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        msgtype: 'markdown',
        markdown: { content },
      }),
    });
    const result = await resp.json();
    if (result.errcode === 0) {
      console.log('✅ 企业微信推送成功');
      return true;
    }
    console.log('❌ 企业微信推送失败:', result.errmsg);
    return false;
  } catch (e) {
    console.log('❌ 企业微信推送异常:', e.message);
    return false;
  }
}

/**
 * 格式化预测结果为企微 Markdown
 */
function formatPredictionMessage(pred, data) {
  const year = new Date().getFullYear();
  const topNumsL3 = pred.numbers.level3;
  const topZodL3 = pred.zodiacs.level3;
  const last5 = data.slice(-5).reverse();

  const lines = [
    '## 六合彩特码预测',
    '',
    '**TOP 10 推荐号码**',
    ...topNumsL3.map((r, i) =>
      `${i + 1}. **${String(r.number).padStart(2, '0')}**  ${getZodiac(r.number, year)} ${getColor(r.number)} ${getSize(r.number)}${getParity(r.number)} ${getElement(r.number, year)}`
    ),
    '',
    '**推荐生肖 (9个)**',
    ...pred.zodiacs.level1.map((z, i) => `${i + 1}. **${z.zodiac}**`),
    '',
    `**波色**: ${pred.topColor}　**大小**: ${pred.topSize}　**单双**: ${pred.topParity}`,
    '',
    '**综合推荐**',
    ...pred.combos.map(c => `> ${c.zodiac}+${String(c.number).padStart(2, '0')} (${(c.probability * 100).toFixed(4)}%)`),
    '',
    '**最近5期**',
    ...last5.map(r => `> ${r.issue.slice(-3)}期 **${r.special}** ${getZodiac(r.special, year)} ${getColor(r.special)}`),
    '',
    `_${formatDate(new Date())} | ${data.length}期数据 | 19个模型_`,
  ];

  return lines.join('\n');
}

/**
 * 主函数
 */
async function main() {
  console.log('=== 六合彩自动预测 (企微版) ===');
  console.log('时间:', formatDate(new Date()));
  console.log('');

  // 1. 获取数据
  console.log('📡 正在获取开奖数据...');
  const data = await fetchData();

  if (data.length < 100) {
    console.log('❌ 数据不足（' + data.length + '条），无法预测');
    const failMsg = '## 六合彩预测失败\n\n数据获取不足（' + data.length + '条），无法进行预测';
    await sendToWeWork(failMsg);
    process.exit(1);
  }

  console.log('📊 数据获取成功:', data.length, '期');
  console.log('');

  // 2. 执行预测
  console.log('🔮 正在执行预测分析...');
  const pred = runPrediction(data);

  // 3. 输出结果到控制台
  console.log('');
  console.log('═══════════════════════════════════════════════════════════');
  console.log('预测结果');
  console.log('═══════════════════════════════════════════════════════════');
  console.log('');

  console.log('【号码预测 - Level1 (38个)】');
  console.log(pred.numbers.level1.map(r => String(r.number).padStart(2, '0')).join(', '));
  console.log('');
  console.log('【号码预测 - Level2 (23个)】');
  console.log(pred.numbers.level2.map(r => String(r.number).padStart(2, '0')).join(', '));
  console.log('');
  console.log('【号码预测 - Level3 (10个)】');
  pred.numbers.level3.forEach((r, i) => {
    console.log(`  ${i + 1}. ${String(r.number).padStart(2, '0')} - ${getZodiac(r.number, year)} ${getColor(r.number)} ${getSize(r.number)}${getParity(r.number)} ${getElement(r.number, year)}`);
  });
  console.log('');
  console.log('【生肖预测 - Level1 (9个)】');
  console.log(pred.zodiacs.level1.map(z => z.zodiac).join(', '));
  console.log('');
  console.log(`【属性】波色: ${pred.topColor}  大小: ${pred.topSize}  单双: ${pred.topParity}`);
  console.log('');

  // 4. 推送企微通知
  console.log('═══════════════════════════════════════════════════════════');
  console.log('📤 正在推送企业微信通知...');
  const message = formatPredictionMessage(pred, data);
  const success = await sendToWeWork(message);

  if (success) {
    console.log('✅ 推送完成');
  } else {
    console.log('❌ 推送失败');
    process.exit(1);
  }

  console.log('');
  console.log('=== 预测任务完成 ===');
}

main().catch(e => {
  console.error('错误:', e);
  process.exit(1);
});
