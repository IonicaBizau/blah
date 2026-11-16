import { EventEmitter } from "node:events";
import { asError } from "./utils.js";

/**
 * @callback HookNext
 * @param {Error} [error] The failure, or no argument to continue.
 * @returns {void}
 */

/**
 * @callback HookCallback
 * @param {*} data A Lien request, response data, or custom execution value.
 * @param {HookNext} [next] Completes a callback-style hook; pass an error to fail.
 * @returns {*} Async hooks may return a promise. Returned values do not replace data.
 */

/**
 * @callback HookDone
 * @param {Error|null} error The failure, or null on success or cancellation.
 * @param {*} data The original execution data.
 * @returns {void}
 */

/**
 * @typedef {number|string} HookMode
 * Use 1/PARALLEL, 2/UNORDERED, or 3/ORDERED. Only these values and names are accepted.
 */

/**
 * @typedef {object} HookRunOptions
 * @property {AbortSignal} [signal] Cancels execution without treating cancellation as a hook error.
 * @property {function(): boolean} [isStopped] Stops further hooks when true.
 */

/**
 * @typedef {Function|{sequence: Array<HookTask>}|{parallel: Array<HookTask>}} HookTask
 * A snapshot entry containing a callback or a group of entries.
 * @private
 */

/**
 * @typedef {object} HookState
 * @property {boolean} active Whether the execution is still running.
 * @property {function(): boolean} stopped Checks completion, cancellation, and the caller's stop condition.
 * @private
 */

/**
 * Hooks
 * Stores hook definitions. Execution state is local to run().
 *
 * @extends EventEmitter
 * @fires Hooks#end
 */
export default class Hooks extends EventEmitter {

    /**
     * Runs sequentially before the other entries.
     * @constant {number}
     */
    static PARALLEL = 1;
    /**
     * Runs consecutive entries together.
     * @constant {number}
     */
    static UNORDERED = 2;
    /**
     * Runs sequentially in registration order.
     * @constant {number}
     */
    static ORDERED = 3;
    /**
     * Registered callbacks and nested pipelines; contains no request state.
     * @private
     * @type {Array<{hook: HookCallback|Hooks, mode: number}>}
     */
    #entries = [];

    /**
     * Appends a hook, nested pipeline, or array of hooks.
     * The legacy PARALLEL mode is a serial prelude; consecutive UNORDERED hooks run together.
     *
     * @param {HookCallback|Hooks|Array<HookCallback|Hooks>} hook The definitions to append.
     * @param {HookMode} [mode=3] The execution mode.
     * @returns {Hooks} This pipeline.
     * @throws {TypeError} If the hook or mode is invalid, or composition would create a cycle.
     */
    add (hook, mode = Hooks.ORDERED) {
        if (Array.isArray(hook)) {
            for (const item of hook) {
                this.add(item, mode);
            }
            return this;
        }
        if (typeof mode === "string") {
            mode = Hooks[mode];
            if (typeof mode !== "number") {
                throw new TypeError("Invalid hook execution mode.");
            }
        }
        mode ??= Hooks.ORDERED;
        if (![1, 2, 3].includes(mode)) {
            throw new TypeError("Invalid hook execution mode.");
        }
        if (typeof hook !== "function" && !(hook instanceof Hooks)) {
            throw new TypeError("Expected a hook function or Lien.Hooks pipeline.");
        }
        if (hook instanceof Hooks && hook.#contains(this)) {
            throw new TypeError("Hook pipelines cannot contain cycles.");
        }
        this.#entries.push({ hook, mode });
        return this;
    }

