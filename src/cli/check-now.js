import { checkAllMonitors } from "../lib/monitorRunner.js";

const results = await checkAllMonitors();
console.log(JSON.stringify(results, null, 2));
