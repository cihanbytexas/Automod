// Discord AutoMod API - Vercel Edge Runtime (Updated)
export const config = {
  runtime: 'edge',
}

// Birleştirilmiş küfür listesini import et
import profanityData from '../data/profanity.json' assert { type: 'json' };

const DISCORD_API_BASE = 'https://discord.com/api/v10';

export default async function handler(request) {
  // CORS Headers
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  };

  // OPTIONS request için CORS
  if (request.method === 'OPTIONS') {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  // Sadece POST isteklerini kabul et
  if (request.method !== 'POST') {
    return new Response(
      JSON.stringify({ error: 'Sadece POST istekleri kabul edilir' }),
      {
        status: 405,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }

  try {
    // Environment variables kontrolü
    const BOT_TOKEN = process.env.BOT_TOKEN;
    if (!BOT_TOKEN) {
      return new Response(
        JSON.stringify({ error: 'BOT_TOKEN environment variable tanımlı değil' }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Request body'yi parse et
    const body = await request.json();
    const { guildId, language = 'both' } = body; // language parametresi eklendi (both, turkish, english)

    if (!guildId) {
      return new Response(
        JSON.stringify({ error: 'guildId parametresi gerekli' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Dil seçimine göre kelime listesi hazırla
    let selectedWords = [];
    switch (language.toLowerCase()) {
      case 'turkish':
        selectedWords = profanityData.turkish_words;
        break;
      case 'english':
        selectedWords = profanityData.english_words;
        break;
      case 'both':
      default:
        selectedWords = [...profanityData.turkish_words, ...profanityData.english_words];
        break;
    }

    console.log(`🎯 Seçilen dil: ${language}, Kelime sayısı: ${selectedWords.length}`);

    // Discord API Headers
    const discordHeaders = {
      'Authorization': `Bot ${BOT_TOKEN}`,
      'Content-Type': 'application/json',
    };

    // Mevcut AutoMod kurallarını al
    const rulesResponse = await fetch(
      `${DISCORD_API_BASE}/guilds/${guildId}/auto-moderation/rules`,
      {
        headers: discordHeaders,
      }
    );

    if (!rulesResponse.ok) {
      const error = await rulesResponse.text();
      return new Response(
        JSON.stringify({ 
          error: `Discord API Hatası: ${rulesResponse.status} - ${error}` 
        }),
        {
          status: rulesResponse.status,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const existingRules = await rulesResponse.json();

    if (!existingRules || existingRules.length === 0) {
      return new Response(
        JSON.stringify({ 
          error: 'Bu sunucuda AutoMod kuralı bulunamadı. Önce Discord\'dan manuel kural oluşturun.',
          suggestion: 'Discord Sunucu Ayarları > AutoMod > Yeni kural oluştur'
        }),
        {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    let updatedRulesCount = 0;
    const updateResults = [];
    let totalWordsAdded = 0;

    console.log(`📋 ${existingRules.length} adet AutoMod kuralı bulundu`);

    // Her kural için güncelleme yap
    for (const rule of existingRules) {
      try {
        console.log(`🔧 Kural güncelleniyor: ${rule.name} (Type: ${rule.trigger.type})`);

        // Kuralı aktif hale getir ve trigger ayarlarını güncelle
        const updatedRule = {
          name: rule.name,
          enabled: true, // Kuralı aktif et
          trigger: {
            ...rule.trigger,
          },
          actions: rule.actions,
        };

        let wordsAddedToThisRule = 0;

        // Trigger tipine göre özel ayarlar
        switch (rule.trigger.type) {
          case 1: // KEYWORD
            console.log('🔤 KEYWORD trigger güncelleniyor...');
            
            if (!updatedRule.trigger.metadata) {
              updatedRule.trigger.metadata = {};
            }
            
            const existingKeywords = updatedRule.trigger.metadata.keyword_filter || [];
            console.log(`📝 Mevcut kelime sayısı: ${existingKeywords.length}`);
            
            // Yeni kelimeleri ekle (duplicate'leri engellemek için Set kullan)
            const combinedKeywords = [...new Set([...existingKeywords, ...selectedWords])];
            wordsAddedToThisRule = combinedKeywords.length - existingKeywords.length;
            totalWordsAdded += wordsAddedToThisRule;
            
            updatedRule.trigger.metadata = {
              ...updatedRule.trigger.metadata,
              keyword_filter: combinedKeywords,
              presets: [1, 2, 3], // Tüm preset'leri aktif et (küfür, cinsel içerik, hakaret)
              allow_list: [], // Beyaz liste temizle
              regex_patterns: [] // Regex temizle (opsiyonel)
            };

            console.log(`✅ ${wordsAddedToThisRule} yeni kelime eklendi, toplam: ${combinedKeywords.length}`);
            break;

          case 3: // SPAM
            console.log('🚫 SPAM trigger güncelleniyor...');
            
            if (!updatedRule.trigger.metadata) {
              updatedRule.trigger.metadata = {};
            }
            // Spam korumasını maksimuma çıkar
            updatedRule.trigger.metadata.mention_total_limit = 5; // Maximum mention limit
            break;

          case 4: // KEYWORD_PRESET  
            console.log('📋 KEYWORD_PRESET trigger güncelleniyor...');
            
            if (!updatedRule.trigger.metadata) {
              updatedRule.trigger.metadata = {};
            }
            // Preset ayarlarını maksimuma çıkar
            updatedRule.trigger.metadata.presets = [1, 2, 3]; // Tüm preset'ler
            updatedRule.trigger.metadata.allow_list = []; // Beyaz liste temizle
            break;

          case 5: // MENTION_SPAM
            console.log('📢 MENTION_SPAM trigger güncelleniyor...');
            
            if (!updatedRule.trigger.metadata) {
              updatedRule.trigger.metadata = {};
            }
            // Mention spam korumasını sıkılaştır
            updatedRule.trigger.metadata.mention_total_limit = 3; // Sıkı mention limiti
            updatedRule.trigger.metadata.mention_raid_protection_enabled = true; // Raid koruması
            break;

          default:
            console.log(`⚠️ Bilinmeyen trigger tipi: ${rule.trigger.type}`);
        }

        // Kuralı güncelle
        const updateResponse = await fetch(
          `${DISCORD_API_BASE}/guilds/${guildId}/auto-moderation/rules/${rule.id}`,
          {
            method: 'PATCH',
            headers: discordHeaders,
            body: JSON.stringify(updatedRule),
          }
        );

        if (updateResponse.ok) {
          updatedRulesCount++;
          updateResults.push({
            ruleId: rule.id,
            name: rule.name,
            status: 'success',
            type: rule.trigger.type,
            typeName: getTypeName(rule.trigger.type),
            wordsAdded: wordsAddedToThisRule,
            enabled: true
          });
          console.log(`✅ Kural başarıyla güncellendi: ${rule.name}`);
        } else {
          const errorText = await updateResponse.text();
          updateResults.push({
            ruleId: rule.id,
            name: rule.name,
            status: 'failed',
            error: errorText,
            type: rule.trigger.type,
            typeName: getTypeName(rule.trigger.type)
          });
          console.log(`❌ Kural güncellenemedi: ${rule.name} - ${errorText}`);
        }

        // Rate limit koruması (Discord API limiti)
        await new Promise(resolve => setTimeout(resolve, 100));

      } catch (error) {
        updateResults.push({
          ruleId: rule.id,
          name: rule.name,
          status: 'failed',
          error: error.message,
          type: rule.trigger ? rule.trigger.type : 'unknown',
          typeName: rule.trigger ? getTypeName(rule.trigger.type) : 'Unknown'
        });
        console.log(`💥 Kural güncelleme hatası: ${rule.name} - ${error.message}`);
      }
    }

    // Detaylı başarılı yanıt
    const response = {
      message: `AutoMod kuralları güncellendi! (${updatedRulesCount}/${existingRules.length} kural başarılı)`,
      success: updatedRulesCount === existingRules.length,
      language: language,
      stats: {
        totalRules: existingRules.length,
        updatedRules: updatedRulesCount,
        failedRules: existingRules.length - updatedRulesCount,
        totalWordsAdded: totalWordsAdded,
        selectedWordsCount: selectedWords.length,
        availableWords: {
          turkish: profanityData.turkish_words.length,
          english: profanityData.english_words.length,
          combined: profanityData.turkish_words.length + profanityData.english_words.length
        }
      },
      details: updateResults,
      timestamp: new Date().toISOString()
    };

    console.log(`🎉 İşlem tamamlandı: ${updatedRulesCount}/${existingRules.length} kural güncellendi`);

    return new Response(
      JSON.stringify(response, null, 2),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error) {
    console.error('💥 API Hatası:', error);
    return new Response(
      JSON.stringify({ 
        error: `Beklenmeyen hata: ${error.message}`,
        timestamp: new Date().toISOString()
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
}

// Helper function: Trigger type'ı açıklayıcı isme çevir
function getTypeName(triggerType) {
  const typeNames = {
    1: 'KEYWORD_FILTER',
    2: 'HARMFUL_LINK', 
    3: 'SPAM',
    4: 'KEYWORD_PRESET',
    5: 'MENTION_SPAM'
  };
  return typeNames[triggerType] || `UNKNOWN_${triggerType}`;
                  }
