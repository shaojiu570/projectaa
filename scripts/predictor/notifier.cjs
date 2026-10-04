/**
 * 六合彩预测系统 - 推送服务
 * 支持多渠道: Telegram / Bark / 钉钉 / 飞书 / 企业微信
 */

const crypto = require('crypto');

// 从环境变量读取配置
const CONFIG = {
  telegram: {
    botToken: process.env.TELEGRAM_BOT_TOKEN || '',
    chatId: process.env.TELEGRAM_CHAT_ID || '',
  },
  bark: {
    key: process.env.BARK_KEY || '',
  },
  dingtalk: {
    webhook: process.env.DINGTALK_WEBHOOK || '',
    secret: process.env.DINGTALK_SECRET || '',
  },
  feishu: {
    webhook: process.env.FEISHU_WEBHOOK || '',
  },
  wework: {
    key: process.env.WEWORK_WEBHOOK_KEY || '',
  },
};

/**
 * Telegram 推送
 */
async function sendToTelegram(content) {
  const { botToken, chatId } = CONFIG.telegram;
  if (!botToken || !chatId) return false;

  try {
    const url = `https://api.telegram.org/bot${botToken}/sendMessage`;
    const resp = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: content,
        parse_mode: 'Markdown',
      }),
    });
    const result = await resp.json();
    if (result.ok) {
      console.log('✅ Telegram 推送成功');
      return true;
    }
    console.log('❌ Telegram 推送失败:', result.description);
    return false;
  } catch (e) {
    console.log('❌ Telegram 推送异常:', e.message);
    return false;
  }
}

/**
 * Bark 推送 (iOS)
 */
async function sendToBark(title, content) {
  const { key } = CONFIG.bark;
  if (!key) return false;

  try {
    const url = `https://api.day.app/${key}/${encodeURIComponent(title)}/${encodeURIComponent(content)}`;
    const resp = await fetch(url);
    const result = await resp.json();
    if (result.code === 200) {
      console.log('✅ Bark 推送成功');
      return true;
    }
    console.log('❌ Bark 推送失败:', result.message);
    return false;
  } catch (e) {
    console.log('❌ Bark 推送异常:', e.message);
    return false;
  }
}

/**
 * 钉钉推送
 */
async function sendToDingTalk(content) {
  const { webhook, secret } = CONFIG.dingtalk;
  if (!webhook) return false;

  try {
    let url = webhook;
    
    if (secret) {
      const timestamp = Date.now();
      const stringToSign = `${timestamp}\n${secret}`;
      const hmac = crypto.createHmac('sha256', secret);
      hmac.update(stringToSign);
      const sign = encodeURIComponent(hmac.digest('base64'));
      url = `${webhook}&timestamp=${timestamp}&sign=${sign}`;
    }

    const resp = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        msgtype: 'markdown',
        markdown: { title: '六合彩预测', text: content },
      }),
    });
    const result = await resp.json();
    if (result.errcode === 0) {
      console.log('✅ 钉钉推送成功');
      return true;
    }
    console.log('❌ 钉钉推送失败:', result.errmsg);
    return false;
  } catch (e) {
    console.log('❌ 钉钉推送异常:', e.message);
    return false;
  }
}

/**
 * 飞书推送
 */
async function sendToFeishu(content) {
  const { webhook } = CONFIG.feishu;
  if (!webhook) return false;

  try {
    const resp = await fetch(webhook, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        msg_type: 'text',
        content: { text: content },
      }),
    });
    const result = await resp.json();
    if (result.StatusCode === 0) {
      console.log('✅ 飞书推送成功');
      return true;
    }
    console.log('❌ 飞书推送失败:', result.msg);
    return false;
  } catch (e) {
    console.log('❌ 飞书推送异常:', e.message);
    return false;
  }
}

/**
 * 企业微信推送
 */
