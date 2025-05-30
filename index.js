const { default: makeWASocket, useSingleFileAuthState, DisconnectReason, fetchLatestBaileysVersion, makeCacheableSignalKeyStore } = require('@adiwajshing/baileys');
const { Boom } = require('@hapi/boom');
const axios = require('axios');
const P = require('pino');

axios.get('https://api.ipify.org?format=json').then(({data}) => {
  console.log('Meu IP público:', data.ip);
});


const authFile = './auth_info.json';
const { state, saveState } = useSingleFileAuthState(authFile);

const COCAUTH = 'Bearer SEU_TOKEN_DA_API';  // seu token da API Clash of Clans
const WAR_TAG = '#SEU_CLAN_TAG';             // tag do seu clã, ex: '#ABC123'
const WHATSAPP_GROUP_ID = '120363209208893914@g.us'; // ID do grupo WhatsApp (normalmente termina com '@g.us')

function tempoRestante(fim) {
  const now = new Date();
  const end = new Date(fim);
  const diffMs = end - now;
  return diffMs > 0 ? diffMs : 0;
}

function formatarTempo(ms) {
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  return `${h}h ${m}m`;
}

async function pegarDadosGuerra() {
  try {
    const response = await axios.get(`https://api.clashofclans.com/v1/clans/${encodeURIComponent(WAR_TAG)}/currentwar`, {
      headers: { Authorization: COCAUTH }
    });
    return response.data;
  } catch (error) {
    console.error('Erro ao consultar guerra:', error.response?.data || error.message);
    return null;
  }
}

async function enviarAlerta(client, texto) {
  await client.sendMessage(WHATSAPP_GROUP_ID, { text: texto });
}

async function monitorarGuerra(client) {
  let ultimoStatus = null;
  let alertou1h = false;
  let alertou4h = false;

  setInterval(async () => {
    const guerra = await pegarDadosGuerra();
    if (!guerra) return;

    const estadoAtual = guerra.state; // ex: 'inWar', 'warEnded', 'notInWar'
    const tempoFim = guerra.endTime;

    if (estadoAtual !== ultimoStatus) {
      if (estadoAtual === 'inWar') {
        await enviarAlerta(client, '🚨 Guerra começou!');
      } else if (estadoAtual === 'warEnded') {
        await enviarAlerta(client, '🏆 Guerra finalizada!');
      }
      ultimoStatus = estadoAtual;
      alertou1h = false;
      alertou4h = false;
    }

    if (estadoAtual === 'inWar') {
      const restante = tempoRestante(tempoFim);
      if (restante > 0) {
        if (restante <= 3600000 && !alertou1h) {
          await enviarAlerta(client, `⚠️ Faltando 1 hora para acabar a guerra!`);
          alertou1h = true;
        }

        if (restante % 14400000 < 60000 && !alertou4h) { // a cada 4 horas +/- 1 min
          await enviarAlerta(client, `⏳ Tempo restante para acabar a guerra: ${formatarTempo(restante)}`);
          alertou4h = true;
        }

        if (restante > 3600000) alertou1h = false;
        if (restante > 14400000) alertou4h = false;
      }
    }
  }, 5 * 60 * 1000); // roda a cada 5 minutos
}

async function startSock() {
  const { version, isLatest } = await fetchLatestBaileysVersion();
  console.log(`Usando WA v${version.join('.')}, isLatest: ${isLatest}`);

  const sock = makeWASocket({
    version,
    auth: state,
    printQRInTerminal: true,
    logger: P({ level: 'silent' }),
  });

  sock.ev.on('creds.update', saveState);

  sock.ev.on('connection.update', (update) => {
    const { connection, lastDisconnect, qr } = update;
    if (qr) {
      console.log('Escaneie o QR code acima para conectar o WhatsApp.');
    }
    if (connection === 'close') {
      const status = lastDisconnect.error?.output?.statusCode || 0;
      if (status === DisconnectReason.loggedOut) {
        console.log('Desconectado. Apague o arquivo auth_info.json e conecte novamente.');
      } else {
        console.log('Reconectando...');
        startSock();
      }
    }
    if (connection === 'open') {
      console.log('Conectado ao WhatsApp.');
      monitorarGuerra(sock);
    }
  });

  return sock;
}

startSock();
