import type { Request, Response } from 'express';

const decodeJsonString = (value: string) => {
    try {
        return JSON.parse(`"${value}"`);
    } catch {
        return value;
    }
};

const extractBestImageUrl = (html: string): string | null => {
    const results: Array<{ url: string; width: number; height: number }> = [];
    const regex = /"murl":"(.*?)".*?"ow":(\d+),"oh":(\d+)/g;
    let match: RegExpExecArray | null;

    while ((match = regex.exec(html)) !== null) {
        const decoded = decodeJsonString(match[1]);
        const width = Number(match[2]);
        const height = Number(match[3]);
        if (typeof decoded === 'string' && decoded.startsWith('http')) {
            results.push({ url: decoded, width, height });
        }
    }

    const large = results.filter(item => item.width >= 1600 && item.height >= 900);
    const pool = large.length > 0 ? large : results;
    if (pool.length === 0) return null;

    pool.sort((a, b) => (b.width * b.height) - (a.width * a.height));
    return pool[0].url;
};

export async function getCoverImage(req: Request, res: Response) {
    try {
        const query = typeof req.query.query === 'string' ? req.query.query : '';
        if (!query) return res.status(400).json({ error: 'query required' });

        const url = `https://www.bing.com/images/search?q=${encodeURIComponent(query)}&qft=+filterui:imagesize-large&form=IRFLTR`;
        const response = await fetch(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0'
            }
        });

        if (!response.ok) {
            return res.status(502).json({ error: 'Failed to fetch image results' });
        }

        const html = await response.text();
        const imageUrl = extractBestImageUrl(html);

        if (!imageUrl) {
            return res.status(404).json({ error: 'No image found' });
        }

        return res.json({ url: imageUrl });
    } catch (error: any) {
        return res.status(500).json({ error: error.message || 'Cover lookup failed' });
    }
}
