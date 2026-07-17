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
        // الانتقال إلى الـ API الخاص بـ RoVer لتخطي حجب وسقوط اتصال Render بـ Bloxlink
        const response = await fetch(`https://api.rover.link/v1/roblox-to-discord/${robloxId}`);
        if (!response.ok) {
            console.log(`❌ فشل استجابة RoVer API: ${response.status}`);
            return null;
        }
        const data = await response.json();
        
        // استخراج المعرف بنجاح من هيكلة بيانات RoVer
        return data.discordId ? String(data.discordId) : null;
    } catch (e) {
        console.log("❌ خطأ أثناء الاتصال بـ RoVer API:", e);
        return null;
    }
}

app.get('/check-user', async (req, res) => {
    const robloxId = req.query.robloxId;
    console.log(`==> فحص لاعب روبلوكس برقم: ${robloxId}`);
    
    try {
        const discordId = await getDiscordIdFromRoblox(robloxId);
        console.log(`==> رقم الديسكورد المسترجع هو: ${discordId}`);
        
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

        // فحص الرتبة داخل السيرفر
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
    console.log("🚀 السيرفر يعمل ومستعد عبر مسار RoVer البديل لتخطي أخطاء الـ DNS!");
});
