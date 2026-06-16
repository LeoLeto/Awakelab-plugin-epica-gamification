(function() {
    "use strict";

    function limitWords(text, maxWords) {
        var clean = String(text || "").replace(/\s+/g, " ").trim();
        if (!clean) {
            return "";
        }
        var words = clean.split(" ");
        return words.slice(0, maxWords || 10).join(" ").trim();
    }

    function normalizeIntruderItems(rawItems) {
        if (!Array.isArray(rawItems)) {
            return [];
        }

        var items = [];
        for (var i = 0; i < rawItems.length; i++) {
            var raw = rawItems[i] || {};
            var category = limitWords(raw.category || raw.topic || raw.theme || "", 10);
            var intruder = limitWords(raw.intruder || raw.odd || raw.wrong || "", 10);
            var optionsRaw = raw.options;
            if (typeof optionsRaw === "string") {
                optionsRaw = optionsRaw.split(",");
            }
            if (!Array.isArray(optionsRaw)) {
                optionsRaw = [];
            }

            var options = [];
            var seen = {};
            for (var o = 0; o < optionsRaw.length; o++) {
                var value = limitWords(optionsRaw[o], 10);
                var key = value.toLowerCase();
                if (!value || seen[key]) {
                    continue;
                }
                seen[key] = true;
                options.push(value);
            }

            if (intruder && !seen[intruder.toLowerCase()]) {
                options.push(intruder);
            }
            if (!category || !intruder || options.length < 4) {
                continue;
            }

            var intruderLower = intruder.toLowerCase();
            var idx = -1;
            for (var j = 0; j < options.length; j++) {
                if (String(options[j]).toLowerCase() === intruderLower) {
                    idx = j;
                    break;
                }
            }
            if (idx < 0) {
                continue;
            }

            items.push({
                category: category,
                options: options.slice(0, 4),
                intruder: intruder
            });
        }

        return items;
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

    function createPanelTexture(label, top, bottom, border) {
        var canvas = document.createElement("canvas");
        canvas.width = 1024;
        canvas.height = 512;
        var ctx = canvas.getContext("2d");
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        var gradient = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
        gradient.addColorStop(0, top);
        gradient.addColorStop(1, bottom);
        roundedRect(ctx, 18, 22, canvas.width - 36, canvas.height - 44, 36);
        ctx.fillStyle = gradient;
        ctx.fill();
        ctx.strokeStyle = border;
        ctx.lineWidth = 7;
        ctx.stroke();

        var gloss = ctx.createLinearGradient(0, 28, 0, 220);
        gloss.addColorStop(0, "rgba(255,255,255,0.22)");
        gloss.addColorStop(1, "rgba(255,255,255,0)");
        ctx.fillStyle = gloss;
        roundedRect(ctx, 24, 28, canvas.width - 48, 180, 28);
        ctx.fill();

        ctx.fillStyle = "rgba(236,246,255,0.96)";
        ctx.font = "700 34px 'Trebuchet MS', 'Verdana', sans-serif";
        ctx.fillText("CONCEPTO", 50, 74);

        var text = limitWords(label, 10);
        var size = 92;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        while (size > 48) {
            ctx.font = "800 " + size + "px 'Trebuchet MS', 'Verdana', sans-serif";
            if (ctx.measureText(text).width <= 900) {
                break;
            }
            size -= 4;
        }
        ctx.font = "800 " + size + "px 'Trebuchet MS', 'Verdana', sans-serif";
        ctx.strokeStyle = "rgba(10,26,52,0.9)";
        ctx.lineWidth = Math.max(4, Math.floor(size * 0.1));
        ctx.strokeText(text, canvas.width * 0.5, canvas.height * 0.58);
        ctx.fillStyle = "rgba(247,252,255,1)";
        ctx.fillText(text, canvas.width * 0.5, canvas.height * 0.58);

        var texture = new THREE.CanvasTexture(canvas);
        texture.minFilter = THREE.LinearMipmapLinearFilter;
        texture.magFilter = THREE.LinearFilter;
        texture.needsUpdate = true;
        return texture;
    }

    function createIntruderCardTexture(label, isIntruder) {
        // Todas las cartas usan el mismo color para no revelar la intrusa visualmente.
        return createPanelTexture(label, "rgba(102,161,219,0.98)", "rgba(50,95,162,0.98)", "rgba(186,224,255,0.95)");
    }

    window.Memory3DIntruderHelpers = {
        mode: "intruder3d_helpers",
        normalizeIntruderItems: normalizeIntruderItems,
        createIntruderCardTexture: createIntruderCardTexture
    };
})();
