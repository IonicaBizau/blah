import session from "express-session";

/**
 * Options received by the test store provider.
 *
 * @private
 * @type {Array<object>}
 */
export const configurations = [];
/**
 * An ES module store provider used by session-loading tests.
 *
 * @private
 */
export default {
    /**
     * Records the supplied options and creates an in-memory session store.
     *
     * @private
     * @param {object} options The provider options.
     * @returns {Promise<object>} The test session store.
     */
    async create (options) {
        configurations.push(options);
        return new session.MemoryStore();
    }
};
