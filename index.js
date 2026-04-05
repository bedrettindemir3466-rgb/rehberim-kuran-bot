const axios = require('axios');
const http = require('http');

// Render panelindeki Environment Variables kısmından çekilen bilgiler
const APP_ID = process.env.ONESIGNAL_APP_ID;
const API_KEY = process.env.ONESIGNAL_REST_KEY;

const server = http.createServer(async (req, res) => {
    // Tarayıcıdan https://rehberim-kuran-bot.onrender.com/test-gonder adresine girince çalışır
    if (req.url === '/test-gonder') {
        console.log("--- 🚨 KANIT SİNYALİ GÖNDERİLİYOR ---");
        
        const sonuc = await kanitMesajiGonder();
        
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        if (sonuc) {
            res.end(`
                <div style="text-align:center; margin-top:50px; font-family:sans-serif;">
                    <h1 style="color:green;">✅ TALİMAT ONESIGNAL'A İLETİLDİ!</h1>
                    <p>OneSignal bu isteği kabul etti. Şimdi telefonunuzu veya OneSignal panelini kontrol edin.</p>
                </div>
            `);
        } else {
            res.end(`
                <div style="text-align:center; margin-top:50px; font-family:sans-serif;">
                    <h1 style="color:red;">❌ ONESIGNAL REDDETTİ!</h1>
                    <p>Loglara bak, bir hata var.</p>
                </div>
            `);
        }
    } else {
        // Ana sayfa mesajı
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end("<h1>Bot Aktif</h1><p>Test için sonuna <b>/test-gonder</b> ekleyin.</p>");
    }
});

async function kanitMesajiGonder() {
    try {
        const response = await axios.post('https://onesignal.com/api/v1/notifications', {
            app_id: APP_ID,
            headings: { "tr": "BAĞLANTI KANITI", "en": "CONNECTION TEST" },
            contents: { "tr": "Render üzerinden gelen onay mesajıdır!", "en": "Success from Render!" },
            // Tüm kayıtlı abonelere gönderir
            included_segments: ["Total Subscriptions"],
            isAnyWeb: true,
            isAndroid: true,
            isIos: true
        }, {
            headers: { 
                'Authorization': `Basic ${API_KEY}`,
                'Content-Type': 'application/json' 
            }
        });

        if (response.data && response.data.id) {
            console.log("🚀 ONAY: Mesaj iletildi. ID:", response.data.id);
            return true;
        }
        return false;
    } catch (e) {
        if (e.response) {
            console.error("❌ HATA DETAYI:", JSON.stringify(e.response.data));
        } else {
            console.error("❌ SİSTEMSEL HATA:", e.message);
        }
        return false;
    }
}

// Render'ın port ayarı (Varsayılan 10000)
const PORT = process.env.PORT || 10000;
server.listen(PORT, () => {
    console.log(`==> Sunucu ${PORT} portunda hazır.`);
});
