const axios = require('axios');
const http = require('http');

const APP_ID = process.env.ONESIGNAL_APP_ID;
const API_KEY = process.env.ONESIGNAL_REST_KEY;
const SEHIR = "Istanbul"; 

// Ayet ve Hadis Havuzu
const ayetler = [
    { tr: "Namazı kılın, zekâtı verin. Rüku edenlerle birlikte siz de rüku edin.", en: "Establish prayer and give zakah and bow with those who bow." },
    { tr: "Sabır ve namazla Allah’tan yardım isteyin.", en: "Seek help through patience and prayer." }
];

const hadisler = [
    { tr: "Namaz dinin direğidir.", en: "Prayer is the pillar of religion." },
    { tr: "Cennetin anahtarı namazdır.", en: "The key to Paradise is prayer." }
];

const server = http.createServer(async (req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });

    if (req.url === '/vakitleri-kur') {
        try {
            const vResponse = await axios.get(`http://api.aladhan.com/v1/timingsByCity?city=${SEHIR}&country=Turkey&method=13`);
            const v = vResponse.data.data.timings;
            const bugun = new Date().toISOString().split('T')[0];

            const vakitListesi = [
                { ad: "İmsak", saat: v.Fajr },
                { ad: "Öğle", saat: v.Dhuhr },
                { ad: "İkindi", saat: v.Asr },
                { ad: "Akşam", saat: v.Maghrib },
                { ad: "Yatsı", saat: v.Isha }
            ];

            for (let vkt of vakitListesi) {
                const rAyet = ayetler[Math.floor(Math.random() * ayetler.length)];
                
                // 15 DAKİKA ÖNCE HATIRLATMA (Boşluk hatası düzeltildi)
                const hatirlatZaman = hesaplaZaman(vkt.saat, -15);
                await bildirimGonder(
                    `${vkt.ad} Vakti Yaklaşıyor`, `15 dakika sonra ${vkt.ad} vakti girecek. Hazırlanmayı unutmayın.`,
                    `${vkt.ad} Approaching`, `${vkt.ad} starts in 15 minutes.`,
                    `${bugun} ${hatirlatZaman}:00 GMT+0300`
                );

                // TAM VAKTİNDE EZAN + AYET
                await bildirimGonder(
                    `Ezan Okunuyor: ${vkt.ad}`, `${vkt.ad} vakti girdi. Ayet: ${rAyet.tr}`,
                    `Adhan: ${vkt.ad}`, `It's time for ${vkt.ad}. Verse: ${rAyet.en}`,
                    `${bugun} ${vkt.saat}:00 GMT+0300`
                );
            }

            res.end(`<h1>✅ BAŞARILI!</h1><p>${SEHIR} için tüm vakitler hatasız kuruldu.</p>`);
        } catch (e) {
            const detay = e.response ? JSON.stringify(e.response.data) : e.message;
            res.end(`<h1>❌ HATA:</h1><p>${detay}</p>`);
        }
    } else {
        res.end("<h1>Cihan Yazılım Namaz Otomasyonu</h1><p>/vakitleri-kur linkine tıkla.</p>");
    }
});

async function bildirimGonder(baslikTr, icerikTr, baslikEn, icerikEn, zaman) {
    return axios.post('https://onesignal.com/api/v1/notifications', {
        app_id: APP_ID,
        headings: { "tr": baslikTr, "en": baslikEn },
        contents: { "tr": icerikTr, "en": icerikEn },
        included_segments: ["Total Subscriptions"],
        isAndroid: true, isIos: true,
        send_after: zaman
    }, {
        headers: { 'Authorization': `Basic ${API_KEY}`, 'Content-Type': 'application/json' }
    });
}

function hesaplaZaman(saatDizisi, farkDakika) {
    let [saat, dakika] = saatDizisi.split(':').map(Number);
    let d = new Date();
    d.setHours(saat, dakika + farkDakika, 0);
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

const PORT = process.env.PORT || 10000;
server.listen(PORT);
