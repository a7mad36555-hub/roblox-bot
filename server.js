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
        // استخدام بروكسي "allorigins" لتخطي مشاكل الـ DNS والاتصال المحجوب في Render
        const proxyUrl = `https://api.allorigins.win/get?url=${encodeURIComponent(`https://api.bloxlink.cloud/v1/roblox-to-discord/${robloxId}`)}`;
        
        const response = await fetch(proxyUrl);
        if (!response.ok) return null;
        
        const wrapper = await response.json();
        // البروكسي يعيد البيانات داخل متغير contents بنص نصي، نحتاج لتحويله لـ JSON
        const data = JSON.parse(wrapper.contents);
        
        if (data && data.success === true && data.user) {
            return String(data.user);
        } else if (data && data.resolved && data.discordId) {
            return String(data.discordId);
        }
        return null;
    } catch (e) {
        console.log("⚠️ فشل البروكسي الأول، جاري تجربة البروكسي البديل...");
        try {
            // بروكسي احتياطي ثانٍ في حال تعطل الأول
            const backupProxy = `https://corsproxy.io/?${encodeURIComponent(`https://api.bloxlink.cloud/v1/roblox-to-discord/${robloxId}`)}`;
            const response2 = await fetch(backupProxy);
            if (!response2.ok) return null;
            const data2 = await response2.json();
            if (data2 && data2.success === true && data2.user) return String(data2.user);
        } catch {
            return null;
        }
        return null;
    }
}

app.get('/check-user', async (req, res) => {
    const robloxId = req.query.robloxId;
    console.log(`==> فحص تلقائي وديناميكي للاعب روبلوكس برقم: ${robloxId}`);
    
    try {
        const discordId = await getDiscordIdFromRoblox(robloxId);
        console.log(`==> رقم الديسكورد المسترجع بنجاح عبر البروكسي: ${discordId}`);
        
        if (!discordId) {
            console.log("❌ لم يتم العثور على حساب الديسكورد تلقائياً.");
            return res.json({ hasRole: false });
        }

        const guild = await client.guilds.fetch(String(GUILD_ID)).catch(() => null);
        if (!guild) {
            console.log("❌ لم يتم العثور على سيرفر الديسكورد، تأكد من الـ GUILD_ID");
            return res.json({ hasRole: false });
        }

        const member = await guild.members.fetch(String(discordId)).catch(() => null);
        if (!member) {
            console.log("❌ اللاعب غير موجود في سيرفر الديسكورد الخاص بك.");
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
app.listen(3000, () => {
    console.log("🚀 السيرفر يعمل بنظام البروكسي التلقائي كاسر القيود الحالية!");
});
