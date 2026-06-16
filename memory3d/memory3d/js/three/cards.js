(function() {
    "use strict";

    var common = window.Memory3DCommon || {};

    function localShuffle(list) {
        for (var i = list.length - 1; i > 0; i--) {
            var j = Math.floor(Math.random() * (i + 1));
            var tmp = list[i];
            list[i] = list[j];
            list[j] = tmp;
        }
    }

    var shuffle = (typeof common.shuffle === "function") ? common.shuffle : localShuffle;

    function wrapText(ctx, text, x, y, maxWidth, lineHeight) {
        var words = String(text || "").split(" ");
        var line = "";
        var lines = 0;
        for (var n = 0; n < words.length; n++) {
            var testLine = line + words[n] + " ";
            var metrics = ctx.measureText(testLine);
            if (metrics.width > maxWidth && n > 0) {
                ctx.fillText(line, x, y);
                line = words[n] + " ";
                y += lineHeight;
                lines++;
            } else {
                line = testLine;
            }
        }
        ctx.fillText(line, x, y);
        return lines + 1;
    }

    function createCardTexture(text, isQuestion) {
        var canvas = document.createElement("canvas");
        canvas.width = 1024;
        canvas.height = 512;
        var ctx = canvas.getContext("2d");

        var accent = isQuestion ? "#9f8cff" : "#6ff0d4";
        var accentSoft = isQuestion ? "rgba(159,140,255,0.26)" : "rgba(111,240,212,0.24)";
        var labelColor = isQuestion ? "rgba(240,232,255,0.96)" : "rgba(224,255,246,0.95)";

        var g = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
        if (isQuestion) {
            g.addColorStop(0, "#34275f");
            g.addColorStop(0.52, "#1f3f8e");
            g.addColorStop(1, "#121d4d");
        } else {
            g.addColorStop(0, "#1f4f57");
            g.addColorStop(0.55, "#197f8f");
            g.addColorStop(1, "#0f3f55");
        }
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // Iluminacion radial para dar volumen de "tarjeta premium".
        var glow = ctx.createRadialGradient(canvas.width * 0.22, canvas.height * 0.16, 10, canvas.width * 0.22, canvas.height * 0.16, canvas.width * 0.8);
        glow.addColorStop(0, "rgba(255,255,255,0.22)");
        glow.addColorStop(0.45, "rgba(255,255,255,0.08)");
        glow.addColorStop(1, "rgba(255,255,255,0)");
        ctx.fillStyle = glow;
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // Patrón suave decorativo.
        ctx.fillStyle = accentSoft;
        for (var i = 0; i < 14; i++) {
            ctx.beginPath();
            ctx.arc(
                Math.random() * canvas.width,
                Math.random() * canvas.height,
                Math.random() * 16 + 8,
                0,
                Math.PI * 2
            );
            ctx.fill();
        }

        // Borde interno.
        ctx.strokeStyle = "rgba(255,255,255,0.24)";
        ctx.lineWidth = 4;
        ctx.strokeRect(18, 18, canvas.width - 36, canvas.height - 36);

        // Franja superior.
        ctx.fillStyle = "rgba(7,10,22,0.22)";
        ctx.fillRect(0, 0, canvas.width, 92);

        ctx.fillStyle = labelColor;
        ctx.font = "700 29px 'Trebuchet MS', 'Verdana', sans-serif";
        ctx.fillText(isQuestion ? "PREGUNTA" : "RESPUESTA", 42, 59);

        // Acento de color junto al label.
        ctx.fillStyle = accent;
        ctx.fillRect(42, 70, 180, 6);

        ctx.fillStyle = "rgba(255,255,255,0.98)";
        ctx.font = "800 56px 'Trebuchet MS', 'Verdana', sans-serif";
        wrapText(ctx, text, 58, 178, canvas.width - 120, 66);

        // Brillo diagonal muy sutil.
        var sheen = ctx.createLinearGradient(0, 0, canvas.width * 0.65, canvas.height);
        sheen.addColorStop(0, "rgba(255,255,255,0.18)");
        sheen.addColorStop(0.35, "rgba(255,255,255,0.03)");
        sheen.addColorStop(1, "rgba(255,255,255,0)");
        ctx.fillStyle = sheen;
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(canvas.width * 0.52, 0);
        ctx.lineTo(canvas.width * 0.14, canvas.height);
        ctx.lineTo(0, canvas.height);
        ctx.closePath();
        ctx.fill();

        var texture = new THREE.CanvasTexture(canvas);
        texture.minFilter = THREE.LinearMipmapLinearFilter;
        texture.magFilter = THREE.LinearFilter;
        texture.needsUpdate = true;
        return texture;
    }

    function createBackTexture(isQuestion) {
        var canvas = document.createElement("canvas");
        canvas.width = 1024;
        canvas.height = 512;
        var ctx = canvas.getContext("2d");
        var g = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
        if (isQuestion) {
            g.addColorStop(0, "#2d265f");
            g.addColorStop(0.5, "#2d3f92");
            g.addColorStop(1, "#1e2253");
        } else {
            g.addColorStop(0, "#1d4d56");
            g.addColorStop(0.5, "#1f6f87");
            g.addColorStop(1, "#18445b");
        }
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        ctx.lineWidth = 7;
        for (var i = 0; i < 13; i++) {
            if (isQuestion) {
                ctx.strokeStyle = (i % 2 === 0) ? "rgba(177, 160, 255, 0.28)" : "rgba(135, 174, 255, 0.2)";
            } else {
                ctx.strokeStyle = (i % 2 === 0) ? "rgba(126, 241, 220, 0.28)" : "rgba(136, 217, 255, 0.2)";
            }
            ctx.beginPath();
            ctx.arc(canvas.width / 2, canvas.height / 2, 30 + i * 29, 0, Math.PI * 2);
            ctx.stroke();
        }

        ctx.strokeStyle = "rgba(255,255,255,0.24)";
        ctx.lineWidth = 4;
        ctx.strokeRect(18, 18, canvas.width - 36, canvas.height - 36);

        ctx.fillStyle = "rgba(236, 245, 255, 0.95)";
        ctx.font = "700 64px 'Trebuchet MS', 'Verdana', sans-serif";
        ctx.textAlign = "center";
        ctx.fillText(isQuestion ? "Preguntas" : "Respuestas", canvas.width / 2, canvas.height / 2 + 18);

        var texture = new THREE.CanvasTexture(canvas);
        texture.minFilter = THREE.LinearMipmapLinearFilter;
        texture.magFilter = THREE.LinearFilter;
        texture.needsUpdate = true;
        return texture;
    }

    function buildDeck(pairs) {
        var deck = [];
        pairs.forEach(function(pair, index) {
            deck.push({ pairIndex: index, kind: "question", text: pair.question || "" });
            deck.push({ pairIndex: index, kind: "answer", text: pair.answer || "" });
        });
        shuffle(deck);
        return deck;
    }

    window.Memory3DCards = {
        buildDeck: buildDeck,
        createCardTexture: createCardTexture,
        createBackTexture: createBackTexture
    };
})();
