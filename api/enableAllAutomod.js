import fetch from "node-fetch";
import turkceKufurler from "../data/küfürler.json" assert { type: "json" };

export const config = { runtime: "edge" };

const BOT_TOKEN = process.env.BOT_TOKEN;

export default async function handler(req) {
  if (req.method !== "POST") return new Response(JSON.stringify({ error: "Only POST allowed" }), { status: 405 });

  const { searchParams } = new URL(req.url);
  const guildId = searchParams.get("guildId");

  if (!guildId) {
    return new Response(JSON.stringify({ error: "guildId parametresi gerekli" }), { status: 400 });
  }

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
        body.trigger_metadata = { keyword_filter: turkceKufurler };
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

    return new Response(JSON.stringify({ message: `Tüm AutoMod kuralları açıldı ve güncellendi (${rules.length} kural)` }), {
      status: 200,
      headers: { "Content-Type": "application/json" }
    });
  } catch (err) {
    console.error(err);
    return new Response(JSON.stringify({ error: "Bir hata oluştu", details: err.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
}A
