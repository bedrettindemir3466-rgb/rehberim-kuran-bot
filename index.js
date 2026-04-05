const axios = require('axios');
const cron = require('node-cron');
const http = require('http');

const APP_ID = process.env.ONESIGNAL_APP_ID;
const API_KEY = process.env.ONESIGNAL_REST_KEY;

const server = http.createServer((req, res) => {
    res.writeHead(200);
    res.end('Ezan Robotu Aktif');
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`==> Sunucu ${PORT} portunda aktif.`);
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

        // TEST: 15:10 için bir test kuralım (Şu an 14:47 olduğun için tam vakti)
        await sendToOneSignal("BAGLANTI TESTI", "Sistem artik hazir! ✅", "15:10");

        for (const v of vakitler) {
            await sendToOneSignal(v.ad, `${v.ad} Ezani Okunuyor...`, v.saat);
            await sendToOneSignal(`${v.ad} Uyari`, `${v.ad} ezanina 15 dakika kaldi.`, dakikaHesapla(v.saat, -15));
            await new Promise(r => setTimeout(r, 500));
        }

        console.log("--- ✅ TÜM PLANLAMALAR TAMAMLANDI ---");
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

        // Eğer hedef saat geçildiyse yarına planla
        if (hedefTarih < simdi) {
            hedefTarih.setDate(hedefTarih.getDate() + 1);
        }

        // En garanti format: 2026-04-05 15:10:00 GMT+0300
        const yil = hedefTarih.getFullYear();
        const ay = String(hedefTarih.getMonth() + 1).padStart(2, '0');
        const gun = String(hedefTarih.getDate()).padStart(2, '0');
        const saat = String(hedefTarih.getHours()).padStart(2, '0');
        const dakika = String(hedefTarih.getMinutes()).padStart(2, '0');
        
        const formatliZaman = `${yil}-${ay}-${gun} ${saat}:${dakika}:00 GMT+0300`;

        const response = await axios.post('https://onesignal.com/api/v1/notifications', {
            app_id: APP_ID,
            headings: { "tr": baslik },
            contents: { "tr": mesaj },
            included_segments: ["Subscribed Users"],
            send_after: formatliZaman
        }, {
            headers: { 
                'Authorization': `Basic ${API_KEY}`,
                'Content-Type': 'application/json' 
            }
        });
        
        if (response.data.id) {
            console.log(`🚀 ONAY: ${baslik} (${zaman}) - ID: ${response.data.id}`);
        }
    } catch (e) {
        if (e.response) {
            console.log(`❌ HATA (${baslik}):`, JSON.stringify(e.response.data));
        }
    }
}

function dakikaHesapla(saatStr, fark) {
    let [h, m] = saatStr.split(':').map(Number);
    let date = new Date();
    date.setHours(h, m + fark, 0);
    return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

cron.schedule('5 0 * * *', startEzanRobot);
