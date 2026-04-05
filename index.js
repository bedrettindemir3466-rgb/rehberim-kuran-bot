const axios = require('axios');
const http = require('http');

const APP_ID = process.env.ONESIGNAL_APP_ID;
const API_KEY = process.env.ONESIGNAL_REST_KEY;

const server = http.createServer(async (req, res) => {
    // Cron-job için hızlı ve temiz yanıt başlığı
    if (req.url === '/vakitleri-kur') {
        try {
            // --- 1. ADIM: VERİLERİ ÇEK (Sessizce, Bildirim Gitmeden) ---
            const rastgeleAyetNo = Math.floor(Math.random() * 6236) + 1;
            const ayetRes = await axios.get(`https://api.alquran.cloud/v1/ayah/${rastgeleAyetNo}/editions/tr.diyanet`);
            const ayetTr = ayetRes.data.data[0].text;
            const sureBilgi = `${ayetRes.data.data[0].surah.englishName} (${ayetRes.data.data[0].numberInSurah})`;

            // --- 2. ADIM: KULLANICILARI ÇEK ---
            const usersRes = await axios.get(`https://onesignal.com/api/v1/players?app_id=${APP_ID}`, {
                headers: { 'Authorization': `Basic ${API_KEY}` }
            });
            const users = usersRes.data.players;

            for (let user of users) {
                const lat = user.tags?.lat;
                const lon = user.tags?.lon;
                const playerId = user.id;
                const ezanAcikMi = user.tags?.imsak_vakti !== "false";

                // --- 3. ADIM: SADECE EZAN BİLDİRİMLERİ (Türkçe ve Tek Satır) ---
                if (lat && lon && ezanAcikMi) {
                    const vRes = await axios.get(`http://api.aladhan.com/v1/timingsByAddress?address=${lat},${lon}&method=13`);
                    const v = vRes.data.data.timings;

                    const vakitler = [
                        { isim: "İmsak", saat: v.Fajr },
                        { isim: "Öğle", saat: v.Dhuhr },
                        { isim: "İkindi", saat: v.Asr },
                        { isim: "Akşam", saat: v.Maghrib },
                        { isim: "Yatsı", saat: v.Isha }
                    ];

                    for (let vkt of vakitler) {
                        await axios.post('https://onesignal.com/api/v1/notifications', {
                            app_id: APP_ID,
                            include_player_ids: [playerId],
                            // OneSignal'ı kandırıyoruz: "en" içine Türkçe yazarak çift bildirimi engelliyoruz
                            headings: { "en": `Ezan: ${vkt.isim}` },
                            contents: { "en": `${vkt.isim} vakti girdi.` },
                            send_after: tarihBelirle(vkt.saat)
                        }, {
                            headers: { 'Authorization': `Basic ${API_KEY}`, 'Content-Type': 'application/json' }
                        });
                    }
                }
            }
            // --- 4. ADIM: CRON-JOB DOSTU KISA CEVAP ---
            res.writeHead(200, { 'Content-Type': 'text/plain' });
            res.end("OK"); // Bu satır Cron-job hatasını bitirir.

        } catch (err) {
            console.error("Hata oluştu:", err.message);
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
