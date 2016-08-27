"use strict";

module.exports = {
	taskManager: require("./taskManager")(),
	stageManager: require("./stageManager")({
		stages: ["setMetadata", "assignGraph", "validatePlugin", "activateRunner"],
		nonCriticalStages: ["validatePlugin", "activateRunner"]
	})
};
