const { Telegram } = require('telegraf')
const tele = new Telegram(process.env.TELE_BOT_TOKEN);

async function alert(msg) {
    tele.sendMessage(process.env.TELE_MONITOR_CHAT_ID, msg);
}

exports.teleAlert = alert;