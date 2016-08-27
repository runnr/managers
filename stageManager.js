"use strict";

const PromiseQueue = require("../helpers/PromiseQueue");

function createManager({ stages, nonCriticalStages = [] }) {
	stages = Array.from(stages);
	nonCriticalStages = new Set(nonCriticalStages);

	let stageIndex = 0;
	let stageError = false;
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
				if(!stageError) {
					stageIndex = index + 1;
					return;
				}

				stageError = false;
				stageIndex = 0;

				throw new StageError("A different job failed to arrive at its next stage.");
			});

		return result.then(nextInput => runStageHandlers(stageHandlers, index + 1, nextInput), err => {
			if(!nonCriticalStages.has(stage))
				stageError = true;

			throw err;
		});
	}

	return Object.assign(stageHandlers => runStageHandlers(stageHandlers, 0), { StageError });
}

class StageError extends Error {}

StageError.prototype.name = "StageError";

createManager.StageError = StageError;

module.exports = createManager;
