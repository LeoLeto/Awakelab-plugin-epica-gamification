(function() {
    "use strict";

    function shuffle(list) {
        for (var i = list.length - 1; i > 0; i--) {
            var j = Math.floor(Math.random() * (i + 1));
            var tmp = list[i];
            list[i] = list[j];
            list[j] = tmp;
        }
    }

    function createCustomCursor(container) {
        if (!window.matchMedia || !window.matchMedia("(pointer:fine)").matches) {
            return null;
        }

        var previous = container.querySelector(".memory3d-custom-cursor");
        if (previous) {
            previous.remove();
        }

        var cursor = document.createElement("div");
        cursor.className = "memory3d-custom-cursor";
        container.appendChild(cursor);
        container.classList.add("memory3d-use-custom-cursor");

        function moveCursor(event) {
            var rect = container.getBoundingClientRect();
            cursor.style.left = (event.clientX - rect.left) + "px";
            cursor.style.top = (event.clientY - rect.top) + "px";
        }

        function showCursor() {
            cursor.classList.add("is-visible");
        }

        function hideCursor() {
            cursor.classList.remove("is-visible");
            cursor.classList.remove("is-down");
        }

        function downCursor() {
            cursor.classList.add("is-down");
        }

        function upCursor() {
            cursor.classList.remove("is-down");
        }

        container.addEventListener("mousemove", moveCursor);
        container.addEventListener("mouseenter", showCursor);
        container.addEventListener("mouseleave", hideCursor);
        container.addEventListener("mousedown", downCursor);
        window.addEventListener("mouseup", upCursor);

        return { cursor: cursor };
    }

    function createHud(container, options) {
        var opts = options || {};
        var scoreNode = opts.scoreNode || null;
        var confirmButton = opts.confirmButton || null;
        var messageNode = opts.messageNode || null;
        var leftTag = opts.leftTag || "Respuestas";
        var rightTag = opts.rightTag || "Preguntas";
        var confirmText = opts.confirmText || "Confirmar pareja";
        var showCancelButton = !!opts.showCancelButton;
        var hideConfirmButton = !!opts.hideConfirmButton;

        var oldUi = document.getElementById("memory3d-ui");
        if (oldUi) {
            oldUi.remove();
        }

        var hud = document.createElement("div");
        hud.className = "memory3d-hud";

        var sideTags = document.createElement("div");
        sideTags.className = "memory3d-side-tags";
        sideTags.innerHTML =
            '<span class="memory3d-tag memory3d-tag-a">' + leftTag + "</span>" +
            '<span class="memory3d-tag memory3d-tag-q">' + rightTag + "</span>";
        hud.appendChild(sideTags);

        var topRow = document.createElement("div");
        topRow.className = "memory3d-hud-row";
        hud.appendChild(topRow);

        if (scoreNode) {
            scoreNode.className = "memory3d-score-pill";
            topRow.appendChild(scoreNode);
        }

        if (confirmButton) {
            if (hideConfirmButton) {
                confirmButton.style.display = "none";
                confirmButton.disabled = true;
            } else {
                confirmButton.className = "memory3d-button memory3d-button-primary";
                confirmButton.textContent = confirmText;
                topRow.appendChild(confirmButton);
            }
        }

        var cancelButton = null;
        if (showCancelButton) {
            cancelButton = document.createElement("button");
            cancelButton.type = "button";
            cancelButton.className = "memory3d-button memory3d-button-cancel";
            cancelButton.textContent = "Cancelar";
            topRow.appendChild(cancelButton);
        }

        var fullscreenButton = document.createElement("button");
        fullscreenButton.type = "button";
        fullscreenButton.className = "memory3d-button memory3d-button-ghost";
        fullscreenButton.textContent = "Pantalla grande";
        topRow.appendChild(fullscreenButton);

        if (messageNode) {
            messageNode.className = "memory3d-message-pill memory3d-message-top-center";
            hud.appendChild(messageNode);
        }

        container.appendChild(hud);

        function updateFullscreenLabel() {
            fullscreenButton.textContent = document.fullscreenElement ? "Salir pantalla grande" : "Pantalla grande";
        }

        fullscreenButton.addEventListener("click", function() {
            if (!document.fullscreenElement) {
                if (container.requestFullscreen) {
                    container.requestFullscreen().catch(function() {});
                }
            } else if (document.exitFullscreen) {
                document.exitFullscreen().catch(function() {});
            }
        });

        document.addEventListener("fullscreenchange", updateFullscreenLabel);
        updateFullscreenLabel();

        return { cancelButton: cancelButton };
    }

    function createPerformanceMonitor(container, renderer, options) {
        var opts = options || {};
        var enabled = !!opts.enabled;
        if (!enabled || !container || !renderer) {
            return {
                sample: function() {},
                destroy: function() {}
            };
        }

        var panel = document.createElement("div");
        panel.className = "memory3d-perf-panel";
        panel.style.position = "absolute";
        panel.style.right = "14px";
        panel.style.bottom = "14px";
        panel.style.zIndex = "22";
        panel.style.padding = "8px 10px";
        panel.style.borderRadius = "10px";
        panel.style.background = "rgba(8,14,34,0.78)";
        panel.style.border = "1px solid rgba(152,192,255,0.38)";
        panel.style.color = "#dff3ff";
        panel.style.font = "600 12px 'Trebuchet MS','Verdana',sans-serif";
        panel.style.lineHeight = "1.35";
        panel.style.whiteSpace = "pre-line";
        panel.style.pointerEvents = "none";
        panel.textContent = "Perf: iniciando...";
        container.appendChild(panel);

        var accumFrames = 0;
        var accumMs = 0;
        var lastSampleAt = 0;
        var lastFrameAt = 0;

        function safeMemoryMB() {
            if (window.performance && window.performance.memory && window.performance.memory.usedJSHeapSize) {
                return (window.performance.memory.usedJSHeapSize / (1024 * 1024)).toFixed(1);
            }
            return "n/a";
        }

        function sample(nowMs) {
            var now = Number(nowMs || 0);
            if (!now) {
                return;
            }
            if (!lastFrameAt) {
                lastFrameAt = now;
                lastSampleAt = now;
                return;
            }

            var dt = Math.max(0, now - lastFrameAt);
            lastFrameAt = now;
            accumFrames++;
            accumMs += dt;

            if (now - lastSampleAt < 500) {
                return;
            }

            var avgMs = accumFrames ? (accumMs / accumFrames) : 0;
            var fps = avgMs > 0 ? (1000 / avgMs) : 0;
            var info = renderer.info && renderer.info.render ? renderer.info.render : {};
            var mem = renderer.info && renderer.info.memory ? renderer.info.memory : {};

            panel.textContent =
                "FPS: " + fps.toFixed(1) +
                " | ms: " + avgMs.toFixed(1) + "\n" +
                "draws: " + (info.calls || 0) +
                " tris: " + (info.triangles || 0) + "\n" +
                "geo: " + (mem.geometries || 0) +
                " tex: " + (mem.textures || 0) +
                " heapMB: " + safeMemoryMB();

            accumFrames = 0;
            accumMs = 0;
            lastSampleAt = now;
        }

        function destroy() {
            if (panel && panel.parentNode) {
                panel.parentNode.removeChild(panel);
            }
        }

        return {
            sample: sample,
            destroy: destroy
        };
    }

    window.Memory3DCommon = {
        shuffle: shuffle,
        createCustomCursor: createCustomCursor,
        createHud: createHud,
        createPerformanceMonitor: createPerformanceMonitor
    };
})();
