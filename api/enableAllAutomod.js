import fetch from "node-fetch";
import fs from "fs";
import dotenv from "dotenv";

dotenv.config();

// ES Module uyumlu küfür listesi yükleme
const KUFURLER = JSON.parse(
  fs.readFileSync(new URL('../data/küfürler.json', import.meta.url), "utf8")
);

const BOT_TOKEN = process.env.BOT_TOKEN;

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Only POST allowed" });

  const { guildId } = req.body;
  if (!guildId) return res.status(400).json({ error: "guildId is required in POST body" });

  const API = `https://discord.com/api/v10/guilds/${guildId}/auto-moderation/rules`;

  try {
    // Sunucudaki tüm AutoMod kurallarını al
    const rulesRes = await fetch(API, {
      headers: { Authorization: `Bot ${BOT_TOKEN}` }
    });
    const rules = await rulesRes.json();

    // Her kuralı enable et ve küfür filtresini uygula
    for (let rule of rules) {
      let body = { enabled: true };

      // Eğer kural keyword_filter içeriyorsa küfür listemizi ekle
      if (rule.trigger_type === 1) { // 1 = Keyword
        body.trigger_metadata = { keyword_filter: KUFURLER };
      }

      await fetch(`${API}/${rule.id}`, {
        method: "PATCH",
        headers: {
          Authorization: `Bot ${BOT_TOKEN}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify(body)
      });
    }

    res.status(200).json({ message: `Tüm AutoMod kuralları açıldı ve güncellendi (${rules.length} kural)` });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Bir hata oluştu", details: err.message });
  }
}
