// Mouse-reactive particle dot grid background
(function () {
    const container = document.getElementById('pixi-container');
    if (!container) return;

    // Dot color: #C2B9B6 → RGB(194, 185, 182)
    const colorR = 194,
          colorG = 185,
          colorB = 182;

    const thickness = Math.pow(80, 2),
          spacing = 15,
          margin = 15,
          drag = 0.5,
          ease = 0.3;

    let canvas, ctx, list, w, h, tog;
    let mx = 0, my = 0;

    const particle = { vx: 0, vy: 0, x: 0, y: 0, ox: 0, oy: 0 };

    function init() {
        canvas = document.createElement('canvas');
        ctx = canvas.getContext('2d');
        tog = true;
        list = [];

        const cols = Math.ceil((container.clientWidth - margin * 2) / spacing);
        const rows = Math.ceil((container.clientHeight - margin * 2) / spacing);
        const nbOfParticles = rows * cols;

        w = canvas.width = cols * spacing + margin * 2;
        h = canvas.height = rows * spacing + margin * 2;

        for (let i = 0; i < nbOfParticles; i++) {
            const p = Object.create(particle);
            p.x = p.ox = margin + spacing * (i % cols);
            p.y = p.oy = margin + spacing * Math.floor(i / cols);
            list[i] = p;
        }

        container.innerHTML = '';
        container.appendChild(canvas);
    }

    function step() {
        let i, p, d, f, t, n, dx, dy;

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
            const a = ctx.createImageData(w, h);
            const b = a.data;

            for (i = 0; i < list.length; i++) {
                p = list[i];
                n = (~~p.x + (~~p.y * w)) * 4;
                b[n]     = colorR;
                b[n + 1] = colorG;
                b[n + 2] = colorB;
                b[n + 3] = 255;
            }

            ctx.putImageData(a, 0, 0);
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

    init();
    step();

    // Rebuild on resize
    let resizeTimer;
    window.addEventListener('resize', function () {
        clearTimeout(resizeTimer);
        resizeTimer = setTimeout(init, 200);
    });
})();
