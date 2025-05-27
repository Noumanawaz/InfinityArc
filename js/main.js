class DemonSlayerApp {
  constructor() {
    this.scene = null;
    this.camera = null;
    this.renderer = null;
    this.infinityArc = null;
    this.particleSystem = null;
    this.controls = null;
    this.audio = null; // Audio element reference
    this.isPlaying = true;
    this.animationSpeed = 1.0;
    this.time = 0;
    this.cameraRadius = 8;
    this.cameraHeight = 2;
    this.cameraSpeed = 0.3;

    this.init();
    this.setupEventListeners();
    this.animate();
  }

  init() {
    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.Fog(0x0a0a0a, 10, 50);

    this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    this.camera.position.set(0, 3, 8);

    this.renderer = new THREE.WebGLRenderer({
      canvas: document.getElementById("webgl-canvas"),
      antialias: true,
      alpha: true,
    });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    this.setupLighting();
    this.infinityArc = new InfinityArc(this.scene);
    this.particleSystem = new ParticleSystem(this.scene, 800);
    this.createEnvironment();

    // Initialize audio
    this.audio = document.getElementById("background-audio");
    if (this.audio) {
      this.audio.loop = true;
      this.audio.volume = 1.0; // Default volume
    } else {
      console.warn("Audio element not found in the DOM.");
    }

    setTimeout(() => {
      document.getElementById("loading").classList.add("hidden");
    }, 2000);
  }

  setupLighting() {
    const ambientLight = new THREE.AmbientLight(0x4fc3f7, 0.3);
    this.scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0x4fc3f7, 0.8);
    directionalLight.position.set(5, 10, 5);
    directionalLight.castShadow = true;
    directionalLight.shadow.mapSize.width = 2048;
    directionalLight.shadow.mapSize.height = 2048;
    this.scene.add(directionalLight);

    const pointLight1 = new THREE.PointLight(0x81d4fa, 0.5, 10);
    pointLight1.position.set(-3, 2, 3);
    this.scene.add(pointLight1);

    const pointLight2 = new THREE.PointLight(0x4fc3f7, 0.5, 10);
    pointLight2.position.set(3, -2, -3);
    this.scene.add(pointLight2);
  }

  createEnvironment() {
    const mistGeometry = new THREE.BufferGeometry();
    const mistCount = 200;
    const mistPositions = new Float32Array(mistCount * 3);
    const mistOpacities = new Float32Array(mistCount);

    for (let i = 0; i < mistCount; i++) {
      mistPositions[i * 3] = (Math.random() - 0.5) * 20;
      mistPositions[i * 3 + 1] = (Math.random() - 0.5) * 10;
      mistPositions[i * 3 + 2] = (Math.random() - 0.5) * 20;
      mistOpacities[i] = Math.random() * 0.3;
    }

    mistGeometry.setAttribute("position", new THREE.BufferAttribute(mistPositions, 3));
    mistGeometry.setAttribute("opacity", new THREE.BufferAttribute(mistOpacities, 1));

    const mistMaterial = new THREE.ShaderMaterial({
      uniforms: {
        time: { value: 0.0 },
        color: { value: new THREE.Color(0x4fc3f7) },
      },
      vertexShader: `
          attribute float opacity;
          varying float vOpacity;
          uniform float time;
          
          void main() {
              vOpacity = opacity;
              vec3 pos = position;
              pos.y += sin(time * 0.5 + position.x * 0.1) * 0.5;
              pos.x += cos(time * 0.3 + position.z * 0.1) * 0.3;
              
              vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
              gl_PointSize = 100.0 / -mvPosition.z;
              gl_Position = projectionMatrix * mvPosition;
          }
        `,
      fragmentShader: `
          uniform vec3 color;
          varying float vOpacity;
          
          void main() {
              vec2 coords = gl_PointCoord;
              float distance = length(coords - vec2(0.5));
              float alpha = 1.0 - smoothstep(0.0, 0.5, distance);
              
              gl_FragColor = vec4(color, alpha * vOpacity * 0.1);
          }
        `,
      transparent: true,
      blending: THREE.AdditiveBlending,
    });

    this.mistSystem = new THREE.Points(mistGeometry, mistMaterial);
    this.scene.add(this.mistSystem);

    const groundGeometry = new THREE.PlaneGeometry(50, 50);
    const groundMaterial = new THREE.MeshPhongMaterial({
      color: 0x111111,
      transparent: true,
      opacity: 0.3,
      reflectivity: 0.8,
    });

    this.ground = new THREE.Mesh(groundGeometry, groundMaterial);
    this.ground.rotation.x = -Math.PI / 2;
    this.ground.position.y = -3;
    this.ground.receiveShadow = true;
    this.scene.add(this.ground);
  }

  setupEventListeners() {
    window.addEventListener("resize", () => this.onWindowResize());

    document.getElementById("playPause").addEventListener("click", () => {
      this.isPlaying = !this.isPlaying;
      const button = document.getElementById("playPause");
      button.textContent = this.isPlaying ? "⏸️ Pause" : "▶️ Play";
      if (this.audio) {
        if (this.isPlaying) {
          this.audio.play().catch((error) => {
            console.error("Error playing audio:", error);
          });
        } else {
          this.audio.pause();
        }
      }
    });

    document.getElementById("resetCamera").addEventListener("click", () => {
      this.resetCamera();
    });

    document.getElementById("muteToggle").addEventListener("click", () => {
      if (this.audio) {
        this.audio.muted = !this.audio.muted;
        const button = document.getElementById("muteToggle");
        button.textContent = this.audio.muted ? "🔇 Unmute" : "🔊 Mute";
      }
    });

    document.getElementById("speedSlider").addEventListener("input", (e) => {
      this.animationSpeed = parseFloat(e.target.value);
      if (this.audio) {
        this.audio.playbackRate = this.animationSpeed;
      }
    });

    document.getElementById("volumeSlider").addEventListener("input", (e) => {
      if (this.audio) {
        this.audio.volume = parseFloat(e.target.value);
      }
    });

    let isMouseDown = false;
    let mouseX = 0;
    let mouseY = 0;

    document.addEventListener("mousedown", (e) => {
      isMouseDown = true;
      mouseX = e.clientX;
      mouseY = e.clientY;
      if (this.audio && this.isPlaying && this.audio.paused) {
        this.audio.play().catch((error) => {
          console.error("Error playing audio on mousedown:", error);
        });
      }
    });

    document.addEventListener("mouseup", () => {
      isMouseDown = false;
    });

    document.addEventListener("mousemove", (e) => {
      if (isMouseDown) {
        const deltaX = e.clientX - mouseX;
        const deltaY = e.clientY - mouseY;
        this.cameraSpeed += deltaX * 0.001;
        this.cameraHeight += deltaY * 0.01;
        this.cameraHeight = Math.max(-5, Math.min(10, this.cameraHeight));
        mouseX = e.clientX;
        mouseY = e.clientY;
      }
    });

    document.addEventListener("touchstart", (e) => {
      if (e.touches.length === 1) {
        mouseX = e.touches[0].clientX;
        mouseY = e.touches[0].clientY;
        if (this.audio && this.isPlaying && this.audio.paused) {
          this.audio.play().catch((error) => {
            console.error("Error playing audio on touchstart:", error);
          });
        }
      }
    });

    document.addEventListener("touchmove", (e) => {
      if (e.touches.length === 1) {
        const deltaX = e.touches[0].clientX - mouseX;
        const deltaY = e.touches[0].clientY - mouseY;
        this.cameraSpeed += deltaX * 0.001;
        this.cameraHeight += deltaY * 0.01;
        this.cameraHeight = Math.max(-5, Math.min(10, this.cameraHeight));
        mouseX = e.touches[0].clientX;
        mouseY = e.touches[0].clientY;
      }
      e.preventDefault();
    });

    document.addEventListener("wheel", (e) => {
      this.cameraRadius += e.deltaY * 0.01;
      this.cameraRadius = Math.max(3, Math.min(15, this.cameraRadius));
      e.preventDefault();
    });
  }

  onWindowResize() {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  }

  resetCamera() {
    this.cameraRadius = 8;
    this.cameraHeight = 2;
    this.cameraSpeed = 0.3;
  }

  updateCamera() {
    const x = Math.cos(this.time * this.cameraSpeed) * this.cameraRadius;
    const z = Math.sin(this.time * this.cameraSpeed) * this.cameraRadius;
    const y = this.cameraHeight + Math.sin(this.time * 0.2) * 0.5;
    this.camera.position.set(x, y, z);
    this.camera.lookAt(0, 0, 0);
  }

  animate() {
    requestAnimationFrame(() => this.animate());
    if (this.isPlaying) {
      this.time += 0.016 * this.animationSpeed;
      if (this.infinityArc) {
        this.infinityArc.update(this.animationSpeed);
      }
      if (this.particleSystem && this.infinityArc) {
        this.particleSystem.updateParticles(this.infinityArc.getCurve(), this.animationSpeed);
      }
      if (this.mistSystem) {
        this.mistSystem.material.uniforms.time.value = this.time;
        this.mistSystem.rotation.y += 0.001 * this.animationSpeed;
      }
      this.updateCamera();
    }
    this.renderer.render(this.scene, this.camera);
  }

  dispose() {
    if (this.infinityArc) {
      this.infinityArc.dispose();
    }
    if (this.particleSystem) {
      this.particleSystem.dispose();
    }
    if (this.audio) {
      this.audio.pause();
      this.audio.currentTime = 0;
    }
    this.renderer.dispose();
  }
}

window.addEventListener("DOMContentLoaded", () => {
  if (!window.WebGLRenderingContext) {
    alert("WebGL is not supported in your browser. Please use a modern browser.");
    return;
  }

  try {
    window.demonSlayerApp = new DemonSlayerApp();
    console.log("🌊 Demon Slayer Infinity Arc initialized successfully!");
    console.log("🎮 Controls:");
    console.log("  - Drag mouse to orbit camera");
    console.log("  - Scroll wheel to zoom");
    console.log("  - Use buttons to control animation and audio");
  } catch (error) {
    console.error("Failed to initialize Demon Slayer app:", error);
    document.getElementById("loading").innerHTML = `
        <div class="loader"></div>
        <p style="color: #ff5722;">Failed to load. Please refresh the page.</p>
      `;
  }
});

window.addEventListener("beforeunload", () => {
  if (window.demonSlayerApp) {
    window.demonSlayerApp.dispose();
  }
});
