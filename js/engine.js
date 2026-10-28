import { buildTestSequenceSet } from './sequences.js';
import { soundCtrl } from './audio.js';

export const TEST_MODES = {
  DIRECT: 'direct',
  INVERSE: 'inverse',
  FULL: 'full'
};

export class DigitSpanEngine {
  constructor(options = {}) {
    this.digitDurationMs = options.digitDurationMs || 800;
    this.intervalDurationMs = options.intervalDurationMs || 200;
    this.fixationDurationMs = options.fixationDurationMs || 1000;
    this.useRandom = options.useRandom || false;

    this.onStateChange = options.onStateChange || (() => {});
    this.onDigitDisplay = options.onDigitDisplay || (() => {});
    this.onDigitClear = options.onDigitClear || (() => {});
    this.onFixation = options.onFixation || (() => {});
    this.onReadyForInput = options.onReadyForInput || (() => {});
    this.onSubtestTransition = options.onSubtestTransition || (() => {});
    this.onTestFinished = options.onTestFinished || (() => {});

    this.reset();
  }

  reset() {
    this.activeMode = null;
    this.currentSubtest = null;
    this.subtestQueue = [];
    this.sequenceSet = [];
    this.currentItemIndex = 0;
    this.currentTrialIndex = 0;

    this.currentLengthScores = [null, null];
    this.trialHistory = [];

    this.isDisplayingSequence = false;
    this.abortController = null;
  }

  startTest(mode = TEST_MODES.FULL, useRandom = false) {
    this.reset();
    this.activeMode = mode;
    this.useRandom = useRandom;

    if (mode === TEST_MODES.DIRECT) {
      this.subtestQueue = ['direct'];
    } else if (mode === TEST_MODES.INVERSE) {
      this.subtestQueue = ['inverse'];
    } else {
      this.subtestQueue = ['direct', 'inverse'];
    }

    this.startNextSubtest();
  }

  startNextSubtest() {
    if (this.subtestQueue.length === 0) {
      this.finishEntireTest();
      return;
    }

    this.currentSubtest = this.subtestQueue.shift();
    this.sequenceSet = buildTestSequenceSet(this.currentSubtest, this.useRandom);
    this.currentItemIndex = 0;
    this.currentTrialIndex = 0;
    this.currentLengthScores = [null, null];

    this.notifyState();
  }

  getCurrentItem() {
    return this.sequenceSet[this.currentItemIndex] || null;
  }

  getCurrentSequence() {
    const item = this.getCurrentItem();
    if (!item) return null;
    return item.trials[this.currentTrialIndex] || null;
  }

  getCurrentInfo() {
    const item = this.getCurrentItem();
    if (!item) return null;
    return {
      mode: this.activeMode,
      subtest: this.currentSubtest,
      itemNumber: this.currentItemIndex + 1,
      totalItems: this.sequenceSet.length,
      length: item.length,
      trialNumber: this.currentTrialIndex + 1,
      totalTrialsPerItem: 2,
      subtestName: this.currentSubtest === 'direct' ? 'Empan Direct' : 'Empan Inverse',
      instructions: this.currentSubtest === 'direct'
        ? "Restituez les chiffres dans l'ordre exact d'apparition."
        : "Restituez les chiffres dans l'ordre INVERSE (du dernier au premier)."
    };
  }

  notifyState() {
    this.onStateChange(this.getCurrentInfo());
  }

  async playCurrentSequence() {
    const sequence = this.getCurrentSequence();
    if (!sequence) return;

    this.isDisplayingSequence = true;
    this.abortController = new AbortController();

    this.onFixation();
    soundCtrl.playFixation();
    await this.sleep(this.fixationDurationMs);

    for (let i = 0; i < sequence.length; i++) {
      if (this.abortController.signal.aborted) return;

      const digit = sequence[i];

      this.onDigitDisplay(digit, i, sequence.length);
      soundCtrl.playDigit();
      await this.sleep(this.digitDurationMs);

      this.onDigitClear();
      await this.sleep(this.intervalDurationMs);
    }

    this.isDisplayingSequence = false;

    this.onReadyForInput({
      subtest: this.currentSubtest,
      length: sequence.length,
      trialNumber: this.currentTrialIndex + 1
    });
  }

