require('dotenv').config();
const venom = require('venom-bot');
const axios = require('axios');

venom
  .create()
  .then((client) => start(client))
  .catch((error) => {
    console.log(error);
  });

function start(client) {
  client.getAllChats().then((chats) => {
    const groups = chats.filter(chat => chat.isGroup);
    console.log("🔍 Grupos encontrados:");
    groups.forEach(group => {
      console.log(`📛 Nome: ${group.name} | ID: ${group.id}`);
    });
  });
}


const COC_TOKEN = process.env.COC_TOKEN;
const CLAN_TAG = encodeURIComponent(process.env.CLAN_TAG);
const INTERVAL_4H = 4 * 60 * 60 * 1000; // 4 horas em ms
const GROUP_ID = process.env.WHATSAPP_GROUP_ID;

const HEADERS = {
  Authorization: `Bearer ${COC_TOKEN}`,
  Accept: 'application/json',
};

let warEndTime = null;
let warStartTime = null;
let warState = null;

async function fetchWarData() {
  try {
    const res = await axios.get(`https://api.clashofclans.com/v1/clans/${CLAN_TAG}/currentwar`, {
      headers: HEADERS,
    });
    return res.data;
  } catch (err) {
    console.error('Erro ao buscar dados da guerra:', err.response?.data || err.message);
    return null;
  }
}

async function sendMessage(client, message) {
  try {
    await client.sendText(GROUP_ID, message);
  } catch (err) {
    console.error('Erro ao enviar mensagem no WhatsApp:', err.message);
  }
}

function formatTime(ms) {
  const totalSeconds = Math.floor(ms / 1000);
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  return `${h}h ${m}m`;
}

async function checkWar(client) {
  const warData = await fetchWarData();
  if (!warData) return;

  const state = warData.state; // valores possíveis: 'preparation', 'inWar', 'warEnded'
  const startTime = new Date(warData.startTime);
  const endTime = new Date(warData.endTime);
  const now = new Date();

  if (state === 'inWar' && warState !== 'inWar') {
    warStartTime = startTime;
    warEndTime = endTime;
    warState = 'inWar';
    await sendMessage(client, `⚔️ Guerra iniciada! Começou às ${startTime.toLocaleTimeString()}`);
  }

  if (state === 'preparation' && warState !== 'preparation') {
    warStartTime = startTime;
    warEndTime = endTime;
    warState = 'preparation';
    await sendMessage(client, `🕒 Liga/Guerra em preparação. Início previsto: ${startTime.toLocaleTimeString()}`);
  }

  if (warState === 'inWar' || warState === 'preparation') {
    const timeLeft = endTime - now;

    if (timeLeft <= 3600000 && !checkWar.oneHourAlertSent) {
      await sendMessage(client, `⏳ Faltando 1 hora para o fim da guerra/ligas!`);
      checkWar.oneHourAlertSent = true;
    }

    if (!checkWar.last4hSent || now - checkWar.last4hSent >= INTERVAL_4H) {
      await sendMessage(client, `⏰ Ainda faltam ${formatTime(timeLeft)} para acabar a guerra/ligas.`);
      checkWar.last4hSent = now;
    }
  }

  if (state === 'warEnded' && warState !== 'warEnded') {
    warState = 'warEnded';
    await sendMessage(client, `🏆 Guerra/ligas finalizada!`);
  }
}
checkWar.oneHourAlertSent = false;
checkWar.last4hSent = null;

async function startBot() {
  venom.create().then((client) => {
    client.onStateChange((state) => {
      console.log('WhatsApp State:', state);
      if (state === 'CONFLICT' || state === 'UNLAUNCHED') {
        console.log('Reconectando...');
        client.close();
        startBot();
      }
    });

    // Verifica o status da guerra a cada 10 minutos
    setInterval(() => checkWar(client), 10 * 60 * 1000);

    // Primeira checagem imediata
    checkWar(client);
  }).catch((err) => {
    console.error('Erro ao iniciar venom-bot:', err);
  });
}

startBot();