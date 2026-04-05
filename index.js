const axios = require('axios');
const cron = require('node-cron');
const http = require('http');

// Render Environment Variables'dan gelen bilgiler
const APP_ID = process.env.ONESIGNAL_APP_ID;
const API_KEY = process.env.ONESIGNAL_REST_KEY;

const gunlukMesajlar = [
    { baslik: "Günün Ayeti", icerik: "“Şüphesiz güçlükle beraber bir kolaylık vardır.” (İnşirah, 5)" },
    { baslik: "Günün Hadisi", icerik: "“Kolaylaştırınız, zorlaştırmayınız; müjdeleyiniz, nefret ettirmeyiniz.” (Buhârî)" }
];

async function startEzanRobot() {
    console.log("--- 🚀 Robot Goreve Basladi ---");
    try {
        // 1. VAKİTLERİ ÇEK (İstanbul / Büyükçekmece)
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

        // 2. TEST MESAJI (Saat 14:15 için planlandı)
        await sendToOneSignal("TEST MESAJI", "Cihan Bey, sistem artik %100 aktif ve sizi taniyor! ✅", "14:15");

        // 3. GÜNLÜK MANEVİ MESAJ (Yarın Sabah 08:00)
        const rastgele = gunlukMesajlar[Math.floor(Math.random() * gunlukMesajlar.length)];
        await sendToOneSignal(rastgele.baslik, rastgele.icerik, "08:00");

        // 4. NAMAZ VAKİTLERİNİ PLANLA
        for (const v of vakitler) {
            // Ezan Vakti Bildirimi
            await sendToOneSignal(v.ad, `${v.ad} Ezani Okunuyor...`, v.saat);
            
            // 15 Dakika Önceki Hatırlatıcı
            const onbesDk = dakikaHesapla(v.saat, -15);
            await sendToOneSignal(`${v.ad} Uyari`, `${v.ad} ezanina 15 dakika kaldi.`, onbesDk);
            
            // İstekler arası kısa bekleme
            await new Promise(r => setTimeout(r, 1000));
        }

        console.log("--- ✅ TUM PLANLAMALAR ONESIGNAL'A ILETILDI ---");
        return true;
    } catch (error) {
        console.error("❌ ANA HATA:", error.message);
        return false;
    }
}

async function sendToOneSignal(baslik, mesaj, zaman) {
    try {
        const simdi = new Date();
        const tarihStr = simdi.toISOString().split('T')[0]; // YYYY-MM-DD
        const planZaman = `${tarihStr} ${zaman}:00 GMT+0300`;

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
            console.log(`✅ Planlandi: ${baslik} (${zaman})`);
        }
    } catch (e) {
        // Geçmişteki saatler (örneğin sabah geçmiş olan İmsak) için OneSignal hata verir, bu normaldir.
    }
}

function dakikaHesapla(saatStr, fark) {
    let [h, m] = saatStr.split(':').map(Number);
    let date = new Date();
    date.setHours(h, m + fark, 0);
    return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

// RENDER SERVER VE TETİKLEYİCİ
const server = http.createServer((req, res) => {
    res.writeHead(200);
    res.end('Ayet Online Robotu Aktif');
});

async function main() {
    await startEzanRobot(); // Önce planla
    server.listen(process.env.PORT || 3000, () => {
        console.log("==> Render servisi hazir.");
    });
}

main();

// Her gece 00:05'te otomatik yenileme
cron.schedule('5 0 * * *', startEzanRobot);
