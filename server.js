const { Client, GatewayIntentBits } = require('discord.js');
const express = require('express');
const mongoose = require('mongoose');
const app = express();

const client = new Client({ 
    intents: [
        GatewayIntentBits.Guilds, 
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildMessages
    ] 
});

const GUILD_ID = process.env.GUILD_ID;
const ROLE_NAME = process.env.ROLE_NAME || "Verified";
const BOT_TOKEN = process.env.DISCORD_TOKEN;
const MONGO_URI = process.env.MONGO_URI;

// 1. الاتصال بقاعدة البيانات السحابية
mongoose.connect(MONGO_URI)
    .then(() => console.log("💾 متصل بنجاح بقاعدة البيانات السحابية التلقائية!"))
    .catch(err => console.error("❌ فشل الاتصال بقاعدة البيانات:", err));

// 2. هيكل حفظ الحسابات
const UserSchema = new mongoose.Schema({
    robloxId: { type: String, required: true, unique: true },
    discordId: { type: String, required: true }
});
const User = mongoose.model('User', UserSchema);

// 3. مسار الفحص الذكي والمستقل تماماً
app.get('/check-user', async (req, res) => {
    const robloxId = req.query.robloxId;
    const robloxName = req.query.robloxName; // سنرسل اسم اللاعب أيضاً من روبلوكس لزيادة الدقة
    
    console.log(`==> فحص سحابي تلقائي للاعب روبلوكس: ${robloxName} (${robloxId})`);
    
    try {
        const guild = await client.guilds.fetch(String(GUILD_ID)).catch(() => null);
        if (!guild) {
            console.log("❌ لم يتم العثور على سيرفر الديسكورد، تأكد من الـ GUILD_ID");
            return res.json({ hasRole: false });
        }

        // البحث عن معرف اللاعب في قاعدة بياناتك الخاصة أولاً
        let userRecord = await User.findOne({ robloxId: String(robloxId) });
        let discordId = userRecord ? userRecord.discordId : null;

        // إذا لم يكن مسجلاً في قاعدتك بعد، نبحث عنه في الديسكورد مباشرة بناءً على اسمه في روبلوكس
        if (!discordId && robloxName) {
            console.log("🔍 لاعب جديد، جاري البحث التلقائي عنه في سيرفر الديسكورد...");
            
            // جلب قائمة الأعضاء بالكامل للبحث بداخلها
            const members = await guild.members.fetch();
            const matchingMember = members.find(m => 
                (m.nickname && m.nickname.toLowerCase() === robloxName.toLowerCase()) || 
                (m.user.username.toLowerCase() === robloxName.toLowerCase()) ||
                (m.user.displayName && m.user.displayName.toLowerCase() === robloxName.toLowerCase())
            );

            if (matchingMember) {
                discordId = String(matchingMember.id);
                // حفظ الحساب فوراً في قاعدتك للاستخدام المستقبلي اللحظي
                await User.create({ robloxId: String(robloxId), discordId: discordId }).catch(() => null);
                console.log(`✅ تم ربط وحفظ الحساب تلقائياً في قاعدتك بنجاح: ${matchingMember.user.tag}`);
            }
        }

        // إذا لم نجد الحساب نهائياً
        if (!discordId) {
            console.log("❌ لاعب غير موثق أو اسمه في الديسكورد لا يطابق اسمه في روبلوكس.");
            return res.json({ hasRole: false });
        }

        // الفحص اللحظي الفعلي للرتبة داخل الديسكورد (هل طُرد؟ هل سُحبت الرتبة؟)
        const member = await guild.members.fetch(String(discordId)).catch(() => null);
        if (!member) {
            console.log("❌ اللاعب طُرد أو غادر سيرفر الديسكورد.");
            return res.json({ hasRole: false });
        }

        const hasVerifiedRole = member.roles.cache.some(role => role.name.toLowerCase() === ROLE_NAME.toLowerCase());
        console.log(`==> فحص الرتبة اللحظي لـ (${member.user.tag}): ${hasVerifiedRole}`);
        
        return res.json({ hasRole: hasVerifiedRole });
    } catch (error) {
        console.log("❌ خطأ في النظام السحابي:", error);
        return res.status(500).json({ error: "Server Error" });
    }
});

client.login(BOT_TOKEN);
app.listen(3000, () => {
    console.log("🚀 النظام السحابي التلقائي المستقل يعمل الآن بأعلى كفاءة!");
});
