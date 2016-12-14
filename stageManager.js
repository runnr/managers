"use strict";

const { PromiseQueue } = require("@runnr/helpers");

const cancel = Symbol("cancel");

function createManager({ stages, nonCriticalStages = [] }) {
	stages = Array.from(stages);
	nonCriticalStages = new Set(nonCriticalStages);

	let stageIndex = 0;
	let stageError = null;
	let nextStage = Promise.resolve();

	const runningHandlers = new PromiseQueue();

	function runStageHandlers(stageHandlers, index, input) {
		if(index >= stages.length)
			return Promise.resolve(input);

		if(index > stageIndex)
			return nextStage.then(() => runStageHandlers(stageHandlers, index, input), err => {
				err.stageReached = stages[index - 1];

				throw err;
			});

		const stage = stages[index];
		const handler = stageHandlers[stage] || (x => x);
		const result = new Promise(resolve => resolve(handler(input)));
		const isStartOfStage = runningHandlers.isEmpty;

		runningHandlers.add(result);

		if(isStartOfStage)
			nextStage = Promise.all([index === 0 ? Promise.resolve() : nextStage, runningHandlers.onEmpty]).then(() => {
				if(stageError === null) {
					stageIndex = index + 1;

					return;
				}

				const err = stageError;

				stageError = null;
				stageIndex = 0;

				throw new StageError("A different job failed to arrive at its current stage.", err);
			});

		return result.then(nextInput => {
			if(nextInput === cancel)
				return cancel;

			return runStageHandlers(stageHandlers, index + 1, nextInput);
		}, err => {
			if(!nonCriticalStages.has(stage))
				stageError = err;

			throw err;
		});
	}

	return Object.assign(stageHandlers => runStageHandlers(stageHandlers, 0), { StageError, cancel });
}

class StageError extends Error {
	constructor(msg, cause) {
		super(msg);

		this.cause = cause;
		this.stack = `${this.stack}\n\nCause: ${this.cause.stack}`;
	}
}

StageError.prototype.name = "StageError";

Object.assign(createManager, { StageError, cancel });

module.exports = createManager;
