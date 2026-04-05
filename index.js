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
        // Saat 15:40 geçtiği için 15:55'e kuruyoruz (Panelde görünmesi için)
        const gonderimZamani = "2026-04-05 15:55:00 GMT+0300";

        const response = await axios.post('https://onesignal.com/api/v1/notifications', {
            app_id: APP_ID,
            headings: { "tr": "PANEL TESTİ" },
            contents: { "tr": "Bu mesaj sabahtan beri beklediğimiz listede görünecek!" },
            included_segments: ["Total Subscriptions"],
            // Paneldeki 'Scheduled' kısmına düşüren kritik kod:
            send_after: gonderimZamani 
        }, {
            headers: { 
                'Authorization': `Basic ${API_KEY}`,
                'Content-Type': 'application/json' 
            }
        });

        if (response.data.id) return true;
    } catch (e) {
        console.error("❌ HATA SEBEBİ:", JSON.stringify(e.response ? e.response.data : e.message));
        return false;
    }
}
const PORT = process.env.PORT || 10000;
server.listen(PORT, () => {
    console.log(`==> Planlayıcı ${PORT} portunda hazır.`);
});
