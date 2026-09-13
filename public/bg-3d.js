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

    init();
    animate();

    function init() {
        scene = new THREE.Scene();
        scene.fog = new THREE.FogExp2(0x030307, 0.002);

        camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 1, 2000);
        camera.position.z = 500;

        renderer = new THREE.WebGLRenderer({ canvas: canvas, alpha: true, antialias: true });
        renderer.setPixelRatio(window.devicePixelRatio);
        renderer.setSize(window.innerWidth, window.innerHeight);

        // 1. Particle Constellation
        const particleGeometry = new THREE.BufferGeometry();
        const particleCount = 1200;
        const positions = new Float32Array(particleCount * 3);
        const colors = new Float32Array(particleCount * 3);

        const color1 = new THREE.Color(0x00ffff); // Cyan
        const color2 = new THREE.Color(0x8a2be2); // Purple

        for (let i = 0; i < particleCount; i++) {
            positions[i * 3] = (Math.random() - 0.5) * 2000;
            positions[i * 3 + 1] = (Math.random() - 0.5) * 2000;
            positions[i * 3 + 2] = (Math.random() - 0.5) * 2000;

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
            opacity: 0.6
        });

        particles = new THREE.Points(particleGeometry, particleMaterial);
        scene.add(particles);

        // 2. Rotating Dodecahedron / Icosahedron in top-right
        const geom = new THREE.IcosahedronGeometry(80, 0);
        const mat = new THREE.MeshBasicMaterial({ color: 0x00ffff, wireframe: true, transparent: true, opacity: 0.3 });
        dodecahedron = new THREE.Mesh(geom, mat);
        dodecahedron.position.set(300, 200, -200);
        scene.add(dodecahedron);

        // 3. SEO Structural Motifs: 3D Rank Podium
        const podiumGeometries = [
            new THREE.BoxGeometry(40, 120, 40), // Rank 1
            new THREE.BoxGeometry(40, 90, 40),  // Rank 2
            new THREE.BoxGeometry(40, 60, 40)   // Rank 3
        ];
        const podiumColors = [0xffd700, 0x00ffff, 0x8a2be2]; // Gold, Cyan, Purple
        const podiumPositions = [
            { x: -150, y: -100, z: -100 },
            { x: -200, y: -115, z: -100 },
            { x: -100, y: -130, z: -100 }
        ];

        for (let i = 0; i < 3; i++) {
            const pMat = new THREE.MeshBasicMaterial({ color: podiumColors[i], wireframe: true, transparent: true, opacity: 0.5 });
            const pMesh = new THREE.Mesh(podiumGeometries[i], pMat);
            pMesh.position.set(podiumPositions[i].x, podiumPositions[i].y, podiumPositions[i].z);
            scene.add(pMesh);
            podiums.push(pMesh);
        }

        // 4. Backlink Neural Graph Nodes
        const lineMaterial = new THREE.LineBasicMaterial({ color: 0x00ffff, transparent: true, opacity: 0.15 });
        const lineGeometry = new THREE.BufferGeometry();
        const linePositions = [];
        
        for (let i = 0; i < 300; i++) {
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

        // 5. Core Web Vitals Pulse Rings
        const ringColors = [0x00ff00, 0x00ffff, 0x8a2be2];
        for (let i = 0; i < 3; i++) {
            const torusGeom = new THREE.TorusGeometry(150 + i * 40, 2, 16, 100);
            const torusMat = new THREE.MeshBasicMaterial({ color: ringColors[i], transparent: true, opacity: 0.4, wireframe: true });
            const torusMesh = new THREE.Mesh(torusGeom, torusMat);
            torusMesh.rotation.x = Math.random() * Math.PI;
            torusMesh.rotation.y = Math.random() * Math.PI;
            scene.add(torusMesh);
            rings.push(torusMesh);
        }

        window.addEventListener('resize', onWindowResize, false);
        document.addEventListener('mousemove', onDocumentMouseMove, false);
    }

    function onWindowResize() {
        windowHalfX = window.innerWidth / 2;
        windowHalfY = window.innerHeight / 2;
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
    }

    function onDocumentMouseMove(event) {
        mouseX = (event.clientX - windowHalfX) * 0.5;
        mouseY = (event.clientY - windowHalfY) * 0.5;
    }

    function animate() {
        requestAnimationFrame(animate);
        render();
    }

    function render() {
        targetX = mouseX * 0.05;
        targetY = mouseY * 0.05;

        camera.position.x += (targetX - camera.position.x) * 0.02;
        camera.position.y += (-targetY - camera.position.y) * 0.02;
        camera.lookAt(scene.position);

        particles.rotation.x += 0.0005;
        particles.rotation.y += 0.001;
        
        graphLines.rotation.x += 0.0005;
        graphLines.rotation.y += 0.001;

        dodecahedron.rotation.x += 0.005;
        dodecahedron.rotation.y += 0.005;

        rings.forEach((ring, i) => {
            ring.rotation.x += 0.002 * (i + 1);
            ring.rotation.y += 0.003 * (i + 1);
        });

        const time = Date.now() * 0.001;
        podiums.forEach((p, i) => {
            p.position.y += Math.sin(time + i) * 0.2;
        });

        renderer.render(scene, camera);
    }
})();
