const axios = require('axios');
const http = require('http');

// Render panelindeki Environment Variables (Ortam Değişkenleri) kısmından çekilir
const APP_ID = process.env.ONESIGNAL_APP_ID;
const API_KEY = process.env.ONESIGNAL_REST_KEY;

const server = http.createServer(async (req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });

    // 1. ANLIK TEST LİNKİ (Telefonu hemen titretir)
    if (req.url === '/test-gonder') {
        const sonuc = await bildirimGonder(null);
        if (sonuc.basari) {
            res.end(`<h1>✅ TELEFONA GİTTİ!</h1><p>ID: ${sonuc.id}</p>`);
        } else {
            res.end(`<h1>❌ HATA!</h1><p>${sonuc.mesaj}</p>`);
        }
    } 
    // 2. PANEL PLANI LİNKİ (Saat 18:30 için planlar)
    else if (req.url === '/plana-ekle') {
        // Saat 18:30 yapıyoruz (Render hızı ne olursa olsun vakit kalması için)
        const sonuc = await bildirimGonder("2026-04-05 18:30:00 GMT+0300");
        if (sonuc.basari) {
            res.end(`<h1>✅ PANELDE 18:30 İÇİN PLANLANDI!</h1><p>ID: ${sonuc.id}</p><p>OneSignal panelindeki "Scheduled" listesini kontrol edin.</p>`);
        } else {
            res.end(`<h1>❌ HATA!</h1><p>${sonuc.mesaj}</p>`);
        }
    } 
    else {
        // Ana Sayfa
        res.end(`
            <div style="text-align:center; margin-top:50px; font-family:sans-serif;">
                <h1>🚀 OneSignal Tetikleyici Hazır</h1>
                <p>Anlık Gönderim: <a href="/test-gonder">/test-gonder</a></p>
                <p>Panel Planı (18:30): <a href="/plana-ekle">/plana-ekle</a></p>
            </div>
        `);
    }
});

async function bildirimGonder(zaman) {
    try {
        const payload = {
            app_id: APP_ID,
            // OneSignal hatası sonrası İngilizce (en) içerik zorunlu eklendi:
            headings: { 
                "tr": zaman ? "PLANLI BİLDİRİM" : "BAĞLANTI KANITI",
                "en": zaman ? "SCHEDULED NOTIFICATION" : "CONNECTION TEST" 
            },
            contents: { 
                "tr": zaman ? "Bu mesaj panelde görünmeli!" : "Render üzerinden gelen onaydır!",
                "en": zaman ? "Check your OneSignal dashboard!" : "Success from Render!" 
            },
            included_segments: ["Total Subscriptions"],
            isAnyWeb: true,
            isAndroid: true,
            isIos: true
        };

        // Eğer zaman varsa OneSignal'a "beklet" diyoruz
        if (zaman) {
            payload.send_after = zaman;
        }

        const response = await axios.post('https://onesignal.com/api/v1/notifications', payload, {
            headers: { 
                'Authorization': `Basic ${API_KEY}`,
                'Content-Type': 'application/json' 
            }
        });

        return { basari: true, id: response.data.id };
    } catch (e) {
        const detay = e.response ? JSON.stringify(e.response.data) : e.message;
        console.error("❌ HATA:", detay);
        return { basari: false, mesaj: detay };
    }
}

const PORT = process.env.PORT || 10000;
server.listen(PORT, () => {
    console.log(`==> Bot ${PORT} portunda aktif. Emir bekleniyor...`);
});
