const axios = require('axios');
const cron = require('node-cron');
const http = require('http');

const APP_ID = process.env.ONESIGNAL_APP_ID;
const API_KEY = process.env.ONESIGNAL_REST_KEY;

http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('Ayet Online Aktif!\n');
}).listen(process.env.PORT || 3000);

async function startEzanRobot() {
    console.log("--- 🚀 Robot Calismaya Basladi ---");
    try {
        // 1. TEST BİLDİRİMİ (Saat 14:00 için)
        await sendToOneSignal("TEST", "Cihan Bey, sistem artik %100 hazir! ✅", "14:00");

        // 2. VAKİTLERİ ÇEK
        console.log("📡 Vakitler kontrol ediliyor...");
        const res = await axios.get('http://api.aladhan.com/v1/timingsByAddress?address=Buyukcekmece,Istanbul,Turkey&method=13');
        const t = res.data.data.timings;
        
        const vakitler = [
            { ad: "İmsak", saat: t.Fajr },
            { ad: "Öğle", saat: t.Dhuhr },
            { ad: "İkindi", saat: t.Asr },
            { ad: "Akşam", saat: t.Maghrib },
            { ad: "Yatsı", saat: t.Isha }
        ];

        for (let v of vakitler) {
            await sendToOneSignal(v.ad, `${v.ad} Ezani Okunuyor...`, v.saat);
            // Her gönderimden sonra 2 saniye bekle (Bağlantı kopmasın)
            await new Promise(resolve => setTimeout(resolve, 2000));
        }

        console.log("--- ✅ Tum Islemler Tamamlandi ---");
    } catch (error) {
        console.error("❌ Hata:", error.message);
    }
}

async function sendToOneSignal(baslik, mesaj, zaman) {
    try {
        const bugun = new Date().toISOString().split('T')[0];
        const planZaman = `${bugun} ${zaman}:00 GMT+0300`;

        const response = await axios.post('https://onesignal.com/api/v1/notifications', {
            app_id: APP_ID,
            headings: { "tr": baslik },
            contents: { "tr": mesaj },
            included_segments: ["Subscribed Users"],
            send_after: planZaman
        }, {
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
        console.log(`❌ Reddedildi (${baslik}): ${detay}`);
    }
}

cron.schedule('5 0 * * *', startEzanRobot);
startEzanRobot();
