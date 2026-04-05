const axios = require('axios');
const cron = require('node-cron');
const http = require('http');

const APP_ID = process.env.ONESIGNAL_APP_ID;
const API_KEY = process.env.ONESIGNAL_REST_KEY;

async function startEzanRobot() {
    console.log("--- 🚀 Robot Goreve Basladi ---");
    try {
        // 1. VAKİTLERİ ÇEK (Aladhan)
        console.log("📡 Vakitler Aladhan'dan aliniyor...");
        const res = await axios.get('http://api.aladhan.com/v1/timingsByAddress?address=Buyukcekmece,Istanbul,Turkey&method=13');
        const t = res.data.data.timings;
        
        const vakitler = [
            { ad: "Imsak", saat: t.Fajr },
            { ad: "Ogle", saat: t.Dhuhr },
            { ad: "Ikindi", saat: t.Asr },
            { ad: "Aksam", saat: t.Maghrib },
            { ad: "Yatsi", saat: t.Isha }
        ];

        // 2. TEST MESAJI (14:15 için - Eğer vakit geçtiyse 14:20 yapın)
        await sendToOneSignal("TEST", "Sistem artik %100 aktif! ✅", "14:15");

        // 3. VAKİTLERİ TEK TEK PLANLA
        for (const v of vakitler) {
            await sendToOneSignal(v.ad, `${v.ad} Ezani Okunuyor...`, v.saat);
            await sendToOneSignal(`${v.ad} Uyari`, `${v.ad} ezanina 15 dakika kaldi.`, dakikaHesapla(v.saat, -15));
        }

        console.log("--- ✅ TUM PLANLAMALAR ONESIGNAL'A ILETILDI ---");
        return true;
    } catch (error) {
        console.error("❌ HATA:", error.message);
        return false;
    }
}

async function sendToOneSignal(baslik, mesaj, zaman) {
    try {
        const bugun = new Date().toISOString().split('T')[0];
        const response = await axios.post('https://onesignal.com/api/v1/notifications', {
            app_id: APP_ID,
            headings: { "tr": baslik },
            contents: { "tr": mesaj },
            included_segments: ["Subscribed Users"],
            send_after: `${bugun} ${zaman}:00 GMT+0300`
        }, {
            headers: { 'Authorization': `Basic ${API_KEY}`, 'Content-Type': 'application/json' }
        });
        if (response.data.id) console.log(`✅ Planlandi: ${baslik} (${zaman})`);
    } catch (e) {
        // Zamanı geçmiş vakitler hata verebilir, bu normaldir.
    }
}

function dakikaHesapla(saatStr, fark) {
    let [h, m] = saatStr.split(':').map(Number);
    let date = new Date();
    date.setHours(h, m + fark, 0);
    return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

// ANA SUNUCU BAŞLATMA
const server = http.createServer((req, res) => {
    res.writeHead(200);
    res.end('Bot Aktif');
});

// KRİTİK NOKTA: Önce robot işini bitirsin, sonra sunucu açılsın!
async function main() {
    await startEzanRobot();
    server.listen(process.env.PORT || 3000, () => {
        console.log("==> Render servisi simdi aktif edildi.");
    });
}

main();
cron.schedule('5 0 * * *', startEzanRobot);
