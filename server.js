import express from "express";

const app = express();

app.get("/", (req, res) => {
  res.send("🤖 Bot Clash WhatsApp está rodando!");
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
  console.log(`✅ Servidor escutando na porta ${PORT}`);
});