export async function checkUrls(urls, onProgress, onResult) {
    const stats = {
        total: urls.length,
        healthy: 0,
        redirects: 0,
        clientErrors: 0,
        serverErrors: 0,
        timeouts: 0
    };
    
    let checkedCount = 0;
    const batchSize = 8;
    
    for (let i = 0; i < urls.length; i += batchSize) {
        const batch = urls.slice(i, i + batchSize);
        
        const results = await Promise.allSettled(batch.map(url => checkUrl(url)));
        
        for (const promiseResult of results) {
            const res = promiseResult.value;
            
            if (res.error === 'Timeout' || (res.error && res.error.toLowerCase().includes('timeout'))) {
                stats.timeouts++;
            } else if (res.status >= 200 && res.status < 300) {
                stats.healthy++;
            } else if (res.status >= 300 && res.status < 400) {
                stats.redirects++;
            } else if (res.status >= 400 && res.status < 500) {
                stats.clientErrors++;
            } else if (res.status >= 500) {
                stats.serverErrors++;
            } else if (res.error) {
                stats.clientErrors++; // Map DNS and other non-timeout errors to clientErrors for simplicity
            }
            
            if (onResult) {
                onResult(res);
            }
            checkedCount++;
        }
        
        if (onProgress) {
            onProgress(`Checked ${checkedCount} of ${urls.length} URLs...`);
        }
    }
    
    return stats;
}

async function checkUrl(url, timeoutMs = 10000, maxRedirects = 5) {
    let currentUrl = url;
    let redirectChain = [];
    let redirectsCount = 0;
    
    const startTime = performance.now();
    
    while (true) {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
        
        try {
            const res = await fetch(currentUrl, {
                method: 'GET',
                redirect: 'manual',
                headers: {
                    'User-Agent': 'SEO-Studio-Bot/2.0'
                },
                signal: controller.signal
            });
            clearTimeout(timeoutId);
            
            const status = res.status;
            
            if (status >= 300 && status < 400 && res.headers.has('location')) {
                let nextUrl = res.headers.get('location');
                try {
                    nextUrl = new URL(nextUrl, currentUrl).href;
                } catch (e) {
                    // Invalid URL in location header
                }
                
                redirectChain.push({ url: currentUrl, status });
                
                redirectsCount++;
                if (redirectsCount >= maxRedirects) {
                    const responseTime = performance.now() - startTime;
                    return {
                        url,
                        finalUrl: currentUrl,
                        status: res.status,
                        redirectChain,
                        responseTime: Math.round(responseTime),
                        contentType: res.headers.get('content-type') || null,
                        error: 'Max redirects reached'
                    };
                }
                currentUrl = nextUrl;
            } else {
                const responseTime = performance.now() - startTime;
                return {
                    url,
                    finalUrl: currentUrl,
                    status: res.status,
                    redirectChain,
                    responseTime: Math.round(responseTime),
                    contentType: res.headers.get('content-type') || null,
                    error: null
                };
            }
        } catch (error) {
            clearTimeout(timeoutId);
            const responseTime = performance.now() - startTime;
            let errorMsg = error.message;
            if (error.name === 'AbortError') {
                errorMsg = 'Timeout';
            }
            return {
                url,
                finalUrl: currentUrl,
                status: null,
                redirectChain,
                responseTime: Math.round(responseTime),
                contentType: null,
                error: errorMsg
            };
        }
    }
}
