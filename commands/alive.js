const settings = require("../settings");

async function aliveCommand(sock, chatId, message) {
    try {
        const message1 = 
            `*🎧 𝐓𝐊𝐓-𝐂𝐘𝐁𝐄𝐑-𝐗𝐌𝐃 is Alive & Kicking! 🎧*\n\n` +
            `📌 *Version:* ${settings.version}\n` +
            `📡 *Status:* Online & Ready\n` +
            `🌍 *Mode:* Public\n` +
            `👨‍💻 *Developer:*𝐓𝐀𝐅𝐀𝐃𝐙𝐖𝐀-𝐓𝐊𝐓_𝐓𝐄𝐂𝐇🇿🇼*\n\n` +

            `┌──────────────────────┐\n` +
            `│      ✨ Features ✨      │\n` +
            `├──────────────────────┤\n` +
            `│ • Group Management   │\n` +
            `│ • Antilink Protection│\n` +
            `│ • Fun & Games        │\n` +
            `│ • Sticker Commands   │\n` +
            `│ • And Many More!     │\n` +
            `└──────────────────────┘\n\n` +

            `💖 *Special TKT-CYBER-X𝐌D Collection* 💖\n\n` +

            `✨ *Best Friend / Bestie* ✨\n` +
            `✩ *"Hazarō aśhantir madhyē tumi āmār ēkmātrō śhantir jāygā.. 🌟\n` +
            `Durottotā kilomēṭar halē'ō, dinēr śhēṣē āmār sōb hāsir kāraṇ tumi.. 😄\n` +
            `Ēi nil digantē ēk chilitē rōd haẏē thēkō śaratkāl, priyō Bēsṭī.."* 💙✨✈️ ✩\n\n` +

            `🎀 *Banglish Translation:* 🎀\n` +
            `"হাজারো অশান্তির মধ্যে তুমি আমার একমাত্র শান্তির জায়গা.. 🌟\n` +
            `দূরত্বটা কিলোমিটার হলেও, দিনের শেষে আমার সব হাসির কারণ তুমি.. 😄\n` +
            `এই নীল দিগন্তে এক চিলতে রোদ হয়ে থাকো শরৎকাল, প্রিয় বেস্টি.."* 💙✨✈️ ✩\n\n` +

            `💕 *Ekta Cute Shayari:* 💕\n` +
            `"Bestie tumi amaar life er chocolate syrup.. 🍫\n` +
            `Je kono muhurte add korle sob mishti kore deo! 🍯✨\n` +
            `Distance thakle'o feeling ta kachhe-i.. 🥰\n` +
            `Coz tumi amaar heart er permanent guest! 🏡💖"*\n\n` +

            `🌸 *Banglish Translation:* 🌸\n` +
            `"বেস্টি তুমি আমার লাইফের চকোলেট সিরাপ.. 🍫\n` +
            `যে কোনো মুহূর্তে অ্যাড করলে সব মিষ্টি করে দাও! 🍯✨\n` +
            `দূরত্ব থাকলেও ফিলিংটা কাছেই.. 🥰\n` +
            `কারণ তুমি আমার হার্টের পার্মানেন্ট গেস্ট! 🏡💖"*\n\n` +

            `💔 *Emotional Shayari:* 💔\n` +
            `"Tu..pahle aa to sahi..🥺\n` +
            `Ek baar..nazrein mila to sahi..😳\n` +
            `Main...janaze se bhi uth ke wapas aa jaunga..🥹\n` +
            `Bas ek baar..awaaz laga to sahi..❤️‍🩹🥀"\n\n` +

            `📝 *English Meaning:* 📝\n` +
            `"You.. just come first..🥺\n` +
            `Just once.. meet my eyes..😳\n` +
            `I... will rise even from the funeral and come back..🥹\n` +
            `Just once.. call out to me..❤️‍🩹🥀"\n\n` +

            `💡 *Bestie Care Tips* 💡\n` +
            `🤗 *Daily Check-in:* HEY 👋 "How are today @! 💌\n` +
            `😂 *Fun Time:* send a  funny meme/video share chibaba! 📹\n` +
            `🎉 *Surprise:* Random e ekta cute sticker/card pathao! 🎁\n` +
            `👯 *Memory:* Memories,are remembered when you see your loved one on a photo! 📸\n` +
            `💬 *Support:* if you have a problem on this bot contact the owner! 🤝\n\n` +

            `✨ *Friendship Mantra:* ✨\n` +
            `"True friendship doesn't count miles.. 📏\n` +
            `It counts smiles, memories & care! 😊💫\n` +
            `A bestie is a sister from another mother! 👭✨\n` +
            `Distance makes the heart grow fonder! 💞🌍"\n\n` +

            `Type *.menu* to see the full command list! 🚀`;

        await sock.sendMessage(chatId, {
            text: message1,
            contextInfo: {
                forwardingScore: 999,
                isForwarded: true,
                forwardedNewsletterMessageInfo: {
                    newsletterJid: '120363418027651738@newsletter',
                    newsletterName: 'TKT-CYBER-X𝐌D',
                    serverMessageId: -1
                }
            }
        }, { quoted: message });

    } catch (error) {
        console.error('Error in alive command:', error);
        await sock.sendMessage(chatId, { 
            text: 'Bot is alive and running! 🔥' 
        }, { quoted: message });
    }
}

module.exports = aliveCommand;
