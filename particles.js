// Subtle particle grid background using PixiJS
(function () {
    const container = document.getElementById('pixi-container');
    if (!container || typeof PIXI === 'undefined') return;

    const PARTICLE_COLOR = 0xC2B9B6;
    const LINE_COLOR = 0xC2B9B6;
    const PARTICLE_RADIUS = 1.5;
    const GRID_SPACING = 80;
    const DRIFT_SPEED = 0.15;
    const DRIFT_RANGE = 12;
    const LINE_DISTANCE = 100;
    const LINE_ALPHA = 0.12;

    const app = new PIXI.Application({
        resizeTo: container,
        backgroundAlpha: 0,
        antialias: true,
        resolution: window.devicePixelRatio || 1,
        autoDensity: true,
    });
    container.appendChild(app.view);

    const particles = [];
    const lines = new PIXI.Graphics();
    app.stage.addChild(lines);

    function createGrid() {
        // Remove old particles
        for (const p of particles) {
            app.stage.removeChild(p.sprite);
        }
        particles.length = 0;

        const cols = Math.ceil(app.screen.width / GRID_SPACING) + 2;
        const rows = Math.ceil(app.screen.height / GRID_SPACING) + 2;

        // Shared circle texture
        const gfx = new PIXI.Graphics();
        gfx.beginFill(PARTICLE_COLOR);
        gfx.drawCircle(0, 0, PARTICLE_RADIUS);
        gfx.endFill();
        const texture = app.renderer.generateTexture(gfx);
        gfx.destroy();

        for (let r = 0; r < rows; r++) {
            for (let c = 0; c < cols; c++) {
                const originX = c * GRID_SPACING;
                const originY = r * GRID_SPACING;

                const sprite = new PIXI.Sprite(texture);
                sprite.anchor.set(0.5);
                sprite.x = originX;
                sprite.y = originY;
                sprite.alpha = 0.6;
                app.stage.addChild(sprite);

                particles.push({
                    sprite,
                    originX,
                    originY,
                    phaseX: Math.random() * Math.PI * 2,
                    phaseY: Math.random() * Math.PI * 2,
                    speedX: (0.7 + Math.random() * 0.6) * DRIFT_SPEED,
                    speedY: (0.7 + Math.random() * 0.6) * DRIFT_SPEED,
                });
            }
        }
    }

    createGrid();

    // Animate drift + connection lines
    app.ticker.add((delta) => {
        const t = performance.now() / 1000;

        for (const p of particles) {
            p.sprite.x = p.originX + Math.sin(t * p.speedX + p.phaseX) * DRIFT_RANGE;
            p.sprite.y = p.originY + Math.cos(t * p.speedY + p.phaseY) * DRIFT_RANGE;
        }

        // Draw faint lines between nearby particles
        lines.clear();
        lines.lineStyle(0.5, LINE_COLOR, LINE_ALPHA);

        const len = particles.length;
        for (let i = 0; i < len; i++) {
            const a = particles[i].sprite;
            for (let j = i + 1; j < len; j++) {
                const b = particles[j].sprite;
                const dx = a.x - b.x;
                const dy = a.y - b.y;
                const dist = dx * dx + dy * dy;
                if (dist < LINE_DISTANCE * LINE_DISTANCE) {
                    lines.moveTo(a.x, a.y);
                    lines.lineTo(b.x, b.y);
                }
            }
        }
    });

    // Rebuild grid on resize
    let resizeTimer;
    window.addEventListener('resize', () => {
        clearTimeout(resizeTimer);
        resizeTimer = setTimeout(createGrid, 200);
    });
})();
