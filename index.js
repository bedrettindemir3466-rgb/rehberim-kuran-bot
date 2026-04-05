const axios = require('axios');
const cron = require('node-cron');
const http = require('http');

const APP_ID = process.env.ONESIGNAL_APP_ID;
const API_KEY = process.env.ONESIGNAL_REST_KEY;

async function startEzanRobot() {
    console.log("--- 🚀 Robot Goreve Basladi ---");
    try {
        // 1. VAKİTLERİ ÇEK
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

        // 2. TEST MESAJI (Şu anki saatinizden 10-15 dk sonrasına göre planlayın)
        // Saat 14:15 civarı ise bunu 14:30 yapabilirsiniz.
        await sendToOneSignal("ZAMAN TESTI", "ISO formatıyla ilk bildirim! ✅", "14:30");

        // 3. VAKİTLERİ PLANLA
        for (const v of vakitler) {
            await sendToOneSignal(v.ad, `${v.ad} Ezani Okunuyor...`, v.saat);
            await sendToOneSignal(`${v.ad} Uyari`, `${v.ad} ezanina 15 dakika kaldi.`, dakikaHesapla(v.saat, -15));
            await new Promise(r => setTimeout(r, 1000));
        }

        console.log("--- ✅ TUM PLANLAMALAR TAMAMLANDI ---");
    } catch (error) {
        console.error("❌ ANA HATA:", error.message);
    }
}

async function sendToOneSignal(baslik, mesaj, zaman) {
    try {
        const simdi = new Date();
        const [h, m] = zaman.split(':');
        
        let hedefTarih = new Date();
        hedefTarih.setHours(parseInt(h), parseInt(m), 0, 0);

        // Eğer vakit bugün geçtiyse yarına planla
        if (hedefTarih < simdi) {
            hedefTarih.setDate(hedefTarih.getDate() + 1);
        }

        // OneSignal için ISO 8601 formatı (İstanbul GMT+3)
        // Örn: 2026-04-05T14:30:00+03:00
        const isoZaman = hedefTarih.toISOString().replace('Z', '+03:00');

        await axios.post('https://onesignal.com/api/v1/notifications', {
            app_id: APP_ID,
            headings: { "tr": baslik },
            contents: { "tr": mesaj },
            included_segments: ["Subscribed Users"],
            send_after: isoZaman
        }, {
            headers: { 
                'Authorization': `Basic ${API_KEY}`,
                'Content-Type': 'application/json' 
            }
        });
        
        console.log(`✅ Basarili: ${baslik} (${zaman})`);
    } catch (e) {
        // Hata olsa da robotun çökmemesi için sadece yazdırıyoruz
    }
}

function dakikaHesapla(saatStr, fark) {
    let [h, m] = saatStr.split(':').map(Number);
    let date = new Date();
    date.setHours(h, m + fark, 0);
    return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

const server = http.createServer((req, res) => {
    res.writeHead(200);
    res.end('Bot Aktif');
});

async function main() {
    await startEzanRobot();
    server.listen(process.env.PORT || 3000, () => {
        console.log("==> Servis Ayakta.");
    });
}

main();
cron.schedule('5 0 * * *', startEzanRobot);
