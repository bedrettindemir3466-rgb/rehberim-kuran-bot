const axios = require('axios');
const http = require('http');

const APP_ID = process.env.ONESIGNAL_APP_ID;
const API_KEY = process.env.ONESIGNAL_REST_KEY;

const server = http.createServer(async (req, res) => {
    // 1. ESKİ ÇALIŞAN LİNK (Anında telefona gönderir)
    if (req.url === '/test-gonder') {
        const sonuc = await mesajGonder(null); // null = hemen gönder
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(sonuc ? "<h1>✅ ANINDA BİLDİRİM GİTTİ!</h1>" : "<h1>❌ HATA!</h1>");
    } 
    // 2. YENİ LİNK (Sabahtan beri istediğimiz o listeyi doldurur)
    else if (req.url === '/plana-ekle') {
        const sonuc = await mesajGonder("2026-04-05 17:00:00 GMT+0300");
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(sonuc ? "<h1>✅ PANELDE 17:00 İÇİN PLANLANDI!</h1>" : "<h1>❌ HATA!</h1>");
    } 
    else {
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end("<h1>Bot Hazır</h1><p>/test-gonder (Anında) | /plana-ekle (Panelde Görünür)</p>");
    }
});

async function mesajGonder(zaman) {
    try {
        const data = {
            app_id: APP_ID,
            headings: { "tr": zaman ? "SAAT 17:00 PLANI" : "ANLIK TEST" },
            contents: { "tr": zaman ? "Bu mesaj listede görünmeli!" : "Bu mesaj anında gelmeli!" },
            included_segments: ["Total Subscriptions"],
            isAndroid: true,
            isIos: true
        };

        // Eğer zaman varsa OneSignal'a "beklet" diyoruz (Panelde görünmesini sağlayan yer)
        if (zaman) {
            data.send_after = zaman;
        }

        const response = await axios.post('https://onesignal.com/api/v1/notifications', data, {
            headers: { 
                'Authorization': `Basic ${API_KEY}`,
                'Content-Type': 'application/json' 
            }
        });

        return !!(response.data && response.data.id);
    } catch (e) {
        console.error("❌ HATA:", JSON.stringify(e.response ? e.response.data : e.message));
        return false;
    }
}

const PORT = process.env.PORT || 10000;
server.listen(PORT, () => {
    console.log(`==> Sistem ${PORT} portunda hazır.`);
});
