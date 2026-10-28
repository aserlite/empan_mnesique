export const WISC_STANDARD_SEQUENCES = {
  direct: [
    {
      length: 2,
      trials: [
        [2, 9],
        [5, 4]
      ]
    },
    {
      length: 3,
      trials: [
        [3, 8, 6],
        [6, 1, 2]
      ]
    },
    {
      length: 4,
      trials: [
        [3, 4, 1, 7],
        [6, 1, 5, 8]
      ]
    },
    {
      length: 5,
      trials: [
        [5, 2, 1, 8, 6],
        [8, 4, 2, 3, 9]
      ]
    },
    {
      length: 6,
      trials: [
        [3, 8, 9, 1, 7, 4],
        [7, 9, 6, 4, 8, 3]
      ]
    },
    {
      length: 7,
      trials: [
        [5, 1, 7, 4, 2, 3, 8],
        [9, 8, 5, 2, 1, 6, 3]
      ]
    },
    {
      length: 8,
      trials: [
        [1, 8, 4, 5, 9, 7, 6, 3],
        [2, 9, 7, 6, 3, 1, 5, 4]
      ]
    },
    {
      length: 9,
      trials: [
        [5, 3, 8, 7, 1, 2, 4, 6, 9],
        [4, 2, 6, 9, 1, 7, 8, 3, 5]
      ]
    }
  ],

  inverse: [
    {
      length: 2,
      trials: [
        [2, 1],
        [1, 3]
      ]
    },
    {
      length: 3,
      trials: [
        [3, 5, 7],
        [6, 4, 9]
      ]
    },
    {
      length: 4,
      trials: [
        [2, 5, 9, 3],
        [8, 4, 9, 6]
      ]
    },
    {
      length: 5,
      trials: [
        [6, 5, 8, 4, 3],
        [1, 5, 4, 8, 6]
      ]
    },
    {
      length: 6,
      trials: [
        [5, 3, 7, 2, 4, 8],
        [4, 2, 1, 5, 7, 9]
      ]
    },
    {
      length: 7,
      trials: [
        [1, 2, 5, 4, 9, 8, 3],
        [2, 7, 9, 6, 3, 1, 4]
      ]
    },
    {
      length: 8,
      trials: [
        [5, 9, 1, 8, 2, 6, 4, 7],
        [3, 8, 2, 9, 5, 1, 7, 4]
      ]
    },
    {
      length: 9,
      trials: [
        [4, 8, 2, 9, 3, 1, 7, 5, 6],
        [9, 1, 5, 2, 4, 3, 8, 7, 6]
      ]
    }
  ]
};

export function generatePsychometricSequence(length) {
  const digits = [1, 2, 3, 4, 5, 6, 7, 8, 9];
  const sequence = [];

  for (let i = 0; i < length; i++) {
    let validDigits = digits.filter(d => {
      if (sequence.length > 0 && d === sequence[sequence.length - 1]) {
        return false;
      }
      if (sequence.length >= 2) {
        const prev1 = sequence[sequence.length - 1];
        const prev2 = sequence[sequence.length - 2];
        if (prev1 === prev2 + 1 && d === prev1 + 1) return false;
        if (prev1 === prev2 - 1 && d === prev1 - 1) return false;
      }
      return true;
    });

    if (validDigits.length === 0) {
      validDigits = digits.filter(d => d !== sequence[sequence.length - 1]);
    }

    const randomIndex = Math.floor(Math.random() * validDigits.length);
    sequence.push(validDigits[randomIndex]);
  }

  return sequence;
}

export function buildTestSequenceSet(type, useRandom = false) {
  if (!useRandom && WISC_STANDARD_SEQUENCES[type]) {
    return JSON.parse(JSON.stringify(WISC_STANDARD_SEQUENCES[type]));
  }

  const maxLen = 9;
  const set = [];
  for (let len = 2; len <= maxLen; len++) {
    set.push({
      length: len,
      trials: [
        generatePsychometricSequence(len),
        generatePsychometricSequence(len)
      ]
    });
  }
  return set;
}
