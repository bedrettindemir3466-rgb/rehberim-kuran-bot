const axios = require('axios');
const http = require('http');

const APP_ID = process.env.ONESIGNAL_APP_ID;
const API_KEY = process.env.ONESIGNAL_REST_KEY;

let sonKurulumTarihi = ""; 

const server = http.createServer(async (req, res) => {
    if (req.url === '/vakitleri-kur') {
        try {
            const bugun = new Date().toLocaleDateString("tr-TR", {timeZone: "Europe/Istanbul"});
            if (sonKurulumTarihi === bugun) {
                console.log("Zaten cevap verdim, artik gerek kalmadi.");
                res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
                return res.end("Zaten kuruldu, mukerrer islem engellendi.");
            }

            const usersRes = await axios.get(`https://onesignal.com/api/v1/players?app_id=${APP_ID}`, {
                headers: { 'Authorization': `Basic ${API_KEY}` }
            });
            const users = usersRes.data.players;

            // --- GÜVENLİ VE SIRALI MOTOR ⚡ ---
            // Promise.all yerine for...of kullanarak Render'ı çökmeden koruyoruz
            for (const user of users) {
                const lat = user.tags?.lat;
                const lon = user.tags?.lon;
                const playerId = user.id;
                const ezanAcikMi = user.tags?.imsak_vakti !== "false";

                if (lat && lon && ezanAcikMi) {
                    try {
                        const vRes = await axios.get(`http://api.aladhan.com/v1/timingsByAddress?address=${lat},${lon}&method=13`);
                        const v = vRes.data.data.timings;

                        const vakitler = [
                            { isim: "Imsak", saat: v.Fajr },
                            { isim: "Ogle", saat: v.Dhuhr },
                            { isim: "Ikindi", saat: v.Asr },
                            { isim: "Aksam", saat: v.Maghrib },
                            { isim: "Yatsi", saat: v.Isha }
                        ];

                        // Vakitleri gönderirken OneSignal'ı boğmuyoruz
                        for (const vkt of vakitler) {
                            await axios.post('https://onesignal.com/api/v1/notifications', {
                                app_id: APP_ID,
                                include_player_ids: [playerId],
                                headings: { "en": `Ezan: ${vkt.isim}` },
                                contents: { "en": `${vkt.isim} vakti girdi.` },
                                send_after: tarihBelirle(vkt.saat)
                            }, {
                                headers: { 'Authorization': `Basic ${API_KEY}`, 'Content-Type': 'application/json' }
                            });
                        }
                    } catch (e) {
                        console.error(`Kullanici ${playerId} atlandi: ${e.message}`);
                    }
                }
            }

            sonKurulumTarihi = bugun;
            res.writeHead(200, { 'Content-Type': 'text/plain' });
            res.end("OK"); 

        } catch (err) {
            console.error("Ana hata:", err.message);
            res.writeHead(500);
            res.end("Hata");
        }
    } else {
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end("<h1>Cihan Yazılım Rehber Bot Aktif</h1>");
    }
});

function tarihBelirle(vakitSaati) {
    const simdi = new Date(new Date().toLocaleString("en-US", {timeZone: "Europe/Istanbul"}));
    const [saat, dakika] = vakitSaati.split(':').map(Number);
    let hedef = new Date(simdi);
    hedef.setHours(saat, dakika, 0, 0);
    if (hedef <= simdi) hedef.setDate(hedef.getDate() + 1);
    return `${hedef.getFullYear()}-${String(hedef.getMonth() + 1).padStart(2, '0')}-${String(hedef.getDate()).padStart(2, '0')} ${vakitSaati}:00 GMT+0300`;
}

const PORT = process.env.PORT || 10000;
server.listen(PORT);
