require('dotenv').config();
const { default: makeWASocket, useSingleFileAuthState, DisconnectReason } = require('@adiwajshing/baileys');
const { Boom } = require('@hapi/boom');
const fs = require('fs');

const authFile = './auth_info.json';
const { state, saveState } = useSingleFileAuthState(authFile);

const startSock = () => {
  const sock = makeWASocket({
    auth: state,
    printQRInTerminal: true,  // mostra QR no terminal
  });

  sock.ev.on('connection.update', (update) => {
    const { connection, lastDisconnect, qr } = update;
    if (qr) {
      console.log('QR code recebido, escaneie:');
      console.log(qr);
    }
    if (connection === 'close') {
      const shouldReconnect = (lastDisconnect.error)?.output?.statusCode !== DisconnectReason.loggedOut;
      console.log('Conexão fechada devido a', lastDisconnect.error, ', tentando reconectar:', shouldReconnect);
      if (shouldReconnect) {
        startSock();
      }
    } else if (connection === 'open') {
      console.log('Conectado ao WhatsApp!');
    }
  });

  sock.ev.on('creds.update', saveState);

  return sock;
};

startSock();
