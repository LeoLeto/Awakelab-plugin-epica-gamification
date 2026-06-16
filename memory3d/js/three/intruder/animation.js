(function() {
    "use strict";

    function stepIntruderAnimation(state) {
        var t = state.t || 0;
        var cards = state.cards || [];
        var bursts = state.bursts || [];
        var scene = state.scene;

        for (var i = 0; i < cards.length; i++) {
            var card = cards[i];
            if (!card || !card.mesh || !card.targetPos) {
                continue;
            }

            var floatY = Math.sin(t * 1.3 + card.phase) * 0.06;
            var targetY = card.targetPos.y + floatY;
            card.mesh.position.x += (card.targetPos.x - card.mesh.position.x) * 0.14;
            card.mesh.position.y += (targetY - card.mesh.position.y) * 0.14;
            card.mesh.position.z += (card.targetPos.z - card.mesh.position.z) * 0.14;

            var targetRX = -0.012 + Math.sin(t * 1.1 + card.phase) * 0.01;
            var targetRZ = Math.cos(t * 0.9 + card.phase) * 0.01;
            card.mesh.rotation.x += (targetRX - card.mesh.rotation.x) * 0.12;
            card.mesh.rotation.z += (targetRZ - card.mesh.rotation.z) * 0.12;

            if (card.flash > 0) {
                card.flash = Math.max(0, card.flash - 0.05);
            }
            if (card.pulse > 0) {
                card.pulse = Math.max(0, card.pulse - 0.06);
            }

            if (card.material && card.material.emissive) {
                var bad = card.flash;
                var ok = card.pulse;
                card.material.emissive.setHex(bad > 0 ? 0x81243a : 0x1f3b63);
                card.material.emissiveIntensity = 0.17 + bad * 0.7 + ok * 0.4;
            }
        }

        for (var b = bursts.length - 1; b >= 0; b--) {
            var burst = bursts[b];
            burst.life -= 0.03;
            var attr = burst.mesh.geometry.getAttribute("position");
            for (var p = 0; p < burst.velocities.length; p++) {
                attr.array[p * 3] += burst.velocities[p].x;
                attr.array[p * 3 + 1] += burst.velocities[p].y;
                attr.array[p * 3 + 2] += burst.velocities[p].z;
                burst.velocities[p].y -= 0.0042;
            }
            attr.needsUpdate = true;
            burst.mesh.material.opacity = Math.max(0, burst.life);
            if (burst.life <= 0) {
                scene.remove(burst.mesh);
                burst.mesh.geometry.dispose();
                burst.mesh.material.dispose();
                bursts.splice(b, 1);
            }
        }
    }

    window.Memory3DIntruderAnimation = {
        mode: "intruder3d_animation",
        step: stepIntruderAnimation
    };
})();
