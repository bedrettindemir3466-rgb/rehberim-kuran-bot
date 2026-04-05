const axios = require('axios');
const http = require('http');

const APP_ID = process.env.ONESIGNAL_APP_ID;
const API_KEY = process.env.ONESIGNAL_REST_KEY;

const server = http.createServer(async (req, res) => {
    if (req.url === '/plana-ekle') {
        console.log("--- 📅 PLANLAMA İSTEĞİ GÖNDERİLİYOR ---");
        
        const sonuc = await planliMesajGonder();
        
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        if (sonuc) {
            res.end("<h1>✅ PLANLANDI!</h1><p>Şimdi OneSignal panelindeki 'Scheduled' kısmını yenileyin, orada göreceksiniz.</p>");
        } else {
            res.end("<h1>❌ HATA!</h1><p>Planlama yapılamadı, logları kontrol edin.</p>");
        }
    } else {
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end("<h1>Zamanlayıcı Bot</h1><p>Planı panelde görmek için <b>/plana-ekle</b> linkine tıklayın.</p>");
    }
});

async function planliMesajGonder() {
    try {
        // 15:40 için ISO formatında zaman oluşturma (Bugünün tarihi)
        let simdi = new Date();
        // Saat 15:40, Türkiye saati (GMT+3) için Render'da 12:40 olarak ayarlanmalı veya string verilmeli
        // OneSignal "send_after" için genellikle UTC bekler. 
        // 15:40 TR saati = 12:40 UTC
        const gonderimZamani = "2026-04-05 15:40:00 GMT+0300";

        const response = await axios.post('https://onesignal.com/api/v1/notifications', {
            app_id: APP_ID,
            headings: { "tr": "ZAMANLANMIŞ TEST" },
            contents: { "tr": "Bu mesaj OneSignal panelinde planlanmıştır." },
            included_segments: ["Total Subscriptions"],
            // İŞTE KRİTİK SATIR:
            send_after: gonderimZamani 
        }, {
            headers: { 
                'Authorization': `Basic ${API_KEY}`,
                'Content-Type': 'application/json' 
            }
        });

        if (response.data.id) {
            console.log("🚀 Planlama başarılı! OneSignal ID:", response.data.id);
            return true;
        }
    } catch (e) {
        console.error("❌ Hata:", e.response ? e.response.data : e.message);
        return false;
    }
}

const PORT = process.env.PORT || 10000;
server.listen(PORT, () => {
    console.log(`==> Planlayıcı ${PORT} portunda hazır.`);
});
