const stepsPerDecade = 1_000;
const firstDecadeDigits = 5;
const firstDecade = 10n ** BigInt(firstDecadeDigits - 1);
const extension = 6 * stepsPerDecade;
const returnDuration = 1_500;
function offsetWithinStep(rank, digits) {
    // Pick a repeatable offset below 9 × 10^(digits - 1) with a nonzero last digit.
    let state = rank;
    let value = '';
    for (let place = 0; place < digits; place++) {
        state = (Math.imul(state, 1_664_525) + 1_013_904_223) >>> 0;
        const last = place === digits - 1;
        const choices = place === 0 || last ? 9 : 10;
        value += String((state >>> 16) % choices + (last ? 1 : 0));
    }
    return BigInt(value);
}
// The first 1,000 steps cover 0–10,000. Every additional 1,000
// covers another decimal decade, with exact integer targets.
function indexAtRank(rank) {
    if (rank < stepsPerDecade)
        return BigInt(rank) * 10n;
    const offset = rank - stepsPerDecade;
    const base = firstDecade * 10n ** BigInt(Math.floor(offset / stepsPerDecade));
    const width = base * 9n / BigInt(stepsPerDecade);
    const start = base + width * BigInt(offset % stepsPerDecade);
    return start + offsetWithinStep(rank, String(width).length);
}
function rankAtIndex(index, label) {
    if (index < firstDecade)
        return Number(index / 10n);
    const decade = label.length - firstDecadeDigits;
    const base = firstDecade * 10n ** BigInt(decade);
    const offset = (index - base) * BigInt(stepsPerDecade) / (9n * base);
    return (decade + 1) * stepsPerDecade + Number(offset);
}
export function createScrollRange(input, jumpToIndex) {
    const maximum = Number(input.max);
    const restStep = Math.round(maximum * 0.84);
    let limit = maximum;
    let anchorRank = maximum;
    let anchorStep = maximum;
    let currentIndex = 0n;
    let currentRank = 0;
    let activePointer;
    let animation;
    // The last section holds newly opened decades. Moving the boundary
    // keeps both the thumb and pointer input on the same scale.
    function rankAtStep(step) {
        if (step <= anchorStep)
            return Math.ceil(step * anchorRank / anchorStep);
        return anchorRank + Math.ceil((step - anchorStep) * (limit - anchorRank) / (maximum - anchorStep));
    }
    function paint() {
        let step = maximum;
        if (currentRank <= anchorRank) {
            step = Math.floor(currentRank * anchorStep / anchorRank);
        }
        else if (currentRank < limit) {
            step = anchorStep + Math.floor((currentRank - anchorRank) * (maximum - anchorStep) / (limit - anchorRank));
        }
        if (input.valueAsNumber !== step)
            input.valueAsNumber = step;
    }
    function stopAnimation() {
        if (animation === undefined)
            return;
        cancelAnimationFrame(animation);
        animation = undefined;
    }
    function animateReturn() {
        if (limit === anchorRank || anchorStep <= restStep || animation !== undefined)
            return;
        const start = performance.now();
        const from = anchorStep;
        function advance(now) {
            const progress = Math.min(1, (now - start) / returnDuration);
            anchorStep = Math.round(from + (restStep - from) * progress);
            paint();
            animation = progress < 1 ? requestAnimationFrame(advance) : undefined;
        }
        animation = requestAnimationFrame(advance);
    }
    function update(index) {
        if (index !== currentIndex) {
            currentIndex = index;
            const label = String(index);
            currentRank = rankAtIndex(index, label);
            input.setAttribute('aria-valuetext', label);
        }
        if (activePointer === undefined) {
            if (currentRank >= limit) {
                stopAnimation();
                anchorRank = currentRank;
                limit = currentRank + extension;
                anchorStep = maximum;
            }
            animateReturn();
        }
        paint();
    }
    input.addEventListener('input', () => {
        const index = indexAtRank(rankAtStep(input.valueAsNumber));
        jumpToIndex(index);
        update(index);
    });
    input.addEventListener('pointerdown', (event) => {
        if (!event.isPrimary || event.button !== 0)
            return;
        activePointer = event.pointerId;
        stopAnimation();
    });
    function releasePointer(event) {
        if (activePointer === undefined || (event && event.pointerId !== activePointer))
            return;
        activePointer = undefined;
        update(currentIndex);
    }
    window.addEventListener('pointerup', releasePointer);
    window.addEventListener('pointercancel', releasePointer);
    window.addEventListener('blur', () => releasePointer());
    return update;
}
