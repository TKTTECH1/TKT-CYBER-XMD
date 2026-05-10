const fs = require('fs');
const path = require('path');
const isOwnerOrSudo = require('../lib/isOwner');

const channelInfo = {
    contextInfo: {
        forwardingScore: 1,
        isForwarded: true,
        forwardedNewsletterMessageInfo: {
            newsletterJid: '120363418027651738@newsletter',
            newsletterName: 'TKT♡-CYBER-XMD',
            serverMessageId: -1
        }
    }
};

const configPath = path.join(__dirname, '../data/autoStatus.json');

const DEFAULT_CONFIG = {
    enabled: false,
    reactOn: false
};

const STATUS_ACTION_DELAY_MS = 3000;
const STATUS_RETRY_DELAY_MS = 5000;
const PROCESSED_STATUS_TTL_MS = 10 * 60 * 1000;
const STATUS_REACTIONS = ['💚', '🔥', '✨', '😍', '⚡', '💯', '🇿🇼', '🍻', '🎊', '🥺', '💞', '💩', '💝'];

let configCache = null;
let lastStatusActionAt = 0;
let statusQueue = Promise.resolve();
const processedStatuses = new Map();

function makePanel(title, lines = []) {
    return [
        `╭─〔 ${title} 〕─⬣`,
        ...lines.map(line => `│ ${line}`),
        '╰──────────────⬣'
    ].join('\n');
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function ensureConfigFile() {
    const dir = path.dirname(configPath);

    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }

    if (!fs.existsSync(configPath)) {
        fs.writeFileSync(configPath, JSON.stringify(DEFAULT_CONFIG, null, 2), 'utf8');
    }
}

function loadConfig(force = false) {
    try {
        if (configCache && !force) {
            return { ...configCache };
        }

        ensureConfigFile();
        const raw = fs.readFileSync(configPath, 'utf8');
        const parsed = raw ? JSON.parse(raw) : {};

        configCache = {
            ...DEFAULT_CONFIG,
            ...parsed
        };

        return { ...configCache };
    } catch (error) {
        console.error('Error loading auto status config:', error.message);
        configCache = { ...DEFAULT_CONFIG };
        return { ...configCache };
    }
}

function saveConfig(config) {
    ensureConfigFile();

    configCache = {
        ...DEFAULT_CONFIG,
        ...config
    };

    fs.writeFileSync(configPath, JSON.stringify(configCache, null, 2), 'utf8');
}

function getStatusSenderJid(statusKey = {}) {
    return statusKey?.participant || null;
}

function normalizeJidForCompare(jid) {
    if (!jid || typeof jid !== 'string') return '';
    return jid.split('@')[0].split(':')[0];
}

function uniqueJids(list = []) {
    return [...new Set(list.filter(Boolean))];
}

async function resolveStatusParticipantJid(sock, statusKey = {}) {
    const participantAlt = statusKey?.participantAlt || statusKey?.participantPn || null;
    if (participantAlt && participantAlt.includes('@')) {
        return participantAlt;
    }

    const participant = getStatusSenderJid(statusKey);
    if (!participant) {
        return null;
    }

    if (!participant.endsWith('@lid') && !participant.endsWith('@hosted.lid')) {
        return participant;
    }

    try {
        const mapped = await sock?.signalRepository?.lidMapping?.getPNForLID?.(participant);
        return mapped || participant;
    } catch (error) {
        console.error('Error resolving LID participant:', error.message);
        return participant;
    }
}

async function getStatusReactionTargets(sock, statusKey = {}) {
    const targets = [];
    const rawParticipant = getStatusSenderJid(statusKey);
    const participantAlt = statusKey?.participantAlt || statusKey?.participantPn || null;
    const resolvedParticipant = await resolveStatusParticipantJid(sock, statusKey);

    if (participantAlt && participantAlt.includes('@')) {
        targets.push(participantAlt);
    }

    if (resolvedParticipant) {
        targets.push(resolvedParticipant);
    }

    if (rawParticipant) {
        targets.push(rawParticipant);
    }

    return uniqueJids(targets);
}

