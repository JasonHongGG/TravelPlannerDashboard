import type { Request, Response } from 'express';

const decodeHtmlEntities = (text: string) => {
    return text.replace(/&quot;/g, '"').replace(/&amp;/g, '&');
};

const extractBestImageUrl = (html: string): string | null => {
    const results: Array<{ url: string; width: number; height: number }> = [];

    // Look for <a class="iusc" ... m="{...}" ... href="...">
    // We target the class "iusc" which contains the metadata
    const linkRegex = /<a[^>]+class="iusc"[^>]*>/g;

    let match: RegExpExecArray | null;
    while ((match = linkRegex.exec(html)) !== null) {
        const tag = match[0];
        try {
            // Extract m="{...}" containing the media URL
            const mMatch = /m="([^"]+)"/.exec(tag);
            // Extract href="..." containing the dimensions (expw, exph)
            const hrefMatch = /href="([^"]+)"/.exec(tag);

            if (mMatch && hrefMatch) {
                const mStr = decodeHtmlEntities(mMatch[1]);
                const href = decodeHtmlEntities(hrefMatch[1]);

                const mData = JSON.parse(mStr);
                const murl = mData.murl;

                // Extract expw (width) and exph (height) from href parameters
                const widthMatch = /expw=(\d+)/.exec(href);
                const heightMatch = /exph=(\d+)/.exec(href);

                if (murl && widthMatch && heightMatch) {
                    results.push({
                        url: murl,
                        width: parseInt(widthMatch[1]),
                        height: parseInt(heightMatch[1])
                    });
                }
            }
        } catch {
            // Ignore parsing errors for individual items
        }
    }

    // Filter for large images (HD+)
    const large = results.filter(item => item.width >= 1280 && item.height >= 720);
    // Fallback to whatever we found if no large images match
    const pool = large.length > 0 ? large : results;

    if (pool.length === 0) return null;

    // Sort by resolution (descending)
    pool.sort((a, b) => (b.width * b.height) - (a.width * a.height));

    // Pick random from top 5 to avoid repetition
    const top5 = pool.slice(0, 5);
    const randomIdx = Math.floor(Math.random() * top5.length);
    return top5[randomIdx].url;
};

export async function getCoverImage(req: Request, res: Response) {
    try {
        const query = typeof req.query.query === 'string' ? req.query.query : '';
        if (!query) return res.status(400).json({ error: 'query required' });

        // Add keywords to encourage scenery/photography and exclude maps/charts
        const enhancedQuery = `${query} scenery photography -map -chart -text -diagram -poster`;
        // Add 'filterui:aspect-wide' to prefer landscape images
        const url = `https://www.bing.com/images/search?q=${encodeURIComponent(enhancedQuery)}&qft=+filterui:imagesize-large+filterui:aspect-wide&form=IRFLTR`;

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
