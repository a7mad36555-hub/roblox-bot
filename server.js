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
        // التحويل إلى سيرفر v3 المستقر لتجنب خطأ ENOTFOUND الخاص بـ Render
        const response = await fetch(`https://v3.blox.link/developer/roblox/${robloxId}`);
        if (!response.ok) {
            console.log(`❌ فشل استجابة Bloxlink v3: ${response.status}`);
            return null;
        }
        const data = await response.json();
        
        // قراءة وتمرير الـ ID بحسب هيكلة نظام v3
        if (data && data.user && data.user.id) {
            return String(data.user.id);
        } else if (data && data.discordId) {
            return String(data.discordId);
        }
        
        console.log("❌ Bloxlink v3 لم يعثر على الحساب:", data);
        return null;
    } catch (e) {
        console.log("❌ خطأ أثناء الاتصال بـ Bloxlink v3 API:", e);
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
            console.log("❌ لم يتم العثور على سيرفر الديسكورد، تأكد من الـ GUILD_ID في Render");
            return res.json({ hasRole: false });
        }

        const member = await guild.members.fetch(String(discordId)).catch(() => null);
        if (!member) {
            console.log("❌ لم يتم العثور على العضو داخل السيرفر!");
            return res.json({ hasRole: false });
        }

        // فحص الرتبة
        const hasVerifiedRole = member.roles.cache.some(role => role.name.toLowerCase() === ROLE_NAME.toLowerCase());
        console.log(`==> هل يملك رتبة ${ROLE_NAME}؟ الجواب: ${hasVerifiedRole}`);
        
        return res.json({ hasRole: hasVerifiedRole });
    } catch (error) {
        console.log("❌ خطأ داخلي في السيرفر:", error);
        return res.status(500).json({ error: "Server Error" });
    }
});

client.login(BOT_TOKEN);
app.listen(3000, () => {
    console.log("🚀 السيرفر يعمل ومستعد عبر مسار v3 الجديد!");
});
