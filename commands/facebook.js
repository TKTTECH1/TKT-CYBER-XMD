const axios = require('axios');
const fs = require('fs');
const path = require('path');
    // get message text
    const q = msg.message?.conversation ||
        msg.message?.extendedTextMessage?.text ||
        msg.message?.imageMessage?.caption ||
        msg.message?.videoMessage?.caption || '';
    if (!q || q.trim() === '') {
        await socket.sendMessage(sender, { text: '*`Need FB Video URL`*' });
        break;
    }
    // load bot name
    const sanitized = (number || '').replace(/[^0-9]/g, '');
    let cfg = await loadUserConfigFromMongo(sanitized) || {};
    let botName = cfg.botName || 'TKT-XMD'    // fake contact for quoted card
    const botMention = {
        key: {
            remoteJid: "status@broadcast",
            participant: "0@s.whatsapp.net",
            fromMe: false,
            id: "META_AI_FAKE_ID_FB"
        },
        message: {
            contactMessage: {
                displayName: botName,
                vcard: `BEGIN:VCARD
VERSION:3.0
N:${botName};;;;
FN:${botName}
ORG:Meta Platforms
TEL;type=CELL;type=VOICE;waid=13135550002:+1 313 555 0002
END:VCARD`
            }
        }
    };
    try {
        // call fbdown API
        const apiUrl = `https:///movanest.xyz/v2/fbdown?url=${encodeURIComponent(q.trim())}`;
        const apiRes = await axios.get(apiUrl, { 
            timeout: 30000,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
            }
        }).then(r => r.data).catch(e => null);
        console.log('FB API Response:', apiRes); // Log to debug
        if (!apiRes || !apiRes.status || apiRes.count !== 1 || !apiRes.results || !apiRes.results.length) {
            await socket.sendMessage(sender, { text: '*`ERROR...!`*' }, { quoted: botMention });
            break;
        }
        const result = apiRes.results[0];
        if (!result.normalQualityLink) {
            await socket.sendMessage(sender, { text: '*`No download link available`*' }, { quoted: botMention });
            break;
        }
        // Normalize
        const title = result.title && result.title !== 'No video title' ? result.title : 'Facebook Video';
        const thumb = result.thumbnail || null;
        const duration = result.duration || 'N/A';
        const normalUrl = result.normalQualityLink;
        const hdUrl = result.hdQualityLink;
        const normalFilename = `${title} (Normal).mp4`;
        const hdFilename = `${title} (HD).mp4`;
        const caption = `
\`\✨ 𝐓𝐀𝐅𝐀𝐃𝐙𝐖𝐀-𝐌𝐈𝐍𝐈-𝗙𝗕 𝗗𝗢𝗪𝗡𝗟𝗢𝗗𝗘𝗥 ✨\`\

> 🎵 *Title ┆* ${title}

> ⏱️ *Duration ┆* ${duration || 'N/A'}

> 🔊 *Quality ┆* Normal | HD

> 🔗 *Source ┆* ${q}


*💐 Reply Number Your Format*
*╭━━━━━❮ 360𝐩 ❯━━━━━━━➤*
*┣━➤ 1️⃣. 📄 MP4 as Document*
*┣━➤ 2️⃣. 🎧 MP4 as Audio*
*╰━━━━━━━━━━━━━━━━━━➤*
*╭━━━━━━❮ 𝐇𝐃 ❯━━━━━━━➤*
*┣━➤ 3️⃣. 📄 MP4 as Document*
*┣━➤ 4️⃣. 🎧 MP4 as Audio*
*╰━━━━━━━━━━━━━━━━━━➤*

> 🧑‍💻 POWERED BY ${botName}`;
        // send thumbnail card if available
        const sendOpts = { quoted: botMention };
        const media = thumb ? { image: { url: thumb }, caption } : { text: caption };
        const resMsg = await socket.sendMessage(sender, media, sendOpts);
        // handler waits for quoted reply from same sender
        const handler = async (msgUpdate) => {
            try {
                const received = msgUpdate.messages && msgUpdate.messages[0];
                if (!received) return;
                const fromId = received.key.remoteJid || received.key.participant || (received.key.fromMe && sender);
                if (fromId !== sender) return;
                const text = received.message?.conversation || received.message?.extendedTextMessage?.text;
                if (!text) return;
                // ensure they quoted our card
                const quotedId = received.message?.extendedTextMessage?.contextInfo?.stanzaId ||
                    received.message?.extendedTextMessage?.contextInfo?.quotedMessage?.key?.id;
                if (!quotedId || quotedId !== resMsg.key.id) return;
                const choice = text.toString().trim().split(/\s+/)[0];
                await socket.sendMessage(sender, { react: { text: "📥", key: received.key } });
                let downloadUrl, filename, isHd = false;
                switch (choice) {
                    case "1":
                        downloadUrl = normalUrl;
                        filename = normalFilename;
                        break;
                    case "2":
                        downloadUrl = normalUrl;
                        filename = normalFilename;
                        break;
                    case "3":
                        if (!hdUrl) {
                            await socket.sendMessage(sender, { text: "*HD not available. Use 1 or 2.*" }, { quoted: received });
                            return;
                        }
                        downloadUrl = hdUrl;
                        filename = hdFilename;
                        isHd = true;
                        break;
                    case "4":
                        if (!hdUrl) {
                            await socket.sendMessage(sender, { text: "*HD not available. Use 1 or 2.*" }, { quoted: received });
                            return;
                        }
                        downloadUrl = hdUrl;
                        filename = hdFilename;
                        isHd = true;
                        break;
                    default:
                        await socket.sendMessage(sender, { text: "*Invalid option ❗*" }, { quoted: received });
                        return;
                }
                if (choice === "1" || choice === "3") {
                    await socket.sendMessage(sender, {
                        document: { url: downloadUrl },
                        mimetype: "video/mp4",
                        fileName: filename
                    }, { quoted: received });
                } else {
                    await socket.sendMessage(sender, {
                        video: { url: downloadUrl },
                        mimetype: "video/mp4"
                    }, { quoted: received });
                }
                // cleanup listener after successful send
                socket.ev.off('messages.upsert', handler);
            } catch (err) {
                console.error("Facebook handler error:", err);
                try { socket.ev.off('messages.upsert', handler); } catch (e) {}
            }
        };
        socket.ev.on('messages.upsert', handler);
        // auto-remove handler after 60s
        setTimeout(() => {
            try { socket.ev.off('messages.upsert', handler); } catch (e) {}
        }, 60 * 1000);
        // react to original command
        await socket.sendMessage(sender, { react: { text: '✨', key: msg.key } });
    } catch (err) {
        console.error('Facebook case error:', err);
        await socket.sendMessage(sender, { text: "*`Error occurred while processing Facebook request`*" }, { quoted: botMention });
    }
    break;
        }
module.exports = facebookCommand; 
