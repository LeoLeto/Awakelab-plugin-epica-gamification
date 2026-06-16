(function() {
    "use strict";

    var globalLoadTried = false;

    function findThreeInRequireJS() {
        var requirejs = window.requirejs;
        if (!requirejs || !requirejs.s || !requirejs.s.contexts) {
            return null;
        }

        var contextNames = Object.keys(requirejs.s.contexts);
        for (var i = 0; i < contextNames.length; i++) {
            var context = requirejs.s.contexts[contextNames[i]];
            if (!context || !context.defined) {
                continue;
            }

            var moduleNames = Object.keys(context.defined);
            for (var j = 0; j < moduleNames.length; j++) {
                var candidate = context.defined[moduleNames[j]];
                if (
                    candidate &&
                    typeof candidate === "object" &&
                    typeof candidate.REVISION === "string" &&
                    typeof candidate.Scene === "function" &&
                    typeof candidate.Vector3 === "function"
                ) {
                    return candidate;
                }
            }
        }

        return null;
    }

    function resolveThree() {
        if (window.THREE) {
            return window.THREE;
        }

        var threeFromAMD = findThreeInRequireJS();
        if (threeFromAMD) {
            window.THREE = threeFromAMD;
            return threeFromAMD;
        }

        return null;
    }

    function loadThreeStack() {
        return new Promise(function(resolve, reject) {
            var maxAttempts = 40;
            var attempt = 0;

            function fail() {
                reject(new Error(
                    "Three.js no esta disponible. " +
                    "Verifica /mod/memory3d/js/vendor/three.min.js y limpia cache de Moodle."
                ));
            }

            function forceGlobalLoad() {
                if (globalLoadTried) {
                    fail();
                    return;
                }
                globalLoadTried = true;

                var previousDefine = window.define;
                var script = document.createElement("script");
                var assetbase = (window.Memory3DAssetBase && String(window.Memory3DAssetBase)) || "/mod/memory3d/js/";
                assetbase = assetbase.replace(/\/+$/, "");
                script.src = assetbase + "/vendor/three.min.js?v=" + Date.now();
                script.async = false;

                script.onload = function() {
                    window.define = previousDefine;
                    var three = resolveThree();
                    if (three) {
                        resolve(three);
                    } else {
                        fail();
                    }
                };

                script.onerror = function() {
                    window.define = previousDefine;
                    fail();
                };

                try {
                    window.define = undefined;
                } catch (error) {
                    window.define = previousDefine;
                    fail();
                    return;
                }

                document.head.appendChild(script);
            }

            function tryResolve() {
                var three = resolveThree();
                if (three) {
                    resolve(three);
                    return;
                }

                attempt++;
                if (attempt >= maxAttempts) {
                    forceGlobalLoad();
                    return;
                }

                window.setTimeout(tryResolve, 50);
            }

            tryResolve();
        });
    }

    window.Memory3DLoader = { loadThreeStack: loadThreeStack };
})();
