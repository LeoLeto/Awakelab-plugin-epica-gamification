(function() {
    "use strict";

    function flattenCandidateItems(source) {
        if (!Array.isArray(source)) {
            return [];
        }
        var out = [];
        var queue = source.slice(0);
        while (queue.length) {
            var current = queue.shift();
            if (!current) {
                continue;
            }
            if (Array.isArray(current)) {
                for (var a = 0; a < current.length; a++) {
                    queue.push(current[a]);
                }
                continue;
            }
            if (typeof current === "object") {
                if (Array.isArray(current.items)) {
                    for (var i = 0; i < current.items.length; i++) {
                        queue.push(current.items[i]);
                    }
                    continue;
                }
                if (Array.isArray(current.pairs)) {
                    for (var p = 0; p < current.pairs.length; p++) {
                        queue.push(current.pairs[p]);
                    }
                    continue;
                }
                out.push(current);
            }
        }
        return out;
    }

    function normalizeSentenceWithBlank(text) {
        var sentence = String(text || "").trim();
        if (!sentence) {
            return "";
        }
        sentence = sentence.replace("{{blank}}", "_____");
        sentence = sentence.replace(/_{3,}/g, "_____");
        if (sentence.indexOf("_____") >= 0) {
            return sentence;
        }
        return sentence + " _____";
    }

    function buildItems(rawList) {
        var flat = flattenCandidateItems(rawList);
        var list = [];
        for (var i = 0; i < flat.length; i++) {
            var raw = flat[i] || {};
            var sentence = normalizeSentenceWithBlank(raw.sentence || raw.question || raw.text || "");
            var answer = String(raw.answer || "").trim();
            if (!sentence || !answer) {
                continue;
            }
            list.push({
                pairIndex: i,
                sentence: sentence,
                answer: answer
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

    function createWordTileTexture(text) {
        var canvas = document.createElement("canvas");
        canvas.width = 1200;
        canvas.height = 420;
        var ctx = canvas.getContext("2d");

        var g = ctx.createLinearGradient(0, 0, 1200, 420);
        g.addColorStop(0, "rgba(52,93,150,0.98)");
        g.addColorStop(1, "rgba(31,61,104,0.98)");

        roundedRect(ctx, 16, 22, 1168, 376, 64);
        ctx.fillStyle = g;
        ctx.fill();
        ctx.lineWidth = 10;
        ctx.strokeStyle = "rgba(214,245,255,0.98)";
        ctx.stroke();

        var value = String(text || "").trim();
        var size = 118;
        ctx.fillStyle = "rgba(247,253,255,1)";
        ctx.textAlign = "center";
        ctx.textBaseline = "alphabetic";
        ctx.font = "800 " + size + "px 'Trebuchet MS', 'Verdana', sans-serif";
        ctx.strokeStyle = "rgba(20,42,76,0.85)";
        ctx.lineWidth = Math.max(3, Math.floor(size * 0.1));

        var maxWidth = 1040;
        var words = value.split(/\s+/);
        var lines = [value];
        var fullWidth = ctx.measureText(value).width;
        var shouldSplit = words.length > 1 && (fullWidth > maxWidth * 0.86 || value.length >= 12);
        if (shouldSplit) {
            var bestA = value;
            var bestB = "";
            var bestDiff = Infinity;
            for (var i = 1; i < words.length; i++) {
                var a = words.slice(0, i).join(" ");
                var b = words.slice(i).join(" ");
                var wa = ctx.measureText(a).width;
                var wb = ctx.measureText(b).width;
                var maxLine = Math.max(wa, wb);
                if (maxLine > maxWidth) {
                    continue;
                }
                var diff = Math.abs(wa - wb);
                if (diff < bestDiff) {
                    bestDiff = diff;
                    bestA = a;
                    bestB = b;
                }
            }
            if (bestB) {
                lines = [bestA, bestB];
            }
        }

        size = lines.length === 1 ? 118 : 92;
        var minSize = lines.length === 1 ? 72 : 62;
        while (size > minSize) {
            ctx.font = "800 " + size + "px 'Trebuchet MS', 'Verdana', sans-serif";
            var tooWide = false;
            for (var l = 0; l < lines.length; l++) {
                if (ctx.measureText(lines[l]).width > maxWidth) {
                    tooWide = true;
                    break;
                }
            }
            if (!tooWide) {
                break;
            }
            size -= 4;
        }

        ctx.font = "800 " + size + "px 'Trebuchet MS', 'Verdana', sans-serif";
        ctx.lineWidth = Math.max(3, Math.floor(size * 0.1));
        if (lines.length === 1) {
            ctx.strokeText(lines[0], 600, 228);
            ctx.fillText(lines[0], 600, 228);
        } else {
            var lineGap = Math.max(10, Math.floor(size * 0.2));
            var y1 = 206 - lineGap * 0.5;
            var y2 = y1 + size + lineGap;
            ctx.strokeText(lines[0], 600, y1);
            ctx.fillText(lines[0], 600, y1);
            ctx.strokeText(lines[1], 600, y2);
            ctx.fillText(lines[1], 600, y2);
        }

        var texture = new THREE.CanvasTexture(canvas);
        texture.minFilter = THREE.LinearMipmapLinearFilter;
        texture.magFilter = THREE.LinearFilter;
        texture.needsUpdate = true;
        return texture;
    }

    function createBlankTexture(label, state, widthPx) {
        var canvas = document.createElement("canvas");
        canvas.width = Math.max(420, Math.min(980, Math.floor(widthPx || 620)));
        canvas.height = 220;
        var ctx = canvas.getContext("2d");

        var border = "rgba(174,213,255,0.8)";
        var bg = "rgba(18,38,72,0.54)";
        if (state === "hover") {
            border = "rgba(255,213,128,0.98)";
            bg = "rgba(60,66,110,0.9)";
        } else if (state === "filled") {
            border = "rgba(114,246,184,0.98)";
            bg = "rgba(21,87,69,0.95)";
        }

        roundedRect(ctx, 12, 16, canvas.width - 24, 188, 32);
        ctx.fillStyle = bg;
        ctx.fill();
        ctx.lineWidth = 7;
        ctx.strokeStyle = border;
        ctx.stroke();

        if (label) {
            var size = Math.max(40, Math.min(82, Math.floor((canvas.width - 80) / Math.max(5, String(label).length) * 1.6)));
            ctx.fillStyle = "rgba(236,247,255,0.99)";
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            ctx.font = "800 " + size + "px 'Trebuchet MS', 'Verdana', sans-serif";
            ctx.fillText(label, canvas.width * 0.5, 112);
        }

        var texture = new THREE.CanvasTexture(canvas);
        texture.minFilter = THREE.LinearMipmapLinearFilter;
        texture.magFilter = THREE.LinearFilter;
        texture.needsUpdate = true;
        return texture;
    }

    function createQuestionCardTextureWithBlank(sentence, filledWord) {
        var canvas = document.createElement("canvas");
        canvas.width = 1024;
        canvas.height = 512;
        var ctx = canvas.getContext("2d");

        var g = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
        g.addColorStop(0, "#34275f");
        g.addColorStop(0.52, "#1f3f8e");
        g.addColorStop(1, "#121d4d");
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        var glow = ctx.createRadialGradient(canvas.width * 0.22, canvas.height * 0.16, 10, canvas.width * 0.22, canvas.height * 0.16, canvas.width * 0.8);
        glow.addColorStop(0, "rgba(255,255,255,0.22)");
        glow.addColorStop(0.45, "rgba(255,255,255,0.08)");
        glow.addColorStop(1, "rgba(255,255,255,0)");
        ctx.fillStyle = glow;
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        ctx.strokeStyle = "rgba(255,255,255,0.24)";
        ctx.lineWidth = 4;
        ctx.strokeRect(18, 18, canvas.width - 36, canvas.height - 36);

        ctx.fillStyle = "rgba(7,10,22,0.22)";
        ctx.fillRect(0, 0, canvas.width, 92);

        ctx.fillStyle = "rgba(240,232,255,0.96)";
        ctx.font = "700 29px 'Trebuchet MS', 'Verdana', sans-serif";
        ctx.fillText("PREGUNTA", 42, 59);

        ctx.fillStyle = "#9f8cff";
        ctx.fillRect(42, 70, 180, 6);

        var hasFilledWord = !!String(filledWord || "").trim();
        var replacementWord = String(filledWord || "").trim();
        var blankMarker = "__M3D_BLANK__";
        var textForLayout = hasFilledWord
            ? String(sentence || "").replace("_____", blankMarker)
            : String(sentence || "");
        var tokens = textForLayout.trim().split(/\s+/);
        var lineHeight = 66;
        var startY = 186;
        var xStart = 56;
        var maxWidth = canvas.width - 112;

        ctx.fillStyle = "rgba(245,250,255,0.98)";
        ctx.font = "800 62px 'Trebuchet MS', 'Verdana', sans-serif";
        ctx.textBaseline = "alphabetic";

        var lines = [];
        var current = [];
        var currentWidth = 0;
        var spaceWidth = ctx.measureText(" ").width;
        var i;

        for (i = 0; i < tokens.length; i++) {
            var tk = tokens[i];
            var tkWidth = ctx.measureText(tk).width;
            var nextWidth = current.length ? (currentWidth + spaceWidth + tkWidth) : tkWidth;
            if (current.length && nextWidth > maxWidth) {
                lines.push(current);
                current = [tk];
                currentWidth = tkWidth;
            } else {
                current.push(tk);
                currentWidth = nextWidth;
            }
        }
        if (current.length) {
            lines.push(current);
        }

        var blankRect = null;
        for (var li = 0; li < lines.length; li++) {
            var y = startY + li * lineHeight;
            var x = xStart;
            var row = lines[li];
            for (i = 0; i < row.length; i++) {
                var token = row[i];
                var width = ctx.measureText(token).width;
                var hasMarker = hasFilledWord && token.indexOf(blankMarker) >= 0;
                var hasRawBlank = token.indexOf("_____") >= 0;

                if (hasMarker || hasRawBlank) {
                    var markerText = hasMarker ? blankMarker : "_____";
                    var markerIndex = token.indexOf(markerText);
                    var prefix = markerIndex > 0 ? token.slice(0, markerIndex) : "";
                    var suffix = token.slice(markerIndex + markerText.length);
                    var prefixWidth = prefix ? ctx.measureText(prefix).width : 0;
                    var suffixWidth = suffix ? ctx.measureText(suffix).width : 0;

                    if (prefix) {
                        ctx.fillStyle = "rgba(245,250,255,0.98)";
                        ctx.fillText(prefix, x, y);
                        x += prefixWidth;
                    }

                    var blankH = 56;
                    if (hasMarker) {
                        var filledWidth = ctx.measureText(replacementWord).width;
                        ctx.save();
                        ctx.fillStyle = "rgba(116,255,156,1)";
                        ctx.shadowColor = "rgba(38,130,73,0.85)";
                        ctx.shadowBlur = 4;
                        ctx.fillText(replacementWord, x, y);
                        ctx.shadowBlur = 0;
                        ctx.strokeStyle = "rgba(30,124,70,0.95)";
                        ctx.lineWidth = 3;
                        ctx.beginPath();
                        ctx.moveTo(x - 4, y + 6);
                        ctx.lineTo(x + filledWidth + 4, y + 6);
                        ctx.stroke();
                        ctx.restore();
                        x += filledWidth;
                    } else {
                        var blankW = Math.max(150, ctx.measureText("_____").width + 26);
                        roundedRect(ctx, x - 10, y - blankH + 10, blankW, blankH, 12);
                        ctx.fillStyle = "rgba(19,36,72,0.85)";
                        ctx.fill();
                        ctx.lineWidth = 4;
                        ctx.strokeStyle = "rgba(182,216,255,0.92)";
                        ctx.stroke();
                        ctx.fillStyle = "rgba(245,250,255,0.98)";
                        ctx.fillText("_____", x, y);
                        blankRect = {
                            x: x - 10,
                            y: y - blankH + 10,
                            width: blankW,
                            height: blankH
                        };
                        x += blankW;
                    }

                    if (suffix) {
                        ctx.fillStyle = "rgba(245,250,255,0.98)";
                        ctx.fillText(suffix, x, y);
                        x += suffixWidth;
                    }
                } else {
                    ctx.fillStyle = "rgba(245,250,255,0.98)";
                    ctx.fillText(token, x, y);
                    x += width;
                }

                if (i < row.length - 1) {
                    x += spaceWidth;
                }
            }
        }

        if (!blankRect) {
            blankRect = {
                x: canvas.width * 0.56,
                y: canvas.height * 0.62,
                width: 180,
                height: 56
            };
        }

        var texture = new THREE.CanvasTexture(canvas);
        texture.minFilter = THREE.LinearMipmapLinearFilter;
        texture.magFilter = THREE.LinearFilter;
        texture.needsUpdate = true;

        return {
            texture: texture,
            blank: blankRect,
            canvasWidth: canvas.width,
            canvasHeight: canvas.height
        };
    }

    function getWordTileWidth(text) {
        var len = String(text || "").length;
        return Math.max(2.0, Math.min(4.8, 1.55 + len * 0.11));
    }

    function getReviewGridConfig(count, cardWidth, cardHeight) {
        var safe = Math.max(1, Math.min(15, count || 1));
        var cols = 1;
        if (safe === 2) {
            cols = 2;
        } else if (safe <= 4) {
            cols = 2;
        } else if (safe <= 6) {
            cols = 3;
        } else if (safe <= 9) {
            cols = 3;
        } else if (safe <= 12) {
            cols = 4;
        } else {
            cols = 5;
        }

        var rows = Math.ceil(safe / cols);
        var density = (safe - 1) / 14;
        var scale = 0.9 - density * 0.32;
        scale = Math.max(0.56, Math.min(0.9, scale));
        var xGap = cardWidth * scale + 0.42;
        var zGap = cardHeight * scale + 0.34;

        return {
            cols: cols,
            rows: rows,
            scale: scale,
            xGap: xGap,
            zGap: zGap
        };
    }

    window.Memory3DDragfillHelpers = {
        buildItems: buildItems,
        createWordTileTexture: createWordTileTexture,
        createBlankTexture: createBlankTexture,
        createQuestionCardTextureWithBlank: createQuestionCardTextureWithBlank,
        getWordTileWidth: getWordTileWidth,
        getReviewGridConfig: getReviewGridConfig
    };
})();