function getStatusUniqueId(statusKey = {}) {
    const participant = getStatusSenderJid(statusKey) || 'unknown';
    const id = statusKey?.id || 'no-id';
    return `${participant}:${id}`;
}

function cleanupProcessedStatuses() {
    const now = Date.now();

    for (const [key, timestamp] of processedStatuses.entries()) {
        if (now - timestamp > PROCESSED_STATUS_TTL_MS) {
            processedStatuses.delete(key);
        }
    }
}

function hasProcessedStatus(statusKey) {
    cleanupProcessedStatuses();
    return processedStatuses.has(getStatusUniqueId(statusKey));
}

function markStatusProcessed(statusKey) {
    cleanupProcessedStatuses();
    processedStatuses.set(getStatusUniqueId(statusKey), Date.now());
}

function normalizeSelfJid(sock) {
    const raw = String(sock?.user?.id || '');
    const base = raw.split(':')[0];

    if (!base) return '';
    return base.includes('@') ? base : `${base}@s.whatsapp.net`;
}

function buildReadKey(statusKey = {}, participant) {
    return {
        remoteJid: 'status@broadcast',
        id: statusKey.id,
        participant: participant || statusKey.participant,
        fromMe: false
    };
}

function getRandomStatusReaction() {
    return STATUS_REACTIONS[Math.floor(Math.random() * STATUS_REACTIONS.length)];
}

async function throttleStatusAction() {
    const now = Date.now();
    const diff = now - lastStatusActionAt;

    if (diff < STATUS_ACTION_DELAY_MS) {
        await sleep(STATUS_ACTION_DELAY_MS - diff);
    }

    lastStatusActionAt = Date.now();
}

function enqueueStatusTask(task) {
    statusQueue = statusQueue
        .then(task)
        .catch(error => {
            console.error('AutoStatus queue error:', error.message);
        });

    return statusQueue;
}

async function safeReadStatus(sock, statusKey) {
    const participant = await resolveStatusParticipantJid(sock, statusKey);
    const readKey = buildReadKey(statusKey, participant);

    if (!readKey.id || !readKey.participant) {
        return false;
    }

    await throttleStatusAction();

    try {
        await sock.readMessages([readKey]);
        return true;
    } catch (error) {
        const message = String(error?.message || '');

        if (message.includes('rate-overlimit')) {
            console.log('AutoStatus read rate-limited, retrying...');
            await sleep(STATUS_RETRY_DELAY_MS);
            await throttleStatusAction();
            await sock.readMessages([readKey]);
            return true;
        }

        throw error;
    }
}

async function safeReactStatus(sock, statusKey, emoji = '💚') {
    const rawParticipant = getStatusSenderJid(statusKey);
    const resolvedParticipant = await resolveStatusParticipantJid(sock, statusKey);
    const participantAlt = statusKey?.participantAlt || statusKey?.participantPn || null;
    const statusJidList = await getStatusReactionTargets(sock, statusKey);

    const participantCandidates = uniqueJids([
        rawParticipant,
        participantAlt,
        resolvedParticipant
    ]);

    if (!statusKey?.id || !participantCandidates.length || !statusJidList.length) {
        return false;
    }

    await throttleStatusAction();

    let lastError;

    for (const participant of participantCandidates) {
        const reactKey = buildReadKey(statusKey, participant);

        try {
            await sock.sendMessage(
                'status@broadcast',
                {
                    react: {
                        text: emoji,
                        key: reactKey
                    }
                },
                {
                    broadcast: true,
                    statusJidList
                }
            );
            return true;
        } catch (error) {
            lastError = error;
            const message = String(error?.message || '');

            if (message.includes('rate-overlimit')) {
                console.log(`AutoStatus react rate-limited for ${participant}, retrying...`);
                await sleep(STATUS_RETRY_DELAY_MS);
                await throttleStatusAction();

                await sock.sendMessage(
                    'status@broadcast',
                    {
                        react: {
                            text: emoji,
                            key: reactKey
                        }
                    },
                    {
                        broadcast: true,
                        statusJidList
                    }
                );
                return true;
            }

            console.log(`AutoStatus react failed with participant ${participant}: ${message}`);
        }
    }

    throw lastError || new Error('Unable to react to status.');
}

