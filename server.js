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
    let { url } = req.body;
    if (!url) return res.status(400).json({ error: 'URL gerekli' });

    try {
        console.log(`İşleniyor: ${url}`);
        
        // Temel (Ortak) Ayarlar
        let dlOptions = {
            dumpSingleJson: true,
            noWarnings: true,
            noCallHome: true,
            noCheckCertificate: true,
        };

        // YENİ: Platforma Özel Zeka (Smart Routing)
        if (url.includes('instagram.com')) {
            url = url.split('?')[0]; 
            url = url.replace('/reels/', '/reel/'); 
            dlOptions.format = 'b[ext=mp4]/b';
            
        } else if (url.includes('x.com') || url.includes('twitter.com')) {
            dlOptions.youtubeSkipDashManifest = true; // X için gerekli
            dlOptions.format = 'best[ext=mp4]/best';
            
        } else if (url.includes('youtube.com') || url.includes('youtu.be')) {
            // YouTube için: Dash Manifest atlanmaz, FFmpeg olmadığı için hazır birleşik olan 720p(22) veya 360p(18) istenir
            dlOptions.format = '22/18/best[ext=mp4]/best'; 
            
        } else {
            // Facebook ve Diğerleri
            dlOptions.format = 'b[ext=mp4]/b';
        }

        const output = await youtubedl(url, dlOptions);

        const directUrl = output.url || 
                          (output.requested_downloads && output.requested_downloads[0].url) || 
                          (output.entries && output.entries[0] && output.entries[0].url);

        if (!directUrl) {
            throw new Error("Video bulundu fakat indirme bağlantısı alınamadı.");
        }

        res.json({ 
            title: output.title || 'Video',
            downloadUrl: directUrl 
        });
    } catch (error) {
        console.error('Hata:', error.message);
        
        // PLATFORMLARA ÖZEL HATA MESAJLARI
        let hataMesaji = 'Video ayrıştırılamadı. Korumalı içerik olabilir veya platform engelliyor.';
        
        if (url.includes('instagram.com')) {
            hataMesaji = 'Instagram güvenlik duvarı (Login Wall) sunucumuzu engelledi. Yerel IP gereklidir.';
        } else if (url.includes('youtube.com') || url.includes('youtu.be')) {
            hataMesaji = 'YouTube bot koruması (HTTP 403) devreye girdi. YouTube bulut sunucuların IP adreslerini engellemektedir.';
        }
        
        res.status(500).json({ error: hataMesaji });
    }
});

app.get('/api/stream', (req, res) => {
    const videoUrl = req.query.url;
    
    if (!videoUrl || videoUrl === 'undefined' || videoUrl === 'null') {
        return res.status(400).send('Hata: Video bağlantısı geçersiz.');
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
