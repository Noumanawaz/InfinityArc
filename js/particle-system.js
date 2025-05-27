class ParticleSystem {
  constructor(scene, particleCount = 1000) {
    this.scene = scene;
    this.particleCount = particleCount;
    this.particles = [];
    this.particleSystem = null;
    this.time = 0;

    this.init();
  }

  init() {
    // Create particle geometry
    this.geometry = new THREE.BufferGeometry();
    this.positions = new Float32Array(this.particleCount * 3);
    this.colors = new Float32Array(this.particleCount * 3);
    this.sizes = new Float32Array(this.particleCount);
    this.alphas = new Float32Array(this.particleCount);

    // Initialize particle data
    for (let i = 0; i < this.particleCount; i++) {
      // Create individual particle data
      const particle = {
        position: new THREE.Vector3(),
        velocity: new THREE.Vector3(),
        life: Math.random(),
        maxLife: 1 + Math.random() * 2,
        size: 0.1 + Math.random() * 0.3,
        trail: Math.random() > 0.7, // Some particles leave trails
        pathOffset: Math.random() * Math.PI * 2,
      };

      this.particles.push(particle);

      // Set initial positions (will be updated by infinity arc)
      this.positions[i * 3] = 0;
      this.positions[i * 3 + 1] = 0;
      this.positions[i * 3 + 2] = 0;

      // Set water-like blue colors
      const colorVariation = Math.random() * 0.3;
      this.colors[i * 3] = 0.3 + colorVariation; // R
      this.colors[i * 3 + 1] = 0.7 + colorVariation; // G
      this.colors[i * 3 + 2] = 1.0; // B

      this.sizes[i] = particle.size;
      this.alphas[i] = Math.random() * 0.8 + 0.2;
    }

    // Set geometry attributes
    this.geometry.setAttribute("position", new THREE.BufferAttribute(this.positions, 3));
    this.geometry.setAttribute("color", new THREE.BufferAttribute(this.colors, 3));
    this.geometry.setAttribute("size", new THREE.BufferAttribute(this.sizes, 1));
    this.geometry.setAttribute("alpha", new THREE.BufferAttribute(this.alphas, 1));

    // Create particle material with custom shader
    this.material = new THREE.ShaderMaterial({
      uniforms: {
        time: { value: 0.0 },
        pointTexture: { value: this.createParticleTexture() },
      },
      vertexShader: this.getVertexShader(),
      fragmentShader: this.getFragmentShader(),
      transparent: true,
      vertexColors: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });

    // Create particle system
    this.particleSystem = new THREE.Points(this.geometry, this.material);
    this.scene.add(this.particleSystem);
  }

  createParticleTexture() {
    const canvas = document.createElement("canvas");
    canvas.width = 64;
    canvas.height = 64;
    const ctx = canvas.getContext("2d");

    // Create radial gradient for particle texture
    const gradient = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
    gradient.addColorStop(0, "rgba(79, 195, 247, 1)");
    gradient.addColorStop(0.5, "rgba(79, 195, 247, 0.5)");
    gradient.addColorStop(1, "rgba(79, 195, 247, 0)");

    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 64, 64);

    const texture = new THREE.CanvasTexture(canvas);
    texture.needsUpdate = true;
    return texture;
  }

  getVertexShader() {
    return `
            attribute float size;
            attribute float alpha;
            varying vec3 vColor;
            varying float vAlpha;
            uniform float time;
            
            void main() {
                vColor = color;
                vAlpha = alpha;
                
                vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
                
                // Add some movement based on time
                mvPosition.xyz += sin(time + position.x * 10.0) * 0.01;
                
                gl_PointSize = size * (300.0 / -mvPosition.z);
                gl_Position = projectionMatrix * mvPosition;
            }
        `;
  }

  getFragmentShader() {
    return `
            uniform sampler2D pointTexture;
            varying vec3 vColor;
            varying float vAlpha;
            
            void main() {
                vec2 coords = gl_PointCoord;
                vec4 textureColor = texture2D(pointTexture, coords);
                
                // Create soft circular particles
                float distance = distance(coords, vec2(0.5));
                float alpha = 1.0 - smoothstep(0.0, 0.5, distance);
                
                gl_FragColor = vec4(vColor, alpha * vAlpha * textureColor.a);
            }
        `;
  }

  updateParticles(infinityPath, speed = 1.0) {
    this.time += 0.016 * speed; // Assuming 60fps
    this.material.uniforms.time.value = this.time;

    for (let i = 0; i < this.particleCount; i++) {
      const particle = this.particles[i];

      // Update particle life
      particle.life += 0.01 * speed;
      if (particle.life > particle.maxLife) {
        particle.life = 0;
        particle.pathOffset = Math.random() * Math.PI * 2;
      }

      // Calculate position along infinity path
      const t = (particle.life / particle.maxLife + particle.pathOffset / (Math.PI * 2)) % 1;
      const pathPoint = infinityPath.getPointAt(t);

      // Add some randomness for natural flow
      const noise = new THREE.Vector3(Math.sin(this.time + i * 0.1) * 0.2, Math.cos(this.time + i * 0.15) * 0.2, Math.sin(this.time + i * 0.2) * 0.1);

      particle.position.copy(pathPoint).add(noise);

      // Update position buffer
      this.positions[i * 3] = particle.position.x;
      this.positions[i * 3 + 1] = particle.position.y;
      this.positions[i * 3 + 2] = particle.position.z;

      // Update alpha based on life
      const lifeRatio = particle.life / particle.maxLife;
      this.alphas[i] = Math.sin(lifeRatio * Math.PI) * 0.8 + 0.2;

      // Update size with pulsing effect
      const pulseEffect = Math.sin(this.time * 2 + i * 0.1) * 0.1 + 1;
      this.sizes[i] = particle.size * pulseEffect;
    }

    // Update buffer attributes
    this.geometry.attributes.position.needsUpdate = true;
    this.geometry.attributes.alpha.needsUpdate = true;
    this.geometry.attributes.size.needsUpdate = true;
  }

  setParticleCount(count) {
    // Remove old particle system
    this.scene.remove(this.particleSystem);
    this.geometry.dispose();
    this.material.dispose();

    // Create new system with different count
    this.particleCount = count;
    this.particles = [];
    this.init();
  }

  dispose() {
    this.scene.remove(this.particleSystem);
    this.geometry.dispose();
    this.material.dispose();
  }
}
