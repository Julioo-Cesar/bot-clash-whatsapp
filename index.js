import makeWASocket, {
  useSingleFileAuthState,
  DisconnectReason,
  fetchLatestBaileysVersion,
} from "@adiwajshing/baileys";
import { Boom } from "@hapi/boom";
import axios from "axios";
import dotenv from "dotenv";

dotenv.config();

const authFile = "./auth_info.json";
const { state, saveState } = useSingleFileAuthState(authFile);

const CLAN_TAG = process.env.CLAN_TAG;
const API_KEY = process.env.API_KEY;
const WHATSAPP_GROUP_ID = process.env.WHATSAPP_GROUP_ID;

let warActive = false;
let leagueActive = false;
let warEndTime = null;
let leagueEndTime = null;

async function startSock() {
  const { version } = await fetchLatestBaileysVersion();

  const sock = makeWASocket({
    version,
    auth: state,
    printQRInTerminal: true,
  });

  sock.ev.on("connection.update", (update) => {
    const { connection, lastDisconnect, qr } = update;

    if (qr) {
      console.log("QR code recebido, escaneie com seu WhatsApp:");
      console.log(qr);
    }

    if (connection === "close") {
      const statusCode = lastDisconnect?.error?.output?.statusCode;
      const shouldReconnect = statusCode !== DisconnectReason.loggedOut && statusCode !== 401;
      console.log(
        "Conexão fechada, motivo:",
        lastDisconnect?.error,
        "Reconectar:",
        shouldReconnect
      );
      if (shouldReconnect) {
        startSock();
      }
    } else if (connection === "open") {
      console.log("✅ Conectado com sucesso ao WhatsApp!");
      startMonitoring(sock);
    }
  });

  sock.ev.on("creds.update", saveState);

  return sock;
}

async function checkClashData() {
  try {
    const headers = {
      Authorization: `Bearer ${API_KEY}`,
    };

    const warRes = await axios.get(
      `https://api.clashofclans.com/v1/clans/${encodeURIComponent(CLAN_TAG)}/currentwar`,
      { headers }
    );

    const leagueRes = await axios.get(
      `https://api.clashofclans.com/v1/clans/${encodeURIComponent(CLAN_TAG)}/currentwar/leaguegroup`,
      { headers }
    );

    const war = warRes.data;
    const league = leagueRes.data;

    return { war, league };
  } catch (error) {
    console.error("Erro ao consultar API Clash:", error?.response?.data || error);
    return null;
  }
}

function formatTimeRemaining(ms) {
  if (ms <= 0) return "tempo esgotado";
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  return `${hours}h ${minutes}m`;
}

async function startMonitoring(sock) {
  console.log("🛡️ Iniciando monitoramento de guerra e liga...");

  setInterval(async () => {
    console.log(`[${new Date().toISOString()}] Verificando status do clã...`);

    const data = await checkClashData();
    if (!data) return;

    const now = Date.now();

    // === GUERRA NORMAL ===
    if (data.war.state === "inWar") {
      if (!warActive) {
        warActive = true;
        warEndTime = new Date(data.war.endTime).getTime();
        await sock.sendMessage(WHATSAPP_GROUP_ID, {
          text: `⚔️ Guerra começou! Termina em ${formatTimeRemaining(warEndTime - now)}`,
        });
      } else {
        const timeLeft = warEndTime - now;

        if (timeLeft > 3600000 && timeLeft % 14400000 < 300000) {
          await sock.sendMessage(WHATSAPP_GROUP_ID, {
            text: `⏳ Guerra em andamento. Tempo restante: ${formatTimeRemaining(timeLeft)}`,
          });
        }

        if (timeLeft < 3600000 && timeLeft > 0) {
          await sock.sendMessage(WHATSAPP_GROUP_ID, {
            text: `⚠️ Falta 1 hora para a guerra acabar!`,
          });
          warEndTime = 0;
        }
      }
    } else {
      warActive = false;
      warEndTime = null;
    }

    // === LIGA DE GUERRAS ===
    const leagueState = data.league?.state || (Array.isArray(data.league?.rounds) ? "inWar" : null);

    if (leagueState === "inWar") {
      if (!leagueActive) {
        leagueActive = true;
        leagueEndTime = Date.now() + 24 * 60 * 60 * 1000; // Estimativa: 24h
        await sock.sendMessage(WHATSAPP_GROUP_ID, {
          text: `🏆 Liga de Guerras começou!`,
        });
      } else {
        const timeLeft = leagueEndTime - now;

        if (timeLeft > 3600000 && timeLeft % 14400000 < 300000) {
          await sock.sendMessage(WHATSAPP_GROUP_ID, {
            text: `⏳ Liga em andamento. Tempo restante (estimado): ${formatTimeRemaining(timeLeft)}`,
          });
        }

        if (timeLeft < 3600000 && timeLeft > 0) {
          await sock.sendMessage(WHATSAPP_GROUP_ID, {
            text: `⚠️ Falta 1 hora para a liga acabar (estimado)!`,
          });
          leagueEndTime = 0;
        }
      }
    } else {
      leagueActive = false;
      leagueEndTime = null;
    }
  }, 300000); // 5 minutos
}

startSock();