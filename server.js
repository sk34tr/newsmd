const express = require('express');
const cors = require('cors');
const youtubedl = require('youtube-dl-exec');
const https = require('https');
const http = require('http');

const app = express();
const PORT = process.env.PORT || 3000; 

app.use(cors());
app.use(express.json());

app.post('/api/download', async (req, res) => {
    const { url } = req.body;
    if (!url) return res.status(400).json({ error: 'URL gerekli' });

    try {
        console.log(`İşleniyor: ${url}`);
        const output = await youtubedl(url, {
            dumpSingleJson: true,
            noWarnings: true,
            noCallHome: true,
            noCheckCertificate: true,
            youtubeSkipDashManifest: true,
            // X (Twitter) için parçalı dosyaları reddet, sadece MP4'ü zorla:
            format: 'best[ext=mp4]/bestvideo[ext=mp4]+bestaudio[ext=m4a]/best'
        });

        // X gibi sitelerde MP4 linki farklı klasörlerde saklanabilir, hepsini tara:
        const directUrl = output.url || 
                          (output.requested_downloads && output.requested_downloads[0].url) || 
                          (output.entries && output.entries[0] && output.entries[0].url);

        // Eğer link gerçekten bulunamazsa çökmesini engelle ve hata ver
        if (!directUrl) {
            throw new Error("Video bulundu fakat platform doğrudan MP4 linki vermeyi reddetti.");
        }

        res.json({ 
            title: output.title || 'Video',
            downloadUrl: directUrl 
        });
    } catch (error) {
        console.error('Hata:', error.message);
        res.status(500).json({ error: 'Video ayrıştırılamadı. Linkin doğruluğunu kontrol edin.' });
    }
});

app.get('/api/stream', (req, res) => {
    const videoUrl = req.query.url;
    
    // "undefined" hatasını yakala ve sunucunun çökmesini (ERR_INVALID_RESPONSE) engelle
    if (!videoUrl || videoUrl === 'undefined' || videoUrl === 'null') {
        return res.status(400).send('Hata: Video bağlantısı geçersiz. Lütfen tekrar ayrıştırın.');
    }

    res.setHeader('Content-Disposition', 'attachment; filename="indirilen_video.mp4"');
    res.setHeader('Content-Type', 'video/mp4');

    const requestModule = videoUrl.startsWith('https') ? https : http;
    
    requestModule.get(videoUrl, (videoRes) => {
        if (videoRes.statusCode >= 300 && videoRes.statusCode < 400 && videoRes.headers.location) {
            const redirectUrl = videoRes.headers.location;
            const redirectModule = redirectUrl.startsWith('https') ? https : http;
            
            redirectModule.get(redirectUrl, (redirectRes) => {
                redirectRes.pipe(res);
            }).on('error', () => res.status(500).send('Yönlendirme başarısız oldu.'));
        } else {
            videoRes.pipe(res);
        }
    }).on('error', (err) => {
        console.error('Akış hatası:', err.message);
        res.status(500).send('İndirme başarısız oldu.');
    });
});

app.listen(PORT, () => {
    console.log(`Sunucu aktif ve ${PORT} portunu dinliyor.`);
});
