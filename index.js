const axios = require('axios');
const http = require('http');

// Render panelindeki Environment Variables (Ortam Değişkenleri) kısmından alınır
const APP_ID = process.env.ONESIGNAL_APP_ID;
const API_KEY = process.env.ONESIGNAL_REST_KEY;

const server = http.createServer(async (req, res) => {
    // Tarayıcıdan bu adrese girdiğinizde tetiklenir:
    // https://rehberim-kuran-bot.onrender.com/test-gonder
    if (req.url === '/test-gonder') {
        console.log("--- 🚨 TEST TETİKLENDİ: Sinyal OneSignal'a gidiyor... ---");
        
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
                    <h1 style="color:red;">❌ ONESIGNAL İSTEĞİ REDDETTİ!</h1>
                    <p>Hata detayları için Render panelindeki <b>Logs</b> (siyah ekran) kısmına bakın.</p>
                </div>
            `);
        }
    } else {
        // Ana sayfa
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end("<h1>Bot Çalışıyor</h1><p>Test etmek için sonuna <b>/test-gonder</b> ekleyin.</p>");
    }
});

async function kanitMesajiGonder() {
    try {
        // OneSignal API'sine bildirim isteği atıyoruz
        const response = await axios.post('https://onesignal.com/api/v1/notifications', {
            app_id: APP_ID,
            headings: { "tr": "BAĞLANTI KANITI", "en": "CONNECTION TEST" },
            contents: { "tr": "Render üzerinden gelen onay mesajıdır!", "en": "Success from Render!" },
            // Tüm kayıtlı kullanıcılara gönder:
            included_segments: ["Total Subscriptions"],
            // Cihaz kısıtlaması olmadan:
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
            console.log("🚀 BAŞARILI: Mesaj ID ->", response.data.id);
            return true;
        }
        return false;
    } catch (e) {
        // Burası en önemli kısım: Neden hata aldığımızı siyah ekrana yazdırır
        if (e.response) {
            console.error("❌ ONESIGNAL RED SEBEBİ:", JSON.stringify(e.response.data));
        } else {
            console.error("❌ SİSTEMSEL HATA:", e.message);
        }
        return false;
    }
}

// Render'ın otomatik atadığı portu kullanır, yoksa 10000
const PORT = process.env.PORT || 10000;
server.listen(PORT, () => {
    console.log(`==> Kanıt Robotu ${PORT} portunda hazır. Emir bekleniyor...`);
});
