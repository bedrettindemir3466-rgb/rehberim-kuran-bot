const axios = require('axios');
const http = require('http');

const APP_ID = process.env.ONESIGNAL_APP_ID;
const API_KEY = process.env.ONESIGNAL_REST_KEY;
const SEHIR = "Istanbul"; 

const server = http.createServer(async (req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });

    if (req.url === '/vakitleri-kur') {
        try {
            // 1. Namaz Vakitlerini Çek
            const vResponse = await axios.get(`http://api.aladhan.com/v1/timingsByCity?city=${SEHIR}&country=Turkey&method=13`);
            const v = vResponse.data.data.timings;

            // 2. OTOMATİK AYET ÇEK (api.alquran.cloud)
            const rastgeleAyetNo = Math.floor(Math.random() * 6236) + 1;
            const ayetRes = await axios.get(`https://api.alquran.cloud/v1/ayah/${rastgeleAyetNo}/editions/tr.diyanet,en.asad`);
            const ayetTr = ayetRes.data.data[0].text;
            const ayetEn = ayetRes.data.data[1].text;
            const sureBilgi = `${ayetRes.data.data[0].surah.englishName} (${ayetRes.data.data[0].numberInSurah})`;

            // 3. OTOMATİK HADİS ÇEK (Hadith API - Sunnah verileri)
            // Not: Rastgele bir hadis kitabı ve numarası seçer
            const kitaplar = ['bukhari', 'muslim', 'abudawud', 'tirmidhi'];
            const rastgeleKitap = kitaplar[Math.floor(Math.random() * kitaplar.length)];
            const hadisRes = await axios.get(`https://hadis-api-id.vercel.app/hadith/${rastgeleKitap}?page=1&limit=100`);
            const hadisler = hadisRes.data.items;
            const rHadis = hadisler[Math.floor(Math.random() * hadisler.length)];
            
            const hadisTr = rHadis.tr || "Hayra vesile olan, hayrı yapan gibidir.";
            const hadisEn = rHadis.en || "One who guides to something good has a reward similar to that of its doer.";

            const vakitListesi = [
                { ad: "İmsak", saat: v.Fajr },
                { ad: "Öğle", saat: v.Dhuhr },
                { ad: "İkindi", saat: v.Asr },
                { ad: "Akşam", saat: v.Maghrib },
                { ad: "Yatsı", saat: v.Isha }
            ];

            for (let vkt of vakitListesi) {
                // A. 15 DK ÖNCE HATIRLATMA
                const hZaman = hesaplaZaman(vkt.saat, -15);
                await bildirimGonder(
                    `${vkt.ad} Yaklaşıyor`, "Hazırlanmak için 15 dakikanız var.",
                    `${vkt.ad} is Near`, "15 minutes until prayer time.",
                    tarihBelirle(hZaman)
                );

                // B. TAM VAKTİNDE EZAN
                let icerikTr = `${vkt.ad} vakti girdi.`;
                let icerikEn = `It is time for ${vkt.ad}.`;

                if (vkt.ad === "İmsak") {
                    icerikTr += ` \n📖 Ayet: ${ayetTr} (${sureBilgi}) \n💬 Hadis: ${hadisTr}`;
                    icerikEn += ` \n📖 Verse: ${ayetEn} (${sureBilgi}) \n💬 Hadith: ${hadisEn}`;
                }

                await bildirimGonder(
                    `Ezan: ${vkt.ad}`, icerikTr,
                    `Adhan: ${vkt.ad}`, icerikEn,
                    tarihBelirle(vkt.saat)
                );
            }

            res.end(`<h1>✅ %100 OTOMATİK SİSTEM AKTİF</h1><p>Ayet ve Hadisler internetten canlı çekildi.</p>`);
        } catch (e) {
            res.end(`<h1>❌ HATA:</h1><p>${e.message}</p>`);
        }
    } else {
        res.end("<h1>Cihan Yazılım Full Otomasyon</h1>");
    }
});

// Yardımcı fonksiyonlar (Tarih ve Saat hesaplama)
function tarihBelirle(vakitSaati) {
    const simdi = new Date(new Date().toLocaleString("en-US", {timeZone: "Europe/Istanbul"}));
    const [saat, dakika] = vakitSaati.split(':').map(Number);
    let hedef = new Date(simdi);
    hedef.setHours(saat, dakika, 0, 0);
    if (hedef <= simdi) hedef.setDate(hedef.getDate() + 1);
    const yil = hedef.getFullYear();
    const ay = String(hedef.getMonth() + 1).padStart(2, '0');
    const gun = String(hedef.getDate()).padStart(2, '0');
    return `${yil}-${ay}-${gun} ${vakitSaati}:00 GMT+0300`;
}

async function bildirimGonder(baslikTr, icerikTr, baslikEn, icerikEn, zaman) {
    return axios.post('https://onesignal.com/api/v1/notifications', {
        app_id: APP_ID,
        headings: { "tr": baslikTr, "en": baslikEn },
        contents: { "tr": icerikTr, "en": icerikEn },
        included_segments: ["Total Subscriptions"],
        send_after: zaman
    }, {
        headers: { 'Authorization': `Basic ${API_KEY}`, 'Content-Type': 'application/json' }
    });
}

function hesaplaZaman(saatDizisi, farkDakika) {
    let [saat, dakika] = saatDizisi.split(':').map(Number);
    let d = new Date();
    d.setHours(saat, dakika + farkDakika, 0);
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

const PORT = process.env.PORT || 10000;
server.listen(PORT);
