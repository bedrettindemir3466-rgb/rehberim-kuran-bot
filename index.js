const axios = require('axios');
const http = require('http');

const APP_ID = process.env.ONESIGNAL_APP_ID;
const API_KEY = process.env.ONESIGNAL_REST_KEY;

const server = http.createServer(async (req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });

    if (req.url === '/test-gonder' || req.url === '/plana-ekle') {
        const planliMi = req.url === '/plana-ekle';
        try {
            const response = await axios.post('https://onesignal.com/api/v1/notifications', {
                app_id: APP_ID,
                headings: { "tr": planliMi ? "PLANLI" : "TEST" },
                contents: { "tr": "Mesaj içeriği" },
                included_segments: ["Total Subscriptions"],
                isAndroid: true, isIos: true,
                ...(planliMi && { send_after: "2026-04-05 18:30:00 GMT+0300" })
            }, {
                headers: { 'Authorization': `Basic ${API_KEY}`, 'Content-Type': 'application/json' }
            });

            res.end(`<h1>✅ BAŞARILI!</h1><p>ID: ${response.data.id}</p>`);
        } catch (e) {
            // HATAYI DİREKT EKRANA BASIYORUZ:
            const hataMesaji = e.response ? JSON.stringify(e.response.data) : e.message;
            res.end(`<h1>❌ ONESIGNAL HATASI ÇIKTI:</h1><p style="color:red; font-size:20px;">${hataMesaji}</p>`);
        }
    } else {
        res.end("<h1>Sistem Hazır</h1>");
    }
});

const PORT = process.env.PORT || 10000;
server.listen(PORT);