async function processSingleStatus(sock, statusKey) {
    if (!statusKey || statusKey.remoteJid !== 'status@broadcast') {
        return;
    }

    const config = loadConfig();

    if (!config.enabled && !config.reactOn) {
        return;
    }

    if (hasProcessedStatus(statusKey)) {
        return;
    }

    const rawParticipant = getStatusSenderJid(statusKey);
    const participant = await resolveStatusParticipantJid(sock, statusKey);
    const selfJid = normalizeSelfJid(sock);

    if (!participant) {
        return;
    }

    if (
        normalizeJidForCompare(participant) === normalizeJidForCompare(selfJid) ||
        normalizeJidForCompare(rawParticipant) === normalizeJidForCompare(selfJid)
    ) {
        return;
    }

    try {
        let acted = false;

        if (config.enabled) {
            const viewed = await safeReadStatus(sock, statusKey);

            if (viewed) {
                acted = true;
                console.log(`Auto-viewed status from ${participant}${rawParticipant && rawParticipant !== participant ? ` (raw: ${rawParticipant})` : ''}`);
            }
        }

        if (config.reactOn) {
            const reacted = await safeReactStatus(sock, statusKey, getRandomStatusReaction());

            if (reacted) {
                acted = true;
                console.log(`Auto-reacted to status from ${participant}${rawParticipant && rawParticipant !== participant ? ` (raw: ${rawParticipant})` : ''}`);
            }
        }

        if (acted) {
            markStatusProcessed(statusKey);
        } else {
            console.log(`AutoStatus skipped ${participant} because no action was enabled.`);
        }
    } catch (error) {
        console.error('Error processing status:', error.message);
    }
}

