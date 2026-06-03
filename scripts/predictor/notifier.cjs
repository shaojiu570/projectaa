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
 * 统一推送入口
 */
async function notify(title, content) {
  const results = [];

  if (CONFIG.telegram.botToken && CONFIG.telegram.chatId) {
    results.push(await sendToTelegram(content));
  }
  if (CONFIG.bark.key) {
    results.push(await sendToBark(title, content));
  }
  if (CONFIG.dingtalk.webhook) {
    results.push(await sendToDingTalk(content));
  }
  if (CONFIG.feishu.webhook) {
    results.push(await sendToFeishu(content));
  }
  if (CONFIG.wework.key) {
    results.push(await sendToWeWork(content));
  }

  if (results.length === 0) {
    console.log('⚠️ 未配置任何推送渠道');
    return false;
  }

  return results.some(r => r);
}

/**
 * 格式化预测结果为推送消息
 */
function formatMessage(pred, data) {
  const { formatDate, getZodiac, getColor, getSize, getParity, getElement } = require('./utils.cjs');
  
  const year = new Date().getFullYear();
  const topNumsL3 = pred.numbers.level3;
  const topZodL3 = pred.zodiacs.level3;
  const last5 = data.slice(-5).reverse();

  const lines = [
    '**六合彩特码预测**',
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

module.exports = { notify, formatMessage };
