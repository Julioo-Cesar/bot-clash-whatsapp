const { default: makeWASocket, useSingleFileAuthState } = require('@adiwajshing/baileys');
const { Boom } = require('@hapi/boom');

const authFile = './auth_info.json';
const { state, saveState } = useSingleFileAuthState(authFile);

async function startBot() {
  const sock = makeWASocket({
    auth: state,
    printQRInTerminal: true, // mostra QR code no terminal
  });

  sock.ev.on('connection.update', (update) => {
    const { connection, lastDisconnect, qr } = update;

    if (qr) {
      console.log('Escaneie este QR code pelo WhatsApp no celular:\n', qr);
    }

    if (connection === 'open') {
      console.log('✅ Conectado ao WhatsApp!');
      listGroups(sock);
    }

    if (connection === 'close') {
      const shouldReconnect = (lastDisconnect?.error)?.output?.statusCode !== DisconnectReason.loggedOut;
      console.log('⚠️ Conexão fechada. Reconectando?', shouldReconnect);
      if (shouldReconnect) {
        startBot();
      } else {
        console.log('Desconectado. Faça login novamente.');
      }
    }
  });

  sock.ev.on('creds.update', saveState);
}

async function listGroups(sock) {
  const chats = await sock.groupFetchAllParticipating();
  console.log('\n📋 Grupos encontrados:');
  Object.values(chats).forEach(group => {
    console.log(`Nome: ${group.subject} | ID: ${group.id}`);
  });
}

startBot();
