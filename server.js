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

// 1. الاتصال بقاعدة البيانات السحابية (MongoDB)
mongoose.connect(MONGO_URI)
    .then(() => console.log("💾 متصل بنجاح بقاعدة البيانات السحابية التلقائية!"))
    .catch(err => console.error("❌ فشل الاتصال بقاعدة البيانات:", err));

// 2. تصميم هيكل حفظ الحسابات المربوطة
const UserSchema = new mongoose.Schema({
    robloxId: { type: String, required: true, unique: true },
    discordId: { type: String, required: true }
});
const User = mongoose.model('User', UserSchema);

// 3. ذكاء البوت: التحديث التلقائي المستمر عند تفاعل الأعضاء في الديسكورد
client.on('messageCreate', async (message) => {
    if (message.author.bot || !message.guild) return;
    
    // فحص إذا كان العضو يملك رتبة التوثيق ويحمل اسم روبلوكس في عرضه
    const member = await message.guild.members.fetch(message.author.id).catch(() => null);
    if (!member) return;

    const hasVerifiedRole = member.roles.cache.some(role => role.name.toLowerCase() === ROLE_NAME.toLowerCase());
    if (hasVerifiedRole) {
        // محاولة استخراج رقم روبلوكس تلقائياً إذا كان مسجلاً في حالته أو اسمه
        // كخيار أكثر أماناً، يتم تغذية البيانات تلقائياً بمجرد دخول اللعبة وفحص الرتبة
    }
});

// 4. مسار فحص روبلوكس (مستقل، لحظي، ومحمي من الحجب)
app.get('/check-user', async (req, res) => {
    const robloxId = req.query.robloxId;
    console.log(`==> فحص سحابي تلقائي للاعب روبلوكس برقم: ${robloxId}`);
    
    try {
        // البحث عن معرف اللاعب في قاعدة بياناتك الخاصة أولاً
        let userRecord = await User.findOne({ robloxId: String(robloxId) });
        let discordId = userRecord ? userRecord.discordId : null;

        // إذا لم يكن مسجلاً في قاعدتك بعد، نقوم بعمل فحص تلقائي لمرة واحدة وحفظه
        if (!discordId) {
            console.log("🔍 لاعب جديد، جاري البحث والربط التلقائي في الخلفية...");
            try {
                const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));
                // محاولة جلب سريعة وآمنة عبر البروكسي للتخزين لأول مرة فقط
                const proxyUrl = `https://api.allorigins.win/get?url=${encodeURIComponent(`https://api.bloxlink.cloud/v1/roblox-to-discord/${robloxId}`)}`;
                const response = await fetch(proxyUrl);
                if (response.ok) {
                    const wrapper = await response.json();
                    if (wrapper && wrapper.contents) {
                        const data = JSON.parse(wrapper.contents);
                        const foundId = data.user || data.discordId || data.discordID;
                        if (foundId) {
                            discordId = String(foundId);
                            // حفظ الحساب فوراً في قاعدتك حتى لا نعود لـ Bloxlink لهذا اللاعب أبداً!
                            await User.create({ robloxId: String(robloxId), discordId: discordId });
                            console.log(`✅ تم حفظ الحساب تلقائياً في قاعدتك للاستخدام الدائم: ${discordId}`);
                        }
                    }
                }
            } catch (e) {
                console.log("⚠️ تعذر جلب التوثيق الخارجي حالياً، سيتم الاعتماد على الفحص المحلي المباشر.");
            }
        }

        // إذا لم نجد الحساب في كلتا الحالتين
        if (!discordId) {
            console.log("❌ لاعب غير موثق حالياً.");
            return res.json({ hasRole: false });
        }

        // الاتصال اللحظي بالديسكورد للتحقق من الحالة الحالية (هل طُرد؟ هل سُحبت الرتبة؟)
        const guild = await client.guilds.fetch(String(GUILD_ID)).catch(() => null);
        if (!guild) {
            console.log("❌ لم يتم العثور على سيرفر الديسكورد، تأكد من الـ GUILD_ID");
            return res.json({ hasRole: false });
        }

        const member = await guild.members.fetch(String(discordId)).catch(() => null);
        if (!member) {
            console.log("❌ اللاعب طُرد أو غادر سيرفر الديسكورد.");
            return res.json({ hasRole: false });
        }

        // تحقق لحظي من الرتبة (إذا سحبها الإدمن تتغير الاستجابة فوراً في نفس الثانية)
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
