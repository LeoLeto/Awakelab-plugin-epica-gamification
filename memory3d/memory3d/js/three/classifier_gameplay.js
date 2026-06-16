(function() {
    "use strict";

    var common = window.Memory3DCommon || {};
    var createCustomCursor = common.createCustomCursor;
    var sharedCreateHud = common.createHud;
    var createPerformanceMonitor = common.createPerformanceMonitor;
    var shuffle = common.shuffle;

    var classifierHelpers = window.Memory3DClassifierHelpers || {};
    var normalizeClassifierItems = classifierHelpers.normalizeClassifierItems;
    var uniqueCategories = classifierHelpers.uniqueCategories;
    var createConceptTexture = classifierHelpers.createConceptTexture;
    var createPortalTexture = classifierHelpers.createPortalTexture;

    var classifierAnim = window.Memory3DClassifierAnimation || {};
    var stepClassifierAnimation = classifierAnim.step;
    var middleGreenA = "rgba(139,255,196,1)";
    var middleGreenB = "rgba(41,149,120,1)";

    function startGame(container, rawItems, scoreNode, confirmButton, messageNode, onFinish) {
        if (!createCustomCursor || !sharedCreateHud || !shuffle ||
            !normalizeClassifierItems || !uniqueCategories || !createConceptTexture ||
            !createPortalTexture || !stepClassifierAnimation) {
            if (messageNode) {
                messageNode.textContent = "Faltan modulos comunes del juego clasificador.";
            }
            return;
        }
        if (!window.Memory3DScene || !window.Memory3DCards) {
            if (messageNode) {
                messageNode.textContent = "Faltan modulos 3D para el clasificador.";
            }
            return;
        }

        var items = normalizeClassifierItems(rawItems);
        if (!items.length) {
            if (messageNode) {
                messageNode.textContent = "No hay conceptos para clasificar.";
            }
            return;
        }

        var categories = uniqueCategories(items);
        if (categories.length < 2) {
            if (messageNode) {
                messageNode.textContent = "Se necesitan al menos 2 categorias para clasificar.";
            }
            return;
        }

        function selectActiveCategoriesAndItems(allItems, allCategories) {
            var counts = {};
            var firstSeen = {};
            var i;
            for (i = 0; i < allCategories.length; i++) {
                var key = String(allCategories[i] || "").trim().toLowerCase();
                if (!key) {
                    continue;
                }
                if (!firstSeen[key]) {
                    firstSeen[key] = String(allCategories[i] || "").trim();
                }
                counts[key] = 0;
            }
            for (i = 0; i < allItems.length; i++) {
                var catKey = String(allItems[i].category || "").trim().toLowerCase();
                if (!catKey) {
                    continue;
                }
                if (!firstSeen[catKey]) {
                    firstSeen[catKey] = String(allItems[i].category || "").trim();
                }
                counts[catKey] = (counts[catKey] || 0) + 1;
            }

            var sortable = [];
            for (var key in counts) {
                if (Object.prototype.hasOwnProperty.call(counts, key)) {
                    sortable.push({
                        key: key,
                        label: firstSeen[key] || key,
                        count: counts[key]
                    });
                }
            }
            sortable.sort(function(a, b) {
                return b.count - a.count;
            });

            if (sortable.length < 2) {
                return null;
            }

            var selected = [sortable[0], sortable[1]];
            var selectedMap = {};
            selectedMap[selected[0].key] = true;
            selectedMap[selected[1].key] = true;

            var filtered = [];
            for (i = 0; i < allItems.length; i++) {
                var itemKey = String(allItems[i].category || "").trim().toLowerCase();
                if (selectedMap[itemKey]) {
                    filtered.push(allItems[i]);
                }
            }

            if (filtered.length < 2) {
                return null;
            }

            return {
                categories: [selected[0].label, selected[1].label],
                items: filtered
            };
        }

        var selection = selectActiveCategoriesAndItems(items, categories);
        if (!selection) {
            if (messageNode) {
                messageNode.textContent = "No hay suficientes conceptos para dos categorias en clasificador.";
            }
            return;
        }
        categories = selection.categories;
        items = selection.items;

        shuffle(items);

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
            leftTag: "Categorias",
            rightTag: "Conceptos",
            hideConfirmButton: true
        });
        var tagCategories = container.querySelector(".memory3d-tag-a");
        var tagConcepts = container.querySelector(".memory3d-tag-q");
        if (tagCategories) {
            tagCategories.style.background = "linear-gradient(135deg, rgba(95,191,255,0.96), rgba(61,117,198,0.96))";
            tagCategories.style.borderColor = "rgba(179,222,255,0.9)";
            tagCategories.style.color = "#eef8ff";
        }
        if (tagConcepts) {
            tagConcepts.style.background = "linear-gradient(135deg, rgba(139,255,196,0.96), rgba(41,149,120,0.96))";
            tagConcepts.style.borderColor = "rgba(188,255,221,0.9)";
            tagConcepts.style.color = "#edfff5";
        }

        var score = 0;
        var currentIndex = 0;
        var scoreReported = false;
        var resolving = false;
        var reviewMode = false;
        var reviewFocusCategory = null;
        var dragCard = null;
        var dragOffset = new THREE.Vector3();
        var nearestPortal = null;
        var flashes = [];
        var parkedCards = [];
        var parkedCountByCategory = {};
        var cameraLookAt = new THREE.Vector3(0, -0.5, 0);
        var defaultCameraPos = new THREE.Vector3();

        function setMessage(text) {
            if (messageNode) {
                messageNode.textContent = text;
            }
        }

        function normalizeCategoryKey(value) {
            return String(value || "").trim().toLowerCase();
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
            var maxScore = Math.max(1, items.length * 100);
            onFinish(score, maxScore);
        }

        var portalColors = [
            ["rgba(95,191,255,1)", "rgba(61,117,198,1)"]
        ];

        var portalWidth = 4.2;
        var portalHeight = 1.58;
        var cardWidth = 4.2;
        var cardHeight = 1.58;
        var laneY = 0.25;

        var portals = [];
        var portalGeo = new THREE.PlaneGeometry(portalWidth, portalHeight);
        for (var p = 0; p < categories.length; p++) {
            var pair = portalColors[0];
            var material = new THREE.MeshPhysicalMaterial({
                map: createPortalTexture(categories[p], pair[0], pair[1]),
                transparent: true,
                opacity: 1,
                roughness: 0.28,
                metalness: 0.1,
                emissive: 0x1d2f57,
                emissiveIntensity: 0.18
            });
            var mesh = new THREE.Mesh(portalGeo, material);
            mesh.position.set(p === 0 ? -4.4 : 4.4, laneY, 0);
            mesh.rotation.x = -0.06;
            scene.add(mesh);
            portals.push({
                category: categories[p],
                mesh: mesh,
                targetScale: 1,
                phase: Math.random() * Math.PI * 2
            });
        }

        function createMiddleCardTexture(text) {
            return createPortalTexture(String(text || "").trim(), middleGreenA, middleGreenB);
        }

        var cardGeo = new THREE.PlaneGeometry(cardWidth, cardHeight);
        var cardFrontMat = new THREE.MeshPhysicalMaterial({
            map: createMiddleCardTexture(items[0].concept),
            color: 0xffffff,
            transparent: true,
            opacity: 1,
            side: THREE.DoubleSide,
            roughness: 0.3,
            metalness: 0.08,
            clearcoat: 0.7,
            clearcoatRoughness: 0.3,
            emissive: 0x1e6d51,
            emissiveIntensity: 0.18
        });
        var cardMesh = new THREE.Mesh(cardGeo, cardFrontMat);
        cardMesh.position.set(0, laneY, 0);
        cardMesh.rotation.set(-0.01, 0, 0);
        scene.add(cardMesh);

        var card = {
            mesh: cardMesh,
            targetPos: new THREE.Vector3(0, laneY, 0),
            home: new THREE.Vector3(0, laneY, 0),
            dragging: false,
            flashWrong: 0,
            pulseOk: 0
        };

        var active = items[0];

        function applyConcept(conceptText) {
            if (cardFrontMat.map) {
                cardFrontMat.map.dispose();
            }
            cardFrontMat.map = createMiddleCardTexture(conceptText);
            cardFrontMat.needsUpdate = true;
            card.mesh.position.copy(card.home);
            card.targetPos.copy(card.home);
            card.mesh.rotation.set(-0.01, 0, 0);
            card.mesh.scale.set(1, 1, 1);
        }

        function getBoardBoundsX() {
            var portalMin = Infinity;
            var portalMax = -Infinity;
            for (var i = 0; i < portals.length; i++) {
                var x = portals[i].mesh.position.x;
                portalMin = Math.min(portalMin, x - (portalWidth * 0.5 + 0.16));
                portalMax = Math.max(portalMax, x + (portalWidth * 0.5 + 0.16));
            }
            if (!isFinite(portalMin) || !isFinite(portalMax)) {
                portalMin = -5.5;
                portalMax = 5.5;
            }
            var cardHalf = cardWidth * 0.5;
            var cardMin = card.home.x - cardHalf;
            var cardMax = card.home.x + cardHalf;
            return {
                min: Math.min(portalMin, cardMin),
                max: Math.max(portalMax, cardMax)
            };
        }

        function refreshDefaultCameraPose() {
            var bounds = getBoardBoundsX();
            var lookX = (bounds.min + bounds.max) * 0.5;
            camera.position.y = 0.95;
            cameraLookAt.set(lookX, laneY, 0);
            defaultCameraPos.copy(camera.position);
            defaultCameraPos.x = lookX;
            camera.position.x = lookX;
            camera.lookAt(cameraLookAt.x, cameraLookAt.y, cameraLookAt.z);
        }

        function computeGameplayDistance() {
            var base = Math.max(7.1, 6.8 + items.length * 0.08 + categories.length * 0.06);
            var hFactor = Math.max(0.82, Math.min(1.1, (container.clientHeight || 900) / 980));
            var dByHeight = base * hFactor;

            var aspect = Math.max(1, (container.clientWidth || 1) / Math.max(container.clientHeight || 1, 1));
            var fovRad = (camera.fov * Math.PI) / 180;
            var tanHalf = Math.tan(fovRad * 0.5);
            var bounds = getBoardBoundsX();
            var totalWidth = Math.max(8, bounds.max - bounds.min + 0.8);
            var dByWidth = (totalWidth * 0.5) / Math.max(tanHalf * aspect, 0.0001);

            var dist = Math.max(dByHeight, dByWidth);
            return Math.max(6.7, Math.min(8.6, dist));
        }

        function applyClassifierCameraDistance(distanceValue) {
            var z = Math.max(6.6, Math.min(8.4, distanceValue));
            sceneCtx.setGameplayDistance(z);
            camera.position.z = z;
            camera.position.y = 0.95;
            camera.lookAt(cameraLookAt.x, cameraLookAt.y, cameraLookAt.z);
        }

        var distance = computeGameplayDistance();
        applyClassifierCameraDistance(distance);
        refreshDefaultCameraPose();
        updateScore(0);
        setMessage("Arrastra la carta del medio a su categoria correspondiente (izquierda o derecha).");

        var raycaster = new THREE.Raycaster();
        var mouse = new THREE.Vector2();
        var dragPlane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);
        var hit = new THREE.Vector3();

        function updateMouse(event) {
            var rect = renderer.domElement.getBoundingClientRect();
            mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
            mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
            raycaster.setFromCamera(mouse, camera);
        }

        function portalAt(position) {
            var best = null;
            var bestDist = Infinity;
            for (var i = 0; i < portals.length; i++) {
                var d = portals[i].mesh.position.distanceTo(position);
                if (d < bestDist) {
                    bestDist = d;
                    best = portals[i];
                }
            }
            if (best && bestDist <= 1.95) {
                return best;
            }
            return null;
        }

        function spawnBurst(position, color) {
            var count = 26;
            var positions = new Float32Array(count * 3);
            var velocities = [];
            for (var i = 0; i < count; i++) {
                positions[i * 3] = position.x;
                positions[i * 3 + 1] = position.y;
                positions[i * 3 + 2] = position.z;
                velocities.push(new THREE.Vector3(
                    (Math.random() - 0.5) * 0.16,
                    Math.random() * 0.18 + 0.03,
                    (Math.random() - 0.5) * 0.1
                ));
            }
            var geo = new THREE.BufferGeometry();
            geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
            var mat = new THREE.PointsMaterial({
                color: color,
                size: 0.18,
                transparent: true,
                opacity: 0.95,
                depthWrite: false
            });
            var points = new THREE.Points(geo, mat);
            scene.add(points);
            flashes.push({
                mesh: points,
                velocities: velocities,
                life: 1
            });
        }

        function findPortalByCategory(category) {
            var key = normalizeCategoryKey(category);
            for (var i = 0; i < portals.length; i++) {
                if (normalizeCategoryKey(portals[i].category) === key) {
                    return portals[i];
                }
            }
            return null;
        }

        function getParkSlot(category) {
            var key = normalizeCategoryKey(category);
            var count = parkedCountByCategory[key] || 0;
            parkedCountByCategory[key] = count + 1;

            var portal = findPortalByCategory(category);
            var baseX = portal ? portal.mesh.position.x : 0;
            var baseY = portal ? portal.mesh.position.y : laneY;
            var baseZ = portal ? portal.mesh.position.z : 0;
            var side = baseX >= 0 ? 1 : -1;
            var startOffsetX = 2.2;
            var startOffsetZ = -0.28;
            var stepZ = -0.32;

            return {
                // Primera acertada: al lateral. Las siguientes: detras en Z.
                x: baseX + side * startOffsetX,
                y: baseY - 0.08 - count * 0.012,
                z: baseZ + startOffsetZ + count * stepZ
            };
        }

        function updateParkedReviewTargets() {
            if (!parkedCards.length) {
                return;
            }

            for (var i = 0; i < parkedCards.length; i++) {
                var parked = parkedCards[i];
                parked.targetRotX = -0.01;
                parked.targetRotY = 0;
                parked.targetRotZ = 0;
            }

            if (!reviewMode || !reviewFocusCategory) {
                for (i = 0; i < parkedCards.length; i++) {
                    parkedCards[i].targetPos.copy(parkedCards[i].stackPos);
                    parkedCards[i].targetScale = 0.52;
                    parkedCards[i].targetOpacity = 1;
                    parkedCards[i].isFocusedGroup = false;
                }
                return;
            }

            var portal = findPortalByCategory(reviewFocusCategory);
            var anchorX = 0;
            var anchorY = 0.95;
            var anchorZ = portal ? portal.mesh.position.z : 0;

            var focusList = [];
            for (i = 0; i < parkedCards.length; i++) {
                if (parkedCards[i].categoryKey === reviewFocusCategory) {
                    focusList.push(parkedCards[i]);
                } else {
                    parkedCards[i].targetPos.copy(parkedCards[i].stackPos);
                    parkedCards[i].targetScale = 0.42;
                    parkedCards[i].targetOpacity = 0.2;
                    parkedCards[i].isFocusedGroup = false;
                }
            }

            var count = focusList.length;
            var cols = 1;
            if (count <= 2) {
                cols = 2;
            } else if (count <= 4) {
                cols = 2;
            } else if (count <= 6) {
                cols = 3;
            } else if (count <= 9) {
                cols = 3;
            } else if (count <= 12) {
                cols = 4;
            } else {
                cols = 5;
            }
            var rows = Math.max(1, Math.ceil(count / cols));
            var density = Math.max(0, Math.min(1, (count - 1) / 14));
            var focusScale = Math.max(0.46, 0.74 - density * 0.2);
            var colGap = cardWidth * focusScale + 0.2;
            var rowGap = cardHeight * focusScale + 0.14;
            var startX = anchorX - ((cols - 1) * colGap) * 0.5;
            var startY = anchorY + ((rows - 1) * rowGap) * 0.5;
            for (i = 0; i < focusList.length; i++) {
                var col = i % cols;
                var row = Math.floor(i / cols);
                focusList[i].targetPos.set(
                    startX + colGap * col,
                    startY - row * rowGap,
                    anchorZ + 0.04
                );
                focusList[i].targetScale = focusScale;
                focusList[i].targetOpacity = 1;
                focusList[i].isFocusedGroup = true;
            }
        }

        function parkSolvedCard(conceptText, category, fromPosition) {
            var slot = getParkSlot(category);
            var conceptTexture = createMiddleCardTexture(conceptText);
            var categoryKey = normalizeCategoryKey(category);
            var parkedFrontMat = new THREE.MeshPhysicalMaterial({
                map: conceptTexture,
                color: 0xffffff,
                transparent: true,
                opacity: 1,
                side: THREE.DoubleSide,
                roughness: 0.36,
                metalness: 0.06,
                clearcoat: 0.54,
                clearcoatRoughness: 0.4,
                emissive: 0x1e6d51,
                emissiveIntensity: 0.14
            });
            var parkedMesh = new THREE.Mesh(cardGeo, parkedFrontMat);
            parkedMesh.position.copy(fromPosition || card.mesh.position);
            parkedMesh.rotation.copy(card.mesh.rotation);
            parkedMesh.scale.copy(card.mesh.scale);
            scene.add(parkedMesh);

            parkedCards.push({
                mesh: parkedMesh,
                categoryKey: categoryKey,
                stackPos: new THREE.Vector3(slot.x, slot.y, slot.z),
                targetPos: new THREE.Vector3(slot.x, slot.y, slot.z),
                targetScale: 0.52,
                targetOpacity: 1,
                targetRotX: -0.01,
                targetRotY: 0,
                targetRotZ: 0,
                phase: Math.random() * Math.PI * 2
            });
        }

        function onReviewPointerDown(event) {
            updateMouse(event);
            var portalMeshes = [];
            for (var i = 0; i < portals.length; i++) {
                portalMeshes.push(portals[i].mesh);
            }
            var intersections = raycaster.intersectObjects(portalMeshes, false);
            if (!intersections.length) {
                reviewFocusCategory = null;
                updateParkedReviewTargets();
                setMessage("Repaso final. Click en una categoria para ver sus respuestas.");
                return;
            }

            var clickedPortal = null;
            for (i = 0; i < portals.length; i++) {
                if (portals[i].mesh === intersections[0].object) {
                    clickedPortal = portals[i];
                    break;
                }
            }
            if (!clickedPortal) {
                return;
            }

            var clickedKey = normalizeCategoryKey(clickedPortal.category);
            if (reviewFocusCategory === clickedKey) {
                reviewFocusCategory = null;
                setMessage("Repaso final. Click en una categoria para ver sus respuestas.");
            } else {
                reviewFocusCategory = clickedKey;
                setMessage("Mostrando respuestas de: " + clickedPortal.category + ".");
            }
            updateParkedReviewTargets();
        }

        function onPointerDown(event) {
            if (reviewMode) {
                onReviewPointerDown(event);
                return;
            }
            if (resolving) {
                return;
            }
            updateMouse(event);
            var intersections = raycaster.intersectObject(card.mesh, false);
            if (!intersections.length) {
                return;
            }
            dragCard = card;
            dragCard.dragging = true;
            dragPlane.constant = -dragCard.mesh.position.z;
            if (raycaster.ray.intersectPlane(dragPlane, hit)) {
                dragOffset.copy(dragCard.mesh.position).sub(hit);
            } else {
                dragOffset.set(0, 0, 0);
            }
        }

        function onPointerMove(event) {
            if (!dragCard) {
                return;
            }
            updateMouse(event);
            if (!raycaster.ray.intersectPlane(dragPlane, hit)) {
                return;
            }
            hit.add(dragOffset);
            hit.x = Math.max(-7.2, Math.min(7.2, hit.x));
            hit.y = Math.max(-2.8, Math.min(2.8, hit.y));
            hit.z = 0;
            dragCard.mesh.position.copy(hit);
            dragCard.targetPos.copy(hit);
            nearestPortal = portalAt(hit);
        }

        function nextConcept() {
            currentIndex++;
            if (currentIndex >= items.length) {
                card.mesh.visible = false;
                reviewMode = true;
                reviewFocusCategory = null;
                updateParkedReviewTargets();
                setMessage("Clasificador completado. Click en DDL o DML para ver sus respuestas.");
                reportFinalScore();
                return;
            }
            active = items[currentIndex];
            applyConcept(active.concept);
            setMessage("Correcto. Siguiente concepto.");
        }

        function onPointerUp() {
            if (!dragCard) {
                return;
            }
            dragCard.dragging = false;
            if (nearestPortal && active && nearestPortal.category.toLowerCase() === active.category.toLowerCase()) {
                resolving = true;
                dragCard.pulseOk = 1;
                updateScore(100);
                setMessage("Bien clasificado.");
                spawnBurst(dragCard.mesh.position, 0x74ffd5);
                parkSolvedCard(active.concept, nearestPortal.category, dragCard.mesh.position.clone());
                if (reviewMode) {
                    updateParkedReviewTargets();
                }
                window.setTimeout(function() {
                    resolving = false;
                    nextConcept();
                }, 280);
            } else {
                dragCard.flashWrong = 1;
                dragCard.targetPos.copy(dragCard.home);
                if (nearestPortal) {
                    updateScore(-20);
                    setMessage("Categoria incorrecta. Intentalo otra vez.");
                } else {
                    setMessage("Suelta la carta en la categoria de la izquierda o la derecha.");
                }
            }
            dragCard = null;
            nearestPortal = null;
        }

        renderer.domElement.addEventListener("pointerdown", onPointerDown);
        renderer.domElement.addEventListener("pointermove", onPointerMove);
        window.addEventListener("pointerup", onPointerUp);

        function animate(time) {
            var t = time * 0.001;
            stepClassifierAnimation({
                t: t,
                portals: portals,
                nearestPortal: nearestPortal,
                card: card,
                cardFrontMat: cardFrontMat,
                parkedCards: parkedCards,
                flashes: flashes,
                scene: scene
            });
            perfMonitor.sample(time);

            sceneCtx.updateEnvironment(t);
            sceneCtx.render();
            requestAnimationFrame(animate);
        }

        function onResize() {
            sceneCtx.resize();
            distance = computeGameplayDistance();
            applyClassifierCameraDistance(distance);
            refreshDefaultCameraPose();
        }

        window.addEventListener("resize", onResize);
        document.addEventListener("fullscreenchange", function() {
            window.setTimeout(onResize, 20);
        });

        requestAnimationFrame(animate);
    }

    window.Memory3DClassifierGameplay = {
        mode: "classifier3d",
        startGame: startGame
    };
})();
