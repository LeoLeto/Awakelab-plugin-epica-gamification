(function() {
    "use strict";

    function stepDragfillAnimation(state) {
        var t = state.t;
        var answerCards = state.answerCards;
        var questionCards = state.questionCards;
        var reviewMode = state.reviewMode;
        var reviewFocusIndex = state.reviewFocusIndex;
        var questionMotionTarget = state.questionMotionTarget;
        var cameraTargetPos = state.cameraTargetPos;
        var camera = state.camera;
        var defaultCameraPos = state.defaultCameraPos;
        var cameraLookAt = state.cameraLookAt;

        for (var i = 0; i < answerCards.length; i++) {
            var card = answerCards[i];
            if (card.flashWrong > 0) {
                card.flashWrong = Math.max(0, card.flashWrong - 0.05);
            }
            if (!card.dragging) {
                card.mesh.position.lerp(card.target, 0.18);
            }
            var scale = card.mesh.scale.x + (card.targetScale - card.mesh.scale.x) * 0.2;
            card.mesh.scale.set(scale, scale, 1);

            var hover = (!card.locked && !card.dragging) ? Math.sin(t * 1.9 + card.phase) * 0.043 : 0;
            if (!card.dragging) {
                card.mesh.position.y += (card.target.y + hover - card.mesh.position.y) * 0.16;
            }
            card.mesh.rotation.x += (card.targetRotX - card.mesh.rotation.x) * 0.15;
            card.mesh.rotation.z += (card.targetRotZ - card.mesh.rotation.z) * 0.15;

            if (card.frontMaterial && card.frontMaterial.emissive) {
                var wrongTint = card.flashWrong || 0;
                var baseIntensity = card.dragging ? 0.4 : (card.locked ? 0.24 : 0.17);
                card.frontMaterial.emissive.setHex(wrongTint > 0 ? 0x7a2424 : 0x254870);
                card.frontMaterial.emissiveIntensity = baseIntensity + wrongTint * 0.62;
            }
        }

        for (var q = 0; q < questionCards.length; q++) {
            var question = questionCards[q];
            if (question.pulse > 0) {
                question.pulse = Math.max(0, question.pulse - 0.028);
            }
            var driftY = 0;
            var driftX = 0;
            var driftRotZ = 0;
            if (reviewMode) {
                driftY = Math.sin(t * 0.95 + question.phase) * 0.03;
                driftRotZ = Math.sin(t * 0.75 + question.phase) * 0.008;
            } else if (question.filled) {
                driftY = Math.sin(t * 0.8 + question.phase) * 0.012;
            } else if (!question.filled) {
                driftY = Math.sin(t * 1.3 + question.phase) * 0.025;
                driftX = Math.cos(t * 1.1 + question.phase) * 0.03;
                driftRotZ = Math.sin(t * 1.05 + question.phase) * 0.006;
            }

            questionMotionTarget.copy(question.targetPos);
            questionMotionTarget.y += driftY;
            questionMotionTarget.x += driftX;
            question.mesh.position.lerp(questionMotionTarget, 0.14);
            var pulseScale = question.pulse > 0 ? (1 + question.pulse * 0.2) : 1;
            var focusScale = (reviewMode && reviewFocusIndex === question.index) ? 1.09 : 1;
            var qScaleTarget = question.targetScale * pulseScale * focusScale;
            var qScale = question.mesh.scale.x + (qScaleTarget - question.mesh.scale.x) * 0.14;
            question.mesh.scale.set(qScale, qScale, 1);
            question.mesh.rotation.x += (question.targetRotX - question.mesh.rotation.x) * 0.12;
            question.mesh.rotation.y += (question.targetRotY - question.mesh.rotation.y) * 0.12;
            question.mesh.rotation.z += ((question.targetRotZ + driftRotZ) - question.mesh.rotation.z) * 0.12;

        }

        if (reviewMode && reviewFocusIndex >= 0) {
            var focusCard = questionCards[reviewFocusIndex];
            if (focusCard) {
                cameraTargetPos.set(
                    focusCard.mesh.position.x,
                    focusCard.mesh.position.y + 0.12,
                    defaultCameraPos.z
                );
                camera.position.lerp(cameraTargetPos, 0.08);
                camera.lookAt(focusCard.mesh.position.x, focusCard.mesh.position.y + 0.02, 0);
            }
        } else {
            camera.position.lerp(defaultCameraPos, 0.06);
            camera.lookAt(cameraLookAt.x, cameraLookAt.y, cameraLookAt.z);
        }
    }

    window.Memory3DDragfillAnimation = {
        mode: "dragfill3d_animation",
        step: stepDragfillAnimation
    };
})();
