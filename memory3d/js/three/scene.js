(function() {
    "use strict";

    function createSceneContext(container) {
        function createCanvasTexture(size, paintFn) {
            var canvas = document.createElement("canvas");
            canvas.width = size;
            canvas.height = size;
            var ctx = canvas.getContext("2d");
            paintFn(ctx, size);
            var texture = new THREE.CanvasTexture(canvas);
            texture.colorSpace = THREE.SRGBColorSpace;
            texture.wrapS = THREE.RepeatWrapping;
            texture.wrapT = THREE.RepeatWrapping;
            texture.anisotropy = 4;
            return texture;
        }

        function createParticleTexture(size) {
            return createCanvasTexture(size, function(ctx, s) {
                var cx = s * 0.5;
                var cy = s * 0.5;
                var r = s * 0.5;
                var g = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
                g.addColorStop(0, "rgba(255,255,255,1)");
                g.addColorStop(0.5, "rgba(255,255,255,0.75)");
                g.addColorStop(1, "rgba(255,255,255,0)");
                ctx.fillStyle = g;
                ctx.fillRect(0, 0, s, s);
            });
        }

        function createSolarCoronaTexture(size, innerColor, outerColor) {
            return createCanvasTexture(size, function(ctx, s) {
                var cx = s * 0.5;
                var cy = s * 0.5;
                var g = ctx.createRadialGradient(cx, cy, s * 0.1, cx, cy, s * 0.5);
                g.addColorStop(0, innerColor);
                g.addColorStop(0.45, "rgba(255,210,130,0.45)");
                g.addColorStop(1, outerColor);
                ctx.fillStyle = g;
                ctx.fillRect(0, 0, s, s);
            });
        }

        function createGasTexture(size, colors) {
            return createCanvasTexture(size, function(ctx, s) {
                var bg = ctx.createLinearGradient(0, 0, 0, s);
                for (var i = 0; i < colors.length; i++) {
                    bg.addColorStop(i / (colors.length - 1), colors[i]);
                }
                ctx.fillStyle = bg;
                ctx.fillRect(0, 0, s, s);

                for (var b = 0; b < 26; b++) {
                    var y = Math.random() * s;
                    var thickness = 8 + Math.random() * 22;
                    var alpha = 0.06 + Math.random() * 0.16;
                    ctx.fillStyle = "rgba(255,255,255," + alpha.toFixed(3) + ")";
                    ctx.fillRect(0, y, s, thickness);
                }

                for (var sw = 0; sw < 18; sw++) {
                    ctx.strokeStyle = "rgba(20,25,55," + (0.06 + Math.random() * 0.12).toFixed(3) + ")";
                    ctx.lineWidth = 2 + Math.random() * 6;
                    ctx.beginPath();
                    var startY = Math.random() * s;
                    ctx.moveTo(0, startY);
                    for (var x = 0; x <= s; x += 32) {
                        ctx.lineTo(x, startY + Math.sin((x / s) * Math.PI * 4 + sw) * (5 + Math.random() * 9));
                    }
                    ctx.stroke();
                }
            });
        }

        function createRockTexture(size, base, dark, light) {
            return createCanvasTexture(size, function(ctx, s) {
                var bg = ctx.createLinearGradient(0, 0, s, s);
                bg.addColorStop(0, base);
                bg.addColorStop(1, dark);
                ctx.fillStyle = bg;
                ctx.fillRect(0, 0, s, s);

                for (var i = 0; i < 220; i++) {
                    var r = 2 + Math.random() * 11;
                    var x = Math.random() * s;
                    var y = Math.random() * s;
                    ctx.fillStyle = (i % 3 === 0) ? light : dark;
                    ctx.globalAlpha = 0.08 + Math.random() * 0.2;
                    ctx.beginPath();
                    ctx.arc(x, y, r, 0, Math.PI * 2);
                    ctx.fill();
                }
                ctx.globalAlpha = 1;
            });
        }

        function createMoonTexture(size) {
            return createCanvasTexture(size, function(ctx, s) {
                var bg = ctx.createLinearGradient(0, 0, s, s);
                bg.addColorStop(0, "#d8deea");
                bg.addColorStop(0.5, "#aeb7c9");
                bg.addColorStop(1, "#7f889b");
                ctx.fillStyle = bg;
                ctx.fillRect(0, 0, s, s);

                for (var c = 0; c < 140; c++) {
                    var x = Math.random() * s;
                    var y = Math.random() * s;
                    var r = 3 + Math.random() * 20;
                    ctx.fillStyle = "rgba(70,78,95," + (0.08 + Math.random() * 0.18).toFixed(3) + ")";
                    ctx.beginPath();
                    ctx.arc(x, y, r, 0, Math.PI * 2);
                    ctx.fill();
                    ctx.strokeStyle = "rgba(222,232,248,0.12)";
                    ctx.lineWidth = 1 + Math.random() * 2;
                    ctx.beginPath();
                    ctx.arc(x - r * 0.15, y - r * 0.15, r * 0.65, 0, Math.PI * 2);
                    ctx.stroke();
                }
            });
        }

        function createEarthTexture(size) {
            return createCanvasTexture(size, function(ctx, s) {
                var bg = ctx.createLinearGradient(0, 0, 0, s);
                bg.addColorStop(0, "#2b68b7");
                bg.addColorStop(0.5, "#1f4f93");
                bg.addColorStop(1, "#163d74");
                ctx.fillStyle = bg;
                ctx.fillRect(0, 0, s, s);

                for (var i = 0; i < 72; i++) {
                    var x = Math.random() * s;
                    var y = Math.random() * s;
                    var rx = 18 + Math.random() * 74;
                    var ry = 10 + Math.random() * 42;
                    ctx.fillStyle = (i % 2 === 0) ? "rgba(76,150,86,0.78)" : "rgba(96,167,112,0.62)";
                    ctx.beginPath();
                    ctx.ellipse(x, y, rx, ry, Math.random() * Math.PI, 0, Math.PI * 2);
                    ctx.fill();
                }

                for (var c = 0; c < 110; c++) {
                    var cx = Math.random() * s;
                    var cy = Math.random() * s;
                    var crx = 12 + Math.random() * 58;
                    var cry = 6 + Math.random() * 20;
                    ctx.fillStyle = "rgba(240,248,255," + (0.05 + Math.random() * 0.18).toFixed(3) + ")";
                    ctx.beginPath();
                    ctx.ellipse(cx, cy, crx, cry, Math.random() * Math.PI, 0, Math.PI * 2);
                    ctx.fill();
                }
            });
        }

        function createCloudTexture(size) {
            return createCanvasTexture(size, function(ctx, s) {
                ctx.clearRect(0, 0, s, s);
                for (var i = 0; i < 140; i++) {
                    var x = Math.random() * s;
                    var y = Math.random() * s;
                    var rx = 18 + Math.random() * 70;
                    var ry = 7 + Math.random() * 24;
                    var alpha = 0.08 + Math.random() * 0.24;
                    ctx.fillStyle = "rgba(255,255,255," + alpha.toFixed(3) + ")";
                    ctx.beginPath();
                    ctx.ellipse(x, y, rx, ry, Math.random() * Math.PI, 0, Math.PI * 2);
                    ctx.fill();
                }
            });
        }

        function createSunTexture(size) {
            return createCanvasTexture(size, function(ctx, s) {
                var g = ctx.createRadialGradient(s * 0.5, s * 0.5, s * 0.08, s * 0.5, s * 0.5, s * 0.52);
                g.addColorStop(0, "#fff5b8");
                g.addColorStop(0.45, "#ffd676");
                g.addColorStop(0.75, "#ffaf52");
                g.addColorStop(1, "#d66d1f");
                ctx.fillStyle = g;
                ctx.fillRect(0, 0, s, s);

                for (var spot = 0; spot < 90; spot++) {
                    var sx = Math.random() * s;
                    var sy = Math.random() * s;
                    var sr = 5 + Math.random() * 28;
                    ctx.fillStyle = "rgba(198,82,18," + (0.04 + Math.random() * 0.12).toFixed(3) + ")";
                    ctx.beginPath();
                    ctx.arc(sx, sy, sr, 0, Math.PI * 2);
                    ctx.fill();
                }

                for (var i = 0; i < 55; i++) {
                    ctx.strokeStyle = "rgba(255,222,120," + (0.08 + Math.random() * 0.22).toFixed(3) + ")";
                    ctx.lineWidth = 1 + Math.random() * 4;
                    ctx.beginPath();
                    var y = Math.random() * s;
                    ctx.moveTo(0, y);
                    for (var x = 0; x <= s; x += 20) {
                        ctx.lineTo(x, y + Math.sin((x / s) * Math.PI * 5 + i) * (4 + Math.random() * 11));
                    }
                    ctx.stroke();
                }
            });
        }

        var scene = new THREE.Scene();
        scene.background = new THREE.Color(0x0c1023);
        scene.fog = new THREE.Fog(0x0c1023, 19, 43);

        var camera = new THREE.PerspectiveCamera(55, container.clientWidth / container.clientHeight, 0.1, 100);
        camera.position.set(0, 5.8, 15);
        camera.lookAt(0, 0, 0);

        var renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
        renderer.setSize(container.clientWidth, container.clientHeight);
        renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
        renderer.toneMapping = THREE.ACESFilmicToneMapping;
        renderer.outputColorSpace = THREE.SRGBColorSpace;
        container.appendChild(renderer.domElement);

        var sunTexture = createSunTexture(1024);
        var earthTexture = createEarthTexture(1024);
        var moonTexture = createMoonTexture(768);
        var cloudTexture = createCloudTexture(1024);
        var gasTexture = createGasTexture(1024, ["#d9b786", "#c99863", "#eccca1", "#b9824d", "#f0d6b1"]);
        var farPlanetTexture = createGasTexture(1024, ["#f3ddb2", "#dfc08f", "#caa06e", "#b88753"]);
        var asteroidTexture = createRockTexture(384, "#8e93ab", "#4a5066", "#b8bfd0");
        var particleTexture = createParticleTexture(64);
        var sunCoronaTexture = createSolarCoronaTexture(1024, "rgba(255,245,188,0.95)", "rgba(255,155,70,0)");
        var sunOuterGlowTexture = createSolarCoronaTexture(1024, "rgba(255,210,142,0.68)", "rgba(255,140,56,0)");

        var composer = null;
        if (THREE.EffectComposer && THREE.RenderPass && THREE.UnrealBloomPass) {
            composer = new THREE.EffectComposer(renderer);
            composer.addPass(new THREE.RenderPass(scene, camera));
            var bloom = new THREE.UnrealBloomPass(
                new THREE.Vector2(container.clientWidth, container.clientHeight),
                1.05,
                0.95,
                0.6
            );
            composer.addPass(bloom);
        }

        scene.add(new THREE.HemisphereLight(0xbad6ff, 0x4a2f55, 0.62));

        var directional = new THREE.DirectionalLight(0xfff0db, 1.05);
        directional.position.set(8, 11, 7);
        scene.add(directional);

        var fill = new THREE.PointLight(0x5ecbff, 0.92, 34, 1.1);
        fill.position.set(-9, 5, -5);
        scene.add(fill);

        var glow = new THREE.PointLight(0x5bffcb, 1.12, 36, 1.2);
        glow.position.set(0, 6.2, 5);
        scene.add(glow);

        var magenta = new THREE.PointLight(0xff6fd0, 0.72, 32, 1.3);
        magenta.position.set(6.5, 4.2, -8.2);
        scene.add(magenta);

        var amber = new THREE.PointLight(0xffb76d, 0.58, 26, 1.25);
        amber.position.set(-6.8, 3.8, 4.4);
        scene.add(amber);

        var starCount = 380;
        var starArray = new Float32Array(starCount * 3);
        for (var i = 0; i < starCount; i++) {
            starArray[i * 3] = (Math.random() - 0.5) * 76;
            starArray[i * 3 + 1] = Math.random() * 24 + 0.5;
            starArray[i * 3 + 2] = -26 - Math.random() * 58;
        }
        var starGeo = new THREE.BufferGeometry();
        starGeo.setAttribute("position", new THREE.BufferAttribute(starArray, 3));
        var stars = new THREE.Points(
            starGeo,
            new THREE.PointsMaterial({
                color: 0xffffff,
                map: particleTexture,
                size: 0.14,
                transparent: true,
                opacity: 0.92,
                depthWrite: false,
                alphaTest: 0.18
            })
        );
        scene.add(stars);

        var mistCount = 120;
        var mistArray = new Float32Array(mistCount * 3);
        for (var m = 0; m < mistCount; m++) {
            mistArray[m * 3] = (Math.random() - 0.5) * 34;
            mistArray[m * 3 + 1] = Math.random() * 2.4 - 1.3;
            mistArray[m * 3 + 2] = (Math.random() - 0.5) * 24;
        }
        var mistGeo = new THREE.BufferGeometry();
        mistGeo.setAttribute("position", new THREE.BufferAttribute(mistArray, 3));
        var mist = new THREE.Points(
            mistGeo,
            new THREE.PointsMaterial({
                color: 0xbda8ff,
                map: particleTexture,
                size: 0.22,
                transparent: true,
                opacity: 0.26,
                depthWrite: false,
                alphaTest: 0.1
            })
        );
        mist.position.y = -1.35;
        scene.add(mist);

        var fireflyCount = 90;
        var fireflyArray = new Float32Array(fireflyCount * 3);
        for (var ff = 0; ff < fireflyCount; ff++) {
            fireflyArray[ff * 3] = (Math.random() - 0.5) * 26;
            fireflyArray[ff * 3 + 1] = -1.9 + Math.random() * 2.8;
            fireflyArray[ff * 3 + 2] = (Math.random() - 0.5) * 18;
        }
        var fireflyGeo = new THREE.BufferGeometry();
        fireflyGeo.setAttribute("position", new THREE.BufferAttribute(fireflyArray, 3));
        var fireflies = new THREE.Points(
            fireflyGeo,
            new THREE.PointsMaterial({
                color: 0xffd0ef,
                map: particleTexture,
                size: 0.12,
                transparent: true,
                opacity: 0.6,
                depthWrite: false,
                alphaTest: 0.12
            })
        );
        scene.add(fireflies);

        var asteroidGeo = new THREE.IcosahedronGeometry(0.34, 0);
        var asteroidMat = new THREE.MeshStandardMaterial({
            map: asteroidTexture,
            color: 0xffffff,
            emissive: 0x1e2533,
            emissiveIntensity: 0.2,
            roughness: 0.94,
            metalness: 0.04,
            flatShading: true
        });
        var asteroidCount = 110;
        var asteroids = [];
        for (var ai = 0; ai < asteroidCount; ai++) {
            var asteroid = new THREE.Mesh(asteroidGeo, asteroidMat);
            var ringAngle = Math.random() * Math.PI * 2;
            var ringRadius = 20 + Math.random() * 14;
            asteroid.position.set(
                Math.cos(ringAngle) * ringRadius,
                -0.7 + Math.random() * 2.2,
                -18 - Math.random() * 14
            );
            var s = 0.55 + Math.random() * 1.2;
            asteroid.scale.setScalar(s);
            asteroid.rotation.set(
                Math.random() * Math.PI,
                Math.random() * Math.PI,
                Math.random() * Math.PI
            );
            scene.add(asteroid);
            asteroids.push({
                mesh: asteroid,
                spinX: 0.002 + Math.random() * 0.004,
                spinY: 0.0015 + Math.random() * 0.0035,
                phase: Math.random() * Math.PI * 2,
                baseScale: s,
                home: asteroid.position.clone(),
                flying: false,
                removed: false,
                vel: new THREE.Vector3()
            });
        }

        var spaceGroup = new THREE.Group();
        scene.add(spaceGroup);

        var farPlanet = new THREE.Mesh(
            new THREE.SphereGeometry(2.4, 36, 36),
            new THREE.MeshStandardMaterial({
                map: farPlanetTexture,
                color: 0xffffff,
                emissive: 0x513118,
                emissiveIntensity: 0.14,
                roughness: 0.92,
                metalness: 0.03
            })
        );
        farPlanet.position.set(-10.5, 0.9, -21.5);
        spaceGroup.add(farPlanet);

        var gasGiant = new THREE.Mesh(
            new THREE.SphereGeometry(3.2, 36, 36),
            new THREE.MeshStandardMaterial({
                map: gasTexture,
                color: 0xffffff,
                emissive: 0x4f3016,
                emissiveIntensity: 0.12,
                roughness: 0.9,
                metalness: 0.02
            })
        );
        gasGiant.position.set(10.8, 0.7, -22.5);
        spaceGroup.add(gasGiant);

        var moonA = new THREE.Mesh(
            new THREE.SphereGeometry(0.7, 18, 18),
            new THREE.MeshStandardMaterial({
                map: moonTexture,
                color: 0xd7dbe1,
                emissive: 0x222735,
                emissiveIntensity: 0.08,
                roughness: 0.95,
                metalness: 0.02
            })
        );
        moonA.position.set(gasGiant.position.x + 5.3, gasGiant.position.y + 0.4, gasGiant.position.z + 0.8);
        spaceGroup.add(moonA);

        var moonB = new THREE.Mesh(
            new THREE.SphereGeometry(0.52, 16, 16),
            new THREE.MeshStandardMaterial({
                map: moonTexture,
                color: 0xb8becd,
                emissive: 0x1f2533,
                emissiveIntensity: 0.07,
                roughness: 0.95,
                metalness: 0.02
            })
        );
        moonB.position.set(gasGiant.position.x - 4.1, gasGiant.position.y - 1.3, gasGiant.position.z - 1.1);
        spaceGroup.add(moonB);

        var comet = new THREE.Mesh(
            new THREE.SphereGeometry(0.26, 12, 12),
            new THREE.MeshBasicMaterial({
                color: 0xfff6d4,
                transparent: true,
                opacity: 0.95
            })
        );
        comet.position.set(-20, 1.2, -19.5);
        spaceGroup.add(comet);

        var cometTailCount = 18;
        var cometTailHistory = [];
        var cometTailSprites = [];
        for (var ct = 0; ct < cometTailCount; ct++) {
            cometTailHistory.push(comet.position.clone());
            var tail = new THREE.Sprite(
                new THREE.SpriteMaterial({
                    map: particleTexture,
                    color: 0xffd39d,
                    transparent: true,
                    opacity: Math.max(0, 0.45 - ct * 0.022),
                    depthWrite: false,
                    blending: THREE.AdditiveBlending
                })
            );
            var scale = 0.95 - ct * 0.035;
            tail.scale.set(scale, scale, 1);
            tail.position.copy(comet.position);
            spaceGroup.add(tail);
            cometTailSprites.push(tail);
        }

        var sun = new THREE.Mesh(
            new THREE.SphereGeometry(3.4, 48, 48),
            new THREE.MeshStandardMaterial({
                map: sunTexture,
                color: 0xffffff,
                emissive: 0xffb45a,
                emissiveMap: sunTexture,
                emissiveIntensity: 1.32,
                roughness: 1,
                metalness: 0,
                fog: false,
                transparent: true,
                opacity: 0.98
            })
        );
        sun.position.set(-9.2, 0.8, -15.6);
        scene.add(sun);

        var sunHalo = new THREE.Sprite(
            new THREE.SpriteMaterial({
                map: sunCoronaTexture,
                color: 0xffffff,
                transparent: true,
                opacity: 0.48,
                depthWrite: false,
                fog: false,
                blending: THREE.AdditiveBlending
            })
        );
        sunHalo.position.copy(sun.position);
        sunHalo.scale.set(11.2, 11.2, 1);
        scene.add(sunHalo);

        var sunCorona = new THREE.Sprite(
            new THREE.SpriteMaterial({
                map: sunOuterGlowTexture,
                color: 0xffffff,
                transparent: true,
                opacity: 0.32,
                depthWrite: false,
                fog: false,
                blending: THREE.AdditiveBlending
            })
        );
        sunCorona.position.copy(sun.position);
        sunCorona.scale.set(14.2, 14.2, 1);
        scene.add(sunCorona);

        var earth = new THREE.Mesh(
            new THREE.SphereGeometry(1.75, 36, 36),
            new THREE.MeshStandardMaterial({
                map: earthTexture,
                color: 0xffffff,
                roughness: 0.72,
                metalness: 0.04,
                emissive: 0x102850,
                emissiveIntensity: 0.08
            })
        );
        earth.position.set(8.6, 0.35, -15.4);
        scene.add(earth);

        var earthClouds = new THREE.Mesh(
            new THREE.SphereGeometry(1.8, 36, 36),
            new THREE.MeshStandardMaterial({
                map: cloudTexture,
                color: 0xffffff,
                transparent: true,
                opacity: 0.34,
                depthWrite: false,
                roughness: 1,
                metalness: 0
            })
        );
        earthClouds.position.copy(earth.position);
        scene.add(earthClouds);

        var moon = new THREE.Mesh(
            new THREE.SphereGeometry(0.66, 20, 20),
            new THREE.MeshStandardMaterial({
                map: moonTexture,
                color: 0xffffff,
                emissive: 0x252b3c,
                emissiveIntensity: 0.1,
                roughness: 0.96,
                metalness: 0.01
            })
        );
        moon.position.set(earth.position.x + 3, earth.position.y + 0.2, earth.position.z + 1);
        scene.add(moon);

        function layoutDecorForViewport() {
            var aspect = Math.max(1, container.clientWidth / Math.max(container.clientHeight, 1));
            var spread = 8.4 + Math.min(3.6, (aspect - 1) * 2.8);
            var yBand = 0.7;
            var orbitOriginX = -spread;
            var sunX = orbitOriginX - 1.25;
            var earthOrbit = 15.2 + Math.min(2.8, (aspect - 1) * 1.3);
            var farOrbit = 5.4 + Math.min(1.0, (aspect - 1) * 0.45);
            var gasOrbit = 26.2 + Math.min(4.2, (aspect - 1) * 2.1);

            // Colocacion tipo sistema solar: planeta interno, Tierra, gigante gaseoso.
            sun.position.set(sunX, yBand + 0.18, -16.0);
            sunHalo.position.copy(sun.position);
            sunCorona.position.copy(sun.position);

            farPlanet.position.set(orbitOriginX + farOrbit, yBand - 0.05, -18.2);
            earth.position.set(orbitOriginX + earthOrbit, yBand - 0.24, -22.2);
            earthClouds.position.copy(earth.position);

            gasGiant.position.set(orbitOriginX + gasOrbit, yBand + 0.1, -27.6);
        }

        layoutDecorForViewport();

        function launchAsteroid(asteroidObj) {
            if (!asteroidObj || asteroidObj.flying || asteroidObj.removed) {
                return false;
            }

            asteroidObj.flying = true;
            asteroidObj.removed = false;

            var dir = new THREE.Vector3(
                (Math.random() - 0.5) * 0.55,
                0.25 + Math.random() * 0.45,
                -0.85 - Math.random() * 0.25
            ).normalize();
            var speed = 0.13 + Math.random() * 0.08;
            asteroidObj.vel.copy(dir).multiplyScalar(speed);
            return true;
        }

        function tryBlastAsteroid(raycaster) {
            if (!raycaster) {
                return null;
            }

            var available = [];
            for (var i = 0; i < asteroids.length; i++) {
                if (!asteroids[i].flying && !asteroids[i].removed) {
                    available.push(asteroids[i].mesh);
                }
            }
            if (!available.length) {
                return null;
            }

            var intersections = raycaster.intersectObjects(available, false);
            if (!intersections.length) {
                return null;
            }

            var hitMesh = intersections[0].object;
            for (var j = 0; j < asteroids.length; j++) {
                if (asteroids[j].mesh === hitMesh) {
                    if (launchAsteroid(asteroids[j])) {
                        return intersections[0].point.clone();
                    }
                    break;
                }
            }

            return null;
        }

        function setGameplayDistance(distance) {
            var clamped = Math.max(8, Math.min(20, distance));
            camera.position.z = clamped;
            camera.position.y = 2.8 + clamped * 0.12;
            camera.lookAt(0, -0.5, 0);
            layoutDecorForViewport();
        }

        function render() {
            if (composer) {
                composer.render();
            } else {
                renderer.render(scene, camera);
            }
        }

        function resize() {
            var w = container.clientWidth;
            var h = container.clientHeight;
            camera.aspect = w / h;
            camera.updateProjectionMatrix();
            renderer.setSize(w, h);
            if (composer) {
                composer.setSize(w, h);
            }
            layoutDecorForViewport();
        }

        function updateEnvironment(timeSeconds) {
            var t = timeSeconds || 0;
            glow.position.x = Math.sin(t * 0.6) * 4.8;
            glow.position.z = 4 + Math.cos(t * 0.8) * 2.2;
            fill.position.z = -4.5 + Math.sin(t * 0.5) * 1.7;
            stars.rotation.y += 0.0004;
            mist.rotation.y += 0.0008;
            fireflies.rotation.y += 0.0012;
            fireflies.material.opacity = 0.45 + Math.sin(t * 1.7) * 0.12;
            sunHalo.scale.setScalar(11.2 * (1 + Math.sin(t * 0.55) * 0.05));
            sunHalo.material.opacity = 0.42 + Math.sin(t * 1.2) * 0.06;
            sunCorona.scale.setScalar(14.2 * (1 + Math.sin(t * 0.85 + 0.7) * 0.07));
            sunCorona.material.opacity = 0.24 + Math.sin(t * 1.05 + 0.35) * 0.05;
            earth.rotation.y += 0.0015;
            earthClouds.rotation.y += 0.00195;
            // Orbita mas amplia para evitar cualquier interseccion visual con la Tierra.
            var moonOrbit = t * 0.52;
            var moonOrbitRadiusX = 4.35;
            var moonOrbitRadiusZ = 3.85;
            moon.position.x = earth.position.x + Math.cos(moonOrbit) * moonOrbitRadiusX;
            moon.position.z = earth.position.z + Math.sin(moonOrbit) * moonOrbitRadiusZ;
            moon.position.y = earth.position.y + Math.sin(moonOrbit * 1.3) * 0.5;
            earthClouds.position.copy(earth.position);

            farPlanet.rotation.y += 0.0012;
            gasGiant.rotation.y += 0.00075;

            var moonOrbitA = t * 0.38;
            moonA.position.x = gasGiant.position.x + Math.cos(moonOrbitA) * 6.0;
            moonA.position.z = gasGiant.position.z + Math.sin(moonOrbitA) * 4.8;
            moonA.position.y = gasGiant.position.y + Math.sin(moonOrbitA * 1.4) * 0.9;

            var moonOrbitB = -t * 0.54;
            moonB.position.x = gasGiant.position.x + Math.cos(moonOrbitB) * 5.2;
            moonB.position.z = gasGiant.position.z + Math.sin(moonOrbitB) * 4.25;
            moonB.position.y = gasGiant.position.y - 1.2 + Math.cos(moonOrbitB * 1.3) * 0.55;

            // Cometa en capa de fondo para no cruzar visualmente planetas.
            var cometOrbit = t * 0.22;
            comet.position.x = sun.position.x + 8 + Math.cos(cometOrbit) * 33;
            comet.position.y = 2.35 + Math.sin(cometOrbit * 1.15) * 1.2;
            comet.position.z = -34.5 + Math.sin(cometOrbit * 0.7) * 5.1;

            cometTailHistory.unshift(comet.position.clone());
            if (cometTailHistory.length > cometTailCount) {
                cometTailHistory.pop();
            }
            for (var ti = 0; ti < cometTailSprites.length; ti++) {
                cometTailSprites[ti].position.copy(cometTailHistory[ti]);
                var tscale = Math.max(0.12, 0.96 - ti * 0.045);
                cometTailSprites[ti].scale.set(tscale, tscale, 1);
                cometTailSprites[ti].material.opacity = Math.max(0, 0.28 - ti * 0.015);
            }

            for (var a = 0; a < asteroids.length; a++) {
                var asteroidObj = asteroids[a];
                if (asteroidObj.removed) {
                    continue;
                }

                if (asteroidObj.flying) {
                    asteroidObj.mesh.rotation.x += asteroidObj.spinX * 2.4;
                    asteroidObj.mesh.rotation.y += asteroidObj.spinY * 2.4;
                    asteroidObj.mesh.position.add(asteroidObj.vel);
                    asteroidObj.vel.y += 0.0012;
                    asteroidObj.vel.z -= 0.0011;
                    asteroidObj.vel.multiplyScalar(1.008);
                    asteroidObj.mesh.scale.multiplyScalar(0.966);

                    if (asteroidObj.mesh.scale.x < 0.03 || asteroidObj.mesh.position.z < -90) {
                        asteroidObj.flying = false;
                        asteroidObj.removed = true;
                        asteroidObj.mesh.visible = false;
                    }
                    continue;
                }

                asteroidObj.mesh.rotation.x += asteroidObj.spinX;
                asteroidObj.mesh.rotation.y += asteroidObj.spinY;
                asteroidObj.mesh.position.y += Math.sin(t * 0.55 + asteroidObj.phase) * 0.0016;
            }
        }

        return {
            scene: scene,
            camera: camera,
            renderer: renderer,
            glow: glow,
            setGameplayDistance: setGameplayDistance,
            tryBlastAsteroid: tryBlastAsteroid,
            updateEnvironment: updateEnvironment,
            render: render,
            resize: resize
        };
    }

    window.Memory3DScene = { createSceneContext: createSceneContext };
})();
