const { Client, GatewayIntentBits } = require('discord.js');
const express = require('express');
const https = require('https'); // استخدام مكتبة النظام الأصلية لضمان استقرار الاتصال
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

// دالة تجلب البيانات تلقائياً من Bloxlink مع تجاوز مشاكل وكيل Render
function getDiscordIdFromRoblox(robloxId) {
    return new Promise((resolve) => {
        const options = {
            hostname: 'api.bloxlink.cloud',
            path: `/v1/roblox-to-discord/${robloxId}`,
            method: 'GET',
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' // إيهام السيرفر بطلب طبيعي
            },
            timeout: 5000 // وقت مستقطع 5 ثوانٍ لمنع التعليق
        };

        const req = https.request(options, (res) => {
            let data = '';
            res.on('data', (chunk) => { data += chunk; });
            res.on('end', () => {
                try {
                    const parsed = JSON.parse(data);
                    if (parsed && parsed.success === true && parsed.user) {
                        resolve(String(parsed.user));
                    } else if (parsed && parsed.resolved && parsed.discordId) {
                        resolve(String(parsed.discordId));
                    } else {
                        resolve(null);
                    }
                } catch (e) {
                    resolve(null);
                }
            });
        });

        req.on('error', (e) => {
            console.log("⚠️ محاولة اتصال بديلة عبر الرابط الاحتياطي بسبب قيود الشبكة...");
            // محاولة الاتصال بالرابط البديل تلقائياً في حال فشل الأول
            https.get(`https://api.rover.link/v1/roblox-to-discord/${robloxId}`, {
                headers: { 'User-Agent': 'Mozilla/5.0' }
            }, (res2) => {
                let data2 = '';
                res2.on('data', (chunk) => { data2 += chunk; });
                res2.on('end', () => {
                    try {
                        const parsed2 = JSON.parse(data2);
                        resolve(parsed2.discordId ? String(parsed2.discordId) : null);
                    } catch { resolve(null); }
                });
            }).on('error', () => resolve(null));
        });

        req.end();
    });
}

app.get('/check-user', async (req, res) => {
    const robloxId = req.query.robloxId;
    console.log(`==> فحص تلقائي للاعب روبلوكس برقم: ${robloxId}`);
    
    try {
        // فحص تلقائي وديناميكي عبر الـ APIs
        const discordId = await getDiscordIdFromRoblox(robloxId);
        console.log(`==> رقم الديسكورد المسترجع تلقائياً: ${discordId}`);
        
        if (!discordId) {
            console.log("❌ لم يتم العثور على حساب الديسكورد المرتبط بهذا اللاعب تلقائياً.");
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
    console.log("🚀 السيرفر يعمل بنظام التوثيق التلقائي المطور مع تخطي القيود!");
});
