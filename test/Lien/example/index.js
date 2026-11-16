import Lien from "../lib/index.js";

// Init lien server
const server = new Lien({
    port: 9000,
    public: `${import.meta.dirname}/public`
});

// Listen for load
server.on("load", err => {
    console.log(err || "Server started on port 9000.");
    err && process.exit(1);
});

// Add page
server.get("/", lien => {
    lien.end("Hello World");
});

// Add a dynamic route
server.get("/post/:id", lien => {
    lien.end("Post id: " + lien.params.id);
});

// Add a static file
server.get("/test", "index.html");

// Listen for server errors
server.on("serverError", err => {
    console.log(err.stack);
});
