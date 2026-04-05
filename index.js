const axios = require('axios');
const cron = require('node-cron');
const http = require('http');

const APP_ID = process.env.ONESIGNAL_APP_ID;
const API_KEY = process.env.ONESIGNAL_REST_KEY;

// Render'ı zorla açık tutan sunucu
const server = http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('Robot Aktif\n');
});

server.listen(process.env.PORT || 3000, async () => {
    console.log("--- 🚀 Robot Calismaya Basladi ---");
    await startEzanRobot();
});

async function startEzanRobot() {
    try {
        // 1. TEST BİLDİRİMİ (14:05)
        console.log("Test mesaji gonderiliyor...");
        await sendToOneSignal("TEST", "Sistem %100 calisiyor! ✅", "14:05");

        // 2. VAKİTLERİ ÇEK
        console.log("📡 Vakitler Aladhan'dan cekiliyor...");
        const res = await axios.get('http://api.aladhan.com/v1/timingsByAddress?address=Buyukcekmece,Istanbul,Turkey&method=13');
        const t = res.data.data.timings;
        
        const vakitler = [
            { ad: "Imsak", saat: t.Fajr },
            { ad: "Ogle", saat: t.Dhuhr },
            { ad: "Ikindi", saat: t.Asr },
            { ad: "Aksam", saat: t.Maghrib },
            { ad: "Yatsi", saat: t.Isha }
        ];

        // Vakitleri tek tek ve bekleyerek planla
        for (const v of vakitler) {
            await sendToOneSignal(v.ad, `${v.ad} Ezani Okunuyor...`, v.saat);
            // OneSignal'ı yormamak için 1 saniye bekle
            await new Promise(r => setTimeout(r, 1000));
        }

        console.log("--- ✅ TUM PLANLAMALAR ONESIGNAL'A ILETILDI ---");
    } catch (error) {
        console.error("❌ ANA HATA:", error.message);
    }
}

async function sendToOneSignal(baslik, mesaj, zaman) {
    try {
        const bugun = new Date().toISOString().split('T')[0];
        const data = {
            app_id: APP_ID,
            headings: { "tr": baslik },
            contents: { "tr": mesaj },
            included_segments: ["Subscribed Users"],
            send_after: `${bugun} ${zaman}:00 GMT+0300`
        };

        const response = await axios.post('https://onesignal.com/api/v1/notifications', data, {
            headers: { 
                'Authorization': `Basic ${API_KEY}`,
                'Content-Type': 'application/json' 
            }
        });
        
        if (response.data.id) {
            console.log(`✅ Basarili: ${baslik} (${zaman})`);
        }
    } catch (e) {
        const detay = e.response ? JSON.stringify(e.response.data) : e.message;
        console.log(`❌ HATA (${baslik}): ${detay}`);
    }
}

cron.schedule('5 0 * * *', startEzanRobot);
