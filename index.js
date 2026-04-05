const axios = require('axios');
const http = require('http');

const APP_ID = process.env.ONESIGNAL_APP_ID;
const API_KEY = process.env.ONESIGNAL_REST_KEY;

const server = http.createServer(async (req, res) => {
    // 1. SENİN ÇALIŞAN TEST KODUN (Hemen gönderir)
    if (req.url === '/test-gonder') {
        console.log("--- 🚨 TEST TETİKLENDİ ---");
        const sonuc = await kanitMesajiGonder(null); // null = anında
        
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(sonuc ? "<h1>✅ TELEFONA ANINDA GİTTİ!</h1>" : "<h1>❌ HATA!</h1>");
    } 
    // 2. SABAHTAN BERİ İSTEDİĞİMİZ PANEL PLANI (17:30'da gönderir)
    else if (req.url === '/plana-ekle') {
        console.log("--- 📅 PANEL PLANI TETİKLENDİ ---");
        const sonuc = await kanitMesajiGonder("2026-04-05 17:30:00 GMT+0300");
        
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(sonuc ? "<h1>✅ PANELDE 17:30 İÇİN PLANLANDI!</h1>" : "<h1>❌ HATA!</h1>");
    } 
    else {
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end("<h1>Bot Aktif</h1><p>/test-gonder (Anında) | /plana-ekle (Panelde Görünür)</p>");
    }
});

async function kanitMesajiGonder(zaman) {
    try {
        const body = {
            app_id: APP_ID,
            headings: { "tr": zaman ? "SAAT 17:30 PLANI" : "BAĞLANTI KANITI" },
            contents: { "tr": zaman ? "Bu mesajı panelde görmelisin!" : "Render üzerinden gelen onaydır!" },
            included_segments: ["Total Subscriptions"],
            isAnyWeb: true,
            isAndroid: true,
            isIos: true
        };

        // Eğer zaman varsa, OneSignal'a "beklet" diyoruz (Panelde görünmesini sağlayan satır)
        if (zaman) {
            body.send_after = zaman;
        }

        const response = await axios.post('https://onesignal.com/api/v1/notifications', body, {
            headers: { 
                'Authorization': `Basic ${API_KEY}`,
                'Content-Type': 'application/json' 
            }
        });

        if (response.data && response.data.id) {
            console.log("🚀 BAŞARILI. ID:", response.data.id);
            return true;
        }
        return false;
    } catch (e) {
        if (e.response) {
            console.error("❌ ONESIGNAL HATASI:", JSON.stringify(e.response.data));
        } else {
            console.error("❌ SİSTEMSEL HATA:", e.message);
        }
        return false;
    }
}

const PORT = process.env.PORT || 10000;
server.listen(PORT, () => {
    console.log(`==> Bot ${PORT} portunda hazır.`);
});
