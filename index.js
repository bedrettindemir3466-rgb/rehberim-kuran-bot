const axios = require('axios');
const cron = require('node-cron');
const http = require('http');

const APP_ID = process.env.ONESIGNAL_APP_ID;
const API_KEY = process.env.ONESIGNAL_REST_KEY;

http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('Rehberim Kuran Bot Calisiyor\n');
}).listen(process.env.PORT || 3000);

async function startEzanRobot() {
    console.log("--- Test ve Planlama Başlatıldı ---");
    try {
        // 1. ÖZEL TEST BİLDİRİMİ (Saat 13:50 için)
        // Not: Eğer saat 13:50'yi geçtiyse burayı 1-2 dakika sonrasına ayarlayın.
        await sendToOneSignal("TEST BİLDİRİMİ", "Cihan Bey, test başarılı! Saat tam 13:50.", "13:50");

        // 2. VAKİTLERİ ÇEK (Aladhan API)
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
            await sendToOneSignal(`${v.ad} Ezanı`, `${v.ad} Ezanı Okunuyor...`, v.saat);
            const onbesDk = dakikaHesapla(v.saat, -15);
            await sendToOneSignal(`${v.ad} Uyarı`, `${v.ad} ezanına 15 dakika kaldı.`, onbesDk);
        }

        console.log("--- TÜM İŞLEMLER BİTTİ, LOGLARI KONTROL EDİN ---");
    } catch (error) {
        console.error("ANA HATA:", error.message);
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
        const planlananZaman = `${bugun} ${zaman}:00 GMT+0300`;

        const response = await axios.post('https://onesignal.com/api/v1/notifications', {
            app_id: APP_ID,
            headings: { "tr": baslik },
            contents: { "tr": mesaj },
            included_segments: ["Subscribed Users"],
            send_after: planlananZaman
        }, {
            headers: { 
                'Authorization': `Basic ${API_KEY}`,
                'Content-Type': 'application/json' 
            }
        });
        
        if (response.data.id) {
            console.log(`✅ BAŞARILI: ${baslik} (${zaman}) planlandı.`);
        }
    } catch (e) {
        const detay = e.response ? JSON.stringify(e.response.data) : e.message;
        console.log(`❌ REDDEDİLDİ (${baslik} - ${zaman}): ${detay}`);
    }
}

cron.schedule('5 0 * * *', startEzanRobot);
startEzanRobot();
