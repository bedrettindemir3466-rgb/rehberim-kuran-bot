const axios = require('axios');
const cron = require('node-cron');

const APP_ID = process.env.ONESIGNAL_APP_ID;
const API_KEY = process.env.ONESIGNAL_REST_KEY;

async function startEzanRobot() {
    try {
        console.log("Diyanet verileri çekiliyor...");
        const response = await axios.get('https://namaz-vakti.vercel.app/vakitler?ilce=9541');
        const bugun = response.data[0];

        const vakitListesi = [
            { ad: "İmsak", saat: bugun.Imsak },
            { ad: "Öğle", saat: bugun.Ogle },
            { ad: "İkindi", saat: bugun.Ikindi },
            { ad: "Akşam", saat: bugun.Aksam },
            { ad: "Yatsı", saat: bugun.Yatsi }
        ];

        for (let vakit of vakitListesi) {
            await sendNotification(`${vakit.ad} Ezanı Okunuyor...`, vakit.saat);
            const onbesDkOnce = subtractMinutes(vakit.saat, 15);
            await sendNotification(`${vakit.ad} ezanına 15 dakika kaldı.`, onbesDkOnce);
        }
        console.log("Bildirimler OneSignal kuyruğuna eklendi.");
    } catch (error) {
        console.error("Hata:", error.message);
    }
}

function subtractMinutes(timeStr, mins) {
    let [h, m] = timeStr.split(':').map(Number);
    let date = new Date();
    date.setHours(h, m + mins, 0); 
    return `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
}

async function sendNotification(mesaj, zaman) {
    const data = {
        app_id: APP_ID,
        contents: { "tr": mesaj },
        included_segments: ["Subscribed Users"],
        send_after: `${new Date().toISOString().split('T')[0]} ${zaman}:00 GMT+0300`
    };
    return axios.post('https://onesignal.com/api/v1/notifications', data, {
        headers: { 'Authorization': `Basic ${API_KEY}` }
    });
}

cron.schedule('5 0 * * *', startEzanRobot);
startEzanRobot();
