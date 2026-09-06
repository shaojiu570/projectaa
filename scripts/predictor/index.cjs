/**
 * 六合彩预测系统 - 主入口
 * 模块化结构，便于维护和扩展
 */

const { runPrediction } = require('./predictor.cjs');
const { fetchData } = require('./fetcher.cjs');
const { notify, formatMessage } = require('./notifier.cjs');
const { formatDate, getZodiacOfRecord, getElementOfRecord, getColor } = require('./utils.cjs');

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
  console.log('');
  console.log('═══════════════════════════════════════════════════════════');
  console.log('预测结果');
  console.log('═══════════════════════════════════════════════════════════');
  console.log('');

  // 各类型预测
  pred.types.forEach(t => {
    console.log(`【${t.name} Top${t.resultCount}】`);
    console.log(t.predictions
      .map(p => t.id === 'number' ? String(p.category).padStart(2, '0') : p.category)
      .join(', '));
    console.log('');
  });

  // 综合推荐号码
  console.log(`【推荐号码 (${pred.finalCount}个)】`);
  console.log(pred.finalNumbers.slice(0, pred.finalCount).map(n => String(n.number).padStart(2, '0')).join(', '));
  console.log('');

  // 最近5期（含波色/五行）
  console.log('【最近5期（含波色/五行）】');
  const last5 = data.slice(-5).reverse();
  last5.forEach(r => {
    const color = getColor(r.special);
    const element = getElementOfRecord(r);
    console.log(`  ${r.issue}期: ${r.special} - ${getZodiacOfRecord(r)} ${color} ${element}`);
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