async function autoStatusCommand(sock, chatId, msg, args = []) {
    try {
        ensureConfigFile();

        const senderId = msg?.key?.participant || msg?.key?.remoteJid;
        const isOwner = await isOwnerOrSudo(senderId, sock, chatId);

        if (!msg?.key?.fromMe && !isOwner) {
            await sock.sendMessage(
                chatId,
                {
                    text: makePanel('ᴀᴜᴛᴏ sᴛᴀᴛᴜs', [
                        '❌ ᴛʜɪs ᴄᴏᴍᴍᴀɴᴅ ɪs ꜰᴏʀ ᴏᴡɴᴇʀ ᴏɴʟʏ.'
                    ]),
                    ...channelInfo
                },
                { quoted: msg }
            );
            return;
        }

        const config = loadConfig();
        const sub = String(args[0] || '').toLowerCase();
        const sub2 = String(args[1] || '').toLowerCase();

        if (!sub) {
            await sock.sendMessage(
                chatId,
                {
                    text: makePanel('ᴀᴜᴛᴏ sᴛᴀᴛᴜs', [
                        `📌 ᴠɪᴇᴡ: ${config.enabled ? 'ON' : 'OFF'}`,
                        `💚 ʀᴇᴀᴄᴛ: ${config.reactOn ? 'ON' : 'OFF'}`,
                        '',
                        '• .autostatus on',
                        '• .autostatus off',
                        '• .autostatus react on',
                        '• .autostatus react off'
                    ]),
                    ...channelInfo
                },
                { quoted: msg }
            );
            return;
        }

        if (sub === 'on') {
            config.enabled = true;
            saveConfig(config);

            await sock.sendMessage(
                chatId,
                {
                    text: makePanel('ᴀᴜᴛᴏ sᴛᴀᴛᴜs', [
                        '✅ ᴀᴜᴛᴏ sᴛᴀᴛᴜs ᴠɪᴇᴡ ᴇɴᴀʙʟᴇᴅ.'
                    ]),
                    ...channelInfo
                },
                { quoted: msg }
            );
            return;
        }

        if (sub === 'off') {
            config.enabled = false;
            saveConfig(config);

            await sock.sendMessage(
                chatId,
                {
                    text: makePanel('ᴀᴜᴛᴏ sᴛᴀᴛᴜs', [
                        '❌ ᴀᴜᴛᴏ sᴛᴀᴛᴜs ᴠɪᴇᴡ ᴅɪsᴀʙʟᴇᴅ.'
                    ]),
                    ...channelInfo
                },
                { quoted: msg }
            );
            return;
        }

        if (sub === 'react') {
            if (!sub2) {
                await sock.sendMessage(
                    chatId,
                    {
                        text: makePanel('ᴀᴜᴛᴏ sᴛᴀᴛᴜs', [
                            '❌ ᴜsᴇ: .autostatus react on/off'
                        ]),
                        ...channelInfo
                    },
                    { quoted: msg }
                );
                return;
            }

            if (sub2 === 'on') {
                config.reactOn = true;
                saveConfig(config);

                await sock.sendMessage(
                    chatId,
                    {
                        text: makePanel('ᴀᴜᴛᴏ sᴛᴀᴛᴜs', [
                            '✅ sᴛᴀᴛᴜs ʀᴇᴀᴄᴛɪᴏɴ ᴇɴᴀʙʟᴇᴅ.',
                            '⚠️ sᴏᴍᴇ ʙᴀɪʟᴇʏs ʙᴜɪʟᴅs ᴍᴀʏ sᴛɪʟʟ ɴᴏᴛ sʜᴏᴡ',
                            'ᴠɪsɪʙʟᴇ sᴛᴀᴛᴜs ʀᴇᴀᴄᴛɪᴏɴs.'
                        ]),
                        ...channelInfo
                    },
                    { quoted: msg }
                );
                return;
            }

            if (sub2 === 'off') {
                config.reactOn = false;
                saveConfig(config);

                await sock.sendMessage(
                    chatId,
                    {
                        text: makePanel('ᴀᴜᴛᴏ sᴛᴀᴛᴜs', [
                            '❌ sᴛᴀᴛᴜs ʀᴇᴀᴄᴛɪᴏɴ ᴅɪsᴀʙʟᴇᴅ.'
                        ]),
                        ...channelInfo
                    },
                    { quoted: msg }
                );
                return;
            }

            await sock.sendMessage(
                chatId,
                {
                    text: makePanel('ᴀᴜᴛᴏ sᴛᴀᴛᴜs', [
                        '❌ ᴜsᴇ: .autostatus react on/off'
                    ]),
                    ...channelInfo
                },
                { quoted: msg }
            );
            return;
        }

        await sock.sendMessage(
            chatId,
            {
                text: makePanel('ᴀᴜᴛᴏ sᴛᴀᴛᴜs', [
                    '❌ ɪɴᴠᴀʟɪᴅ ᴀᴜᴛᴏsᴛᴀᴛᴜs ᴄᴏᴍᴍᴀɴᴅ.'
                ]),
                ...channelInfo
            },
            { quoted: msg }
        );
    } catch (error) {
        console.error('Error in autoStatusCommand:', error);
        await sock.sendMessage(
            chatId,
            {
                text: makePanel('ᴀᴜᴛᴏ sᴛᴀᴛᴜs', [
                    `❌ ᴇʀʀᴏʀ: ${error.message}`
                ]),
                ...channelInfo
            },
            { quoted: msg }
        );
    }
}

async function handleStatusUpdate(sock, payload) {
    try {
        const statusKeys = [];

        if (payload?.messages && Array.isArray(payload.messages)) {
            for (const msg of payload.messages) {
                if (msg?.key?.remoteJid === 'status@broadcast') {
                    statusKeys.push(msg.key);
                }
            }
        } else if (payload?.key?.remoteJid === 'status@broadcast') {
            statusKeys.push(payload.key);
        }

        if (!statusKeys.length) {
            return;
        }

        for (const statusKey of statusKeys) {
            await enqueueStatusTask(() => processSingleStatus(sock, statusKey));
        }
    } catch (error) {
        console.error('Error in handleStatusUpdate:', error.message);
    }
}

module.exports = {
    autoStatusCommand,
    autostatusCommand: autoStatusCommand,
    handleStatusUpdate,
    handleStatusUpsert: handleStatusUpdate
};
