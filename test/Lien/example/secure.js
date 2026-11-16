import Lien from "../lib/index.js";

// Init lien server
const server = new Lien({
    host: "localhost",
    port: 9000,
    public: import.meta.dirname + "/public",
    ssl: {
        key: import.meta.dirname + "/ssl/key.pem",
        cert: import.meta.dirname + "/ssl/cert.pem"
    }
});

// Listen for load
server.on("load", function (err) {
    console.log(err || "Server started on port 9000.");
    err && process.exit(1);
});

// Add page
server.addPage("/", function (lien) {
    lien.end("Hello World");
});

// Add a dynamic route
server.addPage("/post/:id", function (lien) {
    lien.end("Post id: " + lien.params.id);
});
server.addPage("/test", "/index.html");
