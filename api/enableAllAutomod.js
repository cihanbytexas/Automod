import turkceKufurler from "../data/küfürler.json" assert { type: "json" };

export const config = { runtime: "edge" };

const BOT_TOKEN = process.env.BOT_TOKEN;

export default async function handler(req) {
  if (req.method !== "POST") 
    return new Response(JSON.stringify({ error: "Only POST allowed" }), { status: 405 });

  // POST body'yi JSON olarak al
  const body = await req.json();
  const guildId = body.guildId;

  if (!guildId) {
    return new Response(JSON.stringify({ error: "guildId parametresi gerekli" }), { status: 400 });
  }

  const API = `https://discord.com/api/v10/guilds/${guildId}/auto-moderation/rules`;

  try {
    const rulesRes = await fetch(API, {
      headers: { Authorization: `Bot ${BOT_TOKEN}` }
    });
    const rules = await rulesRes.json();

    for (let rule of rules) {
      let updateBody = { enabled: true };

      if (rule.trigger_type === 1) {
        updateBody.trigger_metadata = { keyword_filter: turkceKufurler };
      }

      await fetch(`${API}/${rule.id}`, {
        method: "PATCH",
        headers: {
          Authorization: `Bot ${BOT_TOKEN}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify(updateBody)
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
}
