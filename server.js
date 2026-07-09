const { Client, GatewayIntentBits } = require('discord.js');
const express = require('express');
const fetch = require('node-fetch');
const app = express();

const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers] });

const GUILD_ID = process.env.GUILD_ID;
const ROLE_NAME = process.env.ROLE_NAME || "Verified";
const BOT_TOKEN = process.env.DISCORD_TOKEN;

async function getDiscordIdFromRoblox(robloxId) {
    try {
        const response = await fetch(`https://api.bloxlink.cloud/v1/roblox-to-discord/${robloxId}`);
        if (!response.ok) return null;
        const data = await response.json();
        return data.resolved ? data.discordId : null;
    } catch (e) {
        return null;
    }
}

app.get('/check-user', async (req, res) => {
    const robloxId = req.query.robloxId;
    try {
        const discordId = await getDiscordIdFromRoblox(robloxId);
        if (!discordId) return res.json({ hasRole: false });

        const guild = await client.guilds.fetch(GUILD_ID).catch(() => null);
        if (!guild) return res.json({ hasRole: false });

        const member = await guild.members.fetch(discordId).catch(() => null);
        if (!member) return res.json({ hasRole: false });

        const hasVerifiedRole = member.roles.cache.some(role => role.name.toLowerCase() === ROLE_NAME.toLowerCase());
        return res.json({ hasRole: hasVerifiedRole });
    } catch (error) {
        return res.status(500).json({ error: "Server Error" });
    }
});

client.login(BOT_TOKEN);
app.listen(3000);
