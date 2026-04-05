const axios = require('axios');
const http = require('http');

const APP_ID = process.env.ONESIGNAL_APP_ID;
const API_KEY = process.env.ONESIGNAL_REST_KEY;

const server = http.createServer(async (req, res) => {
    // 1. SİZİN TAŞ GİBİ ÇALIŞAN TEST LİNKİNİZ
    if (req.url === '/test-gonder') {
        const sonuc = await kanitMesajiGonder(false); 
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(sonuc ? "<h1>✅ TELEFONA GİTTİ!</h1>" : "<h1>❌ HATA! LOGLARA BAKIN.</h1>");
    } 
    // 2. PANELDEKİ LİSTEYİ DOLDURACAK LİNK (18:00 PLANI)
    else if (req.url === '/plana-ekle') {
        const sonuc = await kanitMesajiGonder(true); 
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(sonuc ? "<h1>✅ PANELDE 18:00 İÇİN PLANLANDI!</h1>" : "<h1>❌ HATA! LOGLARA BAKIN.</h1>");
    } 
    else {
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end("<h1>Bot Hazır</h1><p>/test-gonder veya /plana-ekle</p>");
    }
});

async function kanitMesajiGonder(planliMi) {
    try {
        // SİZİN ÇALIŞAN VERİ YAPINIZIN BİREBİR AYNISI
        const veri = {
            app_id: APP_ID,
            headings: { "tr": planliMi ? "SAAT 18:00 PLANI" : "BAĞLANTI KANITI" },
            contents: { "tr": planliMi ? "Bu satırı panelde görmelisin!" : "Onay mesajıdır!" },
            included_segments: ["Total Subscriptions"],
            isAnyWeb: true,
            isAndroid: true,
            isIos: true
        };

        // Eğer planlıysa, sadece bu satırı ekliyoruz (Sihirli satır)
        if (planliMi) {
            veri.send_after = "2026-04-05 18:00:00 GMT+0300";
        }

        const response = await axios.post('https://onesignal.com/api/v1/notifications', veri, {
            headers: { 
                'Authorization': `Basic ${API_KEY}`,
                'Content-Type': 'application/json' 
            }
        });

        return !!(response.data && response.data.id);
    } catch (e) {
        console.error("❌ HATA DETAYI:", e.response ? JSON.stringify(e.response.data) : e.message);
        return false;
    }
}

const PORT = process.env.PORT || 10000;
server.listen(PORT, () => {
    console.log(`==> Sistem ${PORT} portunda emir bekliyor.`);
});
