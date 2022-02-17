import { generate } from "./tools";

const packetServer = generate("Server", "HighFive");

console.log(JSON.stringify(packetServer, null, 2));