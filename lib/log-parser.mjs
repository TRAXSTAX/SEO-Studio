import fs from 'fs';
import readline from 'readline';

const LOG_REGEX = /^(\S+) (\S+) (\S+) \[([^\]]+)\] "(\S+) ([^"]*?)\s*(\S+)?" (\d{3}) (\S+) "([^"]*)" "([^"]*)"/;

export async function parseLog(filePath, onProgress, onComplete) {
  const fileStream = fs.createReadStream(filePath);
  const rl = readline.createInterface({
    input: fileStream,
    crlfDelay: Infinity
  });

  const stats = {
    totalLines: 0,
    botHits: 0,
    bots: {},
    topUrls: {},
    statusCodes: {}
  };

  for await (const line of rl) {
    stats.totalLines++;
    
    const lowerLine = line.toLowerCase();
    if (!lowerLine.includes('bot') && !lowerLine.includes('spider') && !lowerLine.includes('crawler')) {
        continue;
    }
    
    const match = line.match(LOG_REGEX);
    if (match) {
      const url = match[6];
      const status = match[8];
      const ua = match[11].toLowerCase();

      let botName = null;
      if (ua.includes('googlebot')) botName = 'Googlebot';
      else if (ua.includes('bingbot')) botName = 'Bingbot';
      else if (ua.includes('yandexbot')) botName = 'Yandexbot';
      else if (ua.includes('ahrefsbot')) botName = 'Ahrefsbot';
      else if (ua.includes('semrushbot')) botName = 'Semrushbot';
      else botName = 'Other Bot';

      if (botName) {
        stats.botHits++;
        stats.bots[botName] = (stats.bots[botName] || 0) + 1;
        stats.topUrls[url] = (stats.topUrls[url] || 0) + 1;
        stats.statusCodes[status] = (stats.statusCodes[status] || 0) + 1;
      }
    }
    
    if (stats.totalLines % 5000 === 0) {
       onProgress(stats.totalLines);
    }
  }

  // Sort top URLs by frequency
  const sortedUrls = Object.entries(stats.topUrls)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 100); 
  stats.topUrls = sortedUrls;

  onComplete(stats);
}
