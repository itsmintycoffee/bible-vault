// Mouse-reactive particle dot grid background
(function () {
    const container = document.getElementById('pixi-container');
    if (!container) return;

    // Dot color: darker for more contrast against #E9E5E3 background
    const dotColor = 'rgb(170, 160, 155)',
          dotSize = 1.5;

    const thickness = Math.pow(150, 2),
          spacing = 15,
          margin = 15,
          drag = 0.5,
          ease = 0.2;

    let canvas, ctx, list, w, h, tog;
    let mx = 0, my = 0;

    const particle = { vx: 0, vy: 0, x: 0, y: 0, ox: 0, oy: 0, alpha: 1 };

    function init() {
        canvas = document.createElement('canvas');
        ctx = canvas.getContext('2d');
        tog = true;
        list = [];

        const cw = container.clientWidth || window.innerWidth;
        const ch = container.clientHeight || window.innerHeight;
        const cols = Math.ceil((cw - margin * 2) / spacing);
        const rows = Math.ceil((ch - margin * 2) / spacing);
        const nbOfParticles = rows * cols;

        w = canvas.width = cols * spacing + margin * 2;
        h = canvas.height = rows * spacing + margin * 2;

        for (let i = 0; i < nbOfParticles; i++) {
            const p = Object.create(particle);
            p.x = p.ox = margin + spacing * (i % cols);
            p.y = p.oy = margin + spacing * Math.floor(i / cols);
            p.alpha = 0.1 + Math.random() * 0.9;
            list[i] = p;
        }

        container.innerHTML = '';
        container.appendChild(canvas);
    }

    function step() {
        let i, p, d, f, t, dx, dy;

        if (tog = !tog) {
            for (i = 0; i < list.length; i++) {
                p = list[i];

                d = (dx = mx - p.x) * dx + (dy = my - p.y) * dy;
                f = -thickness / d;

                if (d < thickness) {
                    t = Math.atan2(dy, dx);
                    p.vx += f * Math.cos(t);
                    p.vy += f * Math.sin(t);
                }

                p.x += (p.vx *= drag) + (p.ox - p.x) * ease;
                p.y += (p.vy *= drag) + (p.oy - p.y) * ease;
            }
        } else {
            ctx.clearRect(0, 0, w, h);
            ctx.fillStyle = dotColor;
            for (i = 0; i < list.length; i++) {
                p = list[i];
                ctx.globalAlpha = p.alpha;
                ctx.fillRect(p.x - 0.75, p.y - 0.75, dotSize, dotSize);
            }
            ctx.globalAlpha = 1;
        }

        requestAnimationFrame(step);
    }

    document.addEventListener('mousemove', function (e) {
        mx = e.clientX;
        my = e.clientY;
    });

    document.addEventListener('mouseleave', function () {
        mx = 0;
        my = 0;
    });

    // Defer init until DOM is laid out so container has dimensions
    function start() { init(); step(); }
    if (document.readyState === 'complete') {
        start();
    } else {
        window.addEventListener('load', start);
    }

    // Rebuild on resize
    let resizeTimer;
    window.addEventListener('resize', function () {
        clearTimeout(resizeTimer);
        resizeTimer = setTimeout(init, 200);
    });
})();