    /**
     * Checks nested pipelines before adding a definition to avoid cycles.
     *
     * @private
     * @param {Hooks} pipeline The pipeline to find.
     * @returns {boolean}
     */
    #contains (pipeline) {
        return this === pipeline || this.#entries.some(({ hook }) => hook instanceof Hooks && hook.#contains(pipeline));
    }

    /**
     * Copies the execution plan so later registrations cannot change an active run.
     *
     * @private
     * @returns {HookTask} The execution plan, containing no request data.
     */
    #snapshot () {
        const first = [],
            ordered = [];
        let unordered;
        for (const { hook, mode } of this.#entries) {
            const task = hook instanceof Hooks ? hook.#snapshot() : hook;
            if (mode === Hooks.UNORDERED) {
                if (!unordered) {
                    unordered = [];
                    ordered.push({
                        parallel: unordered
                    });
                }
                unordered.push(task);
            } else {
                unordered = undefined;
                (mode === Hooks.PARALLEL ? first : ordered).push(task);
            }
        }
        // Legacy PARALLEL entries actually execute sequentially before the rest.
        return {
            sequence: [...first, ...ordered]
        };
    }

    /**
     * Executes hooks with independent state, awaiting async and callback hooks.
     * Cancellation stops subsequent hooks and resolves with the same data; running work is not undone.
     *
     * @template T
     * @param {T} [data={}] The shared value for this execution; mutate it in place.
     * @param {HookRunOptions} [options={}] Cancellation and stop checks.
     * @returns {Promise<T>} The original data value after hooks complete or are canceled.
     * @throws {Error} If a hook throws, rejects, or passes an error to next().
     * @fires Hooks#end
     */
    async run (data = {}, options = {}) {
        const { signal, isStopped = () => false } = options;
        const plan = this.#snapshot();
        const state = {
            active: true,
            stopped: () => !state.active || signal?.aborted || isStopped()
        };
        let onAbort;
        const aborted = new Promise(resolve => {
            onAbort = resolve;
            if (signal?.aborted) {
                resolve();
            } else {
                signal?.addEventListener("abort", onAbort, {
                    once: true
                });
            }
        });
        let failure = null;
        try {
            await Promise.race([execute(plan, data, state), aborted]);
            return data;
        } catch (error) {
            failure = asError(error, "Hook failed.");
            throw failure;
        } finally {
            state.active = false;
            signal?.removeEventListener("abort", onAbort);
            this.emit("end", failure, data);
        }
    }

    /**
     * Executes hooks with the legacy callback interface.
     * start(callback) creates a fresh empty object. Prefer run() when awaiting the result.
     *
     * @param {*|HookDone} [data={}] The execution data, or the completion callback.
     * @param {HookDone} [callback] Receives the error and original data.
     * @param {function(): boolean} [isStopped] Stops subsequent hooks when true.
     * @returns {function(): void} Cancels this execution; completion is reported once.
     */
    start (data = {}, callback = () => {}, isStopped) {
        if (typeof data === "function") {
            callback = data;
            data = {};
        }
        const controller = new AbortController();
        this.run(data, {
            signal: controller.signal,
            isStopped
        }).then(result => callback(null, result), error => callback(error, data));
        return () => controller.abort();
    }
}

/**
 * Executes a snapshot recursively, preserving sequential and unordered groups.
 *
 * @private
 * @param {HookTask} task The task or group.
 * @param {*} data The execution data.
 * @param {HookState} state The state owned by this run.
 * @returns {Promise<void>}
 */
async function execute (task, data, state) {
    if (state.stopped()) {
        return;
    }

    if (typeof task === "function") {
        return invoke(task, data, state);
    }

    if (task.parallel) {
        await Promise.all(task.parallel.map(child => execute(child, data, state)));
    } else {
        for (const child of task.sequence) {
            if (state.stopped()) {
                break;
            }
            await execute(child, data, state);
        }
    }
}

/**
 * Invokes one hook. Callback hooks settle once even when they also return a promise.
 *
 * @private
 * @param {HookCallback} hook The callback or async hook.
 * @param {*} data The execution data.
 * @param {HookState} state The state owned by this run.
 * @returns {Promise<void>}
 */
async function invoke (hook, data, state) {
    await Promise.resolve();
    if (state.stopped()) {
        return;
    }

    if (hook.length < 2) {
        await hook(data);
        return;
    }
    // Keep callback hooks working alongside async functions.
    await new Promise((resolve, reject) => {
        let settled = false;
        const next = error => {
            if (settled) {
                return;
            }
            settled = true;
            if (error) {
                reject(error);
            } else {
                resolve();
            }
        };
        try {
            const result = hook(data, next);
            if (result && typeof result.then === "function") {
                Promise.resolve(result).then(() => next(), error => next(asError(error, "Hook promise rejected.")));
            }
        } catch (error) {
            next(asError(error, "Hook threw without an error."));
        }
    });
}

/**
 * Reports completion of one execution, including canceled executions.
 * @event Hooks#end
 * @param {Error|null} error The failure, or null on success or cancellation.
 * @param {*} data The original execution data.
 */
