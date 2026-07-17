const { Client, GatewayIntentBits } = require('discord.js');
const express = require('express');
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

// 💾 جدول محلي لربط حسابات روبلوكس بحسابات الديسكورد (لتجنب سقوط الـ API الخارجي)
// يمكنك إضافة أي لاعب هنا مستقبلاً بهذه الطريقة: "رقم_روبلوكس": "رقم_الديسكورد"
const verifiedUsers = {
    "3581770950": "726006456003559434" // حسابك المربوط حالياً
};

app.get('/check-user', async (req, res) => {
    const robloxId = req.query.robloxId;
    console.log(`==> فحص لاعب روبلوكس برقم: ${robloxId}`);
    
    try {
        // جلب معرف الديسكورد من الجدول المحلي مباشرة
        const discordId = verifiedUsers[String(robloxId)];
        console.log(`==> رقم الديسكورد المسترجع محلياً هو: ${discordId}`);
        
        if (!discordId) {
            console.log("❌ هذا اللاعب غير مضاف في القائمة المحلية لسيرفر التوثيق");
            return res.json({ hasRole: false });
        }

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
    console.log("🚀 السيرفر يعمل بنظام التحقق المحلي فائق السرعة والأمان!");
});
