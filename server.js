// server.js
import express from "express";
import dotenv from "dotenv";
dotenv.config();

const app = express();
const PORT = process.env.PORT || 10000;

app.get("/", (req, res) => {
  res.send("Bot Clash of Clans WhatsApp rodando!");
});

app.listen(PORT, () => {
  console.log(`Servidor escutando na porta ${PORT}`);
});