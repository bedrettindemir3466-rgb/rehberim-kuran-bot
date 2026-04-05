const axios = require('axios');
const http = require('http');

const APP_ID = process.env.ONESIGNAL_APP_ID;
const API_KEY = process.env.ONESIGNAL_REST_KEY;
const SEHIR = "Istanbul"; 

const ayetler = [
    { tr: "Namazı kılın, zekâtı verin. Rüku edenlerle birlikte siz de rüku edin.", en: "Establish prayer and give zakah and bow with those who bow." },
    { tr: "Sabır ve namazla Allah’tan yardım isteyin.", en: "Seek help through patience and prayer." }
];

const server = http.createServer(async (req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });

    if (req.url === '/vakitleri-kur') {
        try {
            const vResponse = await axios.get(`http://api.aladhan.com/v1/timingsByCity?city=${SEHIR}&country=Turkey&method=13`);
            const v = vResponse.data.data.timings;

            const vakitListesi = [
                { ad: "İmsak", saat: v.Fajr },
                { ad: "Öğle", saat: v.Dhuhr },
                { ad: "İkindi", saat: v.Asr },
                { ad: "Akşam", saat: v.Maghrib },
                { ad: "Yatsı", saat: v.Isha }
            ];

            for (let vkt of vakitListesi) {
                const rAyet = ayetler[Math.floor(Math.random() * ayetler.length)];
                
                // 1. Hatırlatma (15 dk önce) ve 2. Ezan vakitlerini planla
                const planlar = [
                    { tip: "Hatırlatma", zaman: hesaplaZaman(vkt.saat, -15), baslik: `${vkt.ad} Yaklaşıyor`, icerik: "15 dakika kaldı." },
                    { tip: "Ezan", zaman: vkt.saat, baslik: `Ezan: ${vkt.ad}`, icerik: `Vakit girdi. Ayet: ${rAyet.tr}` }
                ];

                for (let p of planlar) {
                    // AKILLI TARİH: Vakit geçtiyse yarına kur
                    const tamZaman = tarihBelirle(p.zaman); 
                    
                    await bildirimGonder(
                        p.baslik, p.icerik,
                        p.baslik, p.icerik,
                        tamZaman
                    );
                }
            }
            res.end(`<h1>✅ BAŞARILI!</h1><p>Geçmiş vakitler yarına, gelecek vakitler bugüne kuruldu.</p>`);
        } catch (e) {
            const detay = e.response ? JSON.stringify(e.response.data) : e.message;
            res.end(`<h1>❌ HATA:</h1><p>${detay}</p>`);
        }
    } else {
        res.end("<h1>Cihan Yazılım Namaz Otomasyonu</h1>");
    }
});

// Vakit geçtiyse yarına atan fonksiyon
function tarihBelirle(vakitSaati) {
    const simdi = new Date(new Date().toLocaleString("en-US", {timeZone: "Europe/Istanbul"}));
    const [saat, dakika] = vakitSaati.split(':').map(Number);
    
    let hedef = new Date(simdi);
    hedef.setHours(saat, dakika, 0, 0);

    // Eğer hedef saat şu anı geçtiyse, 1 gün (24 saat) ekle
    if (hedef <= simdi) {
        hedef.setDate(hedef.getDate() + 1);
    }

    const yil = hedef.getFullYear();
    const ay = String(hedef.getMonth() + 1).padStart(2, '0');
    const gun = String(hedef.getDate()).padStart(2, '0');
    return `${yil}-${ay}-${gun} ${vakitSaati}:00 GMT+0300`;
}

async function bildirimGonder(baslikTr, icerikTr, baslikEn, icerikEn, zaman) {
    return axios.post('https://onesignal.com/api/v1/notifications', {
        app_id: APP_ID,
        headings: { "tr": baslikTr, "en": baslikEn },
        contents: { "tr": icerikTr, "en": icerikEn },
        included_segments: ["Total Subscriptions"],
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
