// Initialize PixiJS Application
const app = new PIXI.Application({
    width: window.innerWidth,
    height: window.innerHeight,
    backgroundColor: 0x667eea,
    backgroundAlpha: 0,
    resolution: window.devicePixelRatio || 1,
});

document.getElementById('pixi-container').appendChild(app.view);

// Create particle container
const particles = [];
const particleCount = 50;

// Create particles with warm beige tones
for (let i = 0; i < particleCount; i++) {
    const particle = new PIXI.Graphics();
    // Warm beige/tan colors: 0x8b7355, 0xa89080, 0xc4b5a0
    const colors = [0x8b7355, 0xa89080, 0xc4b5a0];
    const color = colors[Math.floor(Math.random() * colors.length)];
    particle.beginFill(color, 0.3);
    particle.drawCircle(0, 0, Math.random() * 3 + 1);
    particle.endFill();

    particle.x = Math.random() * app.screen.width;
    particle.y = Math.random() * app.screen.height;

    particle.vx = (Math.random() - 0.5) * 0.5;
    particle.vy = (Math.random() - 0.5) * 0.5;

    app.stage.addChild(particle);
    particles.push(particle);
}

// Animation loop
app.ticker.add(() => {
    particles.forEach(particle => {
        particle.x += particle.vx;
        particle.y += particle.vy;

        // Wrap around screen
        if (particle.x > app.screen.width) particle.x = 0;
        if (particle.x < 0) particle.x = app.screen.width;
        if (particle.y > app.screen.height) particle.y = 0;
        if (particle.y < 0) particle.y = app.screen.height;
    });
});

// Handle window resize
window.addEventListener('resize', () => {
    app.renderer.resize(window.innerWidth, window.innerHeight);
});
