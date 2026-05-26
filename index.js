const axios = require('axios');

// --- 設定エリア ---
const CONFIG = {
    domain: process.env.MK_DOMAIN || 'misskey.io',
    token: process.env.MK_TOKEN,
    myId: process.env.MY_ID,
    // JSの配列で管理する除外リスト（IDをここに直接書く）
    excludeList: [
        '9xxxxxxxxx', // 例: 友人A
        '8xxxxxxxxx', // 例: 公式垢
    ]
};

const api = async (endpoint, data) => {
    const res = await axios.post(`https://${CONFIG.domain}/api/${endpoint}`, {
        ...data,
        i: CONFIG.token
    });
    return res.data;
};

const sleep = m => new Promise(r => setTimeout(r, m));

async function main() {
    console.log('Auto Unfollow Start...');
    
    try {
        // 1. フォロワーを全取得（片思い判定用）
        let followers = [];
        let untilId = null;
        while (true) {
            const data = await api('users/followers', { userId: CONFIG.myId, untilId, limit: 100 });
            if (data.length === 0) break;
            followers.push(...data.map(f => f.followerId));
            untilId = data[data.length - 1].id;
            await sleep(500);
        }

        // 2. フォロー中ユーザーをページネーションで取得しながら処理
        untilId = null;
        while (true) {
            const following = await api('users/following', { userId: CONFIG.myId, untilId, limit: 100 });
            if (following.length === 0) break;

            for (const f of following) {
                const targetId = f.followeeId;
                const username = f.followee.username;

                // 除外リスト判定
                if (CONFIG.excludeList.includes(targetId)) {
                    console.log(`[SKIP] 除外リスト対象: ${username}`);
                    continue;
                }

                // 片思い判定（相手からフォローされていない）
                if (!followers.includes(targetId)) {
                    console.log(`[UNFOLLOW] ${username} を解除します...`);
                    await api('following/delete', { userId: targetId });
                    await sleep(2000); // 負荷軽減
                }
            }

            untilId = following[following.length - 1].id;
            await sleep(500);
        }
        console.log('Finished.');
    } catch (e) {
        console.error('Error:', e.response?.data || e.message);
        process.exit(1);
    }
}

main();
