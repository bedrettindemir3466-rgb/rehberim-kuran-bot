const axios = require('axios');
const http = require('http');

const APP_ID = process.env.ONESIGNAL_APP_ID;
const API_KEY = process.env.ONESIGNAL_REST_KEY;

// 1. MANUEL TETİKLEME MERKEZİ
const server = http.createServer(async (req, res) => {
    // Tarayıcıdan Render linkine girildiğinde (örneğin: /test-gonder)
    if (req.url === '/test-gonder') {
        console.log("--- 🚨 MANUEL TETIKLEME ALINDI! ---");
        
        const sonuc = await kanitMesajiGonder();
        
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        if (sonuc) {
            res.end("<h1>✅ TALİMAT ONESIGNAL'A İLETİLDİ!</h1><p>Şimdi OneSignal paneline bak, eğer orada yoksa bağlantı yoktur.</p>");
        } else {
            res.end("<h1>❌ ONESIGNAL REDDETTİ!</h1><p>Loglara bak, bir hata var.</p>");
        }
    } else {
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end("<h1>Bot Calisiyor.</h1><p>Test etmek icin linkin sonuna <b>/test-gonder</b> ekle.</p>");
    }
});

async function kanitMesajiGonder() {
    try {
        console.log("📡 OneSignal'a kanit mesaji gonderiliyor...");
        
        const response = await axios.post('https://onesignal.com/api/v1/notifications', {
            app_id: APP_ID,
            headings: { "tr": "BAĞLANTI KANITI" },
            contents: { "tr": "Eğer bu mesajı panelde görüyorsan Render-OneSignal bağı kurulmuştur!" },
            included_segments: ["Subscribed Users"]
            // send_after YOK! Hemen gitsin ki kanit olsun.
        }, {
            headers: { 
                'Authorization': `Basic ${API_KEY}`,
                'Content-Type': 'application/json' 
            }
        });

        if (response.data.id) {
            console.log(`🚀 BAŞARILI! Mesaj ID: ${response.data.id}`);
            return true;
        }
    } catch (e) {
        if (e.response) {
            console.log("❌ ONESIGNAL HATASI:", JSON.stringify(e.response.data));
        } else {
            console.log("❌ ERISIM HATASI:", e.message);
        }
        return false;
    }
}

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`==> Kanit Robotu ${PORT} portunda hazir.`);
});
