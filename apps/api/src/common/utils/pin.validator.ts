/**
 * PIN complexity validation for MOBILE_PIN driver authentication.
 *
 * Rules (all required):
 *  1. Exactly 6 numeric digits
 *  2. No ascending run of 3+ consecutive digits (e.g. 123, 234, 890)
 *  3. No descending run of 3+ consecutive digits (e.g. 321, 987, 210)
 *  4. No trivial repeated patterns:
 *     - All same digit (111111, 999999)
 *     - Alternating two digits (121212, 565656)
 *     - Two-digit block repeated (123123, 456456)
 */
export function validatePinComplexity(pin: string): string | null {
  if (!/^\d{6}$/.test(pin)) {
    return 'PIN must be exactly 6 numeric digits.';
  }

  const digits = pin.split('').map(Number);

  // Rule 2 – ascending run of 3+
  for (let i = 0; i <= digits.length - 3; i++) {
    if (
      digits[i + 1] === (digits[i] as number) + 1 &&
      digits[i + 2] === (digits[i] as number) + 2
    ) {
      return 'PIN must not contain ascending digit sequences (e.g. 123, 456).';
    }
  }

  // Rule 3 – descending run of 3+
  for (let i = 0; i <= digits.length - 3; i++) {
    if (
      digits[i + 1] === (digits[i] as number) - 1 &&
      digits[i + 2] === (digits[i] as number) - 2
    ) {
      return 'PIN must not contain descending digit sequences (e.g. 321, 987).';
    }
  }

  // Rule 4a – all same digit (111111)
  if (new Set(digits).size === 1) {
    return 'PIN must not be a single repeated digit.';
  }

  // Rule 4b – alternating two-digit pattern (121212, 565656)
  if (
    digits[0] === digits[2] &&
    digits[2] === digits[4] &&
    digits[1] === digits[3] &&
    digits[3] === digits[5] &&
    digits[0] !== digits[1]
  ) {
    return 'PIN must not be an alternating pattern (e.g. 121212).';
  }

  // Rule 4c – two-digit block repeated (123123, 456456)
  if (pin.slice(0, 3) === pin.slice(3)) {
    return 'PIN must not be a repeated 3-digit block (e.g. 123123).';
  }

  return null; // valid
}
