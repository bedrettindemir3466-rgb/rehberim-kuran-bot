const axios = require('axios');

const http = require('http');



const APP_ID = process.env.ONESIGNAL_APP_ID;

const API_KEY = process.env.ONESIGNAL_REST_KEY;



const server = http.createServer(async (req, res) => {

    if (req.url === '/vakitleri-kur') {

        // --- 1. STRATEJİ: HEMEN YANIT VER (Zaman Aşımını Önler) ---

        res.writeHead(200, { 'Content-Type': 'application/json' });

        res.end(JSON.stringify({ status: "İşlem arka planda başlatıldı." }));



        // İşlemi bir async fonksiyon içine alıp "await" kullanmadan çağırıyoruz

        processVakitler().catch(err => console.error("Arka plan işlemi başarısız:", err.message));

        

    } else {

        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });

        res.end("<h1>Cihan Yazılım Rehber Bot Aktif</h1>");

    }

});



// --- ANA MOTOR: ARKA PLANDA ÇALIŞIR ---

async function processVakitler() {

    console.log("Kullanıcı listesi çekiliyor...");

    

    const usersRes = await axios.get(`https://onesignal.com/api/v1/players?app_id=${APP_ID}`, {

        headers: { 'Authorization': `Basic ${API_KEY}` }

    });

    const users = usersRes.data.players;

    console.log(`${users.length} kullanıcı bulundu. İşleniyor...`);



    // --- 2. STRATEJİ: BELLEK VE HIZ OPTİMİZASYONU ---

    // Promise.all kullanırken çok fazla kullanıcı olduğunda API limitlerine takılmamak için 

    // işlemleri kontrollü gruplar (chunks) halinde yapmak daha sağlıklıdır.

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

                    { isim: "İmsak", saat: v.Fajr },

                    { isim: "Öğle", saat: v.Dhuhr },

                    { isim: "İkindi", saat: v.Asr },

                    { isim: "Akşam", saat: v.Maghrib },

                    { isim: "Yatsı", saat: v.Isha }

                ];



                // OneSignal'a her vakit için bildirim kur

                // Burada Promise.all kullanarak 5 vakti paralel fırlatıyoruz

                await Promise.all(vakitler.map(vkt => 

                    axios.post('https://onesignal.com/api/v1/notifications', {

                        app_id: APP_ID,

                        include_player_ids: [playerId],

                        headings: { "en": `Ezan: ${vkt.isim}` },

                        contents: { "en": `${vkt.isim} vakti girdi.` },

                        send_after: tarihBelirle(vkt.saat)

                    }, {

                        headers: { 'Authorization': `Basic ${API_KEY}`, 'Content-Type': 'application/json' }

                    })

                ));

            } catch (error) {

                console.error(`User ${playerId} için vakit kurulamadı:`, error.message);

            }

        }

    }

    console.log("Tüm bildirimler başarıyla programlandı.");

}



function tarihBelirle(vakitSaati) {

    // İstanbul saatine göre senkronize et

    const simdi = new Date(new Date().toLocaleString("en-US", {timeZone: "Europe/Istanbul"}));

    const [saat, dakika] = vakitSaati.split(':').map(Number);

    let hedef = new Date(simdi);

    hedef.setHours(saat, dakika, 0, 0);

    

    if (hedef <= simdi) hedef.setDate(hedef.getDate() + 1);

    

    return `${hedef.getFullYear()}-${String(hedef.getMonth() + 1).padStart(2, '0')}-${String(hedef.getDate()).padStart(2, '0')} ${vakitSaati}:00 GMT+0300`;

}



const PORT = process.env.PORT || 10000;

server.listen(PORT, () => console.log(`Server ${PORT} üzerinde çalışıyor.`));
