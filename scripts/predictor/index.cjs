/**
 * 六合彩预测系统 - 主入口
 * 模块化结构，便于维护和扩展
 */

const { runPrediction } = require('./predictor.cjs');
const { fetchData } = require('./fetcher.cjs');
const { notify, formatMessage } = require('./notifier.cjs');
const { formatDate, getZodiac, getColor, getSize, getParity, getElement } = require('./utils.cjs');

/**
 * 主函数
 */
async function main() {
  console.log('=== 六合彩自动预测 ===');
  console.log('时间:', formatDate(new Date()));
  console.log('');

  // 1. 获取数据
  console.log('📡 正在获取开奖数据...');
  const data = await fetchData();

  if (data.length < 100) {
    console.log('❌ 数据不足（' + data.length + '条），无法预测');
    await notify('六合彩预测失败', '数据获取不足，无法进行预测');
    process.exit(1);
  }

  console.log('📊 数据获取成功:', data.length, '期');
  console.log('');

  // 2. 执行预测
  console.log('🔮 正在执行预测分析...');
  const pred = runPrediction(data);

  // 3. 输出结果
  const year = new Date().getFullYear();
  
  console.log('');
  console.log('═══════════════════════════════════════════════════════════');
  console.log('预测结果');
  console.log('═══════════════════════════════════════════════════════════');
  console.log('');
  
  // 号码预测 - 第一层 38个
  console.log('【号码预测 - Level1 (38个)】');
  console.log(pred.numbers.level1.map(r => String(r.number).padStart(2, '0')).join(', '));
  console.log('');
  
  // 号码预测 - 第二层 23个
  console.log('【号码预测 - Level2 (23个)】');
  console.log(pred.numbers.level2.map(r => String(r.number).padStart(2, '0')).join(', '));
  console.log('');
  
  // 号码预测 - 第三层 10个
  console.log('【号码预测 - Level3 (10个)】');
  pred.numbers.level3.forEach((r, i) => {
    console.log(`  ${i + 1}. ${String(r.number).padStart(2, '0')} - ${getZodiac(r.number, year)} ${getColor(r.number)} ${getSize(r.number)}${getParity(r.number)} ${getElement(r.number, year)}`);
  });
  console.log('');

  // 生肖预测 - 第一层 9个
  console.log('【生肖预测 - Level1 (9个)】');
  console.log(pred.zodiacs.level1.map(z => z.zodiac).join(', '));
  console.log('');
  
  // 生肖预测 - 第二层 6个
  console.log('【生肖预测 - Level2 (6个)】');
  console.log(pred.zodiacs.level2.map(z => z.zodiac).join(', '));
  console.log('');
  
  // 生肖预测 - 第三层 3个
  console.log('【生肖预测 - Level3 (3个)】');
  console.log(pred.zodiacs.level3.map(z => z.zodiac).join(', '));
  console.log('');

  // 属性预测
  console.log('【属性预测】');
  console.log(`  波色: ${pred.topColor}`);
  console.log(`  大小: ${pred.topSize}`);
  console.log(`  单双: ${pred.topParity}`);
  console.log('');

  // 综合推荐
  console.log('【综合推荐】');
  pred.combos.forEach(c => {
    console.log(`  ${c.zodiac} + ${String(c.number).padStart(2, '0')} (${(c.probability * 100).toFixed(4)}%)`);
  });
  console.log('');

  // 最近5期
  console.log('【最近5期开奖】');
  const last5 = data.slice(-5).reverse();
  last5.forEach(r => {
    console.log(`  ${r.issue}期: ${r.special} - ${getZodiac(r.special, year)} ${getColor(r.special)}`);
  });
  console.log('');

  // 4. 推送通知
  console.log('═══════════════════════════════════════════════════════════');
  console.log('📤 正在推送通知...');
  const message = formatMessage(pred, data);
  const success = await notify('六合彩特码预测', message);

  if (success) {
    console.log('✅ 推送完成');
  }

  console.log('');
  console.log('=== 预测任务完成 ===');
}

// 执行
main().catch(e => {
  console.error('错误:', e);
  process.exit(1);
});
