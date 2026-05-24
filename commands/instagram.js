const { igdl } = require("ruhend-scraper");

const processedMessages = new Set();

function withNewsletter(data = {}) {
    return {
        ...data,
        contextInfo: {
            forwardingScore: 1,
            isForwarded: true,
            forwardedNewsletterMessageInfo: {
                newsletterJid: '120363418027651738@newsletter',
                newsletterName: 'ꜰᴏᴄᴜꜱ ᴍᴅ',
                serverMessageId: -1
            }
        }
    };
}

function makeBox(title, lines = []) {
    return [
        `╔═══〔 ❍ ${title} 〕═══❒`,
        ...lines.map(line => `║ ❍ ${line}`),
        `╚══════════════════❒`
    ].join('\n');
}

function getTextFromMessage(message) {
    return (
        message?.message?.conversation ||
        message?.message?.extendedTextMessage?.text ||
        message?.message?.imageMessage?.caption ||
        message?.message?.videoMessage?.caption ||
        ''
    ).trim();
}

function extractInstagramUrl(text) {
    if (!text) return null;

    const match = text.match(
        /https?:\/\/(?:www\.)?(?:instagram\.com|instagr\.am)\/[^\s]+/i
    );

    return match ? match[0] : null;
}

function isInstagramUrl(url) {
    if (!url) return false;

    return /https?:\/\/(?:www\.)?(?:instagram\.com|instagr\.am)\//i.test(url);
}

function extractUniqueMedia(mediaData) {
    const uniqueMedia = [];
    const seenUrls = new Set();

    for (const media of mediaData || []) {
        if (!media?.url) continue;

        const cleanUrl = String(media.url).trim();
        if (!cleanUrl) continue;

        if (!seenUrls.has(cleanUrl)) {
            seenUrls.add(cleanUrl);
            uniqueMedia.push({
                ...media,
                url: cleanUrl
            });
        }
    }

    return uniqueMedia;
}

function isValidMediaUrl(url) {
    if (!url || typeof url !== 'string') return false;

    return /^https?:\/\//i.test(url);
}

function isVideoMedia(media, sourceUrl = '') {
    const url = String(media?.url || '').toLowerCase();
    const source = String(sourceUrl || '').toLowerCase();
    const type = String(media?.type || '').toLowerCase();
    const mime = String(media?.mimetype || '').toLowerCase();

    return (
        type.includes('video') ||
        mime.includes('video') ||
        /\.(mp4|mov|avi|mkv|webm|m4v)$/i.test(url) ||
        source.includes('/reel/') ||
        source.includes('/tv/')
    );
}

