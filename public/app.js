document.addEventListener('DOMContentLoaded', () => {
  // XSS Protection
  const escapeHtml = (str) => {
    if (typeof str !== 'string') return str;
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
  };
  
  // ==========================================
  // Navigation Logic
  // ==========================================
  const navItems = document.querySelectorAll('.nav-item');
  const views = document.querySelectorAll('.tool-view');

  navItems.forEach(item => {
    const activateTab = () => {
      // Remove active from all
      navItems.forEach(n => n.classList.remove('active'));
      views.forEach(v => v.classList.remove('active'));
      
      // Add active to clicked
      item.classList.add('active');
      const target = item.getAttribute('data-target');
      document.getElementById(target).classList.add('active');
    };

    item.addEventListener('click', activateTab);
    item.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        activateTab();
      }
    });
  });

  // Helper for SSE reading
  async function readSSE(response, onEvent) {
    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      throw new Error(errData.error || `HTTP Error ${response.status}`);
    }
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const parts = buffer.split('\n\n');
      buffer = parts.pop();
      for (const part of parts) {
        if (part.startsWith('data: ')) {
          try {
            const parsed = JSON.parse(part.substring(6));
            onEvent(parsed.type, parsed.data);
          } catch(e) {}
        }
      }
    }
    // Process any remaining buffered data
    if (buffer.trim()) {
      if (buffer.startsWith('data: ')) {
        try {
          const parsed = JSON.parse(buffer.substring(6));
          onEvent(parsed.type, parsed.data);
        } catch(e) {}
      }
    }
  }

  async function handleSSE(response, callbacks) {
    await readSSE(response, (type, data) => {
      if (type === 'progress' && callbacks.onProgress) callbacks.onProgress(data);
      else if (type === 'complete' && callbacks.onComplete) callbacks.onComplete(data);
      else if (type === 'error' && callbacks.onError) callbacks.onError(data);
    });
  }

  // ==========================================
  // Tool 1: Log Analyzer
  // ==========================================
  const dropZone = document.getElementById('drop-zone');
  const fileInput = document.getElementById('file-input');
  
  dropZone.addEventListener('click', () => fileInput.click());
  dropZone.addEventListener('dragover', (e) => { e.preventDefault(); dropZone.style.borderColor = 'white'; });
  dropZone.addEventListener('dragleave', () => dropZone.style.borderColor = 'var(--accent)');
  dropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropZone.style.borderColor = 'var(--accent)';
    if (e.dataTransfer.files.length) handleLogUpload(e.dataTransfer.files[0]);
  });
  fileInput.addEventListener('change', () => {
    if (fileInput.files.length) handleLogUpload(fileInput.files[0]);
    fileInput.value = '';
  });

  // ==========================================
  // Tool 1.5: GSC Analyzer
  // ==========================================
  const gscFile = document.getElementById('gsc-file');
  if (gscFile) {
    gscFile.addEventListener('change', async (e) => {
      const file = e.target.files[0];
      if (!file) return;

      const formData = new FormData();
      formData.append('csvfile', file);

      const status = document.getElementById('gsc-status');
      const resultsContainer = document.getElementById('gsc-results-container');
      
      status.innerText = 'Uploading and analyzing GSC data...';
      resultsContainer.style.display = 'none';

      try {
        const response = await fetch('/api/gsc/upload', {
          method: 'POST',
          body: formData
        });
        
        if (!response.ok) {
          const err = await response.json();
          throw new Error(err.error || 'Failed to analyze GSC file');
        }
        
        const data = await response.json();
        
        status.innerText = `Analysis Complete! Processed ${data.totalRows} queries.`;
        resultsContainer.style.display = 'flex';
        
        // 1. Low-Hanging Fruit
        const lhTbody = document.getElementById('gsc-low-hanging');
        let lhHtml = '';
        data.lowHangingFruit.forEach(row => {
          lhHtml += `<tr>
            <td>${escapeHtml(row.query)}</td>
            <td>${row.impressions.toLocaleString()}</td>
            <td><span class="badge warning">${row.position.toFixed(1)}</span></td>
          </tr>`;
        });
        lhTbody.innerHTML = lhHtml;

        // 2. CTR Opportunities
        const ctrTbody = document.getElementById('gsc-ctr-opps');
        let ctrHtml = '';
        data.ctrOpps.forEach(row => {
          ctrHtml += `<tr>
            <td>${escapeHtml(row.query)}</td>
            <td><span class="badge error">${row.ctr.toFixed(2)}%</span></td>
            <td>${row.position.toFixed(1)}</td>
          </tr>`;
        });
        ctrTbody.innerHTML = ctrHtml;

        // 3. Top Winners
        const winnersTbody = document.getElementById('gsc-winners');
        let winnersHtml = '';
        data.topWinners.forEach(row => {
          winnersHtml += `<tr>
            <td>${escapeHtml(row.query)}</td>
            <td>${row.clicks.toLocaleString()}</td>
            <td>${row.impressions.toLocaleString()}</td>
            <td>${row.ctr.toFixed(2)}%</td>
            <td><span class="badge success">${row.position.toFixed(1)}</span></td>
          </tr>`;
        });
        winnersTbody.innerHTML = winnersHtml;
        
      } catch (err) {
        status.innerText = 'Error: ' + err.message;
      }
    });
  }

  async function handleLogUpload(file) {
    const formData = new FormData();
    formData.append('logfile', file);
    
    document.getElementById('log-results').style.display = 'none';
    const pText = document.getElementById('log-progress-text');
    const pFill = document.getElementById('log-progress-fill');
    
    try {
      const response = await fetch('/api/logs/upload', { method: 'POST', body: formData });
      await readSSE(response, (type, data) => {
        if (type === 'progress') {
          pText.textContent = data;
          const match = data.match(/(\d+)%/);
          if (match) pFill.style.width = match[1] + '%';
        } else if (type === 'complete') {
          pText.textContent = 'Analysis Complete';
          pFill.style.width = '100%';
          document.getElementById('log-results').style.display = 'grid';
          document.getElementById('total-hits').textContent = data.totalLines.toLocaleString();
          document.getElementById('bot-percentage').textContent = ((data.botHits / data.totalLines) * 100).toFixed(1) + '%';
          
          let topBot = 'None', topCount = 0;
          for (const [bot, count] of Object.entries(data.botAgents)) {
            if (count > topCount) { topCount = count; topBot = bot; }
          }
          document.getElementById('top-bot').textContent = topBot;
        } else if (type === 'error') {
          pText.textContent = 'Error: ' + data;
          pText.style.color = 'var(--intent-err)';
        }
      });
    } catch (e) {
      pText.textContent = 'Upload failed';
    }
  }

  // ==========================================
  // Tool 2: Content Grader
  // ==========================================
  document.getElementById('grader-btn').addEventListener('click', async () => {
    const keyword = document.getElementById('grader-keyword').value;
    const draft = document.getElementById('grader-draft').value;
    const status = document.getElementById('grader-status');
    
    if (!keyword) return alert('Enter a keyword');
    document.getElementById('grader-btn').disabled = true;
    
    try {
      const response = await fetch('/api/grader/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ keyword, draft })
      });
      await readSSE(response, (type, data) => {
        if (type === 'progress') {
          status.textContent = data;
        } else if (type === 'complete') {
          status.textContent = 'Analysis Complete';
          
          // Calculate Grade
          const gradeEl = document.getElementById('grade-circle');
          let grade = 'F', color = 'var(--intent-err)';
          if (data.score > 80) { grade = 'A+'; color = 'var(--intent-trans)'; }
          else if (data.score > 60) { grade = 'B'; color = 'var(--intent-info)'; }
          else if (data.score > 40) { grade = 'C'; color = 'var(--intent-comm)'; }
          gradeEl.textContent = grade;
          gradeEl.style.borderColor = color;
          gradeEl.style.color = color;
          
          const ul = document.getElementById('missing-terms');
          ul.innerHTML = '';
          (data.missingEntities || data.missing || []).slice(0, 10).forEach(term => {
            const li = document.createElement('li');
            li.innerHTML = `${term} <span>+score</span>`;
            ul.appendChild(li);
          });
          document.getElementById('grader-btn').disabled = false;
        } else if (type === 'error') {
          status.textContent = 'Error: ' + data;
          document.getElementById('grader-btn').disabled = false;
        }
      });
    } catch (e) {
      status.textContent = 'Connection failed';
      document.getElementById('grader-btn').disabled = false;
    }
  });

  // ==========================================
  // Tool 3: Web Vitals
  // ==========================================
  document.getElementById('vitals-btn').addEventListener('click', async () => {
    const url = document.getElementById('vitals-url').value;
    const status = document.getElementById('vitals-status');
    if (!url) return alert('Enter a URL');
    
    document.getElementById('vitals-btn').disabled = true;
    document.getElementById('vitals-results').style.display = 'none';
    
    try {
      const response = await fetch('/api/vitals/audit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url })
      });
      await readSSE(response, (type, data) => {
        if (type === 'progress') {
          status.textContent = data;
        } else if (type === 'complete') {
          status.textContent = 'Audit Complete';
          document.getElementById('vitals-results').style.display = 'grid';
          document.getElementById('vitals-score').textContent = data.score;
          document.getElementById('vitals-lcp').textContent = data.metrics?.lcp?.displayValue || 'N/A';
          document.getElementById('vitals-cls').textContent = data.metrics?.cls?.displayValue || 'N/A';
          document.getElementById('vitals-btn').disabled = false;
        } else if (type === 'error') {
          status.textContent = 'Error: ' + data;
          document.getElementById('vitals-btn').disabled = false;
        }
      });
    } catch (e) {
      status.textContent = 'Connection failed';
      document.getElementById('vitals-btn').disabled = false;
    }
  });

  // ==========================================
  // Tool 4: Intent Mapper
  // ==========================================
  document.getElementById('intent-btn').addEventListener('click', async () => {
    const raw = document.getElementById('intent-keywords').value;
    const keywords = raw.split('\n').map(k => k.trim()).filter(k => k.length > 0);
    if (!keywords.length) return alert('Enter keywords');
    
    const btn = document.getElementById('intent-btn');
    const tbody = document.getElementById('intent-tbody');
    const status = document.getElementById('intent-status');
    const count = document.getElementById('intent-count');
    
    btn.disabled = true;
    tbody.innerHTML = '';
    let parsedCount = 0;
    count.textContent = `0 / ${keywords.length}`;
    
    try {
      const response = await fetch('/api/intent/map', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ keywords })
      });
      await readSSE(response, (type, data) => {
        if (type === 'progress') {
          status.textContent = data;
        } else if (type === 'result') {
          parsedCount++;
          count.textContent = `${parsedCount} / ${keywords.length}`;
          
          const tr = document.createElement('tr');
          tr.innerHTML = `
            <td style="font-weight: 500">${escapeHtml(data.keyword)}</td>
            <td><span class="badge ${data.intent}">${data.intent}</span></td>
            <td>
              <div style="font-size:0.85rem; font-weight:bold">${data.confidence}%</div>
              <div class="conf-bar-bg"><div class="conf-bar-fill" style="width:${data.confidence}%"></div></div>
            </td>
          `;
          tbody.appendChild(tr);
        } else if (type === 'complete') {
          status.textContent = 'Mapping Complete';
          btn.disabled = false;
        } else if (type === 'error') {
          status.textContent = 'Error: ' + data;
          btn.disabled = false;
        }
      });
    } catch (e) {
      status.textContent = 'Connection failed';
      btn.disabled = false;
    }
  });

  // ==========================================
  // Tool 5: Site Crawler
  // ==========================================
  const crawlerBtn = document.getElementById('crawler-btn');
  if (crawlerBtn) {
    crawlerBtn.addEventListener('click', async () => {
      const url = document.getElementById('crawler-url').value;
      const maxPages = document.getElementById('crawler-max').value;
      
      if (!url) return alert('Enter a valid starting URL');
      if (!url.startsWith('http')) return alert('URL must start with http:// or https://');
      
      const tbody = document.getElementById('crawler-tbody');
      const status = document.getElementById('crawler-status');
      const countLabel = document.getElementById('crawler-count');
      
      crawlerBtn.disabled = true;
      tbody.innerHTML = '';
      let pageCount = 0;
      countLabel.textContent = '0';
      
      try {
        const response = await fetch('/api/crawler/start', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url, maxPages: parseInt(maxPages) || 50 })
        });
        
        await readSSE(response, (type, data) => {
          if (type === 'progress') {
            status.textContent = data;
          } else if (type === 'result') {
            pageCount++;
            countLabel.textContent = pageCount;
            
            const tr = document.createElement('tr');
            
            let statusColor = 'var(--text)';
            if (data.status === 200) statusColor = 'var(--intent-trans)';
            else if (data.status === 404 || data.status >= 500) statusColor = 'var(--intent-err)';
            else if (data.status >= 300) statusColor = 'var(--intent-comm)';
            
            let titleColor = data.titleLength > 60 || data.titleLength === 0 ? 'var(--intent-err)' : 'var(--text)';
            let descColor = data.descriptionLength > 160 || data.descriptionLength === 0 ? 'var(--intent-err)' : 'var(--text)';
            
            tr.innerHTML = `
              <td style="max-width: 200px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="${escapeHtml(data.url)}">
                <a href="${escapeHtml(data.url)}" target="_blank" style="color:var(--accent); text-decoration:none">${escapeHtml(data.url).replace(/^https?:\/\//, '')}</a>
              </td>
              <td style="font-weight:bold; color:${statusColor}">${data.status}</td>
              <td style="color:${titleColor}">${escapeHtml(data.title)} <br/><small>(${data.titleLength} chars)</small></td>
              <td style="color:${descColor}">${data.description ? escapeHtml(data.description).substring(0,30)+'...' : 'Missing'} <br/><small>(${data.descriptionLength} chars)</small></td>
              <td style="font-family:monospace; color:var(--text-muted)">${data.internalLinks} / ${data.externalLinks}</td>
            `;
            tbody.appendChild(tr);
          } else if (type === 'complete') {
            status.textContent = `Crawl Complete! Found ${data.totalCrawled} pages.`;
            crawlerBtn.disabled = false;
          } else if (type === 'error') {
            status.textContent = 'Error: ' + data;
            status.style.color = 'var(--intent-err)';
            crawlerBtn.disabled = false;
          }
        });
      } catch (e) {
        status.textContent = 'Connection failed';
        crawlerBtn.disabled = false;
      }
    });
  }

  // ==========================================
  // Tool 6: Master Audit
  // ==========================================
  const masterBtn = document.getElementById('master-btn');
  if (masterBtn) {
    masterBtn.addEventListener('click', async () => {
      const url = document.getElementById('master-url').value;
      const keyword = document.getElementById('master-keyword').value;
      const isBatch = document.getElementById('master-batch-toggle')?.checked;
      
      if (!url || !keyword) return alert('Enter a URL and Target Keyword');
      if (!url.startsWith('http')) return alert('URL must start with http:// or https://');
      
      const status = document.getElementById('master-status');
      masterBtn.disabled = true;
      document.getElementById('master-results').style.display = 'none';
      
      try {
        if (isBatch) {
          status.textContent = 'Starting Batch Master Audit...';
          const response = await fetch('/api/master/batch', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ sitemapUrl: url, keyword })
          });
          
          await readSSE(response, (type, data) => {
            if (type === 'progress') {
              status.textContent += `\n${data}`;
            } else if (type === 'complete') {
              status.textContent += `\n\nBatch Audit Complete! Processed ${data.length} URLs. Check the History tab for detailed trends.`;
              masterBtn.disabled = false;
            } else if (type === 'error') {
              status.textContent += `\nError: ${data}`;
              masterBtn.disabled = false;
            }
          });
          return;
        }

        const response = await fetch('/api/master/audit', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url, keyword })
        });
        
        await readSSE(response, (type, data) => {
          if (type === 'progress') {
            status.textContent = data;
          } else if (type === 'complete') {
            status.textContent = '360° Audit Complete!';
            document.getElementById('master-results').style.display = 'block';
            
            // Populate UI
            const scoreEl = document.getElementById('master-score');
            scoreEl.textContent = data.overallScore;
            scoreEl.style.borderColor = data.overallScore > 80 ? 'var(--intent-trans)' : (data.overallScore > 50 ? 'var(--intent-comm)' : 'var(--intent-err)');
            scoreEl.style.color = scoreEl.style.borderColor;
            
            if (data.intent) {
              const b = document.getElementById('master-intent-badge');
              b.textContent = data.intent.intent;
              b.className = `badge ${data.intent.intent}`;
              document.getElementById('master-intent-conf').textContent = `${data.intent.confidence}% Match`;
            }
            
            if (data.vitals && !data.vitals.error) {
              document.getElementById('master-vitals-lcp').textContent = data.vitals.lcp || 'Error';
              document.getElementById('master-vitals-cls').textContent = data.vitals.cls || 'Error';
              document.getElementById('master-vitals-tbt').textContent = data.vitals.tbt || 'Error';
            }
            
            if (data.content) {
              document.getElementById('master-content-grade').textContent = data.content.grade;
              const missingDiv = document.getElementById('master-content-missing');
              missingDiv.innerHTML = '';
              (data.content.missing || []).slice(0, 10).forEach(term => {
                const tag = document.createElement('span');
                tag.style.cssText = 'background: rgba(255,255,255,0.1); padding: 4px 10px; border-radius: 99px; font-size: 0.8rem;';
                tag.textContent = term;
                missingDiv.appendChild(tag);
              });
            }
            if (data.technical) {
              document.getElementById('master-tech-canonical').textContent = data.technical.canonical || 'Missing';
              document.getElementById('master-tech-schema').textContent = data.technical.jsonLd ? 'Present' : 'Missing';
              document.getElementById('master-tech-links').textContent = data.technical.totalLinks || '0';
              const brokenEl = document.getElementById('master-tech-broken');
              brokenEl.textContent = data.technical.brokenLinks || '0';
              if (data.technical.brokenLinks > 0) brokenEl.style.color = 'var(--intent-err)';
              else brokenEl.style.color = 'var(--intent-info)';
            }
            
            if (data.actionPlan) {
              const planList = document.getElementById('master-action-plan');
              planList.innerHTML = '';
              data.actionPlan.forEach(item => {
                const li = document.createElement('li');
                li.style.cssText = 'padding: 10px; background: var(--bg-hover); margin-bottom: 8px; border-radius: 8px; border-left: 4px solid var(--accent);';
                if (item.priority === 'High') li.style.borderLeftColor = 'var(--intent-err)';
                if (item.priority === 'Medium') li.style.borderLeftColor = 'var(--intent-nav)';
                if (item.priority === 'Low') li.style.borderLeftColor = 'var(--intent-info)';
                
                li.innerHTML = `<strong>[${item.priority}]</strong> ${escapeHtml(item.task)}`;
                planList.appendChild(li);
              });
            }

            masterBtn.disabled = false;
          } else if (type === 'error') {
            status.textContent = 'Error: ' + data;
            status.style.color = 'var(--intent-err)';
            masterBtn.disabled = false;
          }
        });
      } catch (e) {
        status.textContent = 'Connection failed';
        masterBtn.disabled = false;
      }
    });
    
    const pdfBtn = document.getElementById('master-pdf-btn');
    if (pdfBtn) {
      pdfBtn.addEventListener('click', async () => {
        const resultsHtml = document.getElementById('master-results').innerHTML;
        pdfBtn.disabled = true;
        pdfBtn.textContent = 'Generating...';
        
        try {
          const res = await fetch('/api/export-pdf', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ htmlContent: resultsHtml })
          });
          
          if (!res.ok) throw new Error('PDF Export failed');
          
          const blob = await res.blob();
          const url = window.URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = 'SEO_Master_Audit.pdf';
          document.body.appendChild(a);
          a.click();
          a.remove();
          window.URL.revokeObjectURL(url);
        } catch (e) {
          alert(e.message);
        } finally {
          pdfBtn.disabled = false;
          pdfBtn.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="margin-right: 8px; vertical-align: middle;"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg> Download PDF Report';
        }
      });
    }
  }

  // ==========================================
  // Tool 6.5: Internal Link Finder
  // ==========================================
  const finderBtn = document.getElementById('finder-btn');
  if (finderBtn) {
    finderBtn.addEventListener('click', async () => {
      const sitemapUrl = document.getElementById('finder-sitemap').value;
      const targetUrl = document.getElementById('finder-target').value;
      const keyword = document.getElementById('finder-keyword').value;
      
      if (!sitemapUrl || !targetUrl || !keyword) return alert('Enter Sitemap URL, Target URL, and Keyword');
      if (!sitemapUrl.startsWith('http') || !targetUrl.startsWith('http')) return alert('URLs must start with http:// or https://');
      
      const tbody = document.getElementById('finder-tbody');
      const status = document.getElementById('finder-status');
      const countLabel = document.getElementById('finder-count');
      
      finderBtn.disabled = true;
      tbody.innerHTML = '';
      let oppCount = 0;
      countLabel.textContent = '0';
      
      try {
        const response = await fetch('/api/links/find', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sitemapUrl, targetUrl, keyword })
        });
        
        await readSSE(response, (type, data) => {
          if (type === 'progress') {
            status.textContent = data;
          } else if (type === 'result') {
            oppCount++;
            countLabel.textContent = oppCount;
            
            const tr = document.createElement('tr');
            tr.innerHTML = `
              <td style="max-width: 250px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="${escapeHtml(data.sourceUrl)}">
                <a href="${escapeHtml(data.sourceUrl)}" target="_blank" style="color:var(--accent); text-decoration:none">${escapeHtml(data.sourceUrl).replace(/^https?:\/\//, '')}</a>
              </td>
              <td style="max-width: 250px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="${escapeHtml(data.targetUrl)}">
                <span style="color:var(--text-muted)">${escapeHtml(data.targetUrl).replace(/^https?:\/\//, '')}</span>
              </td>
              <td style="font-weight:bold; color:var(--intent-trans)">"${escapeHtml(data.keyword)}"</td>
            `;
            tbody.appendChild(tr);
          } else if (type === 'complete') {
            status.textContent = `Scan Complete! Found ${data.opportunities} opportunities across ${data.scanned} pages.`;
            finderBtn.disabled = false;
          } else if (type === 'error') {
            status.textContent = 'Error: ' + data;
            status.style.color = 'var(--intent-err)';
            finderBtn.disabled = false;
          }
        });
      } catch (e) {
        status.textContent = 'Connection failed';
        finderBtn.disabled = false;
      }
    });
  }

  // ==========================================
  // Tool 6.8: Cannibalization Checker
  // ==========================================
  const cannibalBtn = document.getElementById('cannibal-btn');
  if (cannibalBtn) {
    cannibalBtn.addEventListener('click', async () => {
      const sitemapUrl = document.getElementById('cannibal-sitemap').value;
      if (!sitemapUrl) return alert('Enter Sitemap URL');
      if (!sitemapUrl.startsWith('http')) return alert('URL must start with http:// or https://');
      
      const resultsContainer = document.getElementById('cannibal-results');
      const status = document.getElementById('cannibal-status');
      const countLabel = document.getElementById('cannibal-count');
      
      cannibalBtn.disabled = true;
      resultsContainer.innerHTML = '';
      let conflictCount = 0;
      countLabel.textContent = '0';
      
      try {
        const response = await fetch('/api/cannibalization/check', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sitemapUrl })
        });
        
        await readSSE(response, (type, data) => {
          if (type === 'progress') {
            status.textContent = data;
          } else if (type === 'conflict') {
            conflictCount++;
            countLabel.textContent = conflictCount;
            
            const card = document.createElement('div');
            card.style.cssText = 'background: var(--bg-hover); padding: 1.5rem; border-radius: 12px; border: 1px solid var(--intent-err); border-left: 4px solid var(--intent-err);';
            
            let html = `<h3 style="color:var(--intent-err); margin-bottom:1rem;">Conflicting Intent: "${escapeHtml(data.intent)}"</h3>`;
            html += `<ul style="list-style:none; padding:0; display:flex; flex-direction:column; gap:0.5rem;">`;
            
            data.pages.forEach(p => {
              html += `<li>
                <a href="${escapeHtml(p.url)}" target="_blank" style="color:var(--accent); text-decoration:none; font-weight:bold;">${escapeHtml(p.url).replace(/^https?:\/\//, '')}</a>
                <div style="font-size:0.85rem; color:var(--text-muted); margin-top:0.2rem;">Title: ${escapeHtml(p.title)}</div>
                <div style="font-size:0.85rem; color:var(--text-muted);">H1: ${escapeHtml(p.h1)}</div>
              </li>`;
            });
            html += `</ul>`;
            
            card.innerHTML = html;
            resultsContainer.appendChild(card);
          } else if (type === 'complete') {
            status.textContent = `Scan Complete! Found ${data.conflictsFound} conflicts across ${data.scanned} pages.`;
            cannibalBtn.disabled = false;
          } else if (type === 'error') {
            status.textContent = 'Error: ' + data;
            status.style.color = 'var(--intent-err)';
            cannibalBtn.disabled = false;
          }
        });
      } catch (e) {
        status.textContent = 'Connection failed';
        cannibalBtn.disabled = false;
      }
    });
  }

  // ==========================================
  // Tool 6.9: Schema Generator
  // ==========================================
  const schemaTypeSelect = document.getElementById('schema-type');
  const schemaFieldsContainer = document.getElementById('schema-fields-container');
  const schemaBtn = document.getElementById('schema-btn');
  const schemaOutput = document.getElementById('schema-output');

  const schemaTemplates = {
    Product: [
      { id: 'sc-name', label: 'Product Name', placeholder: 'e.g. Vintage Leather Jacket' },
      { id: 'sc-desc', label: 'Description', placeholder: 'e.g. A beautiful vintage jacket.' },
      { id: 'sc-price', label: 'Price (USD)', placeholder: 'e.g. 199.99' },
      { id: 'sc-img', label: 'Image URL', placeholder: 'https://example.com/image.jpg' }
    ],
    Article: [
      { id: 'sc-headline', label: 'Headline', placeholder: 'e.g. 10 Best SEO Tips' },
      { id: 'sc-author', label: 'Author Name', placeholder: 'e.g. Jane Doe' },
      { id: 'sc-date', label: 'Date Published', placeholder: 'e.g. 2026-09-12' },
      { id: 'sc-img', label: 'Image URL', placeholder: 'https://example.com/hero.jpg' }
    ],
    FAQ: [
      { id: 'sc-q1', label: 'Question 1', placeholder: 'What is SEO?' },
      { id: 'sc-a1', label: 'Answer 1', placeholder: 'Search Engine Optimization.' },
      { id: 'sc-q2', label: 'Question 2', placeholder: 'Is this free?' },
      { id: 'sc-a2', label: 'Answer 2', placeholder: 'Yes, it is.' }
    ]
  };

  if (schemaTypeSelect && schemaFieldsContainer) {
    const renderSchemaFields = () => {
      const type = schemaTypeSelect.value;
      schemaFieldsContainer.innerHTML = schemaTemplates[type].map(f => `
        <div style="display:flex; flex-direction:column; gap:0.3rem;">
          <label style="font-size:0.85rem; color:var(--text-muted);">${f.label}</label>
          <input type="text" id="${f.id}" placeholder="${f.placeholder}" style="padding:0.6rem; border-radius:6px; border:1px solid var(--border); background:var(--bg); color:var(--text);" />
        </div>
      `).join('');
    };
    schemaTypeSelect.addEventListener('change', renderSchemaFields);
    renderSchemaFields(); // Initialize on load

    schemaBtn.addEventListener('click', () => {
      const type = schemaTypeSelect.value;
      let jsonld = {};
      
      if (type === 'Product') {
        jsonld = {
          "@context": "https://schema.org/",
          "@type": "Product",
          "name": document.getElementById('sc-name')?.value || "Example Product",
          "image": [ document.getElementById('sc-img')?.value || "https://example.com/img.jpg" ],
          "description": document.getElementById('sc-desc')?.value || "Example description",
          "offers": {
            "@type": "Offer",
            "priceCurrency": "USD",
            "price": document.getElementById('sc-price')?.value || "0.00",
            "availability": "https://schema.org/InStock"
          }
        };
      } else if (type === 'Article') {
        jsonld = {
          "@context": "https://schema.org",
          "@type": "NewsArticle",
          "headline": document.getElementById('sc-headline')?.value || "Example Headline",
          "image": [ document.getElementById('sc-img')?.value || "https://example.com/img.jpg" ],
          "datePublished": document.getElementById('sc-date')?.value || new Date().toISOString(),
          "author": [{
              "@type": "Person",
              "name": document.getElementById('sc-author')?.value || "Author"
          }]
        };
      } else if (type === 'FAQ') {
        jsonld = {
          "@context": "https://schema.org",
          "@type": "FAQPage",
          "mainEntity": [
            {
              "@type": "Question",
              "name": document.getElementById('sc-q1')?.value || "Question 1?",
              "acceptedAnswer": { "@type": "Answer", "text": document.getElementById('sc-a1')?.value || "Answer 1" }
            },
            {
              "@type": "Question",
              "name": document.getElementById('sc-q2')?.value || "Question 2?",
              "acceptedAnswer": { "@type": "Answer", "text": document.getElementById('sc-a2')?.value || "Answer 2" }
            }
          ]
        };
      }
      
      schemaOutput.textContent = `<script type="application/ld+json">\n${JSON.stringify(jsonld, null, 2)}\n</script>`;
    });
  }

  // ==========================================
  // Tool 6.91: Meta Tag Optimizer
  // ==========================================
  const metaBtn = document.getElementById('meta-btn');
  if (metaBtn) {
    metaBtn.addEventListener('click', () => {
      const keyword = document.getElementById('meta-keyword').value || 'Target Keyword';
      const brand = document.getElementById('meta-brand').value || 'Brand';
      const angle = document.getElementById('meta-angle').value;
      const results = document.getElementById('meta-results');
      
      const templates = {
        ecommerce: [
          { t: `Buy ${keyword} Online | ${brand}`, d: `Shop the best ${keyword} at ${brand}. Discover our new 2026 collection with free shipping and easy returns. Order yours today!` },
          { t: `${keyword} - Top Quality & Best Prices | ${brand}`, d: `Looking for ${keyword}? We have everything you need. Browse our massive selection and find the perfect match for you.` },
          { t: `Premium ${keyword} Collection | ${brand}`, d: `Upgrade your style with our premium ${keyword}. Exclusive deals available for a limited time. Shop ${brand} now.` }
        ],
        informational: [
          { t: `The Ultimate Guide to ${keyword} (2026)`, d: `Everything you need to know about ${keyword}. Read our comprehensive guide and expert tips to get started today.` },
          { t: `${keyword}: 7 Things You Must Know`, d: `Before you try ${keyword}, make sure you read this. We cover the top 7 mistakes people make and how to avoid them.` },
          { t: `What is ${keyword}? A Complete Overview`, d: `Confused about ${keyword}? Our beginner-friendly guide explains exactly what it is, how it works, and why it matters.` }
        ],
        local: [
          { t: `Best ${keyword} Near Me | ${brand}`, d: `Need ${keyword}? ${brand} is your local trusted expert. We provide top-rated service with a 100% satisfaction guarantee. Call us!` },
          { t: `${keyword} Services in Your Area | ${brand}`, d: `Fast and reliable ${keyword} services. Contact ${brand} today for a free quote and professional assistance.` },
          { t: `Top-Rated ${keyword} | ${brand}`, d: `Don't settle for less. Get the highest quality ${keyword} from ${brand}. See our amazing customer reviews.` }
        ]
      };
      
      const vars = templates[angle];
      results.innerHTML = '';
      
      vars.forEach((v, i) => {
        const tLen = v.t.length;
        const dLen = v.d.length;
        const tColor = tLen > 60 ? 'var(--intent-err)' : 'var(--intent-trans)';
        const dColor = dLen > 160 ? 'var(--intent-err)' : 'var(--intent-trans)';
        
        results.innerHTML += `
          <div style="background:var(--bg-hover); padding:1rem; border-radius:8px; border:1px solid var(--border);">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.5rem;">
              <strong>Variation ${i+1}</strong>
            </div>
            
            <label style="font-size:0.8rem; color:var(--text-muted);">Title (<span style="color:${tColor}">${tLen}/60</span>)</label>
            <div style="color:var(--accent); font-size:1.1rem; margin-bottom:1rem; cursor:pointer;" onclick="navigator.clipboard.writeText(this.innerText); alert('Copied!')">${v.t}</div>
            
            <label style="font-size:0.8rem; color:var(--text-muted);">Description (<span style="color:${dColor}">${dLen}/160</span>)</label>
            <div style="color:var(--text); font-size:0.9rem; cursor:pointer;" onclick="navigator.clipboard.writeText(this.innerText); alert('Copied!')">${v.d}</div>
          </div>
        `;
      });
    });
  }

  // ==========================================
  // Tool 6.92: Broken Links Checker
  // ==========================================
  const brokenBtn = document.getElementById('broken-btn');
  if (brokenBtn) {
    brokenBtn.addEventListener('click', async () => {
      const url = document.getElementById('broken-url').value;
      if (!url) return alert('Enter Page URL');
      if (!url.startsWith('http')) return alert('URL must start with http:// or https://');
      
      const tbody = document.getElementById('broken-tbody');
      const status = document.getElementById('broken-status');
      const countLabel = document.getElementById('broken-count');
      
      brokenBtn.disabled = true;
      tbody.innerHTML = '';
      let linkCount = 0;
      countLabel.textContent = '0';
      
      try {
        const response = await fetch('/api/links/broken', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url })
        });
        
        await readSSE(response, (type, data) => {
          if (type === 'progress') {
            status.textContent = data;
          } else if (type === 'link') {
            linkCount++;
            countLabel.textContent = linkCount;
            
            const tr = document.createElement('tr');
            
            let color = 'var(--intent-trans)';
            if (data.health === 'Broken') color = 'var(--intent-err)';
            
            tr.innerHTML = `
              <td><a href="${escapeHtml(data.url)}" target="_blank" style="color:var(--accent);">${escapeHtml(data.url)}</a></td>
              <td>${data.status}</td>
              <td style="color:${color}; font-weight:bold;">${data.health}</td>
            `;
            
            // Highlight row if broken
            if (data.health === 'Broken') {
              tr.style.background = 'rgba(255, 107, 107, 0.1)';
            }
            
            tbody.appendChild(tr);
          } else if (type === 'complete') {
            status.textContent = `Scan Complete! Audited ${data.audited} external links.`;
            brokenBtn.disabled = false;
          } else if (type === 'error') {
            status.textContent = 'Error: ' + data;
            status.style.color = 'var(--intent-err)';
            brokenBtn.disabled = false;
          }
        });
      } catch (e) {
        status.textContent = 'Connection failed';
        brokenBtn.disabled = false;
      }
    });
  }

  // ==========================================
  // 7. History & Trends Logic
  // ==========================================
  let historyChart = null;

  async function loadHistory() {
    try {
      const res = await fetch('/api/history');
      const data = await res.json();
      
      // Sort ascending for chart (it comes back DESC if no URL provided)
      data.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

      const labels = data.map(d => new Date(d.timestamp).toLocaleString());
      const overallData = data.map(d => d.overall_score);
      const vitalsData = data.map(d => d.vitals_score);
      const contentData = data.map(d => d.content_score);

      const ctx = document.getElementById('history-chart').getContext('2d');
      if (historyChart) {
        historyChart.destroy();
      }

      historyChart = new Chart(ctx, {
        type: 'line',
        data: {
          labels,
          datasets: [
            {
              label: 'Overall Score',
              data: overallData,
              borderColor: '#6366f1',
              backgroundColor: 'rgba(99, 102, 241, 0.2)',
              borderWidth: 2,
              fill: true,
              tension: 0.3
            },
            {
              label: 'Web Vitals',
              data: vitalsData,
              borderColor: '#10b981',
              borderWidth: 2,
              borderDash: [5, 5],
              tension: 0.3
            },
            {
              label: 'Content NLP',
              data: contentData,
              borderColor: '#f59e0b',
              borderWidth: 2,
              borderDash: [5, 5],
              tension: 0.3
            }
          ]
        },
        options: {
          responsive: true,
          plugins: {
            legend: {
              labels: { color: '#e2e8f0' }
            }
          },
          scales: {
            x: {
              ticks: { color: '#94a3b8' }
            },
            y: {
              min: 0,
              max: 100,
              ticks: { color: '#94a3b8' }
            }
          }
        }
      });
    } catch (e) {
      console.error('Failed to load history', e);
    }
  }

  const refreshBtn = document.getElementById('refresh-history-btn');
  if (refreshBtn) {
    refreshBtn.addEventListener('click', loadHistory);
  }

  // Reload history when the history tab is clicked
  navItems.forEach(item => {
    item.addEventListener('click', () => {
      if (item.dataset.target === 'history-trends') {
        loadHistory();
      }
    });
  });

  // Mobile menu
  const mobileBtnEl = document.querySelector('.mobile-menu-btn');
  const sidebarEl = document.querySelector('.sidebar');
  if (mobileBtnEl && sidebarEl) {
    const mq = window.matchMedia('(max-width: 768px)');
    const handleMQ = (e) => { mobileBtnEl.style.display = e.matches ? 'block' : 'none'; };
    mq.addEventListener('change', handleMQ);
    handleMQ(mq);
    mobileBtnEl.addEventListener('click', () => sidebarEl.classList.toggle('open'));
    navItems.forEach(item => item.addEventListener('click', () => { if (mq.matches) sidebarEl.classList.remove('open'); }));
  }

  // ==========================================
  // Tool: SERP Snippet Previewer
  // ==========================================
  const serpTitle = document.getElementById('serp-title');
  const serpUrl = document.getElementById('serp-url-preview');
  const serpDesc = document.getElementById('serp-desc');
  
  if (serpTitle && serpDesc) {
    // Pixel width measurement using a hidden canvas
    const measureCanvas = document.createElement('canvas');
    const measureCtx = measureCanvas.getContext('2d');
    
    function measurePixelWidth(text, fontSize = '20px', fontFamily = 'Arial, sans-serif') {
      measureCtx.font = `${fontSize} ${fontFamily}`;
      return Math.round(measureCtx.measureText(text).width);
    }
    
    let isMobilePreview = false;
    const MAX_TITLE_PX_DESKTOP = 580;
    const MAX_TITLE_PX_MOBILE = 920;
    const MAX_DESC_DESKTOP = 160;
    const MAX_DESC_MOBILE = 120;
    
    function updateSerpPreview() {
      const title = serpTitle.value || 'Your Page Title Here';
      const url = serpUrl.value || 'https://example.com';
      const desc = serpDesc.value || 'Your meta description will appear here. Write a compelling description to improve your click-through rate.';
      
      const maxTitlePx = isMobilePreview ? MAX_TITLE_PX_MOBILE : MAX_TITLE_PX_DESKTOP;
      const maxDescChars = isMobilePreview ? MAX_DESC_MOBILE : MAX_DESC_DESKTOP;
      const titleFontSize = isMobilePreview ? '18px' : '20px';
      
      // Measure title pixel width
      const titlePx = measurePixelWidth(title, titleFontSize);
      const isTruncated = titlePx > maxTitlePx;
      
      // Find truncation point
      let displayTitle = title;
      if (isTruncated) {
        for (let i = title.length; i > 0; i--) {
          const truncated = title.substring(0, i) + '...';
          if (measurePixelWidth(truncated, titleFontSize) <= maxTitlePx) {
            displayTitle = truncated;
            break;
          }
        }
      }
      
      // Display description with truncation
      let displayDesc = desc;
      if (desc.length > maxDescChars) {
        displayDesc = desc.substring(0, maxDescChars - 3) + '...';
      }
      
      // Parse URL for breadcrumb
      let domain = 'example.com';
      let breadcrumb = url;
      try {
        const parsed = new URL(url);
        domain = parsed.hostname;
        breadcrumb = url.replace(/\/$/, '').replace(/^https?:\/\//, '').replace(/\//g, ' › ');
      } catch(e) {}
      
      // Update preview
      document.getElementById('serp-render-title').textContent = displayTitle;
      document.getElementById('serp-render-title').style.fontSize = titleFontSize;
      document.getElementById('serp-render-desc').textContent = displayDesc;
      document.getElementById('serp-render-breadcrumb').textContent = breadcrumb;
      document.querySelector('#serp-render-url > span').textContent = domain.charAt(0).toUpperCase();
      document.querySelector('#serp-render-url > div > div:first-child').textContent = domain;
      
      // Update metrics
      const titleChars = serpTitle.value.length;
      const descChars = serpDesc.value.length;
      
      document.getElementById('serp-title-chars').textContent = `${titleChars} characters`;
      document.getElementById('serp-title-px').textContent = `${titlePx}px / ${maxTitlePx}px`;
      document.getElementById('serp-title-px').style.color = isTruncated ? 'var(--intent-err)' : 'var(--intent-trans)';
      document.getElementById('serp-desc-chars').textContent = `${descChars} characters`;
      document.getElementById('serp-desc-chars').style.color = descChars > maxDescChars ? 'var(--intent-err)' : 'var(--text-muted)';
      
      document.getElementById('serp-metric-width').textContent = `${titlePx}px`;
      document.getElementById('serp-metric-width').style.color = isTruncated ? 'var(--intent-err)' : 'var(--intent-trans)';
      document.getElementById('serp-metric-len').textContent = titleChars;
      document.getElementById('serp-metric-len').style.color = titleChars > 60 ? 'var(--intent-err)' : (titleChars >= 50 ? 'var(--intent-trans)' : 'var(--intent-comm)');
      document.getElementById('serp-metric-desc').textContent = descChars;
      document.getElementById('serp-metric-desc').style.color = descChars > maxDescChars ? 'var(--intent-err)' : (descChars >= 140 ? 'var(--intent-trans)' : 'var(--intent-comm)');
    }
    
    serpTitle.addEventListener('input', updateSerpPreview);
    serpUrl.addEventListener('input', updateSerpPreview);
    serpDesc.addEventListener('input', updateSerpPreview);
    
    // Desktop/Mobile toggle
    const desktopBtn = document.getElementById('serp-desktop-btn');
    const mobileBtn2 = document.getElementById('serp-mobile-btn');
    desktopBtn.addEventListener('click', () => {
      isMobilePreview = false;
      desktopBtn.style.background = '';
      desktopBtn.style.border = '';
      mobileBtn2.style.background = 'var(--bg-input)';
      mobileBtn2.style.border = '1px solid var(--border)';
      document.getElementById('serp-desc-limit').textContent = 'Desktop: 160 chars';
      updateSerpPreview();
    });
    mobileBtn2.addEventListener('click', () => {
      isMobilePreview = true;
      mobileBtn2.style.background = '';
      mobileBtn2.style.border = '';
      desktopBtn.style.background = 'var(--bg-input)';
      desktopBtn.style.border = '1px solid var(--border)';
      document.getElementById('serp-desc-limit').textContent = 'Mobile: 120 chars';
      updateSerpPreview();
    });
  }

  // ==========================================
  // Tool: Bulk HTTP Status Checker
  // ==========================================
  const bulkBtn = document.getElementById('bulk-btn');
  if (bulkBtn) {
    let bulkResults = [];
    
    bulkBtn.addEventListener('click', async () => {
      const raw = document.getElementById('bulk-urls').value;
      const urls = raw.split('\n').map(u => u.trim()).filter(u => u.length > 0 && u.startsWith('http'));
      if (!urls.length) return alert('Enter at least one URL starting with http:// or https://');
      
      const tbody = document.getElementById('bulk-tbody');
      const statusText = document.getElementById('bulk-status-text');
      const countLabel = document.getElementById('bulk-count');
      const summary = document.getElementById('bulk-summary');
      
      bulkBtn.disabled = true;
      tbody.innerHTML = '';
      bulkResults = [];
      let count = 0;
      countLabel.textContent = '0';
      summary.style.display = 'none';
      
      try {
        const response = await fetch('/api/bulk/check', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ urls })
        });
        
        await readSSE(response, (type, data) => {
          if (type === 'progress') {
            statusText.textContent = data;
          } else if (type === 'result') {
            count++;
            countLabel.textContent = count;
            bulkResults.push(data);
            
            const tr = document.createElement('tr');
            let statusColor = 'var(--text)';
            if (data.status >= 200 && data.status < 300) statusColor = 'var(--intent-trans)';
            else if (data.status >= 300 && data.status < 400) statusColor = 'var(--intent-comm)';
            else if (data.status >= 400) statusColor = 'var(--intent-err)';
            if (data.error) statusColor = 'var(--intent-err)';
            
            const chainLen = data.redirectChain ? data.redirectChain.length : 0;
            const chainBadge = chainLen > 0 ? `<span class="badge warning">${chainLen} hop${chainLen > 1 ? 's' : ''}</span>` : '<span style="color:var(--text-muted)">—</span>';
            
            tr.innerHTML = `
              <td style="max-width:200px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;" title="${escapeHtml(data.url)}">
                <a href="${escapeHtml(data.url)}" target="_blank" style="color:var(--accent); text-decoration:none">${escapeHtml(data.url).replace(/^https?:\/\//, '')}</a>
              </td>
              <td style="font-weight:bold; color:${statusColor}">${data.error || data.status}</td>
              <td style="max-width:200px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; color:var(--text-muted)" title="${escapeHtml(data.finalUrl || '')}">${data.finalUrl !== data.url ? escapeHtml(data.finalUrl || '').replace(/^https?:\/\//, '') : '—'}</td>
              <td>${chainBadge}</td>
              <td style="font-family:monospace; color:var(--text-muted)">${data.responseTime ? data.responseTime + 'ms' : '—'}</td>
            `;
            
            if (data.status >= 400 || data.error) tr.style.background = 'rgba(248, 113, 113, 0.08)';
            else if (data.status >= 300) tr.style.background = 'rgba(251, 191, 36, 0.08)';
            
            tbody.appendChild(tr);
          } else if (type === 'complete') {
            statusText.textContent = `Complete! Checked ${data.total} URLs.`;
            summary.style.display = 'grid';
            document.getElementById('bulk-ok').textContent = data.healthy || 0;
            document.getElementById('bulk-redir').textContent = data.redirects || 0;
            document.getElementById('bulk-client').textContent = data.clientErrors || 0;
            document.getElementById('bulk-server').textContent = data.serverErrors || 0;
            document.getElementById('bulk-timeout').textContent = data.timeouts || 0;
            bulkBtn.disabled = false;
          } else if (type === 'error') {
            statusText.textContent = 'Error: ' + data;
            bulkBtn.disabled = false;
          }
        });
      } catch (e) {
        statusText.textContent = 'Connection failed';
        bulkBtn.disabled = false;
      }
    });
    
    // Export CSV
    document.getElementById('bulk-export-btn').addEventListener('click', () => {
      if (!bulkResults.length) return alert('No results to export');
      let csv = 'URL,Status,Final URL,Redirect Hops,Response Time (ms),Error\n';
      bulkResults.forEach(r => {
        csv += `"${r.url}",${r.status || ''},"${r.finalUrl || ''}",${r.redirectChain ? r.redirectChain.length : 0},${r.responseTime || ''},"${r.error || ''}"\n`;
      });
      const blob = new Blob([csv], { type: 'text/csv' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'bulk_status_check.csv';
      a.click();
      URL.revokeObjectURL(a.href);
    });
  }

  // ==========================================
  // Tool: Heading Structure Analyzer
  // ==========================================
  const headingBtn = document.getElementById('heading-btn');
  if (headingBtn) {
    headingBtn.addEventListener('click', async () => {
      const url = document.getElementById('heading-url').value;
      if (!url) return alert('Enter a URL');
      if (!url.startsWith('http')) return alert('URL must start with http:// or https://');
      
      const statusEl = document.getElementById('heading-status');
      const treeEl = document.getElementById('heading-tree');
      const issuesEl = document.getElementById('heading-issues');
      
      headingBtn.disabled = true;
      statusEl.textContent = 'Analyzing...';
      treeEl.innerHTML = '';
      issuesEl.innerHTML = '';
      
      try {
        const response = await fetch('/api/headings/analyze', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url })
        });
        
        if (!response.ok) {
          const err = await response.json();
          throw new Error(err.error || 'Failed to analyze');
        }
        
        const data = await response.json();
        statusEl.textContent = `Found ${data.total} headings`;
        
        // Render heading tree
        const colors = {
          1: '#8ab4f8', // H1 - blue
          2: '#81c995', // H2 - green
          3: '#fdd663', // H3 - yellow
          4: '#f28b82', // H4 - red
          5: '#c58af9', // H5 - purple
          6: '#78d9ec'  // H6 - cyan
        };
        
        let treeHtml = '';
        data.headings.forEach(h => {
          const indent = (h.level - 1) * 24;
          const connector = h.level === 1 ? '◆' : '├─';
          treeHtml += `<div style="padding-left:${indent}px; display:flex; align-items:flex-start; gap:8px;">`;
          treeHtml += `<span style="color:${colors[h.level]}; font-weight:bold; flex-shrink:0; min-width:30px;">${connector} H${h.level}</span>`;
          treeHtml += `<span style="color:var(--text); opacity:${1 - (h.level - 1) * 0.1}">${escapeHtml(h.text) || '<em style="color:var(--intent-err)">Empty</em>'}</span>`;
          treeHtml += `</div>`;
        });
        
        treeEl.innerHTML = treeHtml || '<div style="color:var(--text-muted); text-align:center; padding:2rem">No headings found on this page</div>';
        
        // Render issues
        data.issues.forEach(issue => {
          const colors = { error: 'var(--intent-err)', warning: 'var(--intent-comm)', success: 'var(--intent-trans)' };
          const icons = { error: '✕', warning: '⚠', success: '✓' };
          issuesEl.innerHTML += `
            <div style="padding:0.6rem 1rem; border-radius:8px; border:1px solid ${colors[issue.type]}30; background:${colors[issue.type]}10; display:flex; align-items:center; gap:8px;">
              <span style="color:${colors[issue.type]}; font-weight:bold;">${icons[issue.type]}</span>
              <span style="font-size:0.85rem;">${escapeHtml(issue.message)}</span>
            </div>
          `;
        });
        
      } catch (e) {
        statusEl.textContent = 'Error: ' + e.message;
        statusEl.style.color = 'var(--intent-err)';
      } finally {
        headingBtn.disabled = false;
      }
    });
  }

  // ==========================================
  // Tool 17: Keyword Discovery
  // ==========================================
  const kwDiscoveryBtn = document.getElementById('kw-discovery-btn');
  if (kwDiscoveryBtn) {
    let discoveryResults = [];
    kwDiscoveryBtn.addEventListener('click', async () => {
      const seed = document.getElementById('kw-discovery-seed').value.trim();
      if (!seed) return alert('Enter a seed keyword');

      const tbody = document.getElementById('kw-discovery-tbody');
      const statusEl = document.getElementById('kw-discovery-status');
      const countEl = document.getElementById('kw-discovery-count');

      kwDiscoveryBtn.disabled = true;
      tbody.innerHTML = '';
      discoveryResults = [];
      countEl.textContent = '0';
      statusEl.textContent = 'Scanning Google Autocomplete...';

      try {
        const response = await fetch('/api/keywords/discover', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ seed })
        });

        await readSSE(response, (type, data) => {
          if (type === 'progress') {
            statusEl.textContent = data;
          } else if (type === 'complete') {
            discoveryResults = data || [];
            countEl.textContent = discoveryResults.length;
            statusEl.textContent = `Done! Found ${discoveryResults.length} keyword suggestions.`;

            if (discoveryResults.length === 0) {
              tbody.innerHTML = '<tr><td colspan="3" style="text-align:center; padding:2rem">No keywords found</td></tr>';
            } else {
              let html = '';
              discoveryResults.forEach(item => {
                html += `
                  <tr>
                    <td style="font-weight:bold; color:var(--text)">${escapeHtml(item.keyword)}</td>
                    <td><span class="badge warning">${escapeHtml(item.source)}</span></td>
                    <td style="color:var(--text-muted); font-family:monospace">${escapeHtml(item.modifier)}</td>
                  </tr>
                `;
              });
              tbody.innerHTML = html;
            }
          } else if (type === 'error') {
            statusEl.textContent = 'Error: ' + data;
          }
        });
      } catch (e) {
        statusEl.textContent = 'Connection failed: ' + e.message;
      } finally {
        kwDiscoveryBtn.disabled = false;
      }
    });

    // CSV Export
    document.getElementById('kw-discovery-export').addEventListener('click', () => {
      if (!discoveryResults.length) return alert('No keywords to export');
      let csv = 'Keyword,Source,Modifier\n';
      discoveryResults.forEach(r => {
        csv += `"${r.keyword}","${r.source}","${r.modifier}"\n`;
      });
      const blob = new Blob([csv], { type: 'text/csv' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'discovered_keywords.csv';
      a.click();
    });
  }

  // ==========================================
  // Tool 18: Keyword Clustering
  // ==========================================
  const kwClusterBtn = document.getElementById('kw-cluster-btn');
  if (kwClusterBtn) {
    kwClusterBtn.addEventListener('click', async () => {
      const rawText = document.getElementById('kw-cluster-text').value;
      const keywords = rawText.split('\n').map(k => k.trim()).filter(Boolean);
      if (keywords.length < 2) return alert('Enter at least 2 keywords to cluster');

      const container = document.getElementById('kw-cluster-container');
      const statusEl = document.getElementById('kw-cluster-status');
      const countEl = document.getElementById('kw-cluster-count');

      kwClusterBtn.disabled = true;
      statusEl.textContent = 'Clustering...';
      container.innerHTML = '';

      try {
        const response = await fetch('/api/keywords/cluster', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ keywords })
        });

        if (!response.ok) throw new Error('Clustering failed');
        const data = await response.json();

        countEl.textContent = data.clusters.length;
        statusEl.textContent = `Found ${data.clusters.length} clusters & ${data.unclustered.length} unclustered keywords.`;

        let html = '';
        data.clusters.forEach((c, idx) => {
          html += `
            <div style="background:var(--bg-input); border:1px solid var(--border); border-radius:8px; padding:1rem;">
              <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.5rem">
                <h4 style="color:var(--accent); margin:0">${escapeHtml(c.label)}</h4>
                <span class="badge success">${c.size} keywords</span>
              </div>
              <div style="display:flex; flex-wrap:wrap; gap:0.4rem; margin-top:0.5rem">
                ${c.keywords.map(k => `<span style="background:var(--bg); border:1px solid var(--border); padding:0.2rem 0.6rem; border-radius:4px; font-size:0.85rem">${escapeHtml(k)}</span>`).join('')}
              </div>
            </div>
          `;
        });

        if (data.unclustered.length > 0) {
          html += `
            <div style="background:var(--bg-input); border:1px solid var(--border); border-radius:8px; padding:1rem; opacity:0.8">
              <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.5rem">
                <h4 style="color:var(--text-muted); margin:0">Unclustered Keywords</h4>
                <span class="badge warning">${data.unclustered.length} items</span>
              </div>
              <div style="display:flex; flex-wrap:wrap; gap:0.4rem; margin-top:0.5rem">
                ${data.unclustered.map(k => `<span style="background:var(--bg); border:1px solid var(--border); padding:0.2rem 0.6rem; border-radius:4px; font-size:0.85rem">${escapeHtml(k)}</span>`).join('')}
              </div>
            </div>
          `;
        }

        container.innerHTML = html;
      } catch (e) {
        statusEl.textContent = 'Error: ' + e.message;
      } finally {
        kwClusterBtn.disabled = false;
      }
    });
  }

  // ==========================================
  // Tool 19: Rank Tracker
  // ==========================================
  const rankCheckBtn = document.getElementById('rank-check-btn');
  if (rankCheckBtn) {
    rankCheckBtn.addEventListener('click', async () => {
      const rawText = document.getElementById('rank-pairs-input').value;
      const lines = rawText.split('\n').map(l => l.trim()).filter(Boolean);
      const pairs = lines.map(line => {
        const parts = line.split('|');
        return { keyword: parts[0]?.trim(), targetUrl: parts[1]?.trim() };
      }).filter(p => p.keyword && p.targetUrl);

      if (!pairs.length) return alert('Enter at least one keyword | url pair');

      const tbody = document.getElementById('rank-tbody');
      const statusEl = document.getElementById('rank-status');
      const countEl = document.getElementById('rank-count');

      rankCheckBtn.disabled = true;
      tbody.innerHTML = '';
      statusEl.textContent = 'Checking rankings...';
      let count = 0;

      try {
        const response = await fetch('/api/rank/check', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ pairs })
        });

        await readSSE(response, (type, data) => {
          if (type === 'progress') {
            statusEl.textContent = data;
          } else if (type === 'result') {
            count++;
            countEl.textContent = count;
            const tr = document.createElement('tr');
            let posBadgeClass = 'error';
            if (data.position <= 3) posBadgeClass = 'success';
            else if (data.position <= 10) posBadgeClass = 'warning';

            tr.innerHTML = `
              <td style="font-weight:bold; color:var(--text)">${escapeHtml(data.keyword)}</td>
              <td style="max-width:200px; overflow:hidden; text-overflow:ellipsis" title="${escapeHtml(data.targetUrl)}">${escapeHtml(data.targetUrl)}</td>
              <td><span class="badge ${posBadgeClass}">#${data.position}</span></td>
              <td>${data.serpFeatures.map(f => `<span class="badge info">${escapeHtml(f)}</span>`).join(' ') || '—'}</td>
            `;
            tbody.appendChild(tr);
          } else if (type === 'complete') {
            statusEl.textContent = `Completed ${count} rank checks. Saved to history.`;
          }
        });
      } catch (e) {
        statusEl.textContent = 'Connection failed: ' + e.message;
      } finally {
        rankCheckBtn.disabled = false;
      }
    });
  }

  // ==========================================
  // Tool 20: Sitemap Tool
  // ==========================================
  const sitemapTabGen = document.getElementById('sitemap-tab-gen');
  const sitemapTabVal = document.getElementById('sitemap-tab-val');
  const sitemapPanelGen = document.getElementById('sitemap-panel-gen');
  const sitemapPanelVal = document.getElementById('sitemap-panel-val');

  if (sitemapTabGen && sitemapTabVal) {
    sitemapTabGen.addEventListener('click', () => {
      sitemapPanelGen.style.display = 'block';
      sitemapPanelVal.style.display = 'none';
      sitemapTabGen.style.background = 'var(--accent)';
      sitemapTabVal.style.background = 'var(--bg-input)';
    });
    sitemapTabVal.addEventListener('click', () => {
      sitemapPanelGen.style.display = 'none';
      sitemapPanelVal.style.display = 'block';
      sitemapTabVal.style.background = 'var(--accent)';
      sitemapTabGen.style.background = 'var(--bg-input)';
    });

    // Generate XML
    document.getElementById('sitemap-gen-btn').addEventListener('click', async () => {
      const rawText = document.getElementById('sitemap-gen-urls').value;
      const urls = rawText.split('\n').map(u => u.trim()).filter(Boolean);
      if (!urls.length) return alert('Enter at least one URL');

      const xmlArea = document.getElementById('sitemap-xml-output');
      const placeholder = document.getElementById('sitemap-placeholder');
      const valTable = document.getElementById('sitemap-val-table');

      try {
        const response = await fetch('/api/sitemap/generate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ urls })
        });

        const xmlText = await response.text();
        placeholder.style.display = 'none';
        valTable.style.display = 'none';
        xmlArea.style.display = 'block';
        xmlArea.value = xmlText;
      } catch (e) {
        alert('Generation failed: ' + e.message);
      }
    });

    // Validate XML
    const sitemapValBtn = document.getElementById('sitemap-val-btn');
    sitemapValBtn.addEventListener('click', async () => {
      const sitemapUrl = document.getElementById('sitemap-val-url').value.trim();
      if (!sitemapUrl) return alert('Enter a sitemap XML URL');

      const tbody = document.getElementById('sitemap-val-tbody');
      const statusEl = document.getElementById('sitemap-status');
      const xmlArea = document.getElementById('sitemap-xml-output');
      const placeholder = document.getElementById('sitemap-placeholder');
      const valTable = document.getElementById('sitemap-val-table');

      sitemapValBtn.disabled = true;
      tbody.innerHTML = '';
      xmlArea.style.display = 'none';
      placeholder.style.display = 'none';
      valTable.style.display = 'table';
      statusEl.textContent = 'Validating sitemap...';

      try {
        const response = await fetch('/api/sitemap/validate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sitemapUrl })
        });

        await readSSE(response, (type, data) => {
          if (type === 'progress') {
            statusEl.textContent = data;
          } else if (type === 'result') {
            const tr = document.createElement('tr');
            let color = data.status >= 200 && data.status < 300 ? 'var(--intent-trans)' : 'var(--intent-err)';
            tr.innerHTML = `
              <td style="max-width:250px; overflow:hidden; text-overflow:ellipsis">${escapeHtml(data.url)}</td>
              <td style="font-weight:bold; color:${color}">${data.status || data.error}</td>
              <td style="font-family:monospace">${data.responseTime ? data.responseTime + 'ms' : '—'}</td>
            `;
            tbody.appendChild(tr);
          } else if (type === 'complete') {
            statusEl.textContent = `Complete! Checked ${data.total} URLs. Healthy: ${data.healthy}, Broken: ${data.broken}.`;
          }
        });
      } catch (e) {
        statusEl.textContent = 'Validation error: ' + e.message;
      } finally {
        sitemapValBtn.disabled = false;
      }
    });
  }

  // ==========================================
  // Tool 21: Robots.txt Analyzer & Tester
  // ==========================================
  const robotsBtn = document.getElementById('robots-btn');
  if (robotsBtn) {
    let parsedRules = [];
    robotsBtn.addEventListener('click', async () => {
      const url = document.getElementById('robots-url').value.trim();
      if (!url) return alert('Enter a website URL or domain');

      const tbody = document.getElementById('robots-tbody');
      const statusEl = document.getElementById('robots-status');
      const issuesEl = document.getElementById('robots-issues');

      robotsBtn.disabled = true;
      tbody.innerHTML = '';
      issuesEl.innerHTML = '';
      statusEl.textContent = 'Fetching & analyzing robots.txt...';

      try {
        const response = await fetch('/api/robots/analyze', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url })
        });

        if (!response.ok) throw new Error('Failed to analyze');
        const data = await response.json();

        parsedRules = data.rules || [];
        statusEl.textContent = `Found ${parsedRules.length} directives.`;

        // Render rules
        let html = '';
        parsedRules.forEach(r => {
          let badgeClass = r.type === 'Disallow' ? 'error' : 'success';
          html += `
            <tr>
              <td style="font-family:monospace; color:var(--accent)">${escapeHtml(r.agent)}</td>
              <td><span class="badge ${badgeClass}">${escapeHtml(r.type)}</span></td>
              <td style="font-family:monospace">${escapeHtml(r.path || '/')}</td>
            </tr>
          `;
        });
        tbody.innerHTML = html || '<tr><td colspan="3" style="text-align:center; padding:2rem">No directives found</td></tr>';

        // Render issues
        (data.issues || []).forEach(issue => {
          const colors = { error: 'var(--intent-err)', warning: 'var(--intent-comm)', success: 'var(--intent-trans)', info: 'var(--intent-info)' };
          issuesEl.innerHTML += `
            <div style="padding:0.6rem 1rem; border-radius:8px; border:1px solid ${colors[issue.type]}30; background:${colors[issue.type]}10; font-size:0.85rem">
              ${escapeHtml(issue.message)}
            </div>
          `;
        });
      } catch (e) {
        statusEl.textContent = 'Error: ' + e.message;
      } finally {
        robotsBtn.disabled = false;
      }
    });

    // Test Path Access
    document.getElementById('robots-test-btn').addEventListener('click', async () => {
      const testPath = document.getElementById('robots-test-path').value.trim();
      const resultEl = document.getElementById('robots-test-result');
      if (!testPath) return alert('Enter a path to test');

      try {
        const response = await fetch('/api/robots/test', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ rules: parsedRules, testPath, userAgent: 'Googlebot' })
        });

        const data = await response.json();
        if (data.allowed) {
          resultEl.textContent = 'ALLOWED ✓';
          resultEl.style.color = 'var(--intent-trans)';
        } else {
          resultEl.textContent = 'BLOCKED ✕';
          resultEl.style.color = 'var(--intent-err)';
        }
      } catch (e) {
        alert('Testing error: ' + e.message);
      }
    });
  }

  // ==========================================
  // Tool 22: Duplicate Content Detector
  // ==========================================
  const dupCheckBtn = document.getElementById('dup-check-btn');
  if (dupCheckBtn) {
    dupCheckBtn.addEventListener('click', async () => {
      const rawText = document.getElementById('dup-urls-input').value;
      const urls = rawText.split('\n').map(u => u.trim()).filter(Boolean);
      if (urls.length < 2) return alert('Enter at least 2 URLs to compare');

      const tbody = document.getElementById('dup-tbody');
      const statusEl = document.getElementById('dup-status');
      const countEl = document.getElementById('dup-count');

      dupCheckBtn.disabled = true;
      tbody.innerHTML = '';
      countEl.textContent = '0';
      statusEl.textContent = 'Fetching pages & comparing content...';

      try {
        const response = await fetch('/api/duplicate/check', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ urls })
        });

        await readSSE(response, (type, data) => {
          if (type === 'progress') {
            statusEl.textContent = data;
          } else if (type === 'complete') {
            const pairs = data.duplicatePairs || [];
            countEl.textContent = pairs.length;
            statusEl.textContent = `Scan complete. Found ${pairs.length} duplicate pairs & ${data.thinPages.length} thin pages.`;

            let html = '';
            pairs.forEach(p => {
              html += `
                <tr>
                  <td style="max-width:180px; overflow:hidden; text-overflow:ellipsis" title="${escapeHtml(p.urlA)}">${escapeHtml(p.urlA)}</td>
                  <td style="max-width:180px; overflow:hidden; text-overflow:ellipsis" title="${escapeHtml(p.urlB)}">${escapeHtml(p.urlB)}</td>
                  <td style="font-weight:bold; color:var(--intent-err)">${p.similarity}%</td>
                  <td><span class="badge error">${escapeHtml(p.status)}</span></td>
                </tr>
              `;
            });
            tbody.innerHTML = html || '<tr><td colspan="4" style="text-align:center; padding:2rem; color:var(--intent-trans)">No duplicate content detected!</td></tr>';
          }
        });
      } catch (e) {
        statusEl.textContent = 'Error: ' + e.message;
      } finally {
        dupCheckBtn.disabled = false;
      }
    });
  }

  // ==========================================
  // Tool 23: Structured Data Validator
  // ==========================================
  const schemaValBtn = document.getElementById('schema-val-btn');
  if (schemaValBtn) {
    schemaValBtn.addEventListener('click', async () => {
      const url = document.getElementById('schema-val-url').value.trim();
      if (!url) return alert('Enter a webpage URL');

      const container = document.getElementById('schema-val-container');
      const statusEl = document.getElementById('schema-val-status');

      schemaValBtn.disabled = true;
      container.innerHTML = '';
      statusEl.textContent = 'Extracting & validating JSON-LD schemas...';

      try {
        const response = await fetch('/api/schema/validate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url })
        });

        if (!response.ok) throw new Error('Validation request failed');
        const data = await response.json();

        statusEl.textContent = `Found ${data.totalSchemas} schema block(s).`;

        if (data.schemas.length === 0) {
          container.innerHTML = '<div style="text-align:center; color:var(--intent-comm); padding:2rem">No JSON-LD schemas detected on this page</div>';
        } else {
          let html = '';
          data.schemas.forEach(s => {
            html += `
              <div style="background:var(--bg-input); border:1px solid var(--border); border-radius:8px; padding:1rem;">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.5rem">
                  <h4 style="color:var(--accent); margin:0">${escapeHtml(s.type)} Schema</h4>
                  <span class="badge info">${s.propertiesCount} properties</span>
                </div>
                <div style="display:flex; flex-direction:column; gap:0.4rem; margin-top:0.5rem">
                  ${s.issues.map(i => {
                    const colors = { error: 'var(--intent-err)', warning: 'var(--intent-comm)', success: 'var(--intent-trans)', info: 'var(--intent-info)' };
                    return `<div style="padding:0.4rem 0.8rem; border-radius:6px; background:${colors[i.type]}15; color:${colors[i.type]}; font-size:0.85rem">${escapeHtml(i.message)}</div>`;
                  }).join('')}
                </div>
              </div>
            `;
          });
          container.innerHTML = html;
        }
      } catch (e) {
        statusEl.textContent = 'Error: ' + e.message;
      } finally {
        schemaValBtn.disabled = false;
      }
    });
  }

});

