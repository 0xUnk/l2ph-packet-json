import ini from "ini";
import path from "path";
import { readFileSync, readdirSync, mkdirSync, existsSync } from "fs";
import jsonfile from 'jsonfile'

interface ITypes {
  type: string;
  sizeLoop: number | undefined;
  name: string;
}

interface IOpcode {
  opcode: string;
  name: string;
  bytes?: ITypes[];
}

const createJson = (packet: IOpcode, client: string, type: string) => { 
  const obj = packet

  const dir = process.cwd() + `/json/${client}/${type}/${obj.name}.json`;
  
  if (!existsSync(path.dirname(dir))) { 
    mkdirSync(path.dirname(dir), { recursive: true });
  }


  jsonfile.writeFile(dir, obj, (err) => {
    if (err) console.error(err)
  })

}

const camalize = (string: string) => {
  return string
    .toLowerCase()
    .replace(/[-_]+/g, " ")
    .replace(/[^\w\s]/g, "")
    .replace(/ (.)/g, function ($1) {
      return $1.toUpperCase();
    })
    .replace(/ /g, "");
};

const dataType = (type: string) => {
  switch (type) {
    case "h":
      return "byte";
    case "c":
      return "word";
    case "f":
      return "float";
    case "q":
      return "double";
    case "s":
      return "ntstring";
    case "b":
      return "bytes";
    case "z":
    case "i":
    case "d":
      return "dword";
    default:
      return type;
  }
};

const nameRegex = (packet: string) => {
  if (!packet) return;
  const regex = /(?<header>[a-z][a-z0-9]*)/gim;

  const exec = regex.exec(packet);

  if (exec && exec.groups) {
    return exec.groups.header;
  }
};

const typeRegex = (packet: string) => {
  if (!packet) return;
  const regex_body = /(?<type>[a-z0-9-])\((?<name>[a-z0-9:.-_]+)\)/gim;
  let myArray;
  let pushItem = [];
  while ((myArray = regex_body.exec(packet)) !== null) {
    const name = myArray[2].split(":")[0];
    pushItem.push({
      type: dataType(myArray[1]),
      sizeLoop: loop(myArray[2]) ? parseInt(loop(packet) as string) : undefined,
      name: camalize(name || "_unknown"),
    });
  }

  return pushItem;
};

const loop = (packet: string) => {
  const regex = /Loop.01.00(?<loop>\d{2})/gm;
  const regexOld = /:For.00(?<loop>\d{2})/gm;

  let isLoop = regex.exec(packet) || regexOld.exec(packet);

  if (isLoop) {
    const n =
      (isLoop?.groups?.loop as unknown as number) < 10
        ? isLoop?.groups?.loop.replace("0", "")
        : isLoop?.groups?.loop;
    return n;
  }
};


const packetClient = (type: string, client: string) => {
  
  const dir = readdirSync(process.cwd() + `/src/packets`);

  const packet = dir.find((packet) => packet.includes(client));
  const packetFile = ini.parse(
    readFileSync(path.resolve(__dirname, `../packets/${packet}`), "utf-8")
  );
  
  const packetsClient = packetFile.client;
  const packetsServer = packetFile.server;

  return (type === "Client") ? packetsClient : packetsServer;

}

export const generate = (type: string, client = "HighFive") => {
  const data = packetClient(type, client);
  if (!type) return;

  let pushItem: IOpcode[] = [];

  Object.entries(data).forEach(([key, value]) => {
    try {
      if (typeof value === "string") {
        const name = nameRegex(value);
        const bytes = typeRegex(value);

        if (key.includes("//") || key.length > 2) return; // ignore comment and two ID packets

        if (name) {
          pushItem.push({
            opcode: key,
            name,
            bytes,
          });

          createJson({
            opcode: key,
            name,
            bytes,
          },
          client,
          type
          )

        }
      }
    } catch (error) {
      console.log(error);
    }
  });
  return pushItem;
};

