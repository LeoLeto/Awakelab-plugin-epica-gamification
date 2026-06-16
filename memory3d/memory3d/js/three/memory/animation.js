(function() {
    "use strict";

    function stepMemoryAnimation(state) {
        var cards = state.cards;
        var pulseRings = state.pulseRings;
        var scene = state.scene;
        var t = state.t;
        var getFocusSlot = state.getFocusSlot;

        for (var i = 0; i < cards.length; i++) {
            var card = cards[i];
            var phase = card.centerPhase;

            card.mesh.rotation.y += (card.targetYRot - card.mesh.rotation.y) * 0.2;
            var rotZTarget = 0;
            var rotXTarget = -0.03;
            if (card.selected) {
                rotZTarget = 0.01 + Math.sin(t * 6 + phase) * 0.025;
                rotXTarget = -0.01 + Math.cos(t * 5 + phase) * 0.02;
            }
            card.mesh.rotation.z += (rotZTarget - card.mesh.rotation.z) * 0.16;
            card.mesh.rotation.x += (rotXTarget - card.mesh.rotation.x) * 0.13;

            var targetScale = card.selected
                ? 1.12 + Math.sin(t * 7 + phase) * 0.03
                : 1;

            if (!card.selected && card.matchAnim > 0) {
                card.matchAnim = Math.max(0, card.matchAnim - 0.025);
                targetScale = Math.max(targetScale, 1 + 0.24 * card.matchAnim);
            }

            card.mesh.scale.x += (targetScale - card.mesh.scale.x) * 0.15;
            card.mesh.scale.y += (targetScale - card.mesh.scale.y) * 0.15;
            card.mesh.scale.z += (1 - card.mesh.scale.z) * 0.15;

            if (card.selected) {
                var slot = getFocusSlot(card);
                var slotFloat = Math.sin(t * 4 + phase) * 0.11;
                var slotDrift = Math.cos(t * 3.2 + phase) * 0.06;
                card.mesh.position.x += ((slot.x + slotDrift) - card.mesh.position.x) * 0.18;
                card.mesh.position.z += (slot.z - card.mesh.position.z) * 0.18;
                card.mesh.position.y += ((slot.y + slotFloat) - card.mesh.position.y) * 0.18;
            } else {
                var matchedBob = card.matched ? Math.sin(t * 2.2 + phase) * 0.06 : 0;
                var matchedDriftX = card.matched ? Math.sin(t * 1.15 + phase) * 0.025 : 0;
                var matchedDriftZ = card.matched ? Math.cos(t * 1.05 + phase) * 0.02 : 0;
                var idleBob = card.matched ? matchedBob : Math.sin(t * 1.3 + card.bobOffset) * 0.05;
                var returnBounce = 0;
                if (card.matchAnim > 0) {
                    returnBounce = Math.sin((1 - card.matchAnim) * Math.PI * 3.4) * 0.2 * card.matchAnim;
                    card.mesh.rotation.z += (Math.sin(t * 16 + phase) * 0.06 * card.matchAnim - card.mesh.rotation.z) * 0.2;
                }
                if (card.matched && card.matchAnim <= 0) {
                    card.mesh.rotation.z += (Math.sin(t * 1.9 + phase) * 0.015 - card.mesh.rotation.z) * 0.08;
                    card.mesh.rotation.x += ((-0.025 + Math.cos(t * 2.1 + phase) * 0.01) - card.mesh.rotation.x) * 0.08;
                }
                card.mesh.position.x += ((card.homeX + matchedDriftX) - card.mesh.position.x) * 0.15;
                card.mesh.position.z += ((card.homeZ + matchedDriftZ) - card.mesh.position.z) * 0.15;
                card.mesh.position.y += ((card.homeY + idleBob + returnBounce) - card.mesh.position.y) * 0.15;
            }

            if (card.flashWrong > 0) {
                card.flashWrong = Math.max(0, card.flashWrong - 0.045);
            }
            var frontMat = card.mesh.material && card.mesh.material[4];
            if (frontMat && frontMat.emissive) {
                var baseHex = card.kind === "question" ? 0x271d6e : 0x234e5d;
                var baseIntensity = card.matched ? 0.5 : (card.selected ? 0.8 : 0.22);
                var wrongTint = card.flashWrong || 0;
                frontMat.emissive.setHex(wrongTint > 0 ? 0x7a2424 : baseHex);
                frontMat.emissiveIntensity = baseIntensity + wrongTint * 0.55;
            }
        }

        for (var p = pulseRings.length - 1; p >= 0; p--) {
            var pulse = pulseRings[p];
            pulse.life -= 0.02;
            pulse.mesh.scale.x += 0.022;
            pulse.mesh.scale.y += 0.022;
            pulse.mesh.material.opacity = Math.max(0, pulse.life * 0.85);
            if (pulse.life <= 0) {
                scene.remove(pulse.mesh);
                pulse.mesh.geometry.dispose();
                pulse.mesh.material.dispose();
                pulseRings.splice(p, 1);
            }
        }
    }

    window.Memory3DMemoryAnimation = {
        mode: "memory3d_animation",
        step: stepMemoryAnimation
    };
})();
