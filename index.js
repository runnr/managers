"use strict";

module.exports = {
	taskManager: require("./taskManager")(),
	stageManager: require("./stageManager")({
		stages: [
			"setMetadata", // Set all data that can be directly derived from the preset.
			"initializeDatabase", // Build indices and check constraints.
			"setDerivedData", // Set all data that can be derived from the preset & all other instances.

			"validatePlugin", // If instanceof Plugin: Validate the correctness of the Plugin installation.
			"activateRunner" // If instanceof Runner: Activate Runner if it is in autostart mode.
		],
		// If validation of a Plugin or activation of a Runner fails, do not cancel all other stages:
		nonCriticalStages: ["activateRunner"]
	})
};
