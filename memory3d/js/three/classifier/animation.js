(function() {
    "use strict";

    function stepClassifierAnimation(state) {
        var t = state.t;
        var portals = state.portals || [];
        var nearestPortal = state.nearestPortal || null;
        var card = state.card;
        var cardFrontMat = state.cardFrontMat;
        var parkedCards = state.parkedCards || [];
        var flashes = state.flashes || [];
        var scene = state.scene;

        for (var i = 0; i < portals.length; i++) {
            var portal = portals[i];
            var hover = nearestPortal === portal ? 1.12 : 1;
            portal.targetScale += (hover - portal.targetScale) * 0.22;
            var wobble = Math.sin(t * 2.1 + portal.phase) * 0.01;
            portal.mesh.scale.set(portal.targetScale + wobble, portal.targetScale + wobble, 1);
            portal.mesh.material.opacity = 1;
        }

        if (card && !card.dragging) {
            card.mesh.position.lerp(card.targetPos, 0.16);
        }
        if (card) {
            card.mesh.rotation.x += ((-0.015 + Math.sin(t * 1.7) * 0.01) - card.mesh.rotation.x) * 0.12;
            card.mesh.rotation.z += (Math.sin(t * 1.3) * 0.01 - card.mesh.rotation.z) * 0.1;

            if (card.flashWrong > 0) {
                card.flashWrong = Math.max(0, card.flashWrong - 0.04);
            }
            if (card.pulseOk > 0) {
                card.pulseOk = Math.max(0, card.pulseOk - 0.05);
            }

            if (cardFrontMat) {
                var wrongTint = card.flashWrong;
                var okPulse = card.pulseOk;
                cardFrontMat.emissive.setHex(wrongTint > 0 ? 0x7a2424 : 0x1e6d51);
                cardFrontMat.emissiveIntensity = 0.18 + wrongTint * 0.55 + okPulse * 0.35;
                var scalePulse = 1 + okPulse * 0.18 + Math.sin(t * 8) * 0.015 * okPulse;
                card.mesh.scale.set(scalePulse, scalePulse, 1);
            }
        }

        for (var k = 0; k < parkedCards.length; k++) {
            var parked = parkedCards[k];
            var focusMotionFactor = parked.isFocusedGroup ? 0.22 : 1;
            var floatX = Math.sin(t * 0.85 + parked.phase) * 0.05 * focusMotionFactor;
            var floatY = Math.sin(t * 1.25 + parked.phase * 1.3) * 0.045 * focusMotionFactor;
            parked.mesh.position.x += ((parked.targetPos.x + floatX) - parked.mesh.position.x) * 0.12;
            parked.mesh.position.y += ((parked.targetPos.y + floatY) - parked.mesh.position.y) * 0.12;
            parked.mesh.position.z += (parked.targetPos.z - parked.mesh.position.z) * 0.12;

            var rotXTarget = parked.targetRotX + Math.sin(t * 1.05 + parked.phase) * 0.012 * focusMotionFactor;
            var rotYTarget = parked.targetRotY + Math.cos(t * 0.95 + parked.phase) * 0.018 * focusMotionFactor;
            var rotZTarget = parked.targetRotZ + Math.sin(t * 1.18 + parked.phase * 1.1) * 0.014 * focusMotionFactor;
            parked.mesh.rotation.x += (rotXTarget - parked.mesh.rotation.x) * 0.12;
            parked.mesh.rotation.y += (rotYTarget - parked.mesh.rotation.y) * 0.12;
            parked.mesh.rotation.z += (rotZTarget - parked.mesh.rotation.z) * 0.12;

            var scaleTarget = parked.targetScale + Math.sin(t * 1.6 + parked.phase) * 0.014 * focusMotionFactor;
            parked.mesh.scale.x += (scaleTarget - parked.mesh.scale.x) * 0.14;
            parked.mesh.scale.y += (scaleTarget - parked.mesh.scale.y) * 0.14;
            parked.mesh.scale.z += (parked.targetScale - parked.mesh.scale.z) * 0.14;
            if (parked.mesh.material) {
                var targetOpacity = (typeof parked.targetOpacity === "number") ? parked.targetOpacity : 1;
                parked.mesh.material.opacity += (targetOpacity - parked.mesh.material.opacity) * 0.16;
            }
        }

        for (var b = flashes.length - 1; b >= 0; b--) {
            var burst = flashes[b];
            burst.life -= 0.03;
            var attr = burst.mesh.geometry.getAttribute("position");
            for (var p = 0; p < burst.velocities.length; p++) {
                var vx = burst.velocities[p].x;
                var vy = burst.velocities[p].y;
                var vz = burst.velocities[p].z;
                attr.array[p * 3] += vx;
                attr.array[p * 3 + 1] += vy;
                attr.array[p * 3 + 2] += vz;
                burst.velocities[p].y -= 0.0038;
            }
            attr.needsUpdate = true;
            burst.mesh.material.opacity = Math.max(0, burst.life);
            if (burst.life <= 0) {
                scene.remove(burst.mesh);
                burst.mesh.geometry.dispose();
                burst.mesh.material.dispose();
                flashes.splice(b, 1);
            }
        }
    }

    window.Memory3DClassifierAnimation = {
        mode: "classifier3d_animation",
        step: stepClassifierAnimation
    };
})();
