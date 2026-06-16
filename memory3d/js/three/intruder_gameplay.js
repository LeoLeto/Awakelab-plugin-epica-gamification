(function() {
    "use strict";

    var common = window.Memory3DCommon || {};
    var createCustomCursor = common.createCustomCursor;
    var sharedCreateHud = common.createHud;
    var createPerformanceMonitor = common.createPerformanceMonitor;
    var shuffle = common.shuffle;

    var intruderHelpers = window.Memory3DIntruderHelpers || {};
    var normalizeIntruderItems = intruderHelpers.normalizeIntruderItems;
    var createIntruderCardTexture = intruderHelpers.createIntruderCardTexture;

    var intruderAnim = window.Memory3DIntruderAnimation || {};
    var stepIntruderAnimation = intruderAnim.step;

    function startGame(container, rawItems, scoreNode, confirmButton, messageNode, onFinish) {
        if (!createCustomCursor || !sharedCreateHud || !shuffle ||
            !normalizeIntruderItems || !createIntruderCardTexture || !stepIntruderAnimation) {
            if (messageNode) {
                messageNode.textContent = "Faltan modulos comunes del juego radar de intrusos.";
            }
            return;
        }
        if (!window.Memory3DScene) {
            if (messageNode) {
                messageNode.textContent = "Faltan modulos 3D para radar de intrusos.";
            }
            return;
        }

        var rounds = normalizeIntruderItems(rawItems);
        if (!rounds.length) {
            if (messageNode) {
                messageNode.textContent = "No hay rondas para radar de intrusos.";
            }
            return;
        }

        shuffle(rounds);

        var sceneCtx = window.Memory3DScene.createSceneContext(container);
        var scene = sceneCtx.scene;
        var camera = sceneCtx.camera;
        var renderer = sceneCtx.renderer;

        var perfEnabled = false;
        try {
            perfEnabled = /(?:\?|&)m3dperf=1(?:&|$)/.test(String(window.location && window.location.search || ""));
        } catch (e) {}
        var perfMonitor = createPerformanceMonitor
            ? createPerformanceMonitor(container, renderer, { enabled: perfEnabled })
            : { sample: function() {} };

        createCustomCursor(container);
        sharedCreateHud(container, {
            scoreNode: scoreNode,
            confirmButton: confirmButton,
            messageNode: messageNode,
            leftTag: "Radar",
            rightTag: "Intrusos",
            hideConfirmButton: true
        });
        var tagA = container.querySelector(".memory3d-tag-a");
        var tagB = container.querySelector(".memory3d-tag-q");
        var tagBg = "linear-gradient(135deg, rgba(88,152,219,0.96), rgba(50,95,162,0.96))";
        var tagBorder = "rgba(186,224,255,0.9)";
        var tagText = "#eef8ff";
        if (tagA) {
            tagA.style.background = tagBg;
            tagA.style.borderColor = tagBorder;
            tagA.style.color = tagText;
        }
        if (tagB) {
            tagB.style.background = tagBg;
            tagB.style.borderColor = tagBorder;
            tagB.style.color = tagText;
        }

        var score = 0;
        var roundIndex = 0;
        var reviewIndex = 0;
        var scoreReported = false;
        var resolving = false;
        var reviewMode = false;
        var cards = [];
        var reviewArrows = [];
        var bursts = [];
        var raycaster = new THREE.Raycaster();
        var mouse = new THREE.Vector2();

        var cardWidth = 3.5;
        var cardHeight = 1.45;
        var positions = [
            new THREE.Vector3(-5.85, 0.22, 0),
            new THREE.Vector3(-1.95, 0.22, 0),
            new THREE.Vector3(1.95, 0.22, 0),
            new THREE.Vector3(5.85, 0.22, 0)
        ];
        var reviewArrowY = 0.22;
        var reviewArrowX = 6.35;

        function setMessage(text) {
            if (messageNode) {
                messageNode.textContent = text;
            }
        }

        function updateScore(delta) {
            score += delta;
            if (scoreNode) {
                scoreNode.textContent = "Puntuacion: " + score;
            }
        }

        function reportFinalScore() {
            if (scoreReported || typeof onFinish !== "function") {
                return;
            }
            scoreReported = true;
            var maxScore = Math.max(1, rounds.length * 120);
            onFinish(score, maxScore);
        }

        function clearCards() {
            for (var i = 0; i < cards.length; i++) {
                if (!cards[i] || !cards[i].mesh) {
                    continue;
                }
                scene.remove(cards[i].mesh);
                if (cards[i].material && cards[i].material.map) {
                    cards[i].material.map.dispose();
                }
                if (cards[i].material) {
                    cards[i].material.dispose();
                }
            }
            cards = [];
        }

        function clearReviewArrows() {
            for (var i = 0; i < reviewArrows.length; i++) {
                if (!reviewArrows[i] || !reviewArrows[i].mesh) {
                    continue;
                }
                scene.remove(reviewArrows[i].mesh);
                if (reviewArrows[i].material && reviewArrows[i].material.map) {
                    reviewArrows[i].material.map.dispose();
                }
                if (reviewArrows[i].material) {
                    reviewArrows[i].material.dispose();
                }
            }
            reviewArrows = [];
        }

        function createArrowTexture(symbol) {
            var canvas = document.createElement("canvas");
            canvas.width = 320;
            canvas.height = 320;
            var ctx = canvas.getContext("2d");
            ctx.clearRect(0, 0, 320, 320);

            ctx.beginPath();
            ctx.arc(160, 160, 132, 0, Math.PI * 2);
            ctx.fillStyle = "rgba(54,93,148,0.92)";
            ctx.fill();
            ctx.lineWidth = 10;
            ctx.strokeStyle = "rgba(193,226,255,0.95)";
            ctx.stroke();

            ctx.font = "900 160px 'Trebuchet MS','Verdana',sans-serif";
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            ctx.lineWidth = 12;
            ctx.strokeStyle = "rgba(14,30,62,0.95)";
            ctx.strokeText(symbol, 160, 176);
            ctx.fillStyle = "rgba(241,250,255,1)";
            ctx.fillText(symbol, 160, 176);

            var texture = new THREE.CanvasTexture(canvas);
            texture.minFilter = THREE.LinearMipmapLinearFilter;
            texture.magFilter = THREE.LinearFilter;
            texture.needsUpdate = true;
            return texture;
        }

        function createReviewArrows() {
            clearReviewArrows();
            var geometry = new THREE.PlaneGeometry(0.95, 0.95);

            var leftMat = new THREE.MeshPhysicalMaterial({
                map: createArrowTexture("◀"),
                transparent: true,
                side: THREE.DoubleSide,
                roughness: 0.34,
                metalness: 0.08,
                emissive: 0x1f3b63,
                emissiveIntensity: 0.2
            });
            var leftMesh = new THREE.Mesh(geometry, leftMat);
            leftMesh.position.set(-reviewArrowX, reviewArrowY, 0);
            scene.add(leftMesh);
            reviewArrows.push({ mesh: leftMesh, material: leftMat, dir: -1 });

            var rightMat = new THREE.MeshPhysicalMaterial({
                map: createArrowTexture("▶"),
                transparent: true,
                side: THREE.DoubleSide,
                roughness: 0.34,
                metalness: 0.08,
                emissive: 0x1f3b63,
                emissiveIntensity: 0.2
            });
            var rightMesh = new THREE.Mesh(geometry, rightMat);
            rightMesh.position.set(reviewArrowX, reviewArrowY, 0);
            scene.add(rightMesh);
            reviewArrows.push({ mesh: rightMesh, material: rightMat, dir: 1 });
        }

        function spawnBurst(position, color) {
            var count = 28;
            var data = new Float32Array(count * 3);
            var velocities = [];
            for (var i = 0; i < count; i++) {
                data[i * 3] = position.x;
                data[i * 3 + 1] = position.y;
                data[i * 3 + 2] = position.z;
                velocities.push(new THREE.Vector3(
                    (Math.random() - 0.5) * 0.2,
                    Math.random() * 0.2 + 0.04,
                    (Math.random() - 0.5) * 0.12
                ));
            }
            var geo = new THREE.BufferGeometry();
            geo.setAttribute("position", new THREE.BufferAttribute(data, 3));
            var mat = new THREE.PointsMaterial({
                color: color,
                size: 0.18,
                transparent: true,
                opacity: 0.95,
                depthWrite: false
            });
            var pts = new THREE.Points(geo, mat);
            scene.add(pts);
            bursts.push({
                mesh: pts,
                velocities: velocities,
                life: 1
            });
        }

        function createRoundCards(round) {
            clearCards();

            var options = (round.options || []).slice(0, 4);
            shuffle(options);
            var intruderLower = String(round.intruder || "").toLowerCase();
            var intruderIndex = -1;
            for (var i = 0; i < options.length; i++) {
                if (String(options[i]).toLowerCase() === intruderLower) {
                    intruderIndex = i;
                    break;
                }
            }
            if (intruderIndex < 0) {
                intruderIndex = 0;
            }

            var geometry = new THREE.PlaneGeometry(cardWidth, cardHeight);
            for (i = 0; i < 4; i++) {
                var isIntruder = i === intruderIndex;
                var texture = createIntruderCardTexture(options[i], isIntruder);
                var material = new THREE.MeshPhysicalMaterial({
                    map: texture,
                    transparent: true,
                    side: THREE.DoubleSide,
                    roughness: 0.3,
                    metalness: 0.08,
                    clearcoat: 0.65,
                    clearcoatRoughness: 0.32,
                    emissive: 0x1f3b63,
                    emissiveIntensity: 0.17
                });
                var mesh = new THREE.Mesh(geometry, material);
                mesh.position.copy(positions[i]);
                mesh.rotation.set(-0.01, 0, 0);
                scene.add(mesh);

                cards.push({
                    mesh: mesh,
                    material: material,
                    label: options[i],
                    isIntruder: isIntruder,
                    targetPos: positions[i].clone(),
                    phase: Math.random() * Math.PI * 2,
                    pulse: 0,
                    flash: 0
                });
            }
        }

        function getCorrectOptions(round) {
            var intruderLower = String(round.intruder || "").toLowerCase();
            var all = Array.isArray(round.options) ? round.options : [];
            var out = [];
            for (var i = 0; i < all.length; i++) {
                var option = String(all[i] || "");
                if (!option) {
                    continue;
                }
                if (option.toLowerCase() === intruderLower) {
                    continue;
                }
                if (out.indexOf(option) >= 0) {
                    continue;
                }
                out.push(option);
            }
            return out.slice(0, 3);
        }

        function createReviewCards(round) {
            clearCards();
            var options = getCorrectOptions(round);
            var reviewPositions = [
                new THREE.Vector3(-4.2, 0.22, 0),
                new THREE.Vector3(0, 0.22, 0),
                new THREE.Vector3(4.2, 0.22, 0)
            ];
            var geometry = new THREE.PlaneGeometry(cardWidth, cardHeight);
            for (var i = 0; i < options.length; i++) {
                var texture = createIntruderCardTexture(options[i], false);
                var material = new THREE.MeshPhysicalMaterial({
                    map: texture,
                    transparent: true,
                    side: THREE.DoubleSide,
                    roughness: 0.3,
                    metalness: 0.08,
                    clearcoat: 0.65,
                    clearcoatRoughness: 0.32,
                    emissive: 0x1f3b63,
                    emissiveIntensity: 0.17
                });
                var mesh = new THREE.Mesh(geometry, material);
                mesh.position.copy(reviewPositions[i]);
                mesh.rotation.set(-0.01, 0, 0);
                scene.add(mesh);

                cards.push({
                    mesh: mesh,
                    material: material,
                    label: options[i],
                    isIntruder: false,
                    targetPos: reviewPositions[i].clone(),
                    phase: Math.random() * Math.PI * 2,
                    pulse: 0,
                    flash: 0
                });
            }
        }

        function getDistanceForBoard() {
            var aspect = Math.max(1, container.clientWidth / Math.max(container.clientHeight, 1));
            var fovRad = (camera.fov * Math.PI) / 180;
            var tanHalfFov = Math.tan(fovRad * 0.5);
            var width = 15.8;
            var byWidth = (width * 0.5) / Math.max(tanHalfFov * aspect, 0.0001);
            return Math.max(8.8, byWidth + 0.9);
        }

        function showRound() {
            if (roundIndex >= rounds.length) {
                reviewMode = true;
                reviewIndex = 0;
                createReviewArrows();
                showReviewRound();
                reportFinalScore();
                return;
            }
            var round = rounds[roundIndex];
            createRoundCards(round);
            setMessage(
                "Categoria: " + round.category + ". Encuentra el intruso y haz click para descartarlo."
            );
        }

        function showReviewRound() {
            if (!rounds.length) {
                return;
            }
            if (reviewIndex < 0) {
                reviewIndex = rounds.length - 1;
            } else if (reviewIndex >= rounds.length) {
                reviewIndex = 0;
            }
            var round = rounds[reviewIndex];
            createReviewCards(round);
            setMessage(
                "Repaso " + (reviewIndex + 1) + "/" + rounds.length +
                " - Categoria: " + round.category +
                ". Flechas izquierda/derecha para cambiar."
            );
        }

        function findCardFromObject(obj) {
            for (var i = 0; i < cards.length; i++) {
                if (cards[i].mesh === obj) {
                    return cards[i];
                }
            }
            return null;
        }

        function nextRound() {
            roundIndex++;
            showRound();
        }

        function onPointerDown(event) {
            if (resolving) {
                return;
            }
            var rect = renderer.domElement.getBoundingClientRect();
            mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
            mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
            raycaster.setFromCamera(mouse, camera);

            if (reviewMode) {
                if (!reviewArrows.length) {
                    return;
                }
                var arrowIntersects = raycaster.intersectObjects(reviewArrows.map(function(a) { return a.mesh; }), false);
                if (!arrowIntersects.length) {
                    return;
                }
                for (var ai = 0; ai < reviewArrows.length; ai++) {
                    if (reviewArrows[ai].mesh === arrowIntersects[0].object) {
                        reviewIndex += reviewArrows[ai].dir;
                        showReviewRound();
                        return;
                    }
                }
                return;
            }

            if (!cards.length) {
                return;
            }

            var intersects = raycaster.intersectObjects(cards.map(function(c) { return c.mesh; }), false);
            if (!intersects.length) {
                return;
            }
            var chosen = findCardFromObject(intersects[0].object);
            if (!chosen) {
                return;
            }

            if (chosen.isIntruder) {
                resolving = true;
                chosen.pulse = 1;
                updateScore(120);
                spawnBurst(chosen.mesh.position, 0x7bffdb);
                setMessage("Correcto. Descartaste el intruso.");
                window.setTimeout(function() {
                    resolving = false;
                    nextRound();
                }, 420);
            } else {
                chosen.flash = 1;
                updateScore(-25);
                setMessage("Ese no es el intruso. Intentalo de nuevo.");
            }
        }

        renderer.domElement.addEventListener("pointerdown", onPointerDown);

        function animate(time) {
            var t = time * 0.001;
            stepIntruderAnimation({
                t: t,
                cards: cards,
                bursts: bursts,
                scene: scene
            });
            perfMonitor.sample(time);

            sceneCtx.updateEnvironment(t);
            sceneCtx.render();
            requestAnimationFrame(animate);
        }

        function onResize() {
            sceneCtx.resize();
            sceneCtx.setGameplayDistance(getDistanceForBoard());
            camera.position.y = 1.05;
            camera.lookAt(0, 0.2, 0);
            if (reviewArrows.length) {
                reviewArrows[0].mesh.position.set(-reviewArrowX, reviewArrowY, 0);
                reviewArrows[1].mesh.position.set(reviewArrowX, reviewArrowY, 0);
            }
        }

        window.addEventListener("resize", onResize);
        document.addEventListener("fullscreenchange", function() {
            window.setTimeout(onResize, 30);
        });

        sceneCtx.setGameplayDistance(getDistanceForBoard());
        camera.position.y = 1.05;
        camera.lookAt(0, 0.2, 0);
        updateScore(0);
        showRound();
        requestAnimationFrame(animate);
    }

    window.Memory3DIntruderGameplay = {
        mode: "intruder3d",
        startGame: startGame
    };
})();
