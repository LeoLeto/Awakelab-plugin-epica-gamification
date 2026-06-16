(function() {
    "use strict";

    var common = window.Memory3DCommon || {};
    var helperApi = window.Memory3DDragfillHelpers || {};

    var createCustomCursor = common.createCustomCursor;
    var sharedCreateHud = common.createHud;
    var createPerformanceMonitor = common.createPerformanceMonitor;
    var shuffle = common.shuffle;

    var buildItems = helperApi.buildItems;
    var createWordTileTexture = helperApi.createWordTileTexture;
    var createBlankTexture = helperApi.createBlankTexture;
    var createQuestionCardTextureWithBlank = helperApi.createQuestionCardTextureWithBlank;
    var getWordTileWidth = helperApi.getWordTileWidth;
    var getReviewGridConfig = helperApi.getReviewGridConfig;
    var dragfillAnimApi = window.Memory3DDragfillAnimation || {};
    var stepDragfillAnimation = dragfillAnimApi.step;

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

    function startGame(container, items, scoreNode, confirmButton, messageNode, onFinish) {
        if (!shuffle || !createCustomCursor || !sharedCreateHud || !buildItems ||
            !createWordTileTexture || !createBlankTexture || !createQuestionCardTextureWithBlank ||
            !getWordTileWidth || !getReviewGridConfig || !stepDragfillAnimation) {
            if (messageNode) {
                messageNode.textContent = "Faltan modulos comunes del juego arrastrar.";
            }
            return;
        }

        var list = buildItems(items);
        if (!container || !list.length) {
            if (messageNode) {
                messageNode.textContent = "No hay ejercicios para arrastrar.";
            }
            return;
        }

        if (!window.Memory3DScene || !window.Memory3DCards) {
            if (messageNode) {
                messageNode.textContent = "Faltan modulos 3D para arrastrar.";
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
        sharedCreateHud(container, {
            scoreNode: scoreNode,
            confirmButton: confirmButton,
            messageNode: messageNode,
            leftTag: "Respuestas",
            rightTag: "Preguntas",
            hideConfirmButton: true
        });
        if (messageNode) {
            messageNode.classList.add("memory3d-message-bottom-center");
        }

        var score = 0;
        var solved = 0;
        var scoreReported = false;
        if (scoreNode) {
            scoreNode.textContent = "Puntuacion: 0";
        }

        function setMessage(text) {
            if (messageNode) {
                messageNode.textContent = text;
            }
        }

        function reportFinalScore() {
            if (scoreReported || typeof onFinish !== "function") {
                return;
            }
            scoreReported = true;
            var maxScore = Math.max(1, list.length * 100);
            onFinish(score, maxScore);
        }

        var questionCardWidth = 4.9;
        var questionCardHeight = 1.82;
        var questionCardDepth = 0.16;
        var questionCardGeo = new THREE.BoxGeometry(questionCardWidth, questionCardHeight, questionCardDepth);
        var backTexture = window.Memory3DCards.createBackTexture();

        var questionCards = [];
        var answerCards = [];
        var slots = [];
        var unresolvedAnswerMeshes = [];
        var reviewMode = false;
        var reviewFocusIndex = -1;
        var questionBoardLayout = null;
        var answerBoardLayout = null;
        var maxAnswerTileWidth = 2.2;

        function getViewportProfile() {
            var w = Math.max(1, container.clientWidth || 1);
            var h = Math.max(1, container.clientHeight || 1);
            var isFullscreen = !!document.fullscreenElement;
            var compact = !isFullscreen && (h < 820 || w < 1500);
            return {
                width: w,
                height: h,
                compact: compact
            };
        }

        function computeQuestionBoardLayout(count, viewport) {
            var safe = Math.max(1, Math.min(15, count || 1));
            var cols = safe <= 5 ? 1 : (safe <= 10 ? 2 : 3);
            var rows = Math.ceil(safe / cols);
            var scale = 1.0 - (safe - 1) * 0.013;
            if (viewport && viewport.compact) {
                scale += 0.05;
            }
            scale = Math.max(0.78, Math.min(1.06, scale));
            var xGap = questionCardWidth * scale + (viewport && viewport.compact ? 0.16 : 0.24);
            var yGap = questionCardHeight * scale + (viewport && viewport.compact ? 0.12 : 0.18);
            return {
                cols: cols,
                rows: rows,
                scale: scale,
                xGap: xGap,
                yGap: yGap,
                centerX: (viewport && viewport.compact) ? 5.32 : 5.95,
                centerY: (viewport && viewport.compact) ? 0.58 : 0.2
            };
        }

        function getQuestionBoardPos(index, layout) {
            var col = index % layout.cols;
            var row = Math.floor(index / layout.cols);
            var startX = layout.centerX - ((layout.cols - 1) * layout.xGap) * 0.5;
            var startY = layout.centerY + ((layout.rows - 1) * layout.yGap) * 0.5;
            return {
                x: startX + col * layout.xGap,
                y: startY - row * layout.yGap
            };
        }

        function computeAnswerBoardLayout(count, viewport, maxTileWidth) {
            var safe = Math.max(1, Math.min(15, count || 1));
            var cols = safe > 8 ? 3 : 2;
            if (safe > 12) {
                cols = 4;
            }
            if (viewport && viewport.compact) {
                cols = Math.min(cols, 3);
            }
            var rows = Math.ceil(safe / cols);
            var tileW = Math.max(2.0, maxTileWidth || 2.0);
            var colGap = tileW + (viewport && viewport.compact ? 0.42 : 0.58);
            return {
                cols: cols,
                rows: rows,
                centerX: (viewport && viewport.compact) ? -4.9 : -5.7,
                colGap: colGap,
                rowGap: (viewport && viewport.compact) ? 1.08 : 1.22,
                startY: ((rows - 1) * ((viewport && viewport.compact) ? 1.08 : 1.22)) / 2 - 0.08
            };
        }

        var viewportProfile = getViewportProfile();
        questionBoardLayout = computeQuestionBoardLayout(list.length, viewportProfile);
        answerBoardLayout = computeAnswerBoardLayout(list.length, viewportProfile, maxAnswerTileWidth);

        for (var i = 0; i < list.length; i++) {
            var item = list[i];
            var qData = createQuestionCardTextureWithBlank(item.sentence, "");
            var qFront = new THREE.MeshPhysicalMaterial({
                map: qData.texture,
                roughness: 0.34,
                metalness: 0.05,
                clearcoat: 0.66,
                clearcoatRoughness: 0.3,
                emissive: 0x2a1d72,
                emissiveIntensity: 0.2
            });
            var qBack = new THREE.MeshPhysicalMaterial({
                map: backTexture,
                roughness: 0.36,
                metalness: 0.04,
                clearcoat: 0.55,
                clearcoatRoughness: 0.34
            });
            var qEdge = new THREE.MeshPhysicalMaterial({
                color: 0x4d3bb5,
                roughness: 0.45,
                metalness: 0.18
            });
            var qMesh = new THREE.Mesh(questionCardGeo, [qEdge, qEdge, qEdge, qEdge, qFront, qBack]);
            var initialQPos = getQuestionBoardPos(i, questionBoardLayout);
            qMesh.position.set(initialQPos.x, initialQPos.y, 0);
            qMesh.rotation.y = 0;
            qMesh.rotation.x = -0.02;
            scene.add(qMesh);

            var blankCenterCanvasX = qData.blank.x + qData.blank.width * 0.5;
            var blankCenterCanvasY = qData.blank.y + qData.blank.height * 0.5;
            var blankWidthWorld = (qData.blank.width / qData.canvasWidth) * questionCardWidth;
            var blankHeightWorld = (qData.blank.height / qData.canvasHeight) * questionCardHeight;

            var localX = (blankCenterCanvasX / qData.canvasWidth - 0.5) * questionCardWidth;
            var localY = (0.5 - blankCenterCanvasY / qData.canvasHeight) * questionCardHeight;

            var slotGeo = new THREE.PlaneGeometry(blankWidthWorld, blankHeightWorld * 0.92);
            var slotMat = new THREE.MeshBasicMaterial({
                map: createBlankTexture("", "normal", qData.blank.width + 80),
                transparent: true,
                depthWrite: false,
                side: THREE.DoubleSide
            });
            var slotMesh = new THREE.Mesh(slotGeo, slotMat);
            slotMesh.position.set(localX, localY, questionCardDepth * 0.5 + 0.002);
            qMesh.add(slotMesh);

            slots.push({
                pairIndex: item.pairIndex,
                parentCard: qMesh,
                questionMaterial: qFront,
                sentence: item.sentence,
                mesh: slotMesh,
                filled: false,
                widthPx: qData.blank.width + 80,
                normalTexture: slotMat.map,
                hoverTexture: createBlankTexture("", "hover", qData.blank.width + 80)
            });

            questionCards.push({
                index: i,
                mesh: qMesh,
                filled: false,
                targetPos: qMesh.position.clone(),
                targetScale: 1,
                targetRotX: -0.02,
                targetRotY: 0,
                targetRotZ: 0,
                phase: Math.random() * Math.PI * 2,
                pulse: 0
            });
        }

        var answers = list.map(function(it) {
            return { pairIndex: it.pairIndex, text: it.answer };
        });
        shuffle(answers);

        var cols = answerBoardLayout.cols;
        var rows = answerBoardLayout.rows;
        var leftCenterX = answerBoardLayout.centerX;
        var colGap = answerBoardLayout.colGap;
        var leftRowGap = answerBoardLayout.rowGap;
        var leftStartY = answerBoardLayout.startY;

        for (var a = 0; a < answers.length; a++) {
            var answerItem = answers[a];
            var col = Math.floor(a / rows);
            var row = a % rows;
            var tileWidth = getWordTileWidth(answerItem.text);
            if (tileWidth > maxAnswerTileWidth) {
                maxAnswerTileWidth = tileWidth;
            }
            var tileGeo = new THREE.PlaneGeometry(tileWidth, 0.94);

            var answerFront = new THREE.MeshPhysicalMaterial({
                map: createWordTileTexture(answerItem.text),
                roughness: 0.3,
                metalness: 0.08,
                clearcoat: 0.72,
                clearcoatRoughness: 0.28,
                emissive: 0x254870,
                emissiveIntensity: 0.17,
                transparent: true,
                side: THREE.DoubleSide
            });
            var aMesh = new THREE.Mesh(tileGeo, answerFront);
            var basePos = new THREE.Vector3(
                leftCenterX + (col - (cols - 1) / 2) * colGap,
                leftStartY - row * leftRowGap,
                0
            );
            aMesh.position.copy(basePos);
            aMesh.rotation.x = -0.02;
            scene.add(aMesh);

            var answerObj = {
                pairIndex: answerItem.pairIndex,
                text: answerItem.text,
                mesh: aMesh,
                frontMaterial: answerFront,
                home: basePos.clone(),
                target: basePos.clone(),
                targetRotX: -0.02,
                targetRotZ: 0,
                dragging: false,
                locked: false,
                flashWrong: 0,
                phase: Math.random() * Math.PI * 2,
                targetScale: 1
            };
            answerCards.push(answerObj);
            unresolvedAnswerMeshes.push(aMesh);
        }

        viewportProfile = getViewportProfile();
        answerBoardLayout = computeAnswerBoardLayout(list.length, viewportProfile, maxAnswerTileWidth);

        updateQuestionQueueTargets();

        var raycaster = new THREE.Raycaster();
        var mouse = new THREE.Vector2();
        var dragPlane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);
        var dragCard = null;
        var dragOffset = new THREE.Vector3();
        var nearestSlot = null;
        var tmpHit = new THREE.Vector3();
        var slotWorld = new THREE.Vector3();
        var questionMotionTarget = new THREE.Vector3();
        var cameraTargetPos = new THREE.Vector3();
        var cameraLookAt = new THREE.Vector3(0, -0.5, 0);
        var defaultCameraPos = new THREE.Vector3();

        function getBoardBoundsX() {
            var qHalf = (questionCardWidth * (questionBoardLayout ? questionBoardLayout.scale : 1)) * 0.5;
            var qStart = questionBoardLayout.centerX - ((questionBoardLayout.cols - 1) * questionBoardLayout.xGap) * 0.5;
            var qEnd = questionBoardLayout.centerX + ((questionBoardLayout.cols - 1) * questionBoardLayout.xGap) * 0.5;
            var qMin = qStart - qHalf;
            var qMax = qEnd + qHalf;

            var aHalf = Math.max(1.0, maxAnswerTileWidth * 0.5);
            var aStart = answerBoardLayout.centerX - ((answerBoardLayout.cols - 1) * answerBoardLayout.colGap) * 0.5;
            var aEnd = answerBoardLayout.centerX + ((answerBoardLayout.cols - 1) * answerBoardLayout.colGap) * 0.5;
            var aMin = aStart - aHalf;
            var aMax = aEnd + aHalf;

            return {
                min: Math.min(qMin, aMin),
                max: Math.max(qMax, aMax)
            };
        }

        function refreshDefaultCameraPose() {
            var bounds = getBoardBoundsX();
            var lookX = (bounds.min + bounds.max) * 0.5;
            camera.position.y = 0.85;
            cameraLookAt.set(lookX, 0.05, 0);
            defaultCameraPos.copy(camera.position);
            defaultCameraPos.x = lookX;
            camera.position.x = lookX;
            camera.lookAt(cameraLookAt.x, cameraLookAt.y, cameraLookAt.z);
        }

        function computeGameplayDistance() {
            var base = Math.max(10.8, 9.4 + list.length * 0.24);
            var hFactor = Math.max(0.82, Math.min(1.1, (container.clientHeight || 900) / 980));
            var dByHeight = base * hFactor;

            var aspect = Math.max(1, (container.clientWidth || 1) / Math.max(container.clientHeight || 1, 1));
            var fovRad = (camera.fov * Math.PI) / 180;
            var tanHalf = Math.tan(fovRad * 0.5);
            var bounds = getBoardBoundsX();
            var totalWidth = Math.max(8, bounds.max - bounds.min + 1.4);
            var dByWidth = (totalWidth * 0.5) / Math.max(tanHalf * aspect, 0.0001);

            return Math.max(dByHeight, dByWidth);
        }

        function relayoutForViewport() {
            var profile = getViewportProfile();
            questionBoardLayout = computeQuestionBoardLayout(list.length, profile);
            answerBoardLayout = computeAnswerBoardLayout(list.length, profile, maxAnswerTileWidth);

            for (var i = 0; i < answerCards.length; i++) {
                var answer = answerCards[i];
                if (answer.locked) {
                    continue;
                }
                var col = Math.floor(i / answerBoardLayout.rows);
                var row = i % answerBoardLayout.rows;
                answer.home.set(
                    answerBoardLayout.centerX + (col - (answerBoardLayout.cols - 1) / 2) * answerBoardLayout.colGap,
                    answerBoardLayout.startY - row * answerBoardLayout.rowGap,
                    0
                );
                if (!answer.dragging) {
                    answer.target.copy(answer.home);
                }
            }

            updateQuestionQueueTargets();
        }

        function updateScore(delta) {
            score += delta;
            if (scoreNode) {
                scoreNode.textContent = "Puntuacion: " + score;
            }
        }

        function getSlotByQuestionIndex(index) {
            for (var i = 0; i < slots.length; i++) {
                if (slots[i].pairIndex === index) {
                    return slots[i];
                }
            }
            return null;
        }

        function updateQuestionQueueTargets() {
            var i;
            if (solved >= list.length) {
                reviewMode = true;
            }

            if (reviewMode) {
                var grid = getReviewGridConfig(questionCards.length, questionCardWidth, questionCardHeight);
                var startX = -((grid.cols - 1) * grid.xGap) * 0.5;
                var yGap = questionCardHeight * grid.scale + 0.34;
                var startY = ((grid.rows - 1) * yGap) * 0.5 - 0.2;

                for (i = 0; i < questionCards.length; i++) {
                    var qReview = questionCards[i];
                    var c = i % grid.cols;
                    var r = Math.floor(i / grid.cols);
                    qReview.targetPos.set(startX + c * grid.xGap, startY - r * yGap, 0);
                    qReview.targetScale = grid.scale;
                    qReview.targetRotX = -0.01;
                    qReview.targetRotY = 0;
                    qReview.targetRotZ = 0;

                    var slotReview = getSlotByQuestionIndex(qReview.index);
                    if (slotReview && !slotReview.filled) {
                        slotReview.mesh.visible = false;
                    }
                }
                return;
            }

            for (i = 0; i < questionCards.length; i++) {
                var q = questionCards[i];
                var slot = getSlotByQuestionIndex(q.index);
                var qPos = getQuestionBoardPos(i, questionBoardLayout);
                q.targetPos.set(qPos.x, qPos.y, 0);
                q.targetScale = questionBoardLayout.scale;
                q.targetRotX = -0.02;
                q.targetRotY = 0;
                q.targetRotZ = 0;
                if (slot) {
                    slot.mesh.visible = !slot.filled;
                }
            }

            updateReviewFocusVisibility();
        }

        function findQuestionByObject(object3d) {
            var node = object3d;
            while (node) {
                for (var i = 0; i < questionCards.length; i++) {
                    if (questionCards[i].mesh === node) {
                        return questionCards[i];
                    }
                }
                node = node.parent;
            }
            return null;
        }

        function updateReviewFocusVisibility() {
            for (var i = 0; i < questionCards.length; i++) {
                var question = questionCards[i];
                if (!reviewMode || reviewFocusIndex < 0) {
                    question.mesh.visible = true;
                    continue;
                }
                question.mesh.visible = (question.index === reviewFocusIndex);
            }
        }

        function onReviewPointerDown(event) {
            updateMouseFromEvent(event);
            var questionMeshes = [];
            for (var i = 0; i < questionCards.length; i++) {
                questionMeshes.push(questionCards[i].mesh);
            }
            var intersections = raycaster.intersectObjects(questionMeshes, true);
            if (!intersections.length) {
                reviewFocusIndex = -1;
                updateReviewFocusVisibility();
                setMessage("Vista final: haz click en una tarjeta para acercarla.");
                return;
            }

            var picked = findQuestionByObject(intersections[0].object);
            if (!picked) {
                reviewFocusIndex = -1;
                updateReviewFocusVisibility();
                return;
            }

            if (reviewFocusIndex === picked.index) {
                reviewFocusIndex = -1;
                updateReviewFocusVisibility();
                setMessage("Vista final: haz click en una tarjeta para acercarla.");
            } else {
                reviewFocusIndex = picked.index;
                updateReviewFocusVisibility();
                setMessage("Tarjeta ampliada. Click otra vez para volver.");
            }
        }

        function updateMouseFromEvent(event) {
            var rect = renderer.domElement.getBoundingClientRect();
            mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
            mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
            raycaster.setFromCamera(mouse, camera);
        }

        function findAnswerObj(mesh) {
            for (var i = 0; i < answerCards.length; i++) {
                if (answerCards[i].mesh === mesh) {
                    return answerCards[i];
                }
            }
            return null;
        }

        function getNearestAvailableSlot(position) {
            var best = null;
            var bestDist = Infinity;
            for (var i = 0; i < slots.length; i++) {
                var slot = slots[i];
                if (slot.filled) {
                    continue;
                }
                slot.mesh.getWorldPosition(slotWorld);
                var dist = slotWorld.distanceTo(position);
                if (dist < bestDist) {
                    bestDist = dist;
                    best = slot;
                }
            }
            if (best && bestDist < 1.25) {
                return best;
            }
            return null;
        }

        function clearSlotHighlights() {
            for (var i = 0; i < slots.length; i++) {
                var slot = slots[i];
                if (!slot.filled) {
                    slot.mesh.material.map = slot.normalTexture;
                    slot.mesh.material.needsUpdate = true;
                }
            }
        }

        function onPointerDown(event) {
            if (reviewMode) {
                onReviewPointerDown(event);
                return;
            }

            updateMouseFromEvent(event);
            var intersections = raycaster.intersectObjects(unresolvedAnswerMeshes, false);
            if (!intersections.length) {
                return;
            }

            var obj = findAnswerObj(intersections[0].object);
            if (!obj || obj.locked) {
                return;
            }

            dragCard = obj;
            dragCard.dragging = true;
            dragPlane.constant = -dragCard.mesh.position.z;
            dragCard.targetScale = 1.08;
            dragCard.frontMaterial.emissiveIntensity = 0.4;

            if (raycaster.ray.intersectPlane(dragPlane, tmpHit)) {
                dragOffset.copy(dragCard.mesh.position).sub(tmpHit);
            } else {
                dragOffset.set(0, 0, 0);
            }

            setMessage("Arrastra la palabra hasta el hueco de la pregunta.");
        }

        function onPointerMove(event) {
            if (!dragCard) {
                return;
            }
            updateMouseFromEvent(event);
            if (!raycaster.ray.intersectPlane(dragPlane, tmpHit)) {
                return;
            }
            tmpHit.add(dragOffset);
            tmpHit.x = Math.max(-10.2, Math.min(9.2, tmpHit.x));
            tmpHit.y = Math.max(-6.2, Math.min(5.8, tmpHit.y));
            tmpHit.z = 0;
            dragCard.mesh.position.copy(tmpHit);
            dragCard.target.copy(tmpHit);

            nearestSlot = getNearestAvailableSlot(dragCard.mesh.position);
            clearSlotHighlights();
            if (nearestSlot) {
                nearestSlot.mesh.material.map = nearestSlot.hoverTexture;
                nearestSlot.mesh.material.needsUpdate = true;
            }
        }

        function removeFromUnresolved(mesh) {
            for (var i = unresolvedAnswerMeshes.length - 1; i >= 0; i--) {
                if (unresolvedAnswerMeshes[i] === mesh) {
                    unresolvedAnswerMeshes.splice(i, 1);
                    break;
                }
            }
        }

        function onPointerUp() {
            if (!dragCard) {
                return;
            }

            if (nearestSlot && dragCard.pairIndex === nearestSlot.pairIndex) {
                dragCard.locked = true;
                nearestSlot.filled = true;
                nearestSlot.mesh.visible = false;
                nearestSlot.questionMaterial.map = createQuestionCardTextureWithBlank(nearestSlot.sentence, dragCard.text).texture;
                nearestSlot.questionMaterial.needsUpdate = true;
                questionCards[nearestSlot.pairIndex].filled = true;
                questionCards[nearestSlot.pairIndex].pulse = 1;
                updateScore(100);
                solved++;
                removeFromUnresolved(dragCard.mesh);
                dragCard.mesh.visible = false;
                updateQuestionQueueTargets();

                if (solved >= list.length) {
                    reviewFocusIndex = -1;
                    updateReviewFocusVisibility();
                    setMessage("Perfecto. Completaste todos los huecos. Mostrando repaso final.");
                    reportFinalScore();
                } else {
                    setMessage("Correcto. Sigue con el siguiente hueco.");
                }
            } else {
                dragCard.target.copy(dragCard.home);
                dragCard.targetScale = 1;
                dragCard.targetRotX = -0.02;
                dragCard.targetRotZ = 0;
                dragCard.flashWrong = 1;
                if (nearestSlot) {
                    updateScore(-15);
                    setMessage("No encaja. Prueba otra palabra.");
                }
            }

            dragCard.dragging = false;
            dragCard.frontMaterial.emissiveIntensity = dragCard.locked ? 0.24 : 0.16;
            dragCard = null;
            nearestSlot = null;
            clearSlotHighlights();
        }

        renderer.domElement.addEventListener("pointerdown", onPointerDown);
        renderer.domElement.addEventListener("pointermove", onPointerMove);
        window.addEventListener("pointerup", onPointerUp);

        relayoutForViewport();
        var distance = computeGameplayDistance();
        sceneCtx.setGameplayDistance(distance);
        refreshDefaultCameraPose();
        setMessage("Arrastra cada palabra al hueco exacto de su pregunta.");

        function animate(time) {
            var t = time * 0.001;
            stepDragfillAnimation({
                t: t,
                answerCards: answerCards,
                questionCards: questionCards,
                reviewMode: reviewMode,
                reviewFocusIndex: reviewFocusIndex,
                questionMotionTarget: questionMotionTarget,
                cameraTargetPos: cameraTargetPos,
                camera: camera,
                defaultCameraPos: defaultCameraPos,
                cameraLookAt: cameraLookAt
            });
            perfMonitor.sample(time);

            sceneCtx.updateEnvironment(t);
            sceneCtx.render();
            requestAnimationFrame(animate);
        }

        function onResize() {
            relayoutForViewport();
            sceneCtx.resize();
            distance = computeGameplayDistance();
            sceneCtx.setGameplayDistance(distance);
            refreshDefaultCameraPose();
        }

        window.addEventListener("resize", onResize);
        document.addEventListener("fullscreenchange", function() {
            window.setTimeout(onResize, 20);
        });

        requestAnimationFrame(animate);
    }

    window.Memory3DDragfillGameplay = {
        mode: "dragfill3d",
        startGame: startGame
    };
})();
