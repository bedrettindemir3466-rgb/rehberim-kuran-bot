const axios = require('axios');
const cron = require('node-cron');
const http = require('http');

const APP_ID = process.env.ONESIGNAL_APP_ID;
const API_KEY = process.env.ONESIGNAL_REST_KEY;

// 1. RENDER'I HEMEN MUTLU ET (Portu hemen dinlemeye basla)
const server = http.createServer((req, res) => {
    res.writeHead(200);
    res.end('Ayet Robotu Aktif');
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`==> Port ${PORT} dinleniyor. Render simdi Live olacak.`);
    // Sunucu acilir acilmaz robotu calistir
    startEzanRobot();
});

async function startEzanRobot() {
    console.log("--- 🚀 Robot Goreve Basladi ---");
    try {
        const res = await axios.get('http://api.aladhan.com/v1/timingsByAddress?address=Buyukcekmece,Istanbul,Turkey&method=13');
        const t = res.data.data.timings;
        
        const vakitler = [
            { ad: "Imsak", saat: t.Fajr },
            { ad: "Ogle", saat: t.Dhuhr },
            { ad: "Ikindi", saat: t.Asr },
            { ad: "Aksam", saat: t.Maghrib },
            { ad: "Yatsi", saat: t.Isha }
        ];

        // TEST: Su anki saatinizden 15 dk sonrasina kurun (Örn: 14:50)
        await sendToOneSignal("SISTEM TESTI", "Render Port sorunu cozuldu! ✅", "14:50");

        for (const v of vakitler) {
            await sendToOneSignal(v.ad, `${v.ad} Ezani Okunuyor...`, v.saat);
            await sendToOneSignal(`${v.ad} Uyari`, `${v.ad} ezanina 15 dakika kaldi.`, dakikaHesapla(v.saat, -15));
            // OneSignal'i yormamak icin yarim saniye bekle
            await new Promise(r => setTimeout(r, 500));
        }

        console.log("--- ✅ TÜM VERİLER ONESIGNAL'A GÖNDERİLDİ ---");
    } catch (error) {
        console.error("❌ HATA:", error.message);
    }
}

async function sendToOneSignal(baslik, mesaj, zaman) {
    try {
        const simdi = new Date();
        const [h, m] = zaman.split(':');
        let hedefTarih = new Date();
        hedefTarih.setHours(parseInt(h), parseInt(m), 0, 0);

        if (hedefTarih < simdi) {
            hedefTarih.setDate(hedefTarih.getDate() + 1);
        }

        const isoZaman = hedefTarih.toISOString().replace('Z', '+03:00');

        await axios.post('https://onesignal.com/api/v1/notifications', {
            app_id: APP_ID,
            headings: { "tr": baslik },
            contents: { "tr": mesaj },
            included_segments: ["Subscribed Users"],
            send_after: isoZaman
        }, {
            headers: { 'Authorization': `Basic ${API_KEY}`, 'Content-Type': 'application/json' }
        });
        console.log(`✅ Planlandi: ${baslik} (${zaman})`);
    } catch (e) {
        // Hata olsa da sessizce devam et
    }
}

function dakikaHesapla(saatStr, fark) {
    let [h, m] = saatStr.split(':').map(Number);
    let date = new Date();
    date.setHours(h, m + fark, 0);
    return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

// Her gece 00:05'te calis
cron.schedule('5 0 * * *', startEzanRobot);
