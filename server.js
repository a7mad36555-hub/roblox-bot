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

// 1. الاتصال بقاعدة البيانات السحابية
mongoose.connect(MONGO_URI)
    .then(() => console.log("💾 متصل بنجاح بقاعدة البيانات السحابية!"))
    .catch(err => console.error("❌ فشل الاتصال بقاعدة البيانات:", err));

// 2. هيكل حفظ الحسابات الموثقة محلياً لتسريع العمليات اللاحقة
const UserSchema = new mongoose.Schema({
    robloxId: { type: String, required: true, unique: true },
    discordId: { type: String, required: true }
});
const User = mongoose.model('User', UserSchema);

// 3. مسار الفحص المباشر عبر Bloxlink API الرسمي
app.get('/check-user', async (req, res) => {
    const robloxId = req.query.robloxId;
    console.log(`==> جاري فحص الربط الرسمي للاعب روبلوكس بالـ ID: ${robloxId}`);
    
    try {
        const guild = await client.guilds.fetch(String(GUILD_ID)).catch(() => null);
        if (!guild) {
            console.log("❌ لم يتم العثور على سيرفر الديسكورد، تأكد من الـ GUILD_ID");
            return res.json({ hasRole: false });
        }

        // البحث في قاعدة بياناتك أولاً لتوفير الوقت
        let userRecord = await User.findOne({ robloxId: String(robloxId) });
        let discordId = userRecord ? userRecord.discordId : null;

        // إذا لم يكن مسجلاً محلياً، نسحب بيانات التوثيق الرسمية مباشرة من Bloxlink API
        if (!discordId) {
            console.log("🔍 جاري طلب التوثيق مباشرة من سيرفرات Bloxlink...");
            try {
                const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));
                // الاتصال بـ API التوثيق العالمي لـ Bloxlink باستخدام الـ Roblox ID
                const response = await fetch(`https://api.bloxlink.cloud/v1/roblox-to-discord/${robloxId}`, {
                    headers: { 'User-Agent': 'RobloxVerificationBot/1.0' }
                });

                if (response.ok) {
                    const data = await response.json();
                    const foundId = data.user || data.discordId || data.discordID;
                    if (foundId) {
                        discordId = String(foundId);
                        // حفظ التوثيق الرسمي في قاعدتك فوراً حتى لا نكرر الطلب الخارجي لنفس اللاعب
                        await User.create({ robloxId: String(robloxId), discordId: discordId }).catch(() => null);
                        console.log(`✅ تم جلب وحفظ الربط الرسمي من Bloxlink للحساب: ${discordId}`);
                    }
                } else {
                    console.log(`⚠️ سيرفر Bloxlink رد بحالة غير طبيعية: ${response.status}`);
                }
            } catch (e) {
                console.log("❌ فشل الاتصال بـ Bloxlink API الخارجي:", e.message);
            }
        }

        // إذا لم يتم العثور على أي ربط حساب رسمي للاعب في Bloxlink
        if (!discordId) {
            console.log("❌ هذا اللاعب غير موثق حسابه نهائياً في نظام Bloxlink.");
            return res.json({ hasRole: false });
        }

        // الفحص اللحظي المباشر للرتبة داخل سيرفر الديسكورد الخاص بك
        const member = await guild.members.fetch(String(discordId)).catch(() => null);
        if (!member) {
            console.log("❌ اللاعب يملك حساب موثق لكنه ليس عضواً في سيرفر الديسكورد الخاص بك.");
            return res.json({ hasRole: false });
        }

        const hasVerifiedRole = member.roles.cache.some(role => role.name.toLowerCase() === ROLE_NAME.toLowerCase());
        console.log(`==> نتيجة فحص رتبة Verified اللحظية للحساب (${member.user.tag}): ${hasVerifiedRole}`);
        
        return res.json({ hasRole: hasVerifiedRole });
    } catch (error) {
        console.log("❌ خطأ داخلي في السيرفر السحابي:", error);
        return res.status(500).json({ error: "Server Error" });
    }
});

client.login(BOT_TOKEN);
app.listen(3000, () => {
    console.log("🚀 النظام السحابي المعتمد على معرفات Bloxlink الرسمية يعمل الآن!");
});
