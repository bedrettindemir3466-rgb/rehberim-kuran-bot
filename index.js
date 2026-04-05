const axios = require('axios');
const http = require('http');

const APP_ID = process.env.ONESIGNAL_APP_ID;
const API_KEY = process.env.ONESIGNAL_REST_KEY;

const server = http.createServer(async (req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });

    if (req.url === '/vakitleri-kur') {
        try {
            // --- 1. ADIM: GÜNLÜK TAZE VERİLER (AYET & HADİS) ---
            const rastgeleAyetNo = Math.floor(Math.random() * 6236) + 1;
            const ayetRes = await axios.get(`https://api.alquran.cloud/v1/ayah/${rastgeleAyetNo}/editions/tr.diyanet,en.asad`);
            const ayetTr = ayetRes.data.data[0].text;
            const ayetEn = ayetRes.data.data[1].text;
            const sureBilgi = `${ayetRes.data.data[0].surah.englishName} (${ayetRes.data.data[0].numberInSurah})`;

            let hadisTr = "Hayra vesile olan, hayrı yapan gibidir.";
            let hadisEn = "One who guides to something good has a reward similar to that of its doer.";
            try {
                const hRes = await axios.get(`https://hadis-api-id.vercel.app/hadith/bukhari?page=1&limit=20`);
                if (hRes.data && hRes.data.items) {
                    const rH = hRes.data.items[Math.floor(Math.random() * hRes.data.items.length)];
                    hadisTr = rH.tr || hadisTr;
                    hadisEn = rH.en || hadisEn;
                }
            } catch (e) { console.log("Yedek hadis kullanılıyor."); }

            // --- 2. ADIM: TÜM KULLANICILARI ÇEK ---
            const usersRes = await axios.get(`https://onesignal.com/api/v1/players?app_id=${APP_ID}`, {
                headers: { 'Authorization': `Basic ${API_KEY}` }
            });
            const users = usersRes.data.players;

            for (let user of users) {
                const lat = user.tags?.lat;
                const lon = user.tags?.lon;
                const playerId = user.id;
                const ezanAcikMi = user.tags?.imsak_vakti !== "false"; // Senin "Tek Tik" ayarın

                // --- 3. ADIM: AYET & HADİS BİLDİRİMİ (HERKESE - SABİT SAAT) ---
                // Ezan ayarı ne olursa olsun, her sabah 09:00'da gider.
                await axios.post('https://onesignal.com/api/v1/notifications', {
                    app_id: APP_ID,
                    include_player_ids: [playerId],
                    headings: { "tr": "Günün Ayet ve Hadisi", "en": "Verse & Hadith of the Day" },
                    contents: { 
                        "tr": `📖 Ayet: ${ayetTr} (${sureBilgi})\n💬 Hadis: ${hadisTr}`,
                        "en": `📖 Verse: ${ayetEn} (${sureBilgi})\n💬 Hadith: ${hadisEn}`
                    },
                    send_after: tarihBelirle("09:00") // Sabah 9'a kurduk
                }, {
                    headers: { 'Authorization': `Basic ${API_KEY}`, 'Content-Type': 'application/json' }
                });

                // --- 4. ADIM: EZAN BİLDİRİMLERİ (SADECE AÇIK OLANLARA) ---
                if (lat && lon && ezanAcikMi) {
                    const vRes = await axios.get(`http://api.aladhan.com/v1/timingsByAddress?address=${lat},${lon}&method=13`);
                    const v = vRes.data.data.timings;

                    const vakitler = [
                        { tr: "İmsak", en: "Fajr", saat: v.Fajr },
                        { tr: "Öğle", en: "Dhuhr", saat: v.Dhuhr },
                        { tr: "İkindi", en: "Asr", saat: v.Asr },
                        { tr: "Akşam", en: "Maghrib", saat: v.Maghrib },
                        { tr: "Yatsı", en: "Isha", saat: v.Isha }
                    ];

                    for (let vkt of vakitler) {
                        await axios.post('https://onesignal.com/api/v1/notifications', {
                            app_id: APP_ID,
                            include_player_ids: [playerId],
                            headings: { "tr": `Ezan: ${vkt.tr}`, "en": `Adhan: ${vkt.en}` },
                            contents: { "tr": `${vkt.tr} vakti girdi.`, "en": `It is time for ${vkt.en}.` },
                            send_after: tarihBelirle(vkt.saat)
                        }, {
                            headers: { 'Authorization': `Basic ${API_KEY}`, 'Content-Type': 'application/json' }
                        });
                    }
                }
            }
            res.end(`<h1>✅ BAŞARILI</h1><p>Ayet/Hadis (09:00) ve Ezan vakitleri planlandı.</p>`);
        } catch (err) {
            res.end(`<h1>❌ HATA:</h1><p>${err.message}</p>`);
        }
    } else {
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
