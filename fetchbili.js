const axios = require('axios');
const fs = require('fs');
const { exec } = require('child_process');
const path = require('path');

// ================== [ 1. 配置区域 ] ==================
// 现在你只需要修改这一个 BV 号即可
const bvid = 'BV1CNzQBEEzs'; 

const COOKIE = `_uuid=EEC5A559-102E-4C5C-9BC7-915D1093D510F286123infoc; buvid3=E4E9DAA9-5758-D4F6-3E5A-A6F718670D0A96372infoc; DedeUserID=104407846; DedeUserID__ckMd5=a204c92a716946c3; SESSDATA=0e1048dc%2C1785251475%2Ce7f48%2A11CjDxHgHiusofhxtEsTaJzIZmIIQj042_qBOyPoxIbbVBpp43NKkqasnhNWYCwo1Q86QSVkRkbkl6TEd4ZzI5bk9vczdWTTNVR3VTQUY4aXdCcWdwWW83WWZFWl9Fd0doRENrdVBYVjF0azVSNzQzVU4zQXFSUzhSUkZTRGgyTzlqeTlDVjhRTTBRIIEC; bili_jct=2444e889623d5442bab795f85b84ce5a; buvid4=FD322739-7FF9-A6D2-E6B2-310E6E37D2B610685-022012519-pT8jjHnAVccHAyWKdnlWtw%3D%3D`.trim();

const headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Referer': 'https://www.bilibili.com',
    'Cookie': COOKIE.replace(/\s+/g, ' ')
};

// ================== [ 2. 功能函数 ] ==================

/**
 * 核心改进：根据 bvid 获取第一个分片的 cid
 */
async function getCid(bv) {
    console.log(`正在获取 ${bv} 的 CID 信息...`);
    const url = `https://api.bilibili.com/x/player/pagelist?bvid=${bv}&jsonp=jsonp`;
    const response = await axios.get(url, { headers });
    
    if (response.data && response.data.data) {
        // 返回第一集的 cid
        return response.data.data[0].cid;
    } else {
        throw new Error('无法获取 CID，请检查 BV 号是否正确或 Cookie 是否失效');
    }
}

async function downloadStream(url, fileName) {
    console.log(`正在下载流: ${fileName}...`);
    const writer = fs.createWriteStream(fileName);
    const response = await axios({ url, method: 'GET', responseType: 'stream', headers });
    response.data.pipe(writer);
    return new Promise((resolve, reject) => {
        writer.on('finish', resolve);
        writer.on('error', reject);
    });
}

function mergeToMp4(vFile, aFile, outFile) {
    return new Promise((resolve, reject) => {
        console.log('正在合并视频与音频...');
        const cmd = `ffmpeg -i "${vFile}" -i "${aFile}" -c:v copy -c:a aac -strict experimental -y "${outFile}"`;
        exec(cmd, (err) => {
            if (err) reject(err);
            else resolve();
        });
    });
}

// ================== [ 3. 主程序 ] ==================
async function start() {
    try {
        // 步骤 1: 自动获取 CID
        const cid = await getCid(bvid);
        console.log(`解析成功: CID = ${cid}`);

        // 步骤 2: 获取下载链接 (使用刚才拿到的 cid)
        const apiUrl = `https://api.bilibili.com/x/player/wbi/playurl?bvid=${bvid}&cid=${cid}&qn=80&fnval=16`;
        const playRes = await axios.get(apiUrl, { headers });
        const playInfo = playRes.data.data;

        const videoUrl = playInfo.dash.video[0].baseUrl;
        const audioUrl = playInfo.dash.audio[0].baseUrl;

        const vTemp = 'video_temp.m4s';
        const aTemp = 'audio_temp.m4s';
        const finalMp4 = `bilibili_${bvid}.mp4`;

        // 步骤 3: 并行下载
        await Promise.all([
            downloadStream(videoUrl, vTemp),
            downloadStream(audioUrl, aTemp)
        ]);

        // 步骤 4: 合成
        await mergeToMp4(vTemp, aTemp, finalMp4);

        // 步骤 5: 清理
        fs.unlinkSync(vTemp);
        fs.unlinkSync(aTemp);

        console.log(`\n✅ 处理完成！`);
        console.log(`文件路径: ${path.resolve(finalMp4)}`);

    } catch (error) {
        console.error('\n❌ 运行失败:', error.message);
    }
}

start();