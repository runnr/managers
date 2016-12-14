"use strict";

const owe = require("owe.js");

const generating = require("@runnr/helpers").generatingMaps;

/**
 * Creates a task manager with its own id scope.
 * Task managers are used to synchronize actions across various structural entities of runnr.
 * E. g. the task manager prevents the user from updating a Plugin while it is being uninstalled or the other way around.
 * It basically takes tasks that were requested at the same time and executes them one-by-one in order instead.
 * @return {{ addTask: function, taskify: function, delay: function }} The task manager and its helper functions.
 */
function createManager() {
	const tasksMap = new generating.Map(() => ({}));

	/**
	 * Adds a task to the given id with the given intent. Each id can only have one currently running task and one scheduled follow up task.
	 * If there is no running task for id, task will be called immediately, its result will be Promise.resolve'd and then used as the current task.
	 * If there is a running task and a scheduled follow up task for id and the requested task has a different intent as the follow up task, the follow up task will be replaced by the newly requested one.
	 * If however the follow up task has the same intent as the requested task, the latter will be rejected immediately.
	 * If the requested task should have a different intent than the follow up task, the latter will be rejected. If the requested task additionally has a different intent than the running one, it will be used as the new follow up task.
	 * If there simply is no follow up task but only a currently running one, the requested task will simply be scheduled as the new follow up task for id.
	 * Note: Whenever a follow up task is set for an id, the running task will be canceled IF it offers a "cancel" method.
	 * @param {any} id The id is used to identify objects/entities that have tasks attached to them.
	 * @param {function} task A function that will be called if the task is executed. It has to return a Promise.
	 * @param {any} intent An indentifier that is common for all tasks that do the same thing. This is used to reject tasks whose purpose is already fullfilled by another running or scheduled task.
	 * @return {Promise} A Promise that will be fullfilled/rejected like the resulting Promise of task(). It can additionally be rejected if the task was immediately rejected because of its intent or replaced by another task later on.
	 */
	function addTask(id, task, intent) {
		const tasks = tasksMap.forceGet(id);

		if(!tasks.current) {
			const done = () => {
				tasks.current = undefined;

				if(tasks.next) {
					addTask(id, tasks.next.task, tasks.next.intent)
						.then(tasks.next.promise.resolve, tasks.next.promise.reject);
					tasks.next = undefined;
				}
				else
					tasksMap.delete(id);
			};

			tasks.current = {
				task: Promise.resolve(task()),
				intent
			};
			tasks.current.task.then(done, done);

			return tasks.current.task;
		}

		if(tasks.next) {
			if(intent && tasks.next.intent === intent)
				return Promise.reject(new owe.exposed.Error(`There already is a scheduled ${intent} task for this item.`));

			tasks.next.promise.reject(new owe.exposed.Error("This task was replaced by another one."));
		}

		if(intent && tasks.current.intent === intent)
			return Promise.reject(new owe.exposed.Error(`There already is a running ${intent} task for this item.`));

		tasks.next = { task, intent };

		const nextPromise = new Promise((resolve, reject) => tasks.next.promise = { resolve, reject });

		if(typeof tasks.current.task.cancel === "function")
			tasks.current.task.cancel();

		return nextPromise;
	}

	/**
	 * Returns a function that behaves like task regarding the output but for each call actually adds a task to the id returned by idMap with the given static intent.
	 * If task did not already return a Promise (which is unlikely since synchronous functions should not be taskified), the taskified result will of course always return a Promise to abstract away the possible delay that might occur due to tasking.
	 * @param {function} task The function that should be "taskified" as explained above.
	 * @param {function} idMap Called when the returned function is called. It returns the id this task should be added to. It gets context and arguments of the called returned function.
	 * @param {any} intent The intent to be used for each task that is added.
	 * @return {function} The "taskified" version of task as explained above.
	 */
	function taskify(task, idMap, intent) {
		if(!idMap)
			idMap = x => x;

		return function() {
			return addTask(idMap.apply(this, arguments), () => task.apply(this, arguments), intent);
		};
	}

	/**
	 * Adds a task that behaves like the given promise. Since the promise already exists, it will not be halted in any way.
	 * Instead delay returns a Promise that resolves as soon as promise would have actually be "started" by the task manager.
	 * This resulting Promise is intended to be used as a dependency inside the given promise itself. This makes it possible to execute the async part of a task independent of the task manager and only synchronize the task by adding ("then'ing") the resulting delay Promise when it is neccessary.
	 * Such a thing is necessary e. g. when the id of a task is unknown initially (happens when installing a Plugin, knowing nothing but the remote source).
	 * @param {any} id The task manager object/entity id.
	 * @param {Promise} promise The Promise that should be added as a task to id.
	 * @param {any} intent The intent, that should be used for the new task.
	 * @return {Promise} A Promise that resolves as soon as the added task gets started by the task manager. It is rejected if the added task gets removed by the task manager or if the given promise rejects.
	 */
	function delay(id, promise, intent) {
		return new Promise((resolve, reject) => {
			addTask(id, () => {
				resolve();

				return promise;
			}, intent).catch(reject);
		});
	}

	return { addTask, taskify, delay };
}

module.exports = createManager;
