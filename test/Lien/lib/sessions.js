import session from "express-session";

/**
 * Initializes session middleware before listening.
 * Supports store instances, create() providers, Store subclasses, legacy factories, and imported modules.
 * An explicit session secret takes precedence over the cookie secret.
 *
 * @param {import("./server.js").default} server The server to configure.
 * @returns {Promise<void>} Resolves when middleware and any owned store are ready.
 * @throws {Error} If a store cannot be loaded or initialized.
 * @private
 */
export async function configureSession (server) {
    if (!server.options.session) {
        return;
    }
    const options = {
        resave: false,
        saveUninitialized: true,
        ...server.options.session
    };
    options.secret ??= server.options.cookieSecret;
    const storeOptions = options.storeOptions ?? {};
    let provider = options.store;
    if (typeof provider === "string") {
        try {
            const imported = await import(provider);
            provider = imported.default ?? imported;
        } catch (cause) {
            throw new Error(`Cannot load session store ${options.store}. Install it in your application.`, { cause });
        }
    }

    if (provider && typeof provider.get !== "function") {
        server.SessionStoreModule = provider;
        server.SessionStore = provider;
        if (typeof provider.create === "function") {
            options.store = await provider.create(storeOptions);
        } else if (provider.prototype instanceof session.Store) {
            options.store = new provider(storeOptions);
        } else if (typeof provider === "function") {
            const Store = await provider(session);
            server.SessionStore = Store;
            options.store = new Store(storeOptions);
        } else {
            throw new TypeError("Invalid session store.");
        }
        server._ownedSessionStore = options.store;
    }
    delete options.storeOptions;
    if (!options.store) {
        delete options.store;
    }
    server.options.session = options;
    server.session = session(options);
}
