import fs from 'fs';
import csv from 'csv-parser';
import { pipeline } from 'stream/promises';

const EXPECTED_CTR = {
  1: 28,
  2: 15,
  3: 11,
  4: 8,
  5: 7,
  6: 5,
  7: 4,
  8: 3.5,
  9: 3,
  10: 2.5
};

function getExpectedCtr(position) {
  const roundedPos = Math.round(position);
  if (roundedPos <= 1) return EXPECTED_CTR[1];
  if (roundedPos >= 10) return EXPECTED_CTR[10];
  return EXPECTED_CTR[roundedPos];
}

export async function analyzeGscFile(filePath, fileType) {
  const results = [];
  let detectedHeaders = [];
  
  // Normalize keys to handle different languages and BOMs in GSC exports
  const normalizeKey = (key) => key.toLowerCase().replace(/[^a-z0-9]/g, '');

  await pipeline(
    fs.createReadStream(filePath),
    csv({
      mapHeaders: ({ header, index }) => {
        const normalized = normalizeKey(header);
        detectedHeaders[index] = normalized;
        return normalized;
      }
    }),
    async function* (source) {
      for await (const row of source) {
        results.push(row);
      }
    }
  );

  let type = fileType;
  if (!type) {
    const isQuery = detectedHeaders.some(h => ['topqueries', 'query', 'queries', 'requêteslesplusfréquentes'].includes(h));
    const isPage = detectedHeaders.some(h => ['toppages', 'page', 'pages', 'landingpage', 'pageslesplusfréquentes'].includes(h));
    
    if (isPage) {
      type = 'pages';
    } else if (isQuery) {
      type = 'queries';
    } else {
      type = 'queries'; // default fallback
    }
  }

  const parsedData = results.map(row => {
    let key = '';
    if (type === 'pages') {
      key = row['toppages'] || row['pages'] || row['landingpage'] || row['page'] || row['pageslesplusfréquentes'] || Object.values(row)[0];
    } else {
      key = row['topqueries'] || row['queries'] || row['query'] || row['requêteslesplusfréquentes'] || Object.values(row)[0];
    }
    
    let clicks = parseFloat((row['clicks'] || row['clics'] || '0').toString().replace(/[^0-9.-]+/g, ""));
    let impressions = parseFloat((row['impressions'] || '0').toString().replace(/[^0-9.-]+/g, ""));
    
    let ctrRaw = (row['ctr'] || '0').toString();
    let ctr = parseFloat(ctrRaw.replace('%', '').replace(',', '.'));
    if (ctrRaw.includes('%')) {
      // It's already a percentage
    } else {
      // It's a raw decimal
      ctr = ctr * 100;
    }
    
    let position = parseFloat((row['position'] || '0').toString().replace(',', '.'));

    return { key, clicks, impressions, ctr, position };
  }).filter(row => row.key && !isNaN(row.impressions) && !isNaN(row.position));

  if (type === 'queries') {
    return analyzeQueries(parsedData);
  } else {
    return analyzePages(parsedData);
  }
}

function analyzeQueries(parsedData) {
  let totalClicks = 0;
  let totalImpressions = 0;
  let totalPosition = 0;
  let totalCtr = 0;

  const distribution = {
    '1-3': 0,
    '4-10': 0,
    '11-20': 0,
    '21-50': 0,
    '50+': 0
  };

  for (const row of parsedData) {
    totalClicks += row.clicks;
    totalImpressions += row.impressions;
    totalPosition += row.position;
    totalCtr += row.ctr;

    if (row.position <= 3) distribution['1-3']++;
    else if (row.position <= 10) distribution['4-10']++;
    else if (row.position <= 20) distribution['11-20']++;
    else if (row.position <= 50) distribution['21-50']++;
    else distribution['50+']++;
  }

  const avgPosition = parsedData.length > 0 ? totalPosition / parsedData.length : 0;
  const avgCtr = parsedData.length > 0 ? totalCtr / parsedData.length : 0;

  const expectedTop3Ctr = (EXPECTED_CTR[1] + EXPECTED_CTR[2] + EXPECTED_CTR[3]) / 3;

  const lowHangingFruit = parsedData
    .filter(row => row.position >= 8 && row.position <= 20)
    .sort((a, b) => b.impressions - a.impressions);

  const ctrOpps = parsedData
    .filter(row => row.position >= 1 && row.position <= 10 && row.impressions > 20 && row.ctr < getExpectedCtr(row.position))
    .sort((a, b) => b.impressions - a.impressions);

  const topWinners = [...parsedData]
    .sort((a, b) => b.clicks - a.clicks);

  const quickWins = parsedData
    .filter(row => row.position >= 1 && row.position <= 3 && row.ctr < expectedTop3Ctr)
    .sort((a, b) => b.impressions - a.impressions);

  return {
    fileType: 'queries',
    totalRows: parsedData.length,
    stats: {
      totalClicks,
      totalImpressions,
      avgCtr,
      avgPosition
    },
    distribution,
    lowHangingFruit,
    ctrOpps,
    topWinners,
    quickWins
  };
}

function analyzePages(parsedData) {
  let totalClicks = 0;
  let totalImpressions = 0;

  for (const row of parsedData) {
    totalClicks += row.clicks;
    totalImpressions += row.impressions;
  }

  const avgImpressions = parsedData.length > 0 ? totalImpressions / parsedData.length : 0;
  const avgClicks = parsedData.length > 0 ? totalClicks / parsedData.length : 0;

  const topPagesByClicks = [...parsedData]
    .sort((a, b) => b.clicks - a.clicks);

  const underperformingPages = parsedData
    .filter(row => row.impressions > avgImpressions && row.clicks < avgClicks)
    .sort((a, b) => b.impressions - a.impressions);

  const pagesNeedingAttention = parsedData
    .filter(row => row.position > 10 && row.impressions > 20)
    .sort((a, b) => b.impressions - a.impressions);

  return {
    fileType: 'pages',
    totalRows: parsedData.length,
    topPagesByClicks,
    underperformingPages,
    pagesNeedingAttention
  };
}
