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
});
