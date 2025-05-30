const express = require('express');
const axios = require('axios');

const app = express();
const PORT = process.env.PORT || 3000;

app.get('/', async (req, res) => {
  try {
    const response = await axios.get('https://api.ipify.org?format=json');
    const ip = response.data.ip;
    console.log('IP público da instância Render:', ip);
    res.send(`Seu IP público é: ${ip}`);
  } catch (err) {
    console.error('Erro ao obter IP:', err);
    res.status(500).send('Erro ao obter IP público.');
  }
});

app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});
