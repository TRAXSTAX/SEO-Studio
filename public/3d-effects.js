document.addEventListener('DOMContentLoaded', () => {
    // 1. 3D perspective tilt effect
    const tiltElements = document.querySelectorAll('.metric-card, .input-panel, .results-panel, .nav-item');
    
    tiltElements.forEach(el => {
        el.addEventListener('mousemove', handleTilt);
        el.addEventListener('mouseleave', resetTilt);
        
        // Ensure elements have positioning for the glow effect
        if (getComputedStyle(el).position === 'static') {
            el.style.position = 'relative';
        }
        el.style.overflow = 'hidden';
        
        // Add spotlight element
        const spotlight = document.createElement('div');
        spotlight.className = 'spotlight-glow';
        spotlight.style.position = 'absolute';
        spotlight.style.top = '0';
        spotlight.style.left = '0';
        spotlight.style.width = '100%';
        spotlight.style.height = '100%';
        spotlight.style.pointerEvents = 'none';
        spotlight.style.background = 'radial-gradient(circle at 50% 50%, rgba(255,255,255,0.1) 0%, transparent 60%)';
        spotlight.style.opacity = '0';
        spotlight.style.transition = 'opacity 0.3s ease';
        spotlight.style.zIndex = '0';
        el.appendChild(spotlight);
    });

    function handleTilt(e) {
        const rect = this.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        
        // Calculate rotation
        const centerX = rect.width / 2;
        const centerY = rect.height / 2;
        
        const rotateX = ((y - centerY) / centerY) * -10; // Max rotation 10deg
        const rotateY = ((x - centerX) / centerX) * 10;
        
        this.style.transform = `perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) scale3d(1.02, 1.02, 1.02)`;
        this.style.transition = 'transform 0.1s ease-out';
        this.style.zIndex = '10';
        
        // Update spotlight
        const spotlight = this.querySelector('.spotlight-glow');
        if (spotlight) {
            spotlight.style.background = `radial-gradient(circle at ${x}px ${y}px, rgba(255,255,255,0.15) 0%, transparent 50%)`;
            spotlight.style.opacity = '1';
        }
    }

    function resetTilt(e) {
        this.style.transform = `perspective(1000px) rotateX(0deg) rotateY(0deg) scale3d(1, 1, 1)`;
        this.style.transition = 'transform 0.5s ease-out';
        this.style.zIndex = '1';
        
        const spotlight = this.querySelector('.spotlight-glow');
        if (spotlight) {
            spotlight.style.opacity = '0';
        }
    }

    // 2. Animated number counters
    window.animateNumber = function(element, targetValue, duration = 1500) {
        if (!element) return;
        
        const startValue = parseFloat(element.innerText.replace(/[^0-9.-]+/g,"")) || 0;
        let targetNum = parseFloat(targetValue.toString().replace(/[^0-9.-]+/g,""));
        if (isNaN(targetNum)) {
            element.innerText = targetValue;
            return;
        }

        const isInt = targetNum % 1 === 0;
        
        let startTimestamp = null;
        const step = (timestamp) => {
            if (!startTimestamp) startTimestamp = timestamp;
            const progress = Math.min((timestamp - startTimestamp) / duration, 1);
            
            // easeOutExpo
            const easeProgress = progress === 1 ? 1 : 1 - Math.pow(2, -10 * progress);
            
            let current = startValue + (targetNum - startValue) * easeProgress;
            
            if (isInt) {
                current = Math.floor(current);
            } else {
                current = current.toFixed(2);
            }
            
            // Format
            let formatted = targetValue.toString().replace(/[0-9.-]+/, current);
            element.innerText = formatted;
            
            if (progress < 1) {
                window.requestAnimationFrame(step);
            } else {
                element.innerText = targetValue; 
            }
        };
        
        window.requestAnimationFrame(step);
    };

    // 3. Canvas particle explosion
    window.triggerScoreExplosion = function() {
        const canvas = document.createElement('canvas');
        canvas.style.position = 'fixed';
        canvas.style.top = '0';
        canvas.style.left = '0';
        canvas.style.width = '100vw';
        canvas.style.height = '100vh';
        canvas.style.pointerEvents = 'none';
        canvas.style.zIndex = '9999';
        document.body.appendChild(canvas);
        
        const ctx = canvas.getContext('2d');
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
        
        const particles = [];
        const colors = ['#ff2a2a', '#00ff00', '#00aaff', '#ffaa00', '#ff00aa'];
        
        for (let i = 0; i < 150; i++) {
            particles.push({
                x: window.innerWidth / 2,
                y: window.innerHeight / 2,
                vx: (Math.random() - 0.5) * 20,
                vy: (Math.random() - 0.5) * 20,
                size: Math.random() * 5 + 2,
                color: colors[Math.floor(Math.random() * colors.length)],
                alpha: 1
            });
        }
        
        function animate() {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            let active = false;
            
            for (let i = 0; i < particles.length; i++) {
                let p = particles[i];
                if (p.alpha <= 0) continue;
                
                active = true;
                p.x += p.vx;
                p.y += p.vy;
                p.vy += 0.2; 
                p.alpha -= 0.01;
                
                ctx.globalAlpha = Math.max(0, p.alpha);
                ctx.fillStyle = p.color;
                ctx.beginPath();
                ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
                ctx.fill();
            }
            
            if (active) {
                requestAnimationFrame(animate);
            } else {
                document.body.removeChild(canvas);
            }
        }
        
        
        animate();
    };

    // 4. Command Palette
    createCommandPalette();

    function createCommandPalette() {
        const overlay = document.createElement('div');
        overlay.id = 'cmd-palette-overlay';
        overlay.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.5);backdrop-filter:blur(5px);z-index:9998;display:none;align-items:flex-start;justify-content:center;padding-top:10vh;';
        
        const palette = document.createElement('div');
        palette.id = 'cmd-palette';
        palette.style.cssText = 'width:600px;max-width:90%;background:var(--bg-panel,#1e1e2f);border:1px solid var(--border,#333);border-radius:12px;box-shadow:0 10px 30px rgba(0,0,0,0.5);overflow:hidden;z-index:9999;transform:scale(0.95);opacity:0;transition:all 0.2s ease;';
        
        const input = document.createElement('input');
        input.type = 'text';
        input.placeholder = 'Search tools... (e.g. Master Audit)';
        input.style.cssText = 'width:100%;padding:1.5rem;font-size:1.2rem;border:none;border-bottom:1px solid var(--border,#333);background:transparent;color:var(--text,#fff);outline:none;box-sizing:border-box;';
        
        const list = document.createElement('ul');
        list.style.cssText = 'list-style:none;margin:0;padding:0;max-height:400px;overflow-y:auto;';
        
        palette.appendChild(input);
        palette.appendChild(list);
        overlay.appendChild(palette);
        document.body.appendChild(overlay);

        const tools = Array.from(document.querySelectorAll('.nav-item')).map(item => ({
            name: item.innerText.trim(),
            target: item.getAttribute('data-target'),
            element: item
        }));

        let activeIndex = 0;

        function renderList(filter = '') {
            list.innerHTML = '';
            const filtered = tools.filter(t => t.name.toLowerCase().includes(filter.toLowerCase()));
            filtered.forEach((t, index) => {
                const li = document.createElement('li');
                li.innerText = t.name;
                li.style.cssText = `padding:1rem 1.5rem;cursor:pointer;color:var(--text,#fff);border-bottom:1px solid rgba(255,255,255,0.05);transition:background 0.2s;`;
                if (index === activeIndex) {
                    li.style.background = 'var(--accent, #007bff)';
                }
                li.addEventListener('mouseenter', () => {
                    activeIndex = index;
                    renderList(filter);
                });
                li.addEventListener('click', () => {
                    selectTool(t);
                });
                list.appendChild(li);
            });
            if (filtered.length === 0) {
                const li = document.createElement('li');
                li.innerText = 'No tools found.';
                li.style.cssText = 'padding:1rem 1.5rem;color:var(--text-muted,#888);';
                list.appendChild(li);
            }
        }

        function selectTool(t) {
            closePalette();
            t.element.click();
        }

        function openPalette() {
            overlay.style.display = 'flex';
            setTimeout(() => {
                palette.style.transform = 'scale(1)';
                palette.style.opacity = '1';
                input.focus();
                input.value = '';
                activeIndex = 0;
                renderList();
            }, 10);
        }

        function closePalette() {
            palette.style.transform = 'scale(0.95)';
            palette.style.opacity = '0';
            setTimeout(() => {
                overlay.style.display = 'none';
            }, 200);
        }

        input.addEventListener('input', (e) => {
            activeIndex = 0;
            renderList(e.target.value);
        });

        input.addEventListener('keydown', (e) => {
            const filter = input.value;
            const filtered = tools.filter(t => t.name.toLowerCase().includes(filter.toLowerCase()));
            
            if (e.key === 'ArrowDown') {
                e.preventDefault();
                activeIndex = (activeIndex + 1) % filtered.length;
                renderList(filter);
            } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                activeIndex = (activeIndex - 1 + filtered.length) % filtered.length;
                renderList(filter);
            } else if (e.key === 'Enter') {
                e.preventDefault();
                if (filtered[activeIndex]) {
                    selectTool(filtered[activeIndex]);
                }
            } else if (e.key === 'Escape') {
                closePalette();
            }
        });

        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) {
                closePalette();
            }
        });

        document.addEventListener('keydown', (e) => {
            if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
                e.preventDefault();
                if (overlay.style.display === 'flex') {
                    closePalette();
                } else {
                    openPalette();
                }
            }
        });
    }

    // 5. SEO Particle Pulse Effects
    window.triggerPulseEffect = function(element) {
        if (!element) return;
        const pulse = document.createElement('div');
        pulse.style.cssText = 'position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);width:100%;height:100%;border-radius:50%;background:rgba(0,170,255,0.4);z-index:-1;animation:seoPulse 1s ease-out forwards;pointer-events:none;';
        
        if (getComputedStyle(element).position === 'static') {
            element.style.position = 'relative';
        }
        
        element.appendChild(pulse);
        
        if (!document.getElementById('seo-pulse-style')) {
            const style = document.createElement('style');
            style.id = 'seo-pulse-style';
            style.innerHTML = `
                @keyframes seoPulse {
                    0% { transform: translate(-50%, -50%) scale(1); opacity: 1; }
                    100% { transform: translate(-50%, -50%) scale(2); opacity: 0; }
                }
                .score-ring-animate {
                    transition: stroke-dashoffset 1.5s ease-out, stroke 1.5s ease-out;
                }
            `;
            document.head.appendChild(style);
        }
        
        setTimeout(() => pulse.remove(), 1000);
    };

    // 6. Score ring animations
    window.animateScoreRing = function(circleElement, score, circumference) {
        if (!circleElement) return;
        
        circleElement.style.strokeDasharray = `${circumference} ${circumference}`;
        circleElement.style.strokeDashoffset = circumference;
        circleElement.classList.add('score-ring-animate');
        
        // Force reflow
        void circleElement.getBoundingClientRect();
        
        setTimeout(() => {
            const offset = circumference - (score / 100) * circumference;
            circleElement.style.strokeDashoffset = offset;
            
            // color based on score
            if (score >= 90) circleElement.style.stroke = '#00ff00';
            else if (score >= 50) circleElement.style.stroke = '#ffaa00';
            else circleElement.style.stroke = '#ff2a2a';
        }, 50);
    };

    // 7. SERP Pixel Width Calculator Hook
    const _sharedCanvas = document.createElement('canvas');
    const _sharedCtx = _sharedCanvas.getContext('2d');

    window.calculatePixelWidth = function(text, fontSize = '20px', fontFamily = 'Arial, sans-serif') {
        if (!text) return 0;
        const fontCss = typeof fontSize === 'number' ? `${fontSize}px` : (fontSize || '20px');
        _sharedCtx.font = `${fontCss} ${fontFamily}`;
        return Math.round(_sharedCtx.measureText(text).width);
    };

    // 8. Core Web Vitals HUD Speed Dial Animations
    window.renderCWVSpeedDials = function(containerElement, metrics = {}) {
        if (!containerElement) return;
        
        const score = metrics.score || 0;
        const lcpVal = metrics.lcp || 'N/A';
        const clsVal = metrics.cls || 'N/A';
        const tbtVal = metrics.tbt || 'N/A';

        const parseNum = (str) => {
            const num = parseFloat(str);
            return isNaN(num) ? 0 : num;
        };

        const lcpNum = parseNum(lcpVal);
        const lcpStatus = lcpNum === 0 ? 'warn' : (lcpNum <= 2.5 ? 'pass' : (lcpNum <= 4.0 ? 'warn' : 'fail'));
        const lcpScore = lcpNum === 0 ? 50 : Math.max(10, Math.min(100, Math.round(100 - (lcpNum / 6.0) * 100)));

        const clsNum = parseNum(clsVal);
        const clsStatus = clsNum === 0 ? 'pass' : (clsNum <= 0.1 ? 'pass' : (clsNum <= 0.25 ? 'warn' : 'fail'));
        const clsScore = Math.max(10, Math.min(100, Math.round(100 - (clsNum / 0.5) * 100)));

        const tbtNum = parseNum(tbtVal);
        const tbtStatus = tbtNum === 0 ? 'pass' : (tbtNum <= 200 ? 'pass' : (tbtNum <= 600 ? 'warn' : 'fail'));
        const tbtScore = tbtNum === 0 ? 95 : Math.max(10, Math.min(100, Math.round(100 - (tbtNum / 1000) * 100)));

        const perfStatus = score >= 90 ? 'pass' : (score >= 50 ? 'warn' : 'fail');

        containerElement.innerHTML = `
            <div class="cwv-gauge-hud">
                <div class="cwv-dial-card">
                    <div class="cwv-dial-ring ${perfStatus}" style="--score: ${score}">
                        <div class="cwv-dial-content">
                            <div class="cwv-dial-val">${score}</div>
                            <div class="cwv-dial-unit">Score</div>
                        </div>
                    </div>
                    <div class="cwv-dial-label">Performance</div>
                    <div class="cwv-dial-sub">Lighthouse Score</div>
                </div>

                <div class="cwv-dial-card">
                    <div class="cwv-dial-ring ${lcpStatus}" style="--score: ${lcpScore}">
                        <div class="cwv-dial-content">
                            <div class="cwv-dial-val">${lcpVal}</div>
                            <div class="cwv-dial-unit">Seconds</div>
                        </div>
                    </div>
                    <div class="cwv-dial-label">LCP</div>
                    <div class="cwv-dial-sub">Largest Contentful Paint</div>
                </div>

                <div class="cwv-dial-card">
                    <div class="cwv-dial-ring ${clsStatus}" style="--score: ${clsScore}">
                        <div class="cwv-dial-content">
                            <div class="cwv-dial-val">${clsVal}</div>
                            <div class="cwv-dial-unit">Shift</div>
                        </div>
                    </div>
                    <div class="cwv-dial-label">CLS</div>
                    <div class="cwv-dial-sub">Cumulative Layout Shift</div>
                </div>

                <div class="cwv-dial-card">
                    <div class="cwv-dial-ring ${tbtStatus}" style="--score: ${tbtScore}">
                        <div class="cwv-dial-content">
                            <div class="cwv-dial-val">${tbtVal}</div>
                            <div class="cwv-dial-unit">ms</div>
                        </div>
                    </div>
                    <div class="cwv-dial-label">TBT / Interactivity</div>
                    <div class="cwv-dial-sub">Total Blocking Time</div>
                </div>
            </div>
        `;
    };
});
