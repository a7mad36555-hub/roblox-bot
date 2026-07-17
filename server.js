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
        // استخدام البروكسي المفتوح لتخطي حجب شبكة Render
        const proxyUrl = `https://api.allorigins.win/get?url=${encodeURIComponent(`https://api.bloxlink.cloud/v1/roblox-to-discord/${robloxId}`)}`;
        
        const response = await fetch(proxyUrl);
        if (!response.ok) return null;
        
        const wrapper = await response.json();
        
        // فك النص البرمجي المسترجع من البروكسي بشكل صحيح
        if (wrapper && wrapper.contents) {
            const data = JSON.parse(wrapper.contents);
            
            // قراءة المعرف بحسب ردود Bloxlink المتنوعة
            if (data && data.success === true && data.user) {
                return String(data.user);
            } else if (data && data.resolved && data.discordId) {
                return String(data.discordId);
            } else if (data && data.discordID) {
                return String(data.discordID);
            }
        }
        return null;
    } catch (e) {
        console.log("❌ خطأ في معالجة بيانات البروكسي:", e);
        return null;
    }
}

app.get('/check-user', async (req, res) => {
    const robloxId = req.query.robloxId;
    console.log(`==> فحص تلقائي وديناميكي للاعب روبلوكس برقم: ${robloxId}`);
    
    try {
        const discordId = await getDiscordIdFromRoblox(robloxId);
        console.log(`==> رقم الديسكورد المسترجع بنجاح عبر البروكسي هو: ${discordId}`);
        
        if (!discordId || discordId === "null") {
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
            console.log(`❌ اللاعب صاحب المعرف (${discordId}) غير موجود في سيرفر الديسكورد الخاص بك.`);
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
    console.log("🚀 السيرفر جاهز ومحدث لقراءة بيانات البروكسي بنجاح تلقائي!");
});
