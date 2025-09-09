import fetch from "node-fetch";
import fs from "fs";

const DISCORD_API = "https://discord.com/api/v10";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Only POST allowed" });

  const { guildId } = req.body;
  if (!guildId) return res.status(400).json({ error: "guildId is required" });

  // Küfürler JSON'u oku
  let kufurler = [];
  try {
    kufurler = JSON.parse(fs.readFileSync("./data/kufurler.json", "utf8"));
  } catch (err) {
    return res.status(500).json({ error: "Küfürler JSON okunamadı" });
  }

  const rules = [
    {
      name: "Küfür Engelle",
      event_type: 1,
      trigger_type: 1,
      trigger_metadata: { keyword_filter: kufurler, presets: [] },
      actions: [{ type: 1, metadata: { channel_id: null, custom_message: "Küfür yasak!" } }]
    },
    {
      name: "Spam Engelle",
      event_type: 1,
      trigger_type: 3, // Spam trigger
      trigger_metadata: {},
      actions: [{ type: 1, metadata: { channel_id: null, custom_message: "EnForce Automod spam security system" } }]
    },
    {
      name: "Link / Davet Engelle",
      event_type: 1,
      trigger_type: 1,
      trigger_metadata: { keyword_filter: ["https://", "http://", "discord.gg"], presets: [] },
      actions: [{ type: 1, metadata: { channel_id: null, custom_message: "EnForce Automod security system" } }]
    },
    {
      name: "Medya / NSFW Engelle",
      event_type: 1,
      trigger_type: 1,
      trigger_metadata: { keyword_filter: [], presets: [4] },
      actions: [{ type: 1, metadata: { channel_id: null, custom_message: "EnForce automod system" } }]
    }
  ];

  try {
    const results = [];

    for (let rule of rules) {
      const response = await fetch(`${DISCORD_API}/guilds/${guildId}/auto-moderation/rules`, {
        method: "POST",
        headers: {
          "Authorization": `Bot ${process.env.DISCORD_BOT_TOKEN}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify(rule)
      });

      const data = await response.json();
      results.push({ rule: rule.name, status: response.status, data });
    }

    return res.status(200).json({ success: true, results });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}
