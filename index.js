const axios = require('axios');
const http = require('http');

const APP_ID = process.env.ONESIGNAL_APP_ID;
const API_KEY = process.env.ONESIGNAL_REST_KEY;

const server = http.createServer(async (req, res) => {
    // 1. Sizin çalışan kodunuzdaki link (Hemen gönderir)
    if (req.url === '/test-gonder') {
        const sonuc = await kanitMesajiGonder(false); // Zaman yok
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(sonuc ? "<h1>✅ TELEFONA GİTTİ!</h1>" : "<h1>❌ HATA!</h1>");
    } 
    // 2. Panelde görünmesini sağlayacak link (17:30 planı)
    else if (req.url === '/plana-ekle') {
        const sonuc = await kanitMesajiGonder(true); // Zaman var
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(sonuc ? "<h1>✅ PANELDE PLANLANDI!</h1>" : "<h1>❌ HATA!</h1>");
    } 
    else {
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end("<h1>Bot Hazır</h1>");
    }
});

async function kanitMesajiGonder(planliMi) {
    try {
        // Sizin çalışan kodunuzdaki gövde (body) yapısı:
        const gonderilecekVeri = {
            app_id: APP_ID,
            headings: { "tr": planliMi ? "SAAT 17:30 PLANI" : "BAĞLANTI KANITI" },
            contents: { "tr": planliMi ? "Paneldeki liste doldu!" : "Render üzerinden gelen onaydır!" },
            included_segments: ["Total Subscriptions"],
            isAnyWeb: true,
            isAndroid: true,
            isIos: true
        };

        // Eğer planlı istiyorsak bu satırı ekliyoruz (Panelde görünmesini sağlayan bu)
        if (planliMi) {
            gonderilecekVeri.send_after = "2026-04-05 17:30:00 GMT+0300";
        }

        const response = await axios.post('https://onesignal.com/api/v1/notifications', gonderilecekVeri, {
            headers: { 
                'Authorization': `Basic ${API_KEY}`,
                'Content-Type': 'application/json' 
            }
        });

        return !!(response.data && response.data.id);
    } catch (e) {
        // Hata varsa Render siyah ekranda (Logs) ne olduğunu yazacak
        console.error("❌ ONESIGNAL HATASI:", e.response ? JSON.stringify(e.response.data) : e.message);
        return false;
    }
}

const PORT = process.env.PORT || 10000;
server.listen(PORT, () => {
    console.log(`==> Sistem ${PORT} portunda hazır.`);
});
