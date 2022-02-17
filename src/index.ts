import { generate } from "./tools";

const packetServer = generate("Server");

// const filter = packetServer?.filter((packet) => packet.opcode === "E7") // SendMacroList [C4]


console.log(JSON.stringify(packetServer, null, 2));