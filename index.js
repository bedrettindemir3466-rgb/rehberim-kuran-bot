const axios = require('axios');
const http = require('http');

// Render'daki Environment Variables kısmından çekilecek
const APP_ID = process.env.ONESIGNAL_APP_ID;
const API_KEY = process.env.ONESIGNAL_REST_KEY;

const server = http.createServer(async (req, res) => {
    // Tarayıcıdan bu linke tıklandığında tetiklenir:
    // https://rehberim-kuran-bot.onrender.com/test-gonder
    if (req.url === '/test-gonder') {
        console.log("--- 🚨 MANUEL TETİKLEME BAŞLADI ---");
        
        const sonuc = await kanitMesajiGonder();
        
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        if (sonuc) {
            res.end("<h1>✅ BAŞARILI!</h1><p>OneSignal bu mesajı kabul etti. Paneli kontrol edebilirsiniz.</p>");
        } else {
            res.end("<h1>❌ REDDEDİLDİ!</h1><p>OneSignal isteği geri çevirdi. Render loglarındaki hatayı kontrol edin.</p>");
        }
    } else {
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end("<h1>Bot Aktif</h1><p>Test için <b>/test-gonder</b> ekine gidin.</p>");
    }
});

async function kanitMesajiGonder() {
    try {
        console.log("📡 OneSignal'a istek gönderiliyor...");
        
        const response = await axios.post('https://onesignal.com/api/v1/notifications', {
            app_id: APP_ID,
            headings: { "tr": "BAĞLANTI TESTİ" },
            contents: { "tr": "Render üzerinden gönderilen onay mesajıdır." },
            // En garanti alıcı hedeflemesi:
            included_segments: ["Total Subscriptions"],
            // Web/Android/iOS ayrımı yapmadan herkese:
            isAnyWeb: true,
            isAndroid: true,
            isIos: true
        }, {
            headers: { 
                'Authorization': `Basic ${API_KEY}`,
                'Content-Type': 'application/json' 
            }
        });

        if (response.data.id) {
            console.log(`🚀 ONAY ALINDI! OneSignal Mesaj ID: ${response.data.id}`);
            return true;
        }
    } catch (e) {
        if (e.response) {
            // OneSignal'ın neden reddettiğini anlamak için burası kritik:
            console.error("❌ ONESIGNAL RED SEBEBİ:", JSON.stringify(e.response.data));
        } else {
            console.error("❌ SİSTEMSEL HATA:", e.message);
        }
        return false;
    }
}

// Render'ın beklediği port ayarı
const PORT = process.env.PORT || 10000;
server.listen(PORT, () => {
    console.log(`==> Server ${PORT} portunda hazır. Sinyal bekleniyor...`);
});
