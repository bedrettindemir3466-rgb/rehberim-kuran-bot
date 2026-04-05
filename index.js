const axios = require('axios');
const http = require('http');

// Render panelindeki Environment Variables kısmından çekilen bilgiler
const APP_ID = process.env.ONESIGNAL_APP_ID;
const API_KEY = process.env.ONESIGNAL_REST_KEY;

const server = http.createServer(async (req, res) => {
    // Tarayıcıdan bu adrese girdiğinizde planlama tetiklenir:
    // https://rehberim-kuran-bot.onrender.com/plana-ekle
    if (req.url === '/plana-ekle') {
        console.log("--- 📅 17:00 PLANI ONESIGNAL'A GÖNDERİLİYOR ---");
        
        const sonuc = await planliMesajGonder();
        
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        if (sonuc) {
            res.end(`
                <div style="text-align:center; margin-top:50px; font-family:sans-serif;">
                    <h1 style="color:green;">✅ PANELDE PLANLANDI!</h1>
                    <p>OneSignal bu görevi kabul etti. Şimdi OneSignal panelindeki <b>'Scheduled'</b> kısmını yenileyin.</p>
                </div>
            `);
        } else {
            res.end(`
                <div style="text-align:center; margin-top:50px; font-family:sans-serif;">
                    <h1 style="color:red;">❌ HATA OLUŞTU!</h1>
                    <p>Render loglarını (siyah ekran) kontrol edin.</p>
                </div>
            `);
        }
    } else {
        // Ana sayfa
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end("<h1>Zamanlayıcı Bot Hazır</h1><p>Planı panelde görmek için sonuna <b>/plana-ekle</b> ekleyin.</p>");
    }
});

async function planliMesajGonder() {
    try {
        // Tam saat 17:00:00 (Türkiye Saati)
        const gonderimZamani = "2026-04-05 17:00:00 GMT+0300";

        const response = await axios.post('https://onesignal.com/api/v1/notifications', {
            app_id: APP_ID,
            headings: { "tr": "SAAT 17:00 TESTİ" },
            contents: { "tr": "Sabahtan beri beklediğimiz liste nihayet doldu!" },
            included_segments: ["Total Subscriptions"],
            // Bu parametre mesajı paneldeki 'Scheduled' (Planlanmış) sekmesine düşürür:
            send_after: gonderimZamani 
        }, {
            headers: { 
                'Authorization': `Basic ${API_KEY}`,
                'Content-Type': 'application/json' 
            }
        });

        if (response.data && response.data.id) {
            console.log("🚀 BAŞARILI: Mesaj 17:00 için planlandı. ID:", response.data.id);
            return true;
        }
        return false;
    } catch (e) {
        if (e.response) {
            console.error("❌ ONESIGNAL HATASI:", JSON.stringify(e.response.data));
        } else {
            console.error("❌ SİSTEM HATASI:", e.message);
        }
        return false;
    }
}

// Render Port Ayarı
const PORT = process.env.PORT || 10000;
server.listen(PORT, () => {
    console.log(`==> 17:00 Planlayıcı Bot ${PORT} portunda yayında.`);
});
