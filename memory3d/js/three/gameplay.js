(function() {
    "use strict";

    var common = window.Memory3DCommon || {};
    var layoutApi = window.Memory3DMemoryLayout || {};

    var shuffle = common.shuffle;
    var createCustomCursor = common.createCustomCursor;
    var sharedCreateHud = common.createHud;
    var createPerformanceMonitor = common.createPerformanceMonitor;
    var computeLayoutMetrics = layoutApi.computeLayoutMetrics;
    var getLayoutPosition = layoutApi.getLayoutPosition;
    var memoryAnimApi = window.Memory3DMemoryAnimation || {};
    var stepMemoryAnimation = memoryAnimApi.step;

    function removeLegacyRingDecor(scene) {
        if (!scene || !scene.traverse) {
            return;
        }
        var toRemove = [];
        scene.traverse(function(obj) {
            if (!obj || !obj.isMesh || !obj.geometry) {
                return;
            }
            var type = String(obj.geometry.type || "");
            if (type === "CircleGeometry" || type === "RingGeometry" || type === "TorusGeometry") {
                toRemove.push(obj);
            }
        });
        for (var i = 0; i < toRemove.length; i++) {
            var node = toRemove[i];
            if (node.parent) {
                node.parent.remove(node);
            }
        }
    }

    function startGame(container, pairs, scoreNode, confirmButton, messageNode, onFinish) {
        if (!shuffle || !createCustomCursor || !sharedCreateHud || !computeLayoutMetrics || !getLayoutPosition || !stepMemoryAnimation) {
            if (messageNode) {
                messageNode.textContent = "Faltan modulos comunes del juego de memoria.";
            }
            return;
        }

        var sceneCtx = window.Memory3DScene.createSceneContext(container);
        var scene = sceneCtx.scene;
        var camera = sceneCtx.camera;
        var renderer = sceneCtx.renderer;
        removeLegacyRingDecor(scene);
        var perfEnabled = false;
        try {
            perfEnabled = /(?:\?|&)m3dperf=1(?:&|$)/.test(String(window.location && window.location.search || ""));
        } catch (e) {}
        var perfMonitor = createPerformanceMonitor
            ? createPerformanceMonitor(container, renderer, { enabled: perfEnabled })
            : { sample: function() {} };
        createCustomCursor(container);

        var hud = sharedCreateHud(container, {
            scoreNode: scoreNode,
            confirmButton: confirmButton,
            messageNode: messageNode,
            leftTag: "Respuestas",
            rightTag: "Preguntas",
            confirmText: "Confirmar pareja",
            showCancelButton: true
        });
        var cancelButton = hud.cancelButton;
        var actionRow = null;
        var hudRoot = container.querySelector(".memory3d-hud");
        if (hudRoot && (confirmButton || cancelButton)) {
            actionRow = document.createElement("div");
            actionRow.className = "memory3d-memory-action-row";
            if (cancelButton) {
                actionRow.appendChild(cancelButton);
            }
            if (confirmButton) {
                actionRow.appendChild(confirmButton);
            }
            hudRoot.appendChild(actionRow);
        }

        var questions = [];
        var answers = [];
        for (var i = 0; i < pairs.length; i++) {
            questions.push({ pairIndex: i, kind: "question", text: pairs[i].question || "" });
            answers.push({ pairIndex: i, kind: "answer", text: pairs[i].answer || "" });
        }
        shuffle(answers);

        var maxSideCount = Math.max(questions.length, answers.length);
        var density = Math.max(0, Math.min(1, (maxSideCount - 5) / 10));
        var cardWidth = 3.45 - density * 0.62;
        var cardHeight = 1.92 - density * 0.36;
        var cardDepth = 0.14 - density * 0.03;
        var questionLayout = computeLayoutMetrics(questions.length, cardWidth);
        var answerLayout = computeLayoutMetrics(answers.length, cardWidth);
        var cardGeo = new THREE.BoxGeometry(cardWidth, cardHeight, cardDepth);
        var questionBackTexture = window.Memory3DCards.createBackTexture(true);
        var answerBackTexture = window.Memory3DCards.createBackTexture(false);
        var cards = [];
        var selected = [];
        var resolving = false;
        var score = 0;
        var scoreReported = false;
        var pulseRings = [];

        function reportFinalScore() {
            if (scoreReported || typeof onFinish !== "function") {
                return;
            }
            scoreReported = true;
            var maxScore = Math.max(1, pairs.length * 120);
            onFinish(score, maxScore);
        }

        function createCard(item, index, isQuestion) {
            var layout = isQuestion ? questionLayout : answerLayout;
            var position = getLayoutPosition(index, layout, isQuestion);
            var frontTex = window.Memory3DCards.createCardTexture(item.text, isQuestion);
            var matFront = new THREE.MeshPhysicalMaterial({
                map: frontTex,
                roughness: 0.28,
                metalness: 0.06,
                clearcoat: 0.72,
                clearcoatRoughness: 0.34,
                emissive: isQuestion ? 0x271d6e : 0x234e5d,
                emissiveIntensity: 0.18
            });
            var matBack = new THREE.MeshPhysicalMaterial({
                map: isQuestion ? questionBackTexture : answerBackTexture,
                roughness: 0.31,
                metalness: 0.05,
                clearcoat: 0.66,
                clearcoatRoughness: 0.38
            });
            var edgeColor = isQuestion ? 0x4838a8 : 0x2d8a8f;
            var edgeMat = new THREE.MeshPhysicalMaterial({
                color: edgeColor,
                roughness: 0.46,
                metalness: 0.22,
                clearcoat: 0.2,
                clearcoatRoughness: 0.45
            });
            var mesh = new THREE.Mesh(cardGeo, [edgeMat, edgeMat, edgeMat, edgeMat, matFront, matBack]);
            mesh.position.set(position.x, position.y, position.z);
            mesh.rotation.x = -0.01;
            mesh.rotation.y = Math.PI;
            scene.add(mesh);

            return {
                mesh: mesh,
                pairIndex: item.pairIndex,
                kind: item.kind,
                matched: false,
                matchAnim: 0,
                flashWrong: 0,
                selected: false,
                revealed: false,
                targetYRot: Math.PI,
                homeX: position.x,
                homeY: position.y,
                homeZ: position.z,
                baseY: position.y,
                bobOffset: Math.random() * Math.PI * 2,
                centerPhase: Math.random() * Math.PI * 2
            };
        }

        for (var q = 0; q < questions.length; q++) {
            cards.push(createCard(questions[q], q, true));
        }
        for (var a = 0; a < answers.length; a++) {
            cards.push(createCard(answers[a], a, false));
        }

        var maxRows = Math.max(questionLayout.rows, answerLayout.rows);
        var maxCols = Math.max(questionLayout.cols, answerLayout.cols);
        var zGap = Math.max(questionLayout.zGap, answerLayout.zGap);
        var xGap = Math.max(questionLayout.xGap, answerLayout.xGap);
        var sideCenter = Math.max(questionLayout.sideCenter, answerLayout.sideCenter);
        var totalWidth = sideCenter * 2 + Math.max(0, maxCols - 1) * xGap + cardWidth;
        var totalDepth = Math.max(0, maxRows - 1) * zGap + cardHeight;
        var cameraLookAt = new THREE.Vector3(0, -0.5, 0);
        var cameraCurrentLook = new THREE.Vector3(0, -0.5, 0);
        var cameraDefaultPos = new THREE.Vector3();
        var cameraDefaultLook = new THREE.Vector3(0, -0.5, 0);
        var cameraFocusPos = new THREE.Vector3();
        var cameraFocusLook = new THREE.Vector3(0, 0.1, 0);
        var cameraFocusSelection = false;

        function getBoardBoundsX() {
            var minX = Infinity;
            var maxX = -Infinity;
            var half = cardWidth * 0.5;
            for (var i = 0; i < cards.length; i++) {
                minX = Math.min(minX, cards[i].homeX - half);
                maxX = Math.max(maxX, cards[i].homeX + half);
            }

            var focusHalf = cardWidth * 0.55;
            minX = Math.min(minX, -2.25 - focusHalf);
            maxX = Math.max(maxX, 2.25 + focusHalf);

            if (!isFinite(minX) || !isFinite(maxX)) {
                return { min: -6, max: 6 };
            }
            return { min: minX, max: maxX };
        }

        function refreshDefaultCameraPose() {
            var bounds = getBoardBoundsX();
            var lookX = (bounds.min + bounds.max) * 0.5;
            // Solo en Memory: mantenemos una camara mas alta (como al inicio).
            cameraDefaultPos.set(lookX, 5.6, camera.position.z);
            cameraDefaultLook.set(lookX, -0.5, 0);

            // Vista centrada "tipo 2D" mientras hay seleccion activa.
            cameraFocusPos.set(lookX, 1.2, camera.position.z);
            cameraFocusLook.set(lookX, 0.08, 0);

            if (!cameraFocusSelection) {
                camera.position.copy(cameraDefaultPos);
                cameraLookAt.copy(cameraDefaultLook);
                cameraCurrentLook.copy(cameraDefaultLook);
                camera.lookAt(cameraLookAt.x, cameraLookAt.y, cameraLookAt.z);
            }
        }

        function updateCameraSelectionState() {
            cameraFocusSelection = selected.length > 0 && !resolving;
        }

        function stepCameraTransition() {
            var targetPos = cameraFocusSelection ? cameraFocusPos : cameraDefaultPos;
            var targetLook = cameraFocusSelection ? cameraFocusLook : cameraDefaultLook;
            camera.position.lerp(targetPos, 0.14);
            cameraCurrentLook.lerp(targetLook, 0.14);
            cameraLookAt.copy(cameraCurrentLook);
            camera.lookAt(cameraLookAt.x, cameraLookAt.y, cameraLookAt.z);
        }

        function computeGameplayDistance() {
            var base = Math.max(10.8, 9.4 + maxSideCount * 0.24);
            var hFactor = Math.max(0.82, Math.min(1.1, (container.clientHeight || 900) / 980));
            var dByHeight = base * hFactor;

            var aspect = Math.max(1, container.clientWidth / Math.max(container.clientHeight, 1));
            var fovRad = (camera.fov * Math.PI) / 180;
            var tanHalfFov = Math.tan(fovRad * 0.5);
            var bounds = getBoardBoundsX();
            var boardWidth = Math.max(totalWidth, bounds.max - bounds.min + 1.4);
            var widthPadding = 1.8 + density * 1.1;
            var depthPadding = 2.2 + density * 1.1;
            var dByWidth = ((boardWidth + widthPadding) * 0.5) / Math.max(tanHalfFov * aspect, 0.0001);
            var dByDepth = ((totalDepth + depthPadding) * 0.5) / Math.max(tanHalfFov, 0.0001);
            return Math.max(dByHeight, dByWidth, dByDepth);
        }

        function fitGameplayView() {
            var distance = computeGameplayDistance();
            sceneCtx.setGameplayDistance(distance);
            refreshDefaultCameraPose();
        }

        fitGameplayView();

        var raycaster = new THREE.Raycaster();
        var mouse = new THREE.Vector2();

        function setMessage(text) {
            if (messageNode) {
                messageNode.textContent = text;
            }
        }

        function updateScore() {
            if (scoreNode) {
                scoreNode.textContent = "Puntuacion: " + score;
            }
        }

        function updateConfirmState() {
            if (!confirmButton) {
                return;
            }
            if (resolving || selected.length !== 2) {
                confirmButton.disabled = true;
                if (actionRow) {
                    actionRow.classList.toggle("is-visible", selected.length > 0);
                }
                return;
            }
            confirmButton.disabled = !(selected[0].kind !== selected[1].kind);
            if (actionRow) {
                actionRow.classList.add("is-visible");
            }
        }

        function updateCancelState() {
            if (!cancelButton) {
                return;
            }
            cancelButton.disabled = resolving || selected.length === 0;
            if (actionRow) {
                actionRow.classList.toggle("is-visible", selected.length > 0);
            }
        }

        function hideCard(card) {
            card.selected = false;
            card.revealed = false;
            card.targetYRot = Math.PI;
            updateSelectionVisual(card);
        }

        function updateSelectionVisual(card) {
            var frontMaterial = card.mesh.material[4];
            if (!frontMaterial || !frontMaterial.emissive) {
                return;
            }
            if (card.matched) {
                frontMaterial.emissiveIntensity = 0.5;
            } else if (card.selected) {
                frontMaterial.emissiveIntensity = 0.8;
            } else {
                frontMaterial.emissiveIntensity = 0.22;
            }
        }

        function createPulseAt(position, color) {
            var ring = new THREE.Mesh(
                new THREE.RingGeometry(0.7, 0.95, 36),
                new THREE.MeshBasicMaterial({
                    color: color,
                    transparent: true,
                    opacity: 0.8,
                    side: THREE.DoubleSide
                })
            );
            ring.rotation.x = -Math.PI / 2;
            ring.position.set(position.x, -2.68, position.z);
            scene.add(ring);
            pulseRings.push({ mesh: ring, life: 1 });
        }

        function getFocusSlot(card) {
            if (card.kind === "question") {
                return { x: 2.25, y: 0.95, z: 4.25 };
            }
            return { x: -2.25, y: 0.95, z: 4.25 };
        }

        function pickCard(intersects) {
            if (resolving || selected.length >= 2) {
                return false;
            }

            if (!intersects.length) {
                return false;
            }

            var card = null;
            for (var i = 0; i < cards.length; i++) {
                if (cards[i].mesh === intersects[0].object) {
                    card = cards[i];
                    break;
                }
            }
            if (!card || card.matched || card.selected || card.revealed) {
                return false;
            }
            if (selected.length === 1 && selected[0].kind === card.kind) {
                selected[0].flashWrong = 1;
                setMessage("Debes elegir 1 pregunta y 1 respuesta.");
                return false;
            }

            card.revealed = true;
            card.selected = true;
            card.targetYRot = 0;
            selected.push(card);
            updateSelectionVisual(card);

            if (selected.length === 1) {
                setMessage("Selecciona su pareja en la columna contraria.");
            } else {
                setMessage("Pulsa confirmar para validar la pareja.");
            }

            updateCameraSelectionState();
            updateConfirmState();
            updateCancelState();
            return true;
        }

        function onCanvasClick(event) {
            var rect = renderer.domElement.getBoundingClientRect();
            mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
            mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
            raycaster.setFromCamera(mouse, camera);

            var cardIntersects = raycaster.intersectObjects(cards.map(function(card) {
                return card.mesh;
            }));
            if (pickCard(cardIntersects)) {
                return;
            }

            if (sceneCtx.tryBlastAsteroid) {
                var asteroidHitPoint = sceneCtx.tryBlastAsteroid(raycaster);
                if (asteroidHitPoint) {
                    createPulseAt(asteroidHitPoint, 0xffcb79);
                    if (!resolving && selected.length === 0) {
                        setMessage("Asteroide impactado. Sigue jugando.");
                    }
                }
            }
        }

        renderer.domElement.addEventListener("click", onCanvasClick);

        if (confirmButton) {
            confirmButton.addEventListener("click", function() {
                if (resolving || selected.length !== 2 || selected[0].kind === selected[1].kind) {
                    return;
                }

                resolving = true;
                updateCameraSelectionState();
                updateConfirmState();

                var c1 = selected[0];
                var c2 = selected[1];
                var isMatch = c1.pairIndex === c2.pairIndex;

                if (isMatch) {
                    c1.matched = true;
                    c2.matched = true;
                    c1.matchAnim = 1;
                    c2.matchAnim = 1;
                    c1.selected = false;
                    c2.selected = false;
                    score += 120;
                    setMessage("Perfecto. Pareja correcta.");
                    createPulseAt(c1.mesh.position, c1.kind === "question" ? 0x57a8ff : 0x4bffaa);
                    createPulseAt(c2.mesh.position, c2.kind === "question" ? 0x57a8ff : 0x4bffaa);
                } else {
                    score -= 35;
                    c1.flashWrong = 1;
                    c2.flashWrong = 1;
                    setMessage("No coincide. Prueba otra vez.");
                    window.setTimeout(function() {
                        hideCard(c1);
                        hideCard(c2);
                    }, 520);
                }

                updateSelectionVisual(c1);
                updateSelectionVisual(c2);
                updateScore();
                selected = [];
                updateCameraSelectionState();

                window.setTimeout(function() {
                    resolving = false;
                    updateCameraSelectionState();
                    updateConfirmState();
                    updateCancelState();
                    var allMatched = cards.every(function(card) {
                        return card.matched;
                    });
                    if (allMatched) {
                        setMessage("Juego completado. Puntuacion final: " + score);
                        reportFinalScore();
                    }
                }, 280);
            });
        }

        if (cancelButton) {
            cancelButton.addEventListener("click", function() {
                if (resolving || !selected.length) {
                    return;
                }
                for (var i = 0; i < selected.length; i++) {
                    hideCard(selected[i]);
                }
                selected = [];
                updateCameraSelectionState();
                setMessage("Seleccion cancelada. Elige otra pareja.");
                updateConfirmState();
                updateCancelState();
            });
        }

        function animate(time) {
            var t = time * 0.001;
            stepMemoryAnimation({
                cards: cards,
                pulseRings: pulseRings,
                scene: scene,
                t: t,
                getFocusSlot: getFocusSlot
            });
            perfMonitor.sample(time);

            sceneCtx.updateEnvironment(t);
            stepCameraTransition();
            sceneCtx.render();
            requestAnimationFrame(animate);
        }

        function onFullscreenChange() {
            window.setTimeout(function() {
                sceneCtx.resize();
                fitGameplayView();
            }, 10);
            window.setTimeout(function() {
                sceneCtx.resize();
                fitGameplayView();
            }, 120);
        }

        window.addEventListener("resize", function() {
            sceneCtx.resize();
            fitGameplayView();
        });
        document.addEventListener("fullscreenchange", onFullscreenChange);
        document.addEventListener("webkitfullscreenchange", onFullscreenChange);
        updateScore();
        setMessage("Empieza: todas boca abajo. Gira una pregunta y una respuesta.");
        updateConfirmState();
        updateCancelState();
        requestAnimationFrame(animate);
    }

    window.Memory3DGameplay = { startGame: startGame };
})();
