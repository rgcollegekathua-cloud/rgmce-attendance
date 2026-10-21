const UPPER = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
const LOWER = 'abcdefghijkmnopqrstuvwxyz';
const DIGIT = '23456789';
const AMBIGUOUS = /[IlO01]/g;
function secureRandomInt(max) {
    const cryptoApi = globalThis.crypto;
    if (cryptoApi?.getRandomValues) {
        const limit = Math.floor(0xffffffff / max) * max;
        const buffer = new Uint32Array(1);
        let value = 0;
        do {
            cryptoApi.getRandomValues(buffer);
            value = buffer[0];
        } while (value >= limit);
        return value % max;
    }
    return Math.floor(Math.random() * max);
}
function pick(source) {
    return source[secureRandomInt(source.length)];
}
/** Generates a 14-character password that satisfies `passwordProblem`. */
export function generatePassword() {
    const upper = UPPER.replace(AMBIGUOUS, '');
    const lower = LOWER.replace(AMBIGUOUS, '');
    const digit = DIGIT.replace(AMBIGUOUS, '');
    const all = `${upper}${lower}${digit}`;
    const chars = [pick(upper), pick(lower), pick(digit)];
    while (chars.length < 14)
        chars.push(pick(all));
    for (let i = chars.length - 1; i > 0; i -= 1) {
        const j = secureRandomInt(i + 1);
        [chars[i], chars[j]] = [chars[j], chars[i]];
    }
    return chars.join('');
}
