const { Client, GatewayIntentBits } = require('discord.js');
const express = require('express');
const mongoose = require('mongoose');
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
const MONGO_URI = process.env.MONGO_URI;

// 1. الاتصال بقاعدة البيانات
mongoose.connect(MONGO_URI)
    .then(() => console.log("💾 متصل بنجاح بقاعدة البيانات السحابية!"))
    .catch(err => console.error("❌ فشل الاتصال بقاعدة البيانات:", err));

// 2. هيكل الحسابات
const UserSchema = new mongoose.Schema({
    robloxId: { type: String, required: true, unique: true },
    discordId: { type: String, required: true }
});
const User = mongoose.model('User', UserSchema);

// 3. مسار الفحص الذكي المحدث لـ Bloxlink Global
app.get('/check-user', async (req, res) => {
    const robloxId = req.query.robloxId;
    console.log(`==> جاري فحص الربط الرسمي للاعب روبلوكس بالـ ID: ${robloxId}`);
    
    try {
        const guild = await client.guilds.fetch(String(GUILD_ID)).catch(() => null);
        if (!guild) {
            console.log("❌ لم يتم العثور على سيرفر الديسكورد، تأكد من الـ GUILD_ID");
            return res.json({ hasRole: false });
        }

        // فحص قاعدة بياناتك أولاً
        let userRecord = await User.findOne({ robloxId: String(robloxId) });
        let discordId = userRecord ? userRecord.discordId : null;

        // إذا لم يكن مخزناً، نجيبه من خلال استعلام المتغيرات المباشر لـ Bloxlink
        if (!discordId) {
            console.log("🔍 جاري طلب التوثيق من نظام Bloxlink المستقر...");
            try {
                const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));
                
                // استخدام رابط الـ Global الحصري للاستعلام عن الـ ID
                const response = await fetch(`https://api.blox.link/v4/public/v1/roblox-to-discord/${robloxId}`, {
                    headers: { 'Accept': 'application/json' }
                });

                if (response.ok) {
                    const data = await response.json();
                    let foundId = data.discordId || data.user || (data.discordUsers && data.discordUsers[0]);
                    
                    if (foundId) {
                        discordId = String(foundId);
                        await User.create({ robloxId: String(robloxId), discordId: discordId }).catch(() => null);
                        console.log(`✅ تم جلب وحفظ الربط بنجاح في قاعدتك: ${discordId}`);
                    }
                } else {
                    console.log(`⚠️ سيرفر Bloxlink رد بحالة: ${response.status}. جاري الانتقال للفحص المباشر بسيرفر الديسكورد كخيار بديل تلقائي`);
                    
                    // كخيار بديل (Fallback) لو الـ API معلق: نقوم بالبحث داخل أعضاء السيرفر مباشرة بالاسم أو بشكل تقريبي لو وُجد لكي لا يتعطل اللاعب
                    const members = await guild.members.fetch({ query: req.query.username || '', limit: 1 }).catch(() => null);
                    if (members && members.first()) {
                        discordId = members.first().id;
                    }
                }
            } catch (e) {
                console.log("❌ فشل الاتصال بـ Bloxlink API:", e.message);
            }
        }

        // إذا لم نجد التوثيق ولم ينجح الفحص البديل
        if (!discordId) {
            console.log("❌ هذا اللاعب غير موثق في نظام Bloxlink.");
            return res.json({ hasRole: false });
        }

        // الفحص اللحظي للرتبة بالسيرفر
        const member = await guild.members.fetch(String(discordId)).catch(() => null);
        if (!member) {
            console.log("❌ اللاعب موثق في Bloxlink لكنه خارج سيرفر الديسكورد الخاص بك.");
            return res.json({ hasRole: false });
        }

        const hasVerifiedRole = member.roles.cache.some(role => role.name.toLowerCase() === ROLE_NAME.toLowerCase());
        console.log(`==> نتيجة فحص الرتبة اللحظية للحساب (${member.user.tag}): ${hasVerifiedRole}`);
        
        return res.json({ hasRole: hasVerifiedRole });
    } catch (error) {
        console.log("❌ خطأ داخلي:", error);
        return res.status(500).json({ error: "Server Error" });
    }
});

client.login(BOT_TOKEN);
app.listen(3000, () => {
    console.log("🚀 النظام المحدث بالكامل جاهز ويعمل الآن!");
});
