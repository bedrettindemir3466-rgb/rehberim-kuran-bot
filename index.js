const axios = require('axios');
const cron = require('node-cron');
const http = require('http');

const APP_ID = process.env.ONESIGNAL_APP_ID;
const API_KEY = process.env.ONESIGNAL_REST_KEY;

// Render'ı ayakta tutan mini server
http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('Rehberim Kuran Bot Yayinda!\n');
}).listen(process.env.PORT || 3000);

async function startEzanRobot() {
    console.log("--- 🚀 Robot Goreve Basladi ---");
    try {
        // 1. TEST BİLDİRİMİ (Saat 13:55 için)
        await sendToOneSignal("TEST MESAJI", "Cihan Bey, robotumuz calisiyor! ✅", "13:55");

        // 2. VAKİTLERİ ÇEK (Aladhan API)
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
            await sendToOneSignal(v.ad, `${v.ad} Ezanı Okunuyor...`, v.saat);
            const onbesDk = dakikaHesapla(v.saat, -15);
            await sendToOneSignal(`${v.ad} Uyari`, `${v.ad} ezanina 15 dakika kaldi.`, onbesDk);
        }

        console.log("--- ✅ Tum Islemler Tamamlandi ---");
    } catch (error) {
        console.error("❌ Kritik Hata:", error.message);
    }
}

function dakikaHesapla(saatStr, fark) {
    let [h, m] = saatStr.split(':').map(Number);
    let date = new Date();
    date.setHours(h, m + fark, 0);
    return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

async function sendToOneSignal(baslik, mesaj, zaman) {
    try {
        const bugun = new Date().toISOString().split('T')[0];
        const planZaman = `${bugun} ${zaman}:00 GMT+0300`;

        const response = await axios.post('https://onesignal.com/api/v1/notifications', {
            app_id: APP_ID,
            headings: { "en": baslik, "tr": baslik },
            contents: { "en": mesaj, "tr": mesaj },
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
        const hata = e.response ? JSON.stringify(e.response.data) : e.message;
        console.log(`❌ Hata (${baslik} - ${zaman}): ${hata}`);
    }
}

cron.schedule('5 0 * * *', startEzanRobot);
startEzanRobot();
