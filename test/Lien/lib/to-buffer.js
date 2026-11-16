/**
 * @typedef {object} SerializedContent
 * @property {Buffer} buffer The encoded response body.
 * @property {string} contentType The default Express content type.
 */

/**
 * Serializes response content to a Buffer and selects its default content type.
 * Undefined produces an empty body; other non-string values are serialized as JSON.
 *
 * @param {*} data The response content.
 * @returns {SerializedContent} The encoded body and content type.
 * @throws {Error} If data is an Error or cannot be serialized.
 */
export default function toBuffer (data) {
    if (data === undefined) {
        return {
            buffer: Buffer.alloc(0),
            contentType: "html"
        };
    }

    if (Buffer.isBuffer(data)) {
        return {
            buffer: data,
            contentType: "html"
        };
    }

    if (typeof data === "string") {
        return {
            buffer: Buffer.from(data),
            contentType: /^<\?xml version=/.test(data) ? "xml" : "html"
        };
    }

    if (data instanceof Error) {
        throw data;
    }
    const json = JSON.stringify(data);
    if (json === undefined) {
        throw new TypeError("Response content is not serializable.");
    }
    return {
        buffer: Buffer.from(json),
        contentType: "json"
    };
}
