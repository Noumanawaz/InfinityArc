class InfinityArc {
  constructor(scene) {
    this.scene = scene;
    this.curve = null;
    this.arcMesh = null;
    this.glowMesh = null;
    this.time = 0;

    this.createInfinityCurve();
    this.createArcVisualization();
  }

  createInfinityCurve() {
    // Create infinity symbol using parametric equations
    const points = [];
    const segments = 200;

    for (let i = 0; i <= segments; i++) {
      const t = (i / segments) * Math.PI * 2;

      // Infinity symbol parametric equations
      const scale = 3;
      const x = (scale * Math.cos(t)) / (1 + Math.sin(t) * Math.sin(t));
      const y = (scale * Math.sin(t) * Math.cos(t)) / (1 + Math.sin(t) * Math.sin(t));
      const z = Math.sin(t * 2) * 0.5; // Add some 3D depth

      points.push(new THREE.Vector3(x, y, z));
    }

    // Create curve from points
    this.curve = new THREE.CatmullRomCurve3(points, true); // true for closed curve

    return this.curve;
  }

  createArcVisualization() {
    // Create the main arc line
    const tubeGeometry = new THREE.TubeGeometry(this.curve, 200, 0.05, 8, true);

    // Create gradient material for the arc
    const arcMaterial = new THREE.ShaderMaterial({
      uniforms: {
        time: { value: 0.0 },
        color1: { value: new THREE.Color(0x4fc3f7) }, // Light blue
        color2: { value: new THREE.Color(0x81d4fa) }, // Lighter blue
        opacity: { value: 0.8 },
      },
      vertexShader: this.getArcVertexShader(),
      fragmentShader: this.getArcFragmentShader(),
      transparent: true,
      side: THREE.DoubleSide,
    });

    this.arcMesh = new THREE.Mesh(tubeGeometry, arcMaterial);
    this.scene.add(this.arcMesh);

    // Create glow effect
    const glowGeometry = new THREE.TubeGeometry(this.curve, 200, 0.15, 8, true);
    const glowMaterial = new THREE.ShaderMaterial({
      uniforms: {
        time: { value: 0.0 },
        glowColor: { value: new THREE.Color(0x4fc3f7) },
        opacity: { value: 0.3 },
      },
      vertexShader: this.getGlowVertexShader(),
      fragmentShader: this.getGlowFragmentShader(),
      transparent: true,
      blending: THREE.AdditiveBlending,
      side: THREE.BackSide,
    });

    this.glowMesh = new THREE.Mesh(glowGeometry, glowMaterial);
    this.scene.add(this.glowMesh);

    // Add flowing energy points along the arc
    this.createEnergyPoints();
  }

  createEnergyPoints() {
    const pointCount = 50;
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(pointCount * 3);
    const colors = new Float32Array(pointCount * 3);
    const sizes = new Float32Array(pointCount);

    for (let i = 0; i < pointCount; i++) {
      const t = i / pointCount;
      const point = this.curve.getPointAt(t);

      positions[i * 3] = point.x;
      positions[i * 3 + 1] = point.y;
      positions[i * 3 + 2] = point.z;

      // Blue color variations
      colors[i * 3] = 0.3 + Math.random() * 0.2;
      colors[i * 3 + 1] = 0.7 + Math.random() * 0.3;
      colors[i * 3 + 2] = 1.0;

      sizes[i] = 0.2 + Math.random() * 0.3;
    }

    geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    geometry.setAttribute("size", new THREE.BufferAttribute(sizes, 1));

    const pointMaterial = new THREE.ShaderMaterial({
      uniforms: {
        time: { value: 0.0 },
      },
      vertexShader: `
                attribute float size;
                varying vec3 vColor;
                uniform float time;
                
                void main() {
                    vColor = color;
                    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
                    
                    // Add pulsing effect
                    float pulse = sin(time * 3.0 + position.x * 2.0) * 0.5 + 0.5;
                    gl_PointSize = size * (200.0 / -mvPosition.z) * (1.0 + pulse * 0.5);
                    gl_Position = projectionMatrix * mvPosition;
                }
            `,
      fragmentShader: `
                varying vec3 vColor;
                
                void main() {
                    vec2 coords = gl_PointCoord;
                    float distance = length(coords - vec2(0.5));
                    float alpha = 1.0 - smoothstep(0.0, 0.5, distance);
                    
                    gl_FragColor = vec4(vColor, alpha * 0.8);
                }
            `,
      transparent: true,
      vertexColors: true,
      blending: THREE.AdditiveBlending,
    });

    this.energyPoints = new THREE.Points(geometry, pointMaterial);
    this.scene.add(this.energyPoints);
  }

  getArcVertexShader() {
    return `
            varying vec2 vUv;
            varying vec3 vPosition;
            uniform float time;
            
            void main() {
                vUv = uv;
                vPosition = position;
                
                vec3 pos = position;
                // Add subtle wave motion
                pos += normal * sin(time * 2.0 + position.x * 5.0) * 0.02;
                
                gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
            }
        `;
  }

  getArcFragmentShader() {
    return `
            uniform float time;
            uniform vec3 color1;
            uniform vec3 color2;
            uniform float opacity;
            varying vec2 vUv;
            varying vec3 vPosition;
            
            void main() {
                // Create flowing gradient effect
                float flow = sin(time * 3.0 + vUv.x * 10.0) * 0.5 + 0.5;
                vec3 color = mix(color1, color2, flow);
                
                // Add brightness variation
                float brightness = 1.0 + sin(time * 2.0 + vUv.x * 8.0) * 0.3;
                color *= brightness;
                
                gl_FragColor = vec4(color, opacity);
            }
        `;
  }

  getGlowVertexShader() {
    return `
            varying vec3 vNormal;
            varying vec3 vPosition;
            
            void main() {
                vNormal = normalize(normalMatrix * normal);
                vPosition = position;
                gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
            }
        `;
  }

  getGlowFragmentShader() {
    return `
            uniform float time;
            uniform vec3 glowColor;
            uniform float opacity;
            varying vec3 vNormal;
            varying vec3 vPosition;
            
            void main() {
                // Create rim lighting effect
                vec3 normal = normalize(vNormal);
                float intensity = pow(0.7 - dot(normal, vec3(0.0, 0.0, 1.0)), 2.0);
                
                // Add pulsing
                float pulse = sin(time * 2.0) * 0.5 + 0.5;
                intensity *= (1.0 + pulse * 0.5);
                
                gl_FragColor = vec4(glowColor, intensity * opacity);
            }
        `;
  }

  update(speed = 1.0) {
    this.time += 0.016 * speed;

    // Update shader uniforms
    if (this.arcMesh) {
      this.arcMesh.material.uniforms.time.value = this.time;
    }

    if (this.glowMesh) {
      this.glowMesh.material.uniforms.time.value = this.time;
    }

    if (this.energyPoints) {
      this.energyPoints.material.uniforms.time.value = this.time;

      // Rotate energy points for flowing effect
      this.energyPoints.rotation.z += 0.005 * speed;
    }

    // Gentle rotation of the entire arc
    if (this.arcMesh) {
      this.arcMesh.rotation.y += 0.002 * speed;
    }

    if (this.glowMesh) {
      this.glowMesh.rotation.y += 0.002 * speed;
    }
  }

  getCurve() {
    return this.curve;
  }

  setColors(color1, color2, glowColor) {
    if (this.arcMesh) {
      this.arcMesh.material.uniforms.color1.value.set(color1);
      this.arcMesh.material.uniforms.color2.value.set(color2);
    }

    if (this.glowMesh) {
      this.glowMesh.material.uniforms.glowColor.value.set(glowColor);
    }
  }

  setOpacity(opacity) {
    if (this.arcMesh) {
      this.arcMesh.material.uniforms.opacity.value = opacity;
    }
  }

  dispose() {
    if (this.arcMesh) {
      this.scene.remove(this.arcMesh);
      this.arcMesh.geometry.dispose();
      this.arcMesh.material.dispose();
    }

    if (this.glowMesh) {
      this.scene.remove(this.glowMesh);
      this.glowMesh.geometry.dispose();
      this.glowMesh.material.dispose();
    }

    if (this.energyPoints) {
      this.scene.remove(this.energyPoints);
      this.energyPoints.geometry.dispose();
      this.energyPoints.material.dispose();
    }
  }
}
