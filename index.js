"use strict";

module.exports = {
	taskManager: require("./taskManager")(),
	stageManager: require("./stageManager")({
		stages: ["setMetadata", "initializeDatabase", "assignGraph", "validatePlugin", "activateRunner"],
		nonCriticalStages: ["validatePlugin", "activateRunner"]
	})
};
