(function() {
    "use strict";

    function uniqueCategories(items) {
        var out = [];
        var seen = {};
        for (var i = 0; i < items.length; i++) {
            var key = String(items[i].category || "").trim();
            if (!key) {
                continue;
            }
            var low = key.toLowerCase();
            if (seen[low]) {
                continue;
            }
            seen[low] = true;
            out.push(key);
        }
        return out;
    }

    function normalizeClassifierItems(rawItems) {
        if (!Array.isArray(rawItems)) {
            return [];
        }
        var list = [];
        for (var i = 0; i < rawItems.length; i++) {
            var raw = rawItems[i] || {};
            var concept = String(
                raw.concept || raw.term || raw.item || raw.question || raw.q || ""
            ).trim();
            var category = String(
                raw.category || raw.group || raw.class || raw.answer || raw.a || ""
            ).trim();
            if (!concept || !category) {
                continue;
            }
            list.push({
                concept: concept,
                category: category
            });
        }
        return list;
    }

    function roundedRect(ctx, x, y, w, h, r) {
        ctx.beginPath();
        ctx.moveTo(x + r, y);
        ctx.lineTo(x + w - r, y);
        ctx.quadraticCurveTo(x + w, y, x + w, y + r);
        ctx.lineTo(x + w, y + h - r);
        ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
        ctx.lineTo(x + r, y + h);
        ctx.quadraticCurveTo(x, y + h, x, y + h - r);
        ctx.lineTo(x, y + r);
        ctx.quadraticCurveTo(x, y, x + r, y);
        ctx.closePath();
    }

    function createConceptTexture(text) {
        var canvas = document.createElement("canvas");
        canvas.width = 1024;
        canvas.height = 512;
        var ctx = canvas.getContext("2d");
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        var g = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
        g.addColorStop(0, "#2e4f79");
        g.addColorStop(1, "#1b3354");
        roundedRect(ctx, 18, 20, canvas.width - 36, canvas.height - 40, 34);
        ctx.fillStyle = g;
        ctx.fill();
        ctx.strokeStyle = "rgba(198,229,255,0.85)";
        ctx.lineWidth = 6;
        ctx.stroke();

        ctx.fillStyle = "rgba(236,248,255,0.96)";
        ctx.font = "700 36px 'Trebuchet MS', 'Verdana', sans-serif";
        ctx.fillText("CONCEPTO", 46, 72);

        ctx.fillStyle = "rgba(244,252,255,1)";
        var value = String(text || "").trim();
        var size = 116;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        while (size > 60) {
            ctx.font = "800 " + size + "px 'Trebuchet MS', 'Verdana', sans-serif";
            if (ctx.measureText(value).width <= 900) {
                break;
            }
            size -= 4;
        }
        ctx.font = "800 " + size + "px 'Trebuchet MS', 'Verdana', sans-serif";
        ctx.strokeStyle = "rgba(7,20,44,0.92)";
        ctx.lineWidth = Math.max(4, Math.floor(size * 0.1));
        ctx.shadowColor = "rgba(0, 0, 0, 0.26)";
        ctx.shadowBlur = 6;
        ctx.strokeText(value, canvas.width * 0.5, canvas.height * 0.54);
        ctx.fillText(value, canvas.width * 0.5, canvas.height * 0.54);
        ctx.shadowBlur = 0;

        var texture = new THREE.CanvasTexture(canvas);
        texture.minFilter = THREE.LinearMipmapLinearFilter;
        texture.magFilter = THREE.LinearFilter;
        texture.needsUpdate = true;
        return texture;
    }

    function createPortalTexture(label, colorA, colorB) {
        var canvas = document.createElement("canvas");
        canvas.width = 840;
        canvas.height = 320;
        var ctx = canvas.getContext("2d");
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        var g = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
        g.addColorStop(0, colorA);
        g.addColorStop(1, colorB);
        roundedRect(ctx, 18, 20, canvas.width - 36, canvas.height - 40, 44);
        ctx.fillStyle = g;
        ctx.fill();
        ctx.strokeStyle = "rgba(214,240,255,0.9)";
        ctx.lineWidth = 8;
        ctx.stroke();

        var glow = ctx.createRadialGradient(canvas.width * 0.2, canvas.height * 0.2, 10, canvas.width * 0.2, canvas.height * 0.2, canvas.width * 0.7);
        glow.addColorStop(0, "rgba(255,255,255,0.24)");
        glow.addColorStop(1, "rgba(255,255,255,0)");
        ctx.fillStyle = glow;
        roundedRect(ctx, 18, 20, canvas.width - 36, canvas.height - 40, 44);
        ctx.fill();

        ctx.fillStyle = "rgba(248,254,255,1)";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        var size = 90;
        while (size > 46) {
            ctx.font = "800 " + size + "px 'Trebuchet MS', 'Verdana', sans-serif";
            if (ctx.measureText(label).width <= 760) {
                break;
            }
            size -= 4;
        }
        ctx.font = "800 " + size + "px 'Trebuchet MS', 'Verdana', sans-serif";
        ctx.strokeStyle = "rgba(10,25,48,0.95)";
        ctx.lineWidth = Math.max(4, Math.floor(size * 0.1));
        ctx.shadowColor = "rgba(0, 0, 0, 0.28)";
        ctx.shadowBlur = 6;
        ctx.strokeText(label, canvas.width * 0.5, canvas.height * 0.53);
        ctx.fillText(label, canvas.width * 0.5, canvas.height * 0.53);
        ctx.shadowBlur = 0;

        var texture = new THREE.CanvasTexture(canvas);
        texture.minFilter = THREE.LinearMipmapLinearFilter;
        texture.magFilter = THREE.LinearFilter;
        texture.needsUpdate = true;
        return texture;
    }

    window.Memory3DClassifierHelpers = {
        mode: "classifier3d_helpers",
        normalizeClassifierItems: normalizeClassifierItems,
        uniqueCategories: uniqueCategories,
        createConceptTexture: createConceptTexture,
        createPortalTexture: createPortalTexture
    };
})();