async function sendToWeWork(content) {
  const { key } = CONFIG.wework;
  if (!key) return false;

  try {
    const url = `https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=${key}`;
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
 * 统一推送入口（底层）：notify(title, content)
 *   依次尝试 5 个渠道，有一个成功即返回 true
 */
async function notify(title, content) {
  const results = [];
  if (CONFIG.telegram.botToken && CONFIG.telegram.chatId) results.push(await sendToTelegram(content));
  if (CONFIG.bark.key) results.push(await sendToBark(title, content));
  if (CONFIG.dingtalk.webhook) results.push(await sendToDingTalk(content));
  if (CONFIG.feishu.webhook) results.push(await sendToFeishu(content));
  if (CONFIG.wework.key) results.push(await sendToWeWork(content));
  if (results.length === 0) { console.log('⚠️ 未配置任何推送渠道'); return false; }
  return results.some(r => r);
}

/* ============================================================
 * 推送渠道列表 & 启用状态（供脚本入口在 console 内打印 "N 个渠道启用" 用）
 * ============================================================ */

const ALL_CHANNELS = [
  { id: 'telegram', enabled: () => CONFIG.telegram.botToken && CONFIG.telegram.chatId },
  { id: 'bark',     enabled: () => CONFIG.bark.key },
  { id: 'dingtalk', enabled: () => CONFIG.dingtalk.webhook },
  { id: 'feishu',   enabled: () => CONFIG.feishu.webhook },
  { id: 'wework',   enabled: () => CONFIG.wework.key },
];

/** 返回所有已配置的渠道 id 列表（与入口 index.cjs 中 getEnabledNotifiers() 保持一致） */
function getEnabledNotifiers() {
  return ALL_CHANNELS.filter(c => c.enabled()).map(c => c.id);
}

/* ============================================================
 * 统一推送入口：sendNotifications(body)
 *   body 参数形式（与入口 index.cjs 旧传参方式保持兼容）：
 *   1) 支持旧 body.data = { issue,date,special,nextIssue,nextDate,types,finalNumbers,... }
 *      —— 调用 notify(title, formatMessage(predLike, data))
 *   2) 支持新传法 body = { pred, data }（pred 是 predictor.cjs 的完整结果，推荐）
 *   3) 支持直接传 notify 的 (title, markdown) → sendNotifications({ title, content })
 * ============================================================ */

async function sendNotifications(body) {
  if (!body) return false;

  let title;
  let markdown;
  let pred;
  let data;

  if (body.pred && body.data) {
    // 新传法：body = { pred, data, title? }
    pred = body.pred;
    data = body.data;
    title = body.title || `六合彩预测 · 第${extractNextIssue(pred, data)}期`;
    markdown = formatMessage(pred, data);
  } else if (body.data && (body.data.types || body.data.finalNumbers)) {
    // 旧 body.data 结构：先转成 pred 样子再调用 formatMessage
    const d = body.data;
    pred = {
      types: (d.types || []).map(t => ({
        id: t.id, name: t.name, resultCount: t.resultCount,
        predictions: (t.picks || []).map(p => ({ category: p.category, probability: p.probability, index: (t.picks || []).indexOf(p) })),
      })),
      finalNumbers: d.finalNumbers || [],
      finalCount: (d.finalNumbers || []).length,
      typeHits: d.typeHits || body.typeHits || pred?.typeHits,
      baseSeed: d._baseSeed || body._baseSeed,
    };
    data = globalThis.__NOTIFIER_DATA__ || buildFallbackData(d);
    title = body.title || `六合彩预测 · 第${d.nextIssue || ''}期`;
    markdown = formatMessage(pred, data);
  } else if (body.title && body.content) {
    // 最简形式（直接调用底层 notify(title, content)）
    return notify(body.title, body.content);
  } else {
    console.warn('⚠️  sendNotifications: 无法识别的 body 结构，跳过推送');
    return false;
  }

  return notify(title, markdown);
}

function extractNextIssue(pred, data) {
  if (!data || data.length === 0) return '?';
  const last = data[data.length - 1];
  const issue = last.issue || last.Issue || '';
  const num = parseInt(String(issue).slice(-3), 10);
  return Number.isFinite(num) ? num + 1 : issue;
}

function buildFallbackData(d) {
  return [{
    issue: d.issue, date: d.date, special: d.special,
    n1: undefined, n2: undefined, n3: undefined,
    n4: undefined, n5: undefined, n6: undefined,
  }];
}

/* ============================================================
 * 格式化推送消息（升级为与最新脚本设计一致，含 typeHits / autoWeight / 数据范围）
 * ============================================================ */

/**
 * 格式化预测结果为推送消息（Markdown）
 * @param {object} pred - predictor.cjs runPrediction 返回的结果
 *   兼容字段：pred.typeResults / pred.types / pred.finalNumbers / pred.typeHits / pred.baseSeed / pred.targetDate
 * @param {Array} data - 开奖记录（至少要有最近 N 期做「最近5期」展示）
 */
function formatMessage(pred, data) {
  const { formatDate, getZodiacOfRecord, getElementOfRecord, getColor } = require('./utils.cjs');

  // —— 基础信息：期号 / 日期
  const lastRecord = (data && data.length) ? data[data.length - 1] : null;
  const lastIssueFull = lastRecord ? (lastRecord.issue || lastRecord.Issue || '') : '';
  const lastIssueNum = parseInt(String(lastIssueFull).slice(-3), 10) || 0;
  const nextIssueNum = lastIssueNum > 0 ? lastIssueNum + 1 : 0;
  const targetDateStr = pred.targetDate
    ? formatDate(pred.targetDate).split(' ')[0]
    : formatDate(new Date()).split(' ')[0];
  const dataStartYear = (data && data.length)
    ? new Date(data[0].date || data[0].Date || Date.now()).getFullYear()
    : '?';
  const dataEndYear = lastRecord
    ? new Date(lastRecord.date || lastRecord.date || Date.now()).getFullYear()
    : '?';
  const dataRange = (data && data.length) ? `${dataStartYear}–${dataEndYear}` : '';

  // —— 准备类型列表（优先用 typeResults，兼容旧字段 types）
  const typesList = (Array.isArray(pred.typeResults) && pred.typeResults.length > 0)
    ? pred.typeResults.map(tr => ({
        id: tr.typeId,
        name: tr.typeName,
        resultCount: tr.resultCount,
        predictions: tr.predictions || tr.categories || [],
        numberRanges: tr.numberRanges || [],
      }))
    : (pred.types || []).map(t => ({
        id: t.id, name: t.name,
        resultCount: t.resultCount || (t.predictions || t.picks || []).length,
        predictions: t.predictions || t.picks || [],
        numberRanges: t.numberRanges || [],
      }));

  // —— 统计：autoWeight 启用的类型数量
  let autoWeightCount = 0;
  const rawTypes = pred._rawTypes || pred._effectiveTypes || [];
  if (rawTypes.length > 0) {
    autoWeightCount = rawTypes.filter(t => t && t.autoWeight && t.enabled).length;
  } else if (pred.typeResults && pred.typeResults.length > 0) {
    // 如果没传 rawTypes，就看预测时是否已经被调过权（各类型权重≠均分的比例，模糊判断 -> ⚖️ 图标）
    // 这里默认不展示，除非传了 _autoWeightApplied=true
    if (pred._autoWeightApplied) autoWeightCount = typesList.length;
  }

  const lines = [
    `【新澳门六合彩预测】第${nextIssueNum || '?'}期 (${targetDateStr})`,
    ...(lastIssueNum ? [`基于第${lastIssueNum}期数据`] : []),
    '',
  ];

  // —— 类型 TopN（6 种类型以内）
  typesList.forEach(t => {
    const picks = t.predictions;
    if (!picks || picks.length === 0) return;
    const text = picks
      .map(p => {
        if (t.id === 'number') return String(p.category).padStart(2, '0');
        return p.category;
      })
      .join(' ');
    lines.push(`📊 ${t.name}（${t.resultCount || picks.length}个）：`, text, '');
  });

  // —— 综合推荐号码
  const finalNumbers = pred.finalNumbers || [];
  const finalCount = pred.finalCount || finalNumbers.length;
  lines.push(`🎯 推荐号码（${finalCount}个）：`);
  lines.push(finalNumbers.slice(0, finalCount).map(n => String(n.number).padStart(2, '0')).join(' '));

  // —— 最近 5 期（含波色/五行）
  if (data && data.length > 0) {
    lines.push('');
    lines.push('最近5期（含波色/五行）');
    const last5 = data.slice(-5).slice().reverse();
    last5.forEach(r => {
      const color = getColor(r.special ?? r.Special);
      const element = getElementOfRecord(r);
      const zodiac = getZodiacOfRecord(r);
      const issueShort = String(r.issue || r.Issue || '').slice(-3) || '?';
      const special = r.special ?? r.Special;
      lines.push(`> ${issueShort}期 ${special} ${zodiac} ${color} ${element}`);
    });
  }

  // —— 最近一期 typeHits 自评（新增：每个类型 Top1 是否命中 / Top3 算法数量）
  if (pred.typeHits && pred.typeHits.length > 0) {
    lines.push('');
    lines.push('📝 最近一期算法自评（样本外）');
    pred.typeHits.forEach(th => {
      const name = (typesList.find(t => t.id === th.typeId) || {}).name || th.typeId;
      const ar = th.algorithmResults || [];
      const top1Hit = ar.length > 0 && ar[0] && ar[0].rank === 1;
      const top3N = ar.filter(r => r.rank && r.rank <= 3).length;
      lines.push(`> · ${name}：实际 ${th.actualCategory}　Top1${top1Hit ? '✅' : '❌'}　Top3算法 ${top3N}/${ar.length}`);
    });
  }

  // —— 底部 metadata
  const meta = [formatDate(new Date())];
  if (data && data.length) meta.push(`${data.length}期数据${dataRange ? `(${dataRange})` : ''}`);
  meta.push(`${typesList.length}种类型`);
  if (autoWeightCount > 0) meta.push(`⚖️ ${autoWeightCount}型自动调权`);
  if (typeof pred.baseSeed === 'number') meta.push(`seed ${(pred.baseSeed >>> 0).toString(16).toUpperCase().padStart(8, '0')}`);
  lines.push('', `_${meta.join(' | ')}_`);

  return lines.join('\n');
}

module.exports = {
  notify,
  formatMessage,
  sendNotifications,
  getEnabledNotifiers,
};

