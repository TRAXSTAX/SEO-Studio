(function() {
    function isWebGLAvailable() {
        try {
            var canvas = document.createElement('canvas');
            return !!(window.WebGLRenderingContext && (canvas.getContext('webgl') || canvas.getContext('experimental-webgl')));
        } catch (e) {
            return false;
        }
    }

    if (!isWebGLAvailable()) {
        console.warn('WebGL not supported, gracefully degrading background.');
        return;
    }

    let canvas = document.getElementById('bg-canvas');
    if (!canvas) {
        canvas = document.createElement('canvas');
        canvas.id = 'bg-canvas';
        canvas.style.position = 'fixed';
        canvas.style.top = '0';
        canvas.style.left = '0';
        canvas.style.width = '100vw';
        canvas.style.height = '100vh';
        canvas.style.zIndex = '0';
        canvas.style.pointerEvents = 'none';
        document.body.prepend(canvas);
    }

    if (typeof THREE === 'undefined') {
        console.warn('THREE.js is not loaded.');
        return;
    }

    let scene, camera, renderer;
    let mouseX = 0, mouseY = 0;
    let targetX = 0, targetY = 0;
    let windowHalfX = window.innerWidth / 2;
    let windowHalfY = window.innerHeight / 2;

    let particles, dodecahedron, podiums = [], rings = [], graphLines;
    let floatingNumbers = [];
    let activeSignalWaves = [];
    let isAnimating = false;
    let animFrameId = null;

    init();
    startAnimation();

    function init() {
        scene = new THREE.Scene();
        scene.fog = new THREE.FogExp2(0x030307, 0.0018);

        camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 1, 2000);
        camera.position.z = 500;

        renderer = new THREE.WebGLRenderer({ canvas: canvas, alpha: true, antialias: true });
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        renderer.setSize(window.innerWidth, window.innerHeight);

        // 1. Background Particle Constellation
        const particleGeometry = new THREE.BufferGeometry();
        const particleCount = 1200;
        const positions = new Float32Array(particleCount * 3);
        const colors = new Float32Array(particleCount * 3);

        const color1 = new THREE.Color(0x00ffff); // Cyan
        const color2 = new THREE.Color(0x8a2be2); // Purple

        for (let i = 0; i < particleCount; i++) {
            positions[i * 3] = (Math.random() - 0.5) * 2200;
            positions[i * 3 + 1] = (Math.random() - 0.5) * 2200;
            positions[i * 3 + 2] = (Math.random() - 0.5) * 2200;

            const mixedColor = color1.clone().lerp(color2, Math.random());
            colors[i * 3] = mixedColor.r;
            colors[i * 3 + 1] = mixedColor.g;
            colors[i * 3 + 2] = mixedColor.b;
        }

        particleGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        particleGeometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

        const particleMaterial = new THREE.PointsMaterial({
            size: 4,
            vertexColors: true,
            blending: THREE.AdditiveBlending,
            transparent: true,
            opacity: 0.65
        });

        particles = new THREE.Points(particleGeometry, particleMaterial);
        scene.add(particles);

        // 2. Rotating Icosahedron Motif in top-right
        const geom = new THREE.IcosahedronGeometry(85, 1);
        const mat = new THREE.MeshBasicMaterial({ color: 0x00ffff, wireframe: true, transparent: true, opacity: 0.35 });
        dodecahedron = new THREE.Mesh(geom, mat);
        dodecahedron.position.set(320, 220, -220);
        scene.add(dodecahedron);

        // 3. SEO Structural Motifs: 3D Rank Podiums
        const podiumGeometries = [
            new THREE.BoxGeometry(45, 130, 45), // Rank 1
            new THREE.BoxGeometry(45, 95, 45),  // Rank 2
            new THREE.BoxGeometry(45, 65, 45)   // Rank 3
        ];
        const podiumColors = [0xffd700, 0x00ffff, 0x8a2be2]; // Gold, Cyan, Purple
        const podiumPositions = [
            { x: -160, y: -100, z: -100 },
            { x: -215, y: -118, z: -100 },
            { x: -105, y: -132, z: -100 }
        ];

        for (let i = 0; i < 3; i++) {
            const pMat = new THREE.MeshBasicMaterial({ color: podiumColors[i], wireframe: true, transparent: true, opacity: 0.55 });
            const pMesh = new THREE.Mesh(podiumGeometries[i], pMat);
            pMesh.position.set(podiumPositions[i].x, podiumPositions[i].y, podiumPositions[i].z);
            scene.add(pMesh);
            podiums.push(pMesh);
        }

        // 4. Backlink Neural Graph Network Lines
        const lineMaterial = new THREE.LineBasicMaterial({ color: 0x00ffff, transparent: true, opacity: 0.18 });
        const lineGeometry = new THREE.BufferGeometry();
        const linePositions = [];
        
        for (let i = 0; i < 320; i++) {
            const idx1 = Math.floor(Math.random() * particleCount) * 3;
            const idx2 = Math.floor(Math.random() * particleCount) * 3;
            
            linePositions.push(
                positions[idx1], positions[idx1+1], positions[idx1+2],
                positions[idx2], positions[idx2+1], positions[idx2+2]
            );
        }
        lineGeometry.setAttribute('position', new THREE.Float32BufferAttribute(linePositions, 3));
        graphLines = new THREE.LineSegments(lineGeometry, lineMaterial);
        scene.add(graphLines);

        // =========================================================================
        // REQUIREMENT 3: Core Web Vitals Glowing Torus Rings (Gradients + Rotations)
        // =========================================================================
        createCoreWebVitalsRings();

        // =========================================================================
        // REQUIREMENT 1: Floating 3D Rank Numbers (#1, #2, #3, #4, #5) + Neon Particles
        // =========================================================================
        createFloatingRankNumbers();

        // Event Listeners
        window.addEventListener('resize', onWindowResize, false);
        document.addEventListener('mousemove', onDocumentMouseMove, false);
        document.addEventListener('visibilitychange', onVisibilityChange, false);
        canvas.addEventListener('webglcontextlost', onContextLost, false);
        canvas.addEventListener('webglcontextrestored', onContextRestored, false);
        window.addEventListener('beforeunload', cleanupThreeResources, false);

        // =========================================================================
        // REQUIREMENT 2: Form submission & click handlers to trigger signal waves
        // =========================================================================
        setupInteractiveSignalTriggers();
    }

    function onVisibilityChange() {
        if (document.hidden) {
            stopAnimation();
        } else {
            startAnimation();
        }
    }

    function startAnimation() {
        if (!isAnimating) {
            isAnimating = true;
            animFrameId = requestAnimationFrame(animate);
        }
    }

    function stopAnimation() {
        isAnimating = false;
        if (animFrameId) {
            cancelAnimationFrame(animFrameId);
            animFrameId = null;
        }
    }

    function onContextLost(event) {
        event.preventDefault();
        stopAnimation();
    }

    function onContextRestored() {
        startAnimation();
    }

    function disposeObject(obj) {
        if (!obj) return;
        if (obj.geometry) {
            obj.geometry.dispose();
        }
        if (obj.material) {
            if (Array.isArray(obj.material)) {
                obj.material.forEach(m => {
                    if (m.map) m.map.dispose();
                    m.dispose();
                });
            } else {
                if (obj.material.map) obj.material.map.dispose();
                obj.material.dispose();
            }
        }
    }

    function cleanupThreeResources() {
        stopAnimation();
        if (particles) disposeObject(particles);
        if (dodecahedron) disposeObject(dodecahedron);
        if (podiums) {
            podiums.forEach(p => disposeObject(p));
            podiums = [];
        }
        if (graphLines) disposeObject(graphLines);
        if (rings) {
            rings.forEach(r => {
                if (r.geometry) r.geometry.dispose();
                if (r.mesh) disposeObject(r.mesh);
            });
            rings = [];
        }
        if (floatingNumbers) {
            floatingNumbers.forEach(item => {
                if (item.group) item.group.traverse(disposeObject);
            });
            floatingNumbers = [];
        }
        if (activeSignalWaves) {
            activeSignalWaves.forEach(wave => {
                if (wave.group) wave.group.traverse(disposeObject);
            });
            activeSignalWaves = [];
        }
        if (renderer) {
            renderer.dispose();
        }
    }

    // Helper: Create Canvas Texture for Neon Rank Numbers
    function createNeonNumberTexture(text, mainHex, glowHex) {
        const canvas = document.createElement('canvas');
        canvas.width = 256;
        canvas.height = 256;
        const ctx = canvas.getContext('2d');

        ctx.clearRect(0, 0, 256, 256);

        // Neon Glow Backdrop
        ctx.shadowColor = glowHex;
        ctx.shadowBlur = 35;
        ctx.font = '900 110px "Segoe UI", Roboto, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        ctx.fillStyle = mainHex;
        ctx.fillText(text, 128, 128);

        // Second pass for intense glow bloom
        ctx.shadowBlur = 55;
        ctx.fillText(text, 128, 128);

        // Crisp White Core text
        ctx.shadowBlur = 8;
        ctx.shadowColor = '#ffffff';
        ctx.fillStyle = '#ffffff';
        ctx.fillText(text, 128, 128);

        const texture = new THREE.CanvasTexture(canvas);
        texture.needsUpdate = true;
        return texture;
    }

    // REQUIREMENT 1: Floating 3D Numbers (#1, #2, #3, #4, #5) in Glowing Neon Particles
    function createFloatingRankNumbers() {
        const rankConfigs = [
            { text: '#1', mainHex: '#ffd700', glowHex: '#ffaa00', colorVal: 0xffd700, pos: { x: -330, y: 170, z: -140 }, speed: 1.1, ampY: 22, ampX: 14, phase: 0 },
            { text: '#2', mainHex: '#00ffff', glowHex: '#0088ff', colorVal: 0x00ffff, pos: { x: 340, y: 150, z: -190 }, speed: 0.95, ampY: 18, ampX: 12, phase: 1.2 },
            { text: '#3', mainHex: '#b026ff', glowHex: '#ff00aa', colorVal: 0xb026ff, pos: { x: -300, y: -150, z: -170 }, speed: 1.3, ampY: 25, ampX: 16, phase: 2.4 },
            { text: '#4', mainHex: '#00ff88', glowHex: '#00cc66', colorVal: 0x00ff88, pos: { x: 310, y: -190, z: -210 }, speed: 0.85, ampY: 20, ampX: 10, phase: 3.6 },
            { text: '#5', mainHex: '#ff007f', glowHex: '#7928ca', colorVal: 0xff007f, pos: { x: 0, y: 270, z: -260 }, speed: 1.05, ampY: 24, ampX: 15, phase: 4.8 }
        ];

        rankConfigs.forEach((cfg) => {
            const group = new THREE.Group();

            // 1. Glowing Canvas Texture Sprite
            const texture = createNeonNumberTexture(cfg.text, cfg.mainHex, cfg.glowHex);
            const spriteMaterial = new THREE.SpriteMaterial({
                map: texture,
                transparent: true,
                blending: THREE.AdditiveBlending,
                opacity: 0.95,
                depthWrite: false
            });
            const sprite = new THREE.Sprite(spriteMaterial);
            sprite.scale.set(95, 95, 1);
            group.add(sprite);

            // 2. Neon Particle Cloud around the Rank Number
            const haloParticleCount = 45;
            const haloGeometry = new THREE.BufferGeometry();
            const haloPositions = new Float32Array(haloParticleCount * 3);
            const haloColors = new Float32Array(haloParticleCount * 3);

            const baseColor = new THREE.Color(cfg.colorVal);
            const whiteColor = new THREE.Color(0xffffff);

            for (let p = 0; p < haloParticleCount; p++) {
                // Sphere distribution around text center
                const radius = 35 + Math.random() * 35;
                const theta = Math.random() * Math.PI * 2;
                const phi = Math.acos((Math.random() * 2) - 1);

                haloPositions[p * 3] = radius * Math.sin(phi) * Math.cos(theta);
                haloPositions[p * 3 + 1] = radius * Math.sin(phi) * Math.sin(theta);
                haloPositions[p * 3 + 2] = radius * Math.cos(phi);

                const c = baseColor.clone().lerp(whiteColor, Math.random() * 0.4);
                haloColors[p * 3] = c.r;
                haloColors[p * 3 + 1] = c.g;
                haloColors[p * 3 + 2] = c.b;
            }

            haloGeometry.setAttribute('position', new THREE.BufferAttribute(haloPositions, 3));
            haloGeometry.setAttribute('color', new THREE.BufferAttribute(haloColors, 3));

            const haloMaterial = new THREE.PointsMaterial({
                size: 4,
                vertexColors: true,
                transparent: true,
                opacity: 0.8,
                blending: THREE.AdditiveBlending,
                depthWrite: false
            });

            const particleCloud = new THREE.Points(haloGeometry, haloMaterial);
            group.add(particleCloud);

            group.position.set(cfg.pos.x, cfg.pos.y, cfg.pos.z);
            scene.add(group);

            floatingNumbers.push({
                group: group,
                particleCloud: particleCloud,
                basePos: cfg.pos,
                speed: cfg.speed,
                ampY: cfg.ampY,
                ampX: cfg.ampX,
                phase: cfg.phase
            });
        });
    }

    // REQUIREMENT 3: Core Web Vitals Glowing Torus Rings with Smooth Gradients & Multi-Axis Animations
    function createCoreWebVitalsRings() {
        const ringSpecs = [
            { radius: 155, tube: 2.8, radialSegs: 20, tubularSegs: 120, palette: [new THREE.Color(0x00ff88), new THREE.Color(0x00ffff), new THREE.Color(0x76ff03), new THREE.Color(0x00ff88)] }, // LCP - Speed
            { radius: 205, tube: 3.2, radialSegs: 20, tubularSegs: 120, palette: [new THREE.Color(0x00ffff), new THREE.Color(0x3a86ff), new THREE.Color(0x8a2be2), new THREE.Color(0x00ffff)] }, // INP - Interactivity
            { radius: 260, tube: 3.5, radialSegs: 20, tubularSegs: 120, palette: [new THREE.Color(0xffd700), new THREE.Color(0xff007f), new THREE.Color(0x9d00ff), new THREE.Color(0xffd700)] }  // CLS - Stability
        ];

        ringSpecs.forEach((spec, index) => {
            const torusGeom = new THREE.TorusGeometry(spec.radius, spec.tube, spec.radialSegs, spec.tubularSegs);

            // Add Vertex Colors for smooth gradients
            const count = torusGeom.attributes.position.count;
            const colors = new Float32Array(count * 3);
            torusGeom.setAttribute('color', new THREE.BufferAttribute(colors, 3));

            // Dual Material Mesh: Glowing wireframe + translucent inner glow
            const wireMat = new THREE.MeshBasicMaterial({
                vertexColors: true,
                wireframe: true,
                transparent: true,
                opacity: 0.55,
                blending: THREE.AdditiveBlending
            });

            const torusMesh = new THREE.Mesh(torusGeom, wireMat);
            torusMesh.rotation.x = (index + 1) * 0.7;
            torusMesh.rotation.y = (index + 1) * 0.5;

            scene.add(torusMesh);

            rings.push({
                mesh: torusMesh,
                geometry: torusGeom,
                palette: spec.palette,
                tubularSegs: spec.tubularSegs,
                radialSegs: spec.radialSegs,
                index: index,
                rotSpeedX: 0.0015 * (index + 1),
                rotSpeedY: 0.0022 * (3 - index),
                rotSpeedZ: 0.0012 * (index + 0.5),
                flowSpeed: 0.15 + index * 0.08
            });
        });
    }

    // Update Core Web Vitals Torus Ring Gradients over time
    function updateTorusGradients(time) {
        rings.forEach((ringItem) => {
            const colorsAttr = ringItem.geometry.attributes.color;
            const palette = ringItem.palette;
            const tubularSegs = ringItem.tubularSegs;
            const radialSegs = ringItem.radialSegs;

            for (let j = 0; j <= tubularSegs; j++) {
                // Calculate progress around the torus circumference with moving flow offset
                const progress = (j / tubularSegs + time * ringItem.flowSpeed) % 1.0;
                
                // Color interpolation across palette
                const scaledProg = progress * (palette.length - 1);
                const idx1 = Math.floor(scaledProg);
                const idx2 = Math.min(idx1 + 1, palette.length - 1);
                const lerpFactor = scaledProg - idx1;

                const currentColor = palette[idx1].clone().lerp(palette[idx2], lerpFactor);

                for (let i = 0; i <= radialSegs; i++) {
                    const vertexIdx = j * (radialSegs + 1) + i;
                    if (vertexIdx < colorsAttr.count) {
                        colorsAttr.setXYZ(vertexIdx, currentColor.r, currentColor.g, currentColor.b);
                    }
                }
            }
            colorsAttr.needsUpdate = true;
        });
    }

    // =========================================================================
    // REQUIREMENT 2: Interactive Backlink Pulse Waves (window.trigger3DSignalWave)
    // =========================================================================
    window.trigger3DSignalWave = function(screenX, screenY) {
        const origin3D = new THREE.Vector3(0, 0, 0);

        if (typeof screenX === 'number' && typeof screenY === 'number') {
            const mouseVector = new THREE.Vector2(
                (screenX / window.innerWidth) * 2 - 1,
                -(screenY / window.innerHeight) * 2 + 1
            );
            const raycaster = new THREE.Raycaster();
            raycaster.setFromCamera(mouseVector, camera);
            const targetPlane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);
            raycaster.ray.intersectPlane(targetPlane, origin3D);
        }

        const waveGroup = new THREE.Group();
        waveGroup.position.copy(origin3D);

        // 1. Concentric Expanding Shockwave Rings
        const ringCount = 3;
        const waveRings = [];
        const ringColors = [0x00ffff, 0x8a2be2, 0xffd700];

        for (let r = 0; r < ringCount; r++) {
            const torusGeom = new THREE.TorusGeometry(15 + r * 12, 1.8, 12, 48);
            const torusMat = new THREE.MeshBasicMaterial({
                color: ringColors[r % ringColors.length],
                wireframe: true,
                transparent: true,
                opacity: 0.9,
                blending: THREE.AdditiveBlending,
                depthWrite: false
            });
            const ringMesh = new THREE.Mesh(torusGeom, torusMat);
            waveGroup.add(ringMesh);
            waveRings.push(ringMesh);
        }

        // 2. Radial Backlink Pulse Lines (Beams radiating outward)
        const lineCount = 12;
        const linePositions = [];
        const lineVelocities = [];

        for (let l = 0; l < lineCount; l++) {
            const angle = (l / lineCount) * Math.PI * 2 + (Math.random() * 0.2);
            const dirX = Math.cos(angle);
            const dirY = Math.sin(angle);
            const dirZ = (Math.random() - 0.5) * 0.5;

            linePositions.push(0, 0, 0, dirX * 20, dirY * 20, dirZ * 20);
            lineVelocities.push(new THREE.Vector3(dirX, dirY, dirZ));
        }

        const lineGeom = new THREE.BufferGeometry();
        lineGeom.setAttribute('position', new THREE.Float32BufferAttribute(linePositions, 3));

        const lineMat = new THREE.LineBasicMaterial({
            color: 0x00ffff,
            transparent: true,
            opacity: 0.85,
            blending: THREE.AdditiveBlending
        });

        const pulseLines = new THREE.LineSegments(lineGeom, lineMat);
        waveGroup.add(pulseLines);

        // 3. Signal Wave Particles Cloud
        const particleCount = 75;
        const pGeom = new THREE.BufferGeometry();
        const pPos = new Float32Array(particleCount * 3);
        const pVel = [];
        const pColors = new Float32Array(particleCount * 3);

        const cCyan = new THREE.Color(0x00ffff);
        const cPurple = new THREE.Color(0x8a2be2);

        for (let p = 0; p < particleCount; p++) {
            pPos[p * 3] = 0;
            pPos[p * 3 + 1] = 0;
            pPos[p * 3 + 2] = 0;

            const speed = 4 + Math.random() * 8;
            const theta = Math.random() * Math.PI * 2;
            const phi = Math.acos((Math.random() * 2) - 1);

            pVel.push(new THREE.Vector3(
                speed * Math.sin(phi) * Math.cos(theta),
                speed * Math.sin(phi) * Math.sin(theta),
                speed * Math.cos(phi)
            ));

            const mixColor = cCyan.clone().lerp(cPurple, Math.random());
            pColors[p * 3] = mixColor.r;
            pColors[p * 3 + 1] = mixColor.g;
            pColors[p * 3 + 2] = mixColor.b;
        }

        pGeom.setAttribute('position', new THREE.BufferAttribute(pPos, 3));
        pGeom.setAttribute('color', new THREE.BufferAttribute(pColors, 3));

        const pMat = new THREE.PointsMaterial({
            size: 4.5,
            vertexColors: true,
            transparent: true,
            opacity: 0.9,
            blending: THREE.AdditiveBlending,
            depthWrite: false
        });

        const pCloud = new THREE.Points(pGeom, pMat);
        waveGroup.add(pCloud);

        scene.add(waveGroup);

        activeSignalWaves.push({
            group: waveGroup,
            rings: waveRings,
            pulseLines: pulseLines,
            lineVelocities: lineVelocities,
            pCloud: pCloud,
            pVelocities: pVel,
            startTime: Date.now(),
            duration: 1600 // 1.6 seconds animation life
        });
    };

    // Update active signal wave bursts in animation loop
    function updateSignalWaves() {
        const now = Date.now();

        for (let i = activeSignalWaves.length - 1; i >= 0; i--) {
            const wave = activeSignalWaves[i];
            const elapsed = now - wave.startTime;
            const progress = elapsed / wave.duration;

            if (progress >= 1.0) {
                // Clean up WebGL resources
                scene.remove(wave.group);
                wave.group.traverse(disposeObject);
                activeSignalWaves.splice(i, 1);
                continue;
            }

            const easeOut = 1 - Math.pow(1 - progress, 3);
            const fadeOpacity = Math.max(0, 1.0 - progress);

            // Expand concentric shockwave rings
            wave.rings.forEach((ring, idx) => {
                const scale = 1.0 + easeOut * (6.0 + idx * 2.5);
                ring.scale.set(scale, scale, scale);
                ring.material.opacity = fadeOpacity * 0.85;
                ring.rotation.z += 0.02 * (idx + 1);
            });

            // Expand line pulses
            const linePositions = wave.pulseLines.geometry.attributes.position.array;
            for (let l = 0; l < wave.lineVelocities.length; l++) {
                const vel = wave.lineVelocities[l];
                linePositions[l * 6 + 3] = vel.x * easeOut * 12;
                linePositions[l * 6 + 4] = vel.y * easeOut * 12;
                linePositions[l * 6 + 5] = vel.z * easeOut * 12;
            }
            wave.pulseLines.geometry.attributes.position.needsUpdate = true;
            wave.pulseLines.material.opacity = fadeOpacity;

            // Expand particle cloud
            const pPositions = wave.pCloud.geometry.attributes.position.array;
            for (let p = 0; p < wave.pVelocities.length; p++) {
                const vel = wave.pVelocities[p];
                pPositions[p * 3] += vel.x * 0.5;
                pPositions[p * 3 + 1] += vel.y * 0.5;
                pPositions[p * 3 + 2] += vel.z * 0.5;
            }
            wave.pCloud.geometry.attributes.position.needsUpdate = true;
            wave.pCloud.material.opacity = fadeOpacity;
        }
    }

    // Attach listeners so any form submit or button click triggers signal waves
    function setupInteractiveSignalTriggers() {
        document.addEventListener('submit', function(e) {
            let x = window.innerWidth / 2;
            let y = window.innerHeight / 2;
            if (e.target && typeof e.target.getBoundingClientRect === 'function') {
                const rect = e.target.getBoundingClientRect();
                x = rect.left + rect.width / 2;
                y = rect.top + rect.height / 2;
            }
            if (window.trigger3DSignalWave) {
                window.trigger3DSignalWave(x, y);
            }
        }, true);

        document.addEventListener('click', function(e) {
            const btn = e.target.closest('.btn, button, input[type="submit"], .nav-item');
            if (btn && window.trigger3DSignalWave) {
                const rect = btn.getBoundingClientRect();
                window.trigger3DSignalWave(rect.left + rect.width / 2, rect.top + rect.height / 2);
            }
        }, true);
    }

    function onWindowResize() {
        windowHalfX = window.innerWidth / 2;
        windowHalfY = window.innerHeight / 2;
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        if (renderer) {
            renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
            renderer.setSize(window.innerWidth, window.innerHeight);
        }
    }

    function onDocumentMouseMove(event) {
        mouseX = (event.clientX - windowHalfX) * 0.5;
        mouseY = (event.clientY - windowHalfY) * 0.5;
    }

    function animate() {
        if (!isAnimating) return;
        animFrameId = requestAnimationFrame(animate);
        render();
    }

    function render() {
        const time = Date.now() * 0.001;

        targetX = mouseX * 0.05;
        targetY = mouseY * 0.05;

        camera.position.x += (targetX - camera.position.x) * 0.02;
        camera.position.y += (-targetY - camera.position.y) * 0.02;
        camera.lookAt(scene.position);

        // Constellation & graph rotations
        particles.rotation.x += 0.0005;
        particles.rotation.y += 0.001;

        graphLines.rotation.x += 0.0005;
        graphLines.rotation.y += 0.001;

        // Top right dodecahedron rotation
        dodecahedron.rotation.x += 0.004;
        dodecahedron.rotation.y += 0.006;

        // Podiums gentle floating
        podiums.forEach((p, i) => {
            p.position.y += Math.sin(time + i) * 0.25;
            p.rotation.y += 0.003;
        });

        // REQUIREMENT 3: Core Web Vitals Torus Rings Multi-Axis Rotations + Gradients
        rings.forEach((ringItem) => {
            ringItem.mesh.rotation.x += ringItem.rotSpeedX;
            ringItem.mesh.rotation.y += ringItem.rotSpeedY;
            ringItem.mesh.rotation.z += ringItem.rotSpeedZ;
            ringItem.mesh.position.y = Math.sin(time * 0.8 + ringItem.index) * 12;
        });
        updateTorusGradients(time);

        // REQUIREMENT 1: Floating Rank Numbers (#1 to #5) gentle floating & particle rotations
        floatingNumbers.forEach((item) => {
            const t = time * item.speed + item.phase;
            item.group.position.x = item.basePos.x + Math.cos(t * 0.7) * item.ampX;
            item.group.position.y = item.basePos.y + Math.sin(t) * item.ampY;
            item.group.position.z = item.basePos.z + Math.sin(t * 0.5) * 12;

            if (item.particleCloud) {
                item.particleCloud.rotation.y += 0.008;
                item.particleCloud.rotation.x += 0.004;
            }
        });

        // REQUIREMENT 2: Active backlink pulse waves animation
        updateSignalWaves();

        if (renderer && scene && camera) {
            renderer.render(scene, camera);
        }
    }
})();
