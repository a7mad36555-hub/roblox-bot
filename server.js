const { Client, GatewayIntentBits } = require('discord.js');
const express = require('express');
const fetch = require('node-fetch');
const app = express();

const client = new Client({ 
    intents: [
        GatewayIntentBits.Guilds, 
        GatewayIntentBits.GuildMembers
    ] 
});

const GUILD_ID = process.env.GUILD_ID;
const ROLE_NAME = process.env.ROLE_NAME || "Verified";
const BOT_TOKEN = process.env.DISCORD_TOKEN;

async function getDiscordIdFromRoblox(robloxId) {
    try {
        // استخدام الرابط المحدث والبديل لـ Bloxlink لضمان استرجاع البيانات
        const response = await fetch(`https://api.v2.blox.link/roblox/discord/${robloxId}`);
        if (!response.ok) return null;
        const data = await response.json();
        
        // الرابط الجديد يعيد النتيجة داخل متغير user
        return data.user ? String(data.user) : null;
    } catch (e) {
        console.log("❌ خطأ أثناء الاتصال بـ Bloxlink API:", e);
        return null;
    }
}

app.get('/check-user', async (req, res) => {
    const robloxId = req.query.robloxId;
    console.log(`==> فحص لاعب روبلوكس برقم: ${robloxId}`);
    
    try {
        const discordId = await getDiscordIdFromRoblox(robloxId);
        console.log(`==> رقم الديسكورد المسترجع من Bloxlink هو: ${discordId}`);
        
        if (!discordId) return res.json({ hasRole: false });

        const guild = await client.guilds.fetch(String(GUILD_ID)).catch(() => null);
        if (!guild) {
            console.log("❌ لم يتم العثور على سيرفر الديسكورد، تأكد من الـ GUILD_ID");
            return res.json({ hasRole: false });
        }

        const member = await guild.members.fetch(String(discordId)).catch(() => null);
        if (!member) {
            console.log("❌ لم يتم العثور على العضو داخل السيرفر!");
            return res.json({ hasRole: false });
        }

        const hasVerifiedRole = member.roles.cache.some(role => role.name.toLowerCase() === ROLE_NAME.toLowerCase());
        console.log(`==> هل يملك رتبة ${ROLE_NAME}؟ الجواب: ${hasVerifiedRole}`);
        
        return res.json({ hasRole: hasVerifiedRole });
    } catch (error) {
        console.log("❌ خطأ داخلي في السيرفر:", error);
        return res.status(500).json({ error: "Server Error" });
    }
});

client.login(BOT_TOKEN);
app.listen(3000);
