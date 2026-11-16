import Lien from "./server.js";
import Hooks from "./hooks.js";
import LienObj from "./lien.js";

/**
 * The constructor for reusable hook pipelines.
 * @type {typeof Hooks}
 */
Lien.Hooks = Hooks;
/**
 * The request object constructor, also available as a named export.
 * @type {typeof LienObj}
 */
Lien.LienObj = LienObj;

export { Lien, Hooks, LienObj };
export default Lien;

// Keep require("lien") returning the constructor.
export { Lien as "module.exports" };