  evaluateAnswer(rawInput) {
    if (this.isDisplayingSequence) return null;

    const cleanedInput = String(rawInput || '').replace(/\D/g, '');
    const sequence = this.getCurrentSequence();
    const item = this.getCurrentItem();
    if (!sequence || !item) return null;

    const expectedSequence = this.currentSubtest === 'direct'
      ? [...sequence]
      : [...sequence].reverse();

    const expectedString = expectedSequence.join('');
    const isCorrect = cleanedInput === expectedString;
    const points = isCorrect ? (this.currentTrialIndex === 0 ? 2 : 1) : 0;

    if (isCorrect) {
      soundCtrl.playSuccess();
    } else {
      soundCtrl.playError();
    }

    const trialRecord = {
      subtest: this.currentSubtest,
      itemNumber: this.currentItemIndex + 1,
      length: item.length,
      trialNumber: this.currentTrialIndex + 1,
      targetSequence: [...sequence],
      expectedString,
      userInput: cleanedInput,
      isCorrect,
      points,
      timestamp: new Date().toISOString()
    };
    this.trialHistory.push(trialRecord);

    this.currentLengthScores[this.currentTrialIndex] = points;

    const evaluation = {
      record: trialRecord,
      itemScores: [...this.currentLengthScores],
      shouldDiscontinue: false,
      hasNextTrialInItem: false,
      isSubtestComplete: false
    };

    if (this.currentTrialIndex === 0) {
      if (isCorrect) {
        // Réussite dès le premier essai : on valide le niveau directement sans faire le deuxième essai
        evaluation.hasNextTrialInItem = false;
        if (this.currentItemIndex + 1 >= this.sequenceSet.length) {
          evaluation.isSubtestComplete = true;
        }
      } else {
        // Échec sur le premier essai : deuxième chance accordée sur la 2ème série
        evaluation.hasNextTrialInItem = true;
      }
    } else {
      const [t1Score, t2Score] = this.currentLengthScores;

      if (t1Score === 0 && t2Score === 0) {
        evaluation.shouldDiscontinue = true;
        evaluation.isSubtestComplete = true;
      } else if (this.currentItemIndex + 1 >= this.sequenceSet.length) {
        evaluation.isSubtestComplete = true;
      }
    }

    return evaluation;
  }

  advanceToNext(evaluation) {
    if (!evaluation) return;

    if (evaluation.isSubtestComplete) {
      this.handleSubtestCompletion();
      return;
    }

    if (evaluation.hasNextTrialInItem) {
      this.currentTrialIndex = 1;
      this.notifyState();
    } else {
      this.currentItemIndex++;
      this.currentTrialIndex = 0;
      this.currentLengthScores = [null, null];

      if (this.currentItemIndex >= this.sequenceSet.length) {
        this.handleSubtestCompletion();
        return;
      }

      this.notifyState();
    }
  }

  submitAnswer(rawInput) {
    const evaluation = this.evaluateAnswer(rawInput);
    if (!evaluation) return null;
    this.advanceToNext(evaluation);
    return evaluation;
  }

  handleSubtestCompletion() {
    const finishedSubtest = this.currentSubtest;
    const subtestResults = this.computeSubtestScore(finishedSubtest);

    if (this.subtestQueue.length > 0) {
      this.onSubtestTransition({
        finishedSubtest,
        results: subtestResults,
        nextSubtest: this.subtestQueue[0]
      });
    } else {
      this.finishEntireTest();
    }
  }

  finishEntireTest() {
    const fullResults = this.getFullResults();
    this.onTestFinished(fullResults);
  }

  computeSubtestScore(subtest) {
    const trials = this.trialHistory.filter(t => t.subtest === subtest);
    const rawScore = trials.reduce((acc, t) => acc + t.points, 0);

    let maxSpan = 0;
    const successfulLengths = trials.filter(t => t.isCorrect).map(t => t.length);
    if (successfulLengths.length > 0) {
      maxSpan = Math.max(...successfulLengths);
    }

    const maxPossibleScore = 16;

    return {
      subtest,
      subtestName: subtest === 'direct' ? 'Empan Direct' : 'Empan Inverse',
      rawScore,
      maxPossibleScore,
      maxSpan,
      trialsCount: trials.length,
      trials
    };
  }

  getFullResults() {
    const hasDirect = this.trialHistory.some(t => t.subtest === 'direct');
    const hasInverse = this.trialHistory.some(t => t.subtest === 'inverse');

    const directSummary = hasDirect ? this.computeSubtestScore('direct') : null;
    const inverseSummary = hasInverse ? this.computeSubtestScore('inverse') : null;

    let totalRawScore = 0;
    let totalMaxPossible = 0;

    if (directSummary) {
      totalRawScore += directSummary.rawScore;
      totalMaxPossible += directSummary.maxPossibleScore;
    }
    if (inverseSummary) {
      totalRawScore += inverseSummary.rawScore;
      totalMaxPossible += inverseSummary.maxPossibleScore;
    }

    return {
      mode: this.activeMode,
      date: new Date(),
      totalRawScore,
      totalMaxPossible,
      direct: directSummary,
      inverse: inverseSummary,
      trials: [...this.trialHistory]
    };
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  stop() {
    if (this.abortController) {
      this.abortController.abort();
    }
    this.isDisplayingSequence = false;
  }
}
