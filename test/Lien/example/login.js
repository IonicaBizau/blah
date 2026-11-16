import Lien from "../lib/index.js";
import MongoStore from "connect-mongo";

const users = {
    Alice: "123",
    Bob: "1234"
};

// Init lien app
const app = new Lien({
    host: "localhost",
    port: 9000,
    public: `${import.meta.dirname}/public`,
    session: {
        secret: process.env.SESSION_SECRET,
        store: MongoStore.create({
            mongoUrl: process.env.MONGO_URL || "mongodb://127.0.0.1/test-app"
        })
    }
});

// Listen for load
app.on("load", err => {
    console.log(err || "App started on port 9000.");
    err && process.exit(1);
});

// Add page
app.all("/", lien => {
    if (lien.getSessionData("logged_in")) {
        lien.file("logout.html");
    } else {
        lien.file("login.html");
    }
});
app.post("/api/login", lien => {
    if (!lien.data?.username || !lien.data?.password) {
        return lien.apiError("Incomplete data.");
    }

    if (lien.getSessionData("logged_in")) {
        return lien.redirect("/");
    }

    if (users[lien.data.username] === lien.data.password) {
        lien.startSession({
            logged_in: true,
            authenticated_at: new Date(),
            username: lien.data.username
        });
        return lien.redirect("/");
    }
    lien.apiError("Invalid credentials.", 403);
});
app.get("/api/session", lien => {
    lien.end(lien.getSessionData());
});
app.post("/api/logout", async lien => {
    if (!lien.getSessionData("logged_in")) {
        return lien.apiError("You were not logged in anyways.");
    }
    await lien.destroySession();
    lien.redirect("/");
});

// Add a dynamic route
app.get("/post/:id", lien => {
    lien.end("Post id: " + lien.params.id);
});
app.use("/auth", async lien => {
    const username = lien.getSessionData("username");
    lien.user = username ? {
        name: username
    } : null;
    if (!lien.user) {
        return lien.status(403).json({
            error: "Unauthorized"
        });
    }
});
app.get("/auth", lien => {
    lien.end({
        user: "/auth/user"
    });
});
app.get("/auth/user", lien => {
    lien.end({
        foo: "Bar",
        user: lien.user
    });
});
app.get("/test", "/index.html");
app.on("serverError", err => {
    console.log(err.stack);
});
