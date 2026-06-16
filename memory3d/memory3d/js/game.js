(function() {
    "use strict";

    function getMoodleBaseUrl() {
        if (window.M && window.M.cfg && window.M.cfg.wwwroot) {
            return String(window.M.cfg.wwwroot).replace(/\/+$/, "");
        }
        return "";
    }

    function buildModuleUrl(path) {
        var base = getMoodleBaseUrl();
        return (base ? base : "") + path;
    }

    function normalizeBase(base) {
        if (!base) {
            return "";
        }
        return String(base).replace(/\/+$/, "") + "/";
    }

    function joinUrl(base, relativePathWithVersion) {
        return normalizeBase(base) + String(relativePathWithVersion).replace(/^\/+/, "");
    }

    function unique(list) {
        var seen = {};
        var output = [];
        for (var i = 0; i < list.length; i++) {
            var value = list[i];
            if (!value || seen[value]) {
                continue;
            }
            seen[value] = true;
            output.push(value);
        }
        return output;
    }

    function detectAssetBases() {
        var bases = [];

        if (window.Memory3DAssetBase) {
            bases.push(normalizeBase(window.Memory3DAssetBase));
        }

        var scripts = document.getElementsByTagName("script");
        for (var i = 0; i < scripts.length; i++) {
            var src = scripts[i].src || "";
            if (!src) {
                continue;
            }
            if (/\/js\/game\.js(?:\?|$)/.test(src)) {
                bases.push(normalizeBase(src.replace(/\/game\.js(?:\?.*)?$/, "")));
            }
            if (/\/js\/three\/loader\.js(?:\?|$)/.test(src)) {
                bases.push(normalizeBase(src.replace(/\/three\/loader\.js(?:\?.*)?$/, "")));
            }
        }

        bases.push(normalizeBase(buildModuleUrl("/mod/memory3d/js/")));
        bases.push(normalizeBase(buildModuleUrl("/mod/memory3d/memory3d/js/")));

        var path = window.location && window.location.pathname ? window.location.pathname : "";
        var idxNested = path.indexOf("/mod/memory3d/memory3d/");
        if (idxNested >= 0) {
            bases.push(normalizeBase(path.substring(0, idxNested) + "/mod/memory3d/memory3d/js/"));
        }
        var idxPlain = path.indexOf("/mod/memory3d/");
        if (idxPlain >= 0) {
            bases.push(normalizeBase(path.substring(0, idxPlain) + "/mod/memory3d/js/"));
        }

        return unique(bases);
    }

    function tryPromoteFromRequireJS() {
        var requirejs = window.requirejs;
        if (!requirejs || !requirejs.s || !requirejs.s.contexts) {
            return;
        }

        var contexts = requirejs.s.contexts;
        var contextNames = Object.keys(contexts);
        for (var i = 0; i < contextNames.length; i++) {
            var context = contexts[contextNames[i]];
            if (!context || !context.defined) {
                continue;
            }

            var moduleNames = Object.keys(context.defined);
            for (var j = 0; j < moduleNames.length; j++) {
                var mod = context.defined[moduleNames[j]];
                if (!window.Memory3DCards &&
                    mod &&
                    typeof mod === "object" &&
                    typeof mod.createCardTexture === "function" &&
                    typeof mod.createBackTexture === "function") {
                    window.Memory3DCards = mod;
                }
                if (!window.Memory3DCommon &&
                    mod &&
                    typeof mod === "object" &&
                    typeof mod.shuffle === "function" &&
                    typeof mod.createCustomCursor === "function" &&
                    typeof mod.createHud === "function") {
                    window.Memory3DCommon = mod;
                }
                if (!window.Memory3DMemoryLayout &&
                    mod &&
                    typeof mod === "object" &&
                    typeof mod.computeLayoutMetrics === "function" &&
                    typeof mod.getLayoutPosition === "function") {
                    window.Memory3DMemoryLayout = mod;
                }
                if (!window.Memory3DMemoryAnimation &&
                    mod &&
                    typeof mod === "object" &&
                    typeof mod.step === "function" &&
                    mod.mode === "memory3d_animation") {
                    window.Memory3DMemoryAnimation = mod;
                }
                if (!window.Memory3DDragfillHelpers &&
                    mod &&
                    typeof mod === "object" &&
                    typeof mod.buildItems === "function" &&
                    typeof mod.createQuestionCardTextureWithBlank === "function") {
                    window.Memory3DDragfillHelpers = mod;
                }
                if (!window.Memory3DDragfillAnimation &&
                    mod &&
                    typeof mod === "object" &&
                    typeof mod.step === "function" &&
                    mod.mode === "dragfill3d_animation") {
                    window.Memory3DDragfillAnimation = mod;
                }
                if (!window.Memory3DClassifierHelpers &&
                    mod &&
                    typeof mod === "object" &&
                    typeof mod.normalizeClassifierItems === "function" &&
                    typeof mod.createConceptTexture === "function") {
                    window.Memory3DClassifierHelpers = mod;
                }
                if (!window.Memory3DClassifierAnimation &&
                    mod &&
                    typeof mod === "object" &&
                    typeof mod.step === "function" &&
                    mod.mode === "classifier3d_animation") {
                    window.Memory3DClassifierAnimation = mod;
                }
                if (!window.Memory3DIntruderHelpers &&
                    mod &&
                    typeof mod === "object" &&
                    typeof mod.normalizeIntruderItems === "function" &&
                    typeof mod.createIntruderCardTexture === "function") {
                    window.Memory3DIntruderHelpers = mod;
                }
                if (!window.Memory3DIntruderAnimation &&
                    mod &&
                    typeof mod === "object" &&
                    typeof mod.step === "function" &&
                    mod.mode === "intruder3d_animation") {
                    window.Memory3DIntruderAnimation = mod;
                }
                if (!window.Memory3DScene &&
                    mod &&
                    typeof mod === "object" &&
                    typeof mod.createSceneContext === "function") {
                    window.Memory3DScene = mod;
                }
                if (!window.Memory3DGameplay &&
                    mod &&
                    typeof mod === "object" &&
                    typeof mod.startGame === "function" &&
                    (!mod.mode || mod.mode === "memory3d")) {
                    window.Memory3DGameplay = mod;
                }
                if (!window.Memory3DDragfillGameplay &&
                    mod &&
                    typeof mod === "object" &&
                    typeof mod.startGame === "function" &&
                    mod.mode === "dragfill3d") {
                    window.Memory3DDragfillGameplay = mod;
                }
                if (!window.Memory3DClassifierGameplay &&
                    mod &&
                    typeof mod === "object" &&
                    typeof mod.startGame === "function" &&
                    mod.mode === "classifier3d") {
                    window.Memory3DClassifierGameplay = mod;
                }
                if (!window.Memory3DIntruderGameplay &&
                    mod &&
                    typeof mod === "object" &&
                    typeof mod.startGame === "function" &&
                    mod.mode === "intruder3d") {
                    window.Memory3DIntruderGameplay = mod;
                }
            }
        }
    }

    function getMissingParts() {
        tryPromoteFromRequireJS();
        var missing = [];
        if (!window.Memory3DCommon) {
            missing.push("Memory3DCommon");
        }
        if (!window.Memory3DMemoryLayout) {
            missing.push("Memory3DMemoryLayout");
        }
        if (!window.Memory3DMemoryAnimation || typeof window.Memory3DMemoryAnimation.step !== "function") {
            missing.push("Memory3DMemoryAnimation.step");
        }
        if (!window.Memory3DCards) {
            missing.push("Memory3DCards");
        }
        if (!window.Memory3DScene) {
            missing.push("Memory3DScene");
        }
        if (!window.Memory3DGameplay || typeof window.Memory3DGameplay.startGame !== "function") {
            missing.push("Memory3DGameplay.startGame");
        }
        return missing;
    }

    function hasGameplayStack() {
        return (
            getMissingParts().length === 0
        );
    }

    function loadScript(url) {
        return new Promise(function(resolve, reject) {
            var script = document.createElement("script");
            script.src = url;
            script.async = false;
            script.onload = resolve;
            script.onerror = function() {
                reject(new Error("No se pudo cargar: " + url));
            };
            document.head.appendChild(script);
        });
    }

    function loadScriptAndCheck(url, checkFn) {
        return loadScript(url).then(function() {
            return new Promise(function(resolve, reject) {
                window.setTimeout(function() {
                    if (checkFn()) {
                        resolve();
                    } else {
                        reject(new Error("Script cargado pero modulo no detectado: " + url));
                    }
                }, 0);
            });
        });
    }

    function loadFirstAvailable(paths, checkFn) {
        return new Promise(function(resolve, reject) {
            var idx = 0;

            function tryNext() {
                if (idx >= paths.length) {
                    reject(new Error("Ninguna ruta valida para modulo."));
                    return;
                }
                var url = paths[idx++];
                loadScriptAndCheck(url, checkFn).then(resolve).catch(tryNext);
            }

            tryNext();
        });
    }

    function modulePaths(relativePathWithVersion) {
        var relative = String(relativePathWithVersion).replace(/^\/+/, "");
        var bases = detectAssetBases();
        var out = [];
        for (var i = 0; i < bases.length; i++) {
            out.push(joinUrl(bases[i], relative));
        }
        return unique(out);
    }

    function setLoadingState(container, messageNode, isLoading, text) {
        if (!container) {
            return;
        }
        var overlay = container.querySelector(".memory3d-loading-overlay");
        if (isLoading) {
            if (!overlay) {
                overlay = document.createElement("div");
                overlay.className = "memory3d-loading-overlay";
                var pill = document.createElement("div");
                pill.className = "memory3d-loading-pill";
                overlay.appendChild(pill);
                container.appendChild(overlay);
            }
            var labelNode = overlay.querySelector(".memory3d-loading-pill");
            if (labelNode) {
                labelNode.textContent = text || "Cargando...";
            }
            if (messageNode) {
                messageNode.textContent = text || "Cargando...";
            }
            return;
        }
        if (overlay && overlay.parentNode) {
            overlay.parentNode.removeChild(overlay);
        }
    }

    function createScoreReporter(payload, mode) {
        var sent = false;
        var reportUrl = String(payload.reporturl || "").trim();
        var sesskey = String(payload.sesskey || "").trim();
        var cmid = Number(payload.cmid || 0);

        return function(score, maxscore) {
            if (sent || !reportUrl || !sesskey || !cmid) {
                return;
            }
            sent = true;

            var body = {
                cmid: cmid,
                sesskey: sesskey,
                gamemode: String(mode || "memory"),
                score: Number(score || 0),
                maxscore: Number(maxscore || 0)
            };

            fetch(reportUrl, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                credentials: "same-origin",
                body: JSON.stringify(body)
            }).catch(function() {});
        };
    }

    function ensureGameplayStack() {
        return new Promise(function(resolve, reject) {
            var attempts = 0;
            var maxAttempts = 120;

            function failWithMissing(prefix) {
                var missing = getMissingParts();
                reject(new Error(prefix + " Faltan: " + (missing.length ? missing.join(", ") : "desconocido")));
            }

            function waitAfterForcedLoad(remainingChecks) {
                if (hasGameplayStack()) {
                    resolve();
                    return;
                }

                if (remainingChecks <= 0) {
                    failWithMissing("No se pudo inicializar Memory3DGameplay.");
                    return;
                }

                window.setTimeout(function() {
                    waitAfterForcedLoad(remainingChecks - 1);
                }, 100);
            }

            function forceLoadMissing() {
                var stamp = Date.now();
                loadFirstAvailable(
                    modulePaths("three/shared/common.js?v=" + stamp),
                    function() { return !!window.Memory3DCommon; }
                )
                    .then(function() {
                        return loadFirstAvailable(
                            modulePaths("three/memory/layout.js?v=" + stamp),
                            function() { return !!window.Memory3DMemoryLayout; }
                        );
                    })
                    .then(function() {
                        return loadFirstAvailable(
                            modulePaths("three/memory/animation.js?v=" + stamp),
                            function() {
                                return !!window.Memory3DMemoryAnimation &&
                                    typeof window.Memory3DMemoryAnimation.step === "function";
                            }
                        );
                    })
                    .then(function() {
                        return loadFirstAvailable(
                    modulePaths("three/cards.js?v=" + stamp),
                    function() { return !!window.Memory3DCards; }
                        );
                    })
                    .then(function() {
                        return loadFirstAvailable(
                            modulePaths("three/scene.js?v=" + stamp),
                            function() { return !!window.Memory3DScene; }
                        );
                    })
                    .then(function() {
                        return loadFirstAvailable(
                            modulePaths("three/gameplay.js?v=" + stamp),
                            function() {
                                return !!window.Memory3DGameplay &&
                                    typeof window.Memory3DGameplay.startGame === "function";
                            }
                        );
                    })
                    .then(function() {
                        waitAfterForcedLoad(80);
                    })
                    .catch(function() {
                        failWithMissing("No se pudo recargar los scripts de Memory3D.");
                    });
            }

            function waitForGlobals() {
                if (hasGameplayStack()) {
                    resolve();
                    return;
                }

                attempts++;
                if (attempts >= maxAttempts) {
                    forceLoadMissing();
                    return;
                }

                window.setTimeout(waitForGlobals, 50);
            }

            waitForGlobals();
        });
    }

    function hasDragfillStack() {
        tryPromoteFromRequireJS();
        return !!window.Memory3DCommon &&
            !!window.Memory3DDragfillHelpers &&
            !!window.Memory3DDragfillAnimation &&
            !!window.Memory3DDragfillGameplay &&
            typeof window.Memory3DDragfillGameplay.startGame === "function";
    }

    function ensureDragfillStack() {
        return new Promise(function(resolve, reject) {
            if (hasDragfillStack()) {
                resolve();
                return;
            }

            var stamp = Date.now();
            loadFirstAvailable(
                modulePaths("three/shared/common.js?v=" + stamp),
                function() { return !!window.Memory3DCommon; }
            )
                .then(function() {
                    return loadFirstAvailable(
                        modulePaths("three/dragfill/helpers.js?v=" + stamp),
                        function() { return !!window.Memory3DDragfillHelpers; }
                    );
                })
                .then(function() {
                    return loadFirstAvailable(
                        modulePaths("three/dragfill/animation.js?v=" + stamp),
                        function() {
                            return !!window.Memory3DDragfillAnimation &&
                                typeof window.Memory3DDragfillAnimation.step === "function";
                        }
                    );
                })
                .then(function() {
                    return loadFirstAvailable(
                modulePaths("three/cards.js?v=" + stamp),
                function() { return !!window.Memory3DCards; }
                    );
                })
                .then(function() {
                    return loadFirstAvailable(
                        modulePaths("three/scene.js?v=" + stamp),
                        function() { return !!window.Memory3DScene; }
                    );
                })
                .then(function() {
                    return loadFirstAvailable(
                        modulePaths("three/dragfill_gameplay.js?v=" + stamp),
                        function() { return hasDragfillStack(); }
                    );
                })
                .then(function() {
                    if (hasDragfillStack()) {
                        resolve();
                    } else {
                        reject(new Error("No se pudo inicializar el modo arrastrar 3D."));
                    }
                })
                .catch(function() {
                    reject(new Error("No se pudo cargar el modo arrastrar 3D."));
                });
        });
    }

    function hasClassifierStack() {
        tryPromoteFromRequireJS();
        return !!window.Memory3DCommon &&
            !!window.Memory3DClassifierHelpers &&
            !!window.Memory3DClassifierAnimation &&
            !!window.Memory3DCards &&
            !!window.Memory3DScene &&
            !!window.Memory3DClassifierGameplay &&
            typeof window.Memory3DClassifierGameplay.startGame === "function";
    }

    function ensureClassifierStack() {
        return new Promise(function(resolve, reject) {
            if (hasClassifierStack()) {
                resolve();
                return;
            }

            var stamp = Date.now();
            loadFirstAvailable(
                modulePaths("three/shared/common.js?v=" + stamp),
                function() { return !!window.Memory3DCommon; }
            )
                .then(function() {
                    return loadFirstAvailable(
                        modulePaths("three/classifier/helpers.js?v=" + stamp),
                        function() { return !!window.Memory3DClassifierHelpers; }
                    );
                })
                .then(function() {
                    return loadFirstAvailable(
                        modulePaths("three/classifier/animation.js?v=" + stamp),
                        function() {
                            return !!window.Memory3DClassifierAnimation &&
                                typeof window.Memory3DClassifierAnimation.step === "function";
                        }
                    );
                })
                .then(function() {
                    return loadFirstAvailable(
                        modulePaths("three/cards.js?v=" + stamp),
                        function() { return !!window.Memory3DCards; }
                    );
                })
                .then(function() {
                    return loadFirstAvailable(
                        modulePaths("three/scene.js?v=" + stamp),
                        function() { return !!window.Memory3DScene; }
                    );
                })
                .then(function() {
                    return loadFirstAvailable(
                        modulePaths("three/classifier_gameplay.js?v=" + stamp),
                        function() { return hasClassifierStack(); }
                    );
                })
                .then(function() {
                    if (hasClassifierStack()) {
                        resolve();
                    } else {
                        reject(new Error("No se pudo inicializar el modo clasificador 3D."));
                    }
                })
                .catch(function() {
                    reject(new Error("No se pudo cargar el modo clasificador 3D."));
                });
        });
    }

    function hasIntruderStack() {
        tryPromoteFromRequireJS();
        return !!window.Memory3DCommon &&
            !!window.Memory3DIntruderHelpers &&
            !!window.Memory3DIntruderAnimation &&
            !!window.Memory3DCards &&
            !!window.Memory3DScene &&
            !!window.Memory3DIntruderGameplay &&
            typeof window.Memory3DIntruderGameplay.startGame === "function";
    }

    function ensureIntruderStack() {
        return new Promise(function(resolve, reject) {
            if (hasIntruderStack()) {
                resolve();
                return;
            }

            var stamp = Date.now();
            loadFirstAvailable(
                modulePaths("three/shared/common.js?v=" + stamp),
                function() { return !!window.Memory3DCommon; }
            )
                .then(function() {
                    return loadFirstAvailable(
                        modulePaths("three/intruder/helpers.js?v=" + stamp),
                        function() { return !!window.Memory3DIntruderHelpers; }
                    );
                })
                .then(function() {
                    return loadFirstAvailable(
                        modulePaths("three/intruder/animation.js?v=" + stamp),
                        function() {
                            return !!window.Memory3DIntruderAnimation &&
                                typeof window.Memory3DIntruderAnimation.step === "function";
                        }
                    );
                })
                .then(function() {
                    return loadFirstAvailable(
                        modulePaths("three/cards.js?v=" + stamp),
                        function() { return !!window.Memory3DCards; }
                    );
                })
                .then(function() {
                    return loadFirstAvailable(
                        modulePaths("three/scene.js?v=" + stamp),
                        function() { return !!window.Memory3DScene; }
                    );
                })
                .then(function() {
                    return loadFirstAvailable(
                        modulePaths("three/intruder_gameplay.js?v=" + stamp),
                        function() { return hasIntruderStack(); }
                    );
                })
                .then(function() {
                    if (hasIntruderStack()) {
                        resolve();
                    } else {
                        reject(new Error("No se pudo inicializar el modo radar de intrusos 3D."));
                    }
                })
                .catch(function() {
                    reject(new Error("No se pudo cargar el modo radar de intrusos 3D."));
                });
        });
    }

    function boot() {
        var payloadNode = document.getElementById("memory3d-data");
        var container = document.getElementById("memory3d-canvas-container");
        if (!payloadNode || !container) {
            return;
        }

        var scoreNode = document.getElementById("memory3d-score");
        var confirmButton = document.getElementById("memory3d-confirm");
        var messageNode = document.getElementById("memory3d-message");
        setLoadingState(container, messageNode, true, "Cargando...");

        var payload = {};
        try {
            payload = JSON.parse(payloadNode.textContent || "{}");
        } catch (error) {
            setLoadingState(container, messageNode, false);
            if (messageNode) {
                messageNode.textContent = "Error leyendo datos del juego.";
            }
            return;
        }

        var mode = String(payload.gamemode || "memory").toLowerCase();
        var pairs = Array.isArray(payload.pairs) ? payload.pairs : [];
        var items = Array.isArray(payload.items) ? payload.items : pairs;
        var activeData = mode === "memory" ? pairs : items;
        var reportScore = createScoreReporter(payload, mode);

        if (!activeData.length) {
            setLoadingState(container, messageNode, false);
            if (messageNode) {
                if (mode === "dragfill") {
                    messageNode.textContent = "No hay ejercicios para arrastrar todavia.";
                } else if (mode === "classifier") {
                    messageNode.textContent = "No hay conceptos para clasificar todavia.";
                } else if (mode === "intruder") {
                    messageNode.textContent = "No hay rondas de intrusos todavia.";
                } else {
                    messageNode.textContent = "No hay parejas para jugar todavia.";
                }
            }
            return;
        }

        if (mode === "dragfill") {
            if (!window.Memory3DLoader || typeof window.Memory3DLoader.loadThreeStack !== "function") {
                setLoadingState(container, messageNode, false);
                if (messageNode) {
                    messageNode.textContent = "No se pudo inicializar Memory3DLoader.";
                }
                return;
            }

            window.Memory3DLoader.loadThreeStack()
                .then(function() {
                    return ensureDragfillStack();
                })
                .then(function() {
                    setLoadingState(container, messageNode, false);
                    window.Memory3DDragfillGameplay.startGame(container, items, scoreNode, confirmButton, messageNode, reportScore);
                })
                .catch(function(err) {
                    setLoadingState(container, messageNode, false);
                    if (messageNode) {
                        messageNode.textContent = err.message;
                    }
                });
            return;
        }

        if (mode === "classifier") {
            if (!window.Memory3DLoader || typeof window.Memory3DLoader.loadThreeStack !== "function") {
                setLoadingState(container, messageNode, false);
                if (messageNode) {
                    messageNode.textContent = "No se pudo inicializar Memory3DLoader.";
                }
                return;
            }

            window.Memory3DLoader.loadThreeStack()
                .then(function() {
                    return ensureClassifierStack();
                })
                .then(function() {
                    setLoadingState(container, messageNode, false);
                    window.Memory3DClassifierGameplay.startGame(container, items, scoreNode, confirmButton, messageNode, reportScore);
                })
                .catch(function(err) {
                    setLoadingState(container, messageNode, false);
                    if (messageNode) {
                        messageNode.textContent = err.message;
                    }
                });
            return;
        }

        if (mode === "intruder") {
            if (!window.Memory3DLoader || typeof window.Memory3DLoader.loadThreeStack !== "function") {
                setLoadingState(container, messageNode, false);
                if (messageNode) {
                    messageNode.textContent = "No se pudo inicializar Memory3DLoader.";
                }
                return;
            }

            window.Memory3DLoader.loadThreeStack()
                .then(function() {
                    return ensureIntruderStack();
                })
                .then(function() {
                    setLoadingState(container, messageNode, false);
                    window.Memory3DIntruderGameplay.startGame(container, items, scoreNode, confirmButton, messageNode, reportScore);
                })
                .catch(function(err) {
                    setLoadingState(container, messageNode, false);
                    if (messageNode) {
                        messageNode.textContent = err.message;
                    }
                });
            return;
        }

        if (!window.Memory3DLoader || typeof window.Memory3DLoader.loadThreeStack !== "function") {
            setLoadingState(container, messageNode, false);
            if (messageNode) {
                messageNode.textContent = "No se pudo inicializar Memory3DLoader.";
            }
            return;
        }

        window.Memory3DLoader.loadThreeStack()
            .then(function() {
                return ensureGameplayStack();
            })
            .then(function() {
                setLoadingState(container, messageNode, false);
                window.Memory3DGameplay.startGame(container, pairs, scoreNode, confirmButton, messageNode, reportScore);
            })
            .catch(function(err) {
                setLoadingState(container, messageNode, false);
                if (messageNode) {
                    messageNode.textContent = err.message;
                }
            });
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", boot);
    } else {
        boot();
    }
})();

