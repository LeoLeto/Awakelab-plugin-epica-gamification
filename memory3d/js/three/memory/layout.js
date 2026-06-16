(function() {
    "use strict";

    function computeLayoutMetrics(count, cardWidth) {
        var safeCount = Math.max(1, Math.min(15, count || 1));
        var rows = 1;
        var cols = 1;

        if (safeCount === 1) {
            rows = 1;
            cols = 1;
        } else if (safeCount === 2) {
            rows = 2;
            cols = 1;
        } else if (safeCount === 3) {
            rows = 3;
            cols = 1;
        } else if (safeCount <= 4) {
            rows = 2;
            cols = 2;
        } else if (safeCount <= 6) {
            rows = 3;
            cols = 2;
        } else if (safeCount <= 8) {
            rows = 4;
            cols = 2;
        } else if (safeCount === 9) {
            rows = 3;
            cols = 3;
        } else if (safeCount === 10) {
            rows = 5;
            cols = 2;
        } else if (safeCount <= 12) {
            rows = 4;
            cols = 3;
        } else {
            rows = 5;
            cols = 3;
        }

        var zGap = rows >= 5 ? 3.45 : 3.35;
        var xGap = cardWidth + 1.02;
        var sideCenter = 4.45 + Math.max(0, cols - 2) * 0.9;

        return {
            rows: rows,
            cols: cols,
            zGap: zGap,
            xGap: xGap,
            sideCenter: sideCenter
        };
    }

    function getLayoutPosition(index, layout, isQuestion) {
        var row = index % layout.rows;
        var col = Math.floor(index / layout.rows);
        var zStart = -((layout.rows - 1) * layout.zGap) / 2;
        var sideCenterX = isQuestion ? layout.sideCenter : -layout.sideCenter;
        var colOffset = (col - (layout.cols - 1) / 2) * layout.xGap;
        var farRowLift = ((layout.rows - 1) / 2 - row) * 0.34;

        return {
            x: sideCenterX + colOffset,
            y: -0.96 + farRowLift,
            z: zStart + row * layout.zGap
        };
    }

    window.Memory3DMemoryLayout = {
        computeLayoutMetrics: computeLayoutMetrics,
        getLayoutPosition: getLayoutPosition
    };
})();