async function instagramCommand(sock, chatId, message) {
    try {
        const messageId = message?.key?.id;

        if (messageId && processedMessages.has(messageId)) return;

        if (messageId) {
            processedMessages.add(messageId);
            setTimeout(() => processedMessages.delete(messageId), 5 * 60 * 1000);
        }

        const text = getTextFromMessage(message);
        const instagramUrl = extractInstagramUrl(text);

        if (!instagramUrl) {
            return await sock.sendMessage(
                chatId,
                withNewsletter({
                    text: makeBox('ɪɴsᴛᴀɢʀᴀᴍ ᴇʀʀᴏʀ', [
                        'ᴘʟᴇᴀsᴇ sᴇɴᴅ ᴀ ᴠᴀʟɪᴅ ɪɴsᴛᴀɢʀᴀᴍ ʟɪɴᴋ',
                        'ᴇxᴀᴍᴘʟᴇ: .ɪɢ https://instagram.com/reel/...'
                    ])
                }),
                { quoted: message }
            );
        }

        if (!isInstagramUrl(instagramUrl)) {
            return await sock.sendMessage(
                chatId,
                withNewsletter({
                    text: makeBox('ɪɴsᴛᴀɢʀᴀᴍ ᴇʀʀᴏʀ', [
                        'ᴛʜᴀᴛ ɪs ɴᴏᴛ ᴀ ᴠᴀʟɪᴅ ɪɴsᴛᴀɢʀᴀᴍ ʟɪɴᴋ',
                        'sᴇɴᴅ ᴀ ᴘᴏsᴛ, ʀᴇᴇʟ ᴏʀ ᴛᴠ ʟɪɴᴋ'
                    ])
                }),
                { quoted: message }
            );
        }

        try {
            await sock.sendMessage(chatId, {
                react: { text: '🔄', key: message.key }
            });
        } catch {}

        const downloadData = await igdl(instagramUrl);

        if (!downloadData?.data?.length) {
            return await sock.sendMessage(
                chatId,
                withNewsletter({
                    text: makeBox('ɪɴsᴛᴀɢʀᴀᴍ ᴇʀʀᴏʀ', [
                        'ɴᴏ ᴍᴇᴅɪᴀ ᴡᴀs ғᴏᴜɴᴅ',
                        'ᴛʜᴇ ᴘᴏsᴛ ᴍᴀʏ ʙᴇ ᴘʀɪᴠᴀᴛᴇ ᴏʀ ɪɴᴠᴀʟɪᴅ'
                    ])
                }),
                { quoted: message }
            );
        }

        const uniqueMedia = extractUniqueMedia(downloadData.data)
            .filter(item => isValidMediaUrl(item.url))
            .slice(0, 20);

        if (!uniqueMedia.length) {
            return await sock.sendMessage(
                chatId,
                withNewsletter({
                    text: makeBox('ɪɴsᴛᴀɢʀᴀᴍ ᴇʀʀᴏʀ', [
                        'ɴᴏ ᴠᴀʟɪᴅ ᴍᴇᴅɪᴀ ᴡᴀs ғᴏᴜɴᴅ ᴛᴏ ᴅᴏᴡɴʟᴏᴀᴅ'
                    ])
                }),
                { quoted: message }
            );
        }

        let sentCount = 0;
        let failedCount = 0;

        for (let i = 0; i < uniqueMedia.length; i++) {
            const media = uniqueMedia[i];

            try {
                const caption =
                    i === 0
                        ? `╔═══〔 ❍ ɪɴsᴛᴀɢʀᴀᴍ ᴅᴏᴡɴʟᴏᴀᴅ 〕═══❒\n` +
                          `║ ❍ ʙʀᴀɴᴅ: ꜰᴏᴄᴜꜱ ᴍᴅ\n` +
                          `║ ❍ ɪᴛᴇᴍ: ${i + 1}/${uniqueMedia.length}\n` +
                          `╚══════════════════❒`
                        : '';

                if (isVideoMedia(media, instagramUrl)) {
                    await sock.sendMessage(
                        chatId,
                        withNewsletter({
                            video: { url: media.url },
                            mimetype: 'video/mp4',
                            caption
                        }),
                        { quoted: message }
                    );
                } else {
                    await sock.sendMessage(
                        chatId,
                        withNewsletter({
                            image: { url: media.url },
                            caption
                        }),
                        { quoted: message }
                    );
                }

                sentCount++;

                if (i < uniqueMedia.length - 1) {
                    await new Promise(resolve => setTimeout(resolve, 800));
                }
            } catch (mediaError) {
                failedCount++;
                console.error(`Instagram media ${i + 1} error:`, mediaError?.message || mediaError);
            }
        }

        if (sentCount === 0) {
            return await sock.sendMessage(
                chatId,
                withNewsletter({
                    text: makeBox('ɪɴsᴛᴀɢʀᴀᴍ ᴇʀʀᴏʀ', [
                        'ғᴀɪʟᴇᴅ ᴛᴏ sᴇɴᴅ ᴀɴʏ ᴍᴇᴅɪᴀ',
                        'ᴛʀʏ ᴀɢᴀɪɴ ᴡɪᴛʜ ᴀɴᴏᴛʜᴇʀ ʟɪɴᴋ'
                    ])
                }),
                { quoted: message }
            );
        }

        try {
            await sock.sendMessage(chatId, {
                react: { text: '✅', key: message.key }
            });
        } catch {}

        await sock.sendMessage(
            chatId,
            withNewsletter({
                text: makeBox('ɪɴsᴛᴀɢʀᴀᴍ ʀᴇᴘᴏʀᴛ', [
                    `sᴇɴᴛ: ${sentCount}`,
                    `ғᴀɪʟᴇᴅ: ${failedCount}`,
                    `ʙʀᴀɴᴅ: ꜰᴏᴄᴜꜱ ᴍᴅ`
                ])
            }),
            { quoted: message }
        );

    } catch (error) {
        console.error('Error in Instagram command:', error);
        await sock.sendMessage(
            chatId,
            withNewsletter({
                text: makeBox('ɪɴsᴛᴀɢʀᴀᴍ ᴇʀʀᴏʀ', [
                    'ᴀɴ ᴇʀʀᴏʀ ᴏᴄᴄᴜʀʀᴇᴅ ᴡʜɪʟᴇ ᴘʀᴏᴄᴇssɪɴɢ',
                    'ᴘʟᴇᴀsᴇ ᴛʀʏ ᴀɢᴀɪɴ'
                ])
            }),
            { quoted: message }
        );
    }
}

module.exports = instagramCommand;