import ini from "ini";
import path from "path";
import jsonfile from "jsonfile";
import { readFileSync, readdirSync, mkdirSync, existsSync } from "fs";

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

const createJson = (
  packet: IOpcode,
  client: string,
  type: string,
  name: string
) => {
  const obj = packet;

  const dir = process.cwd() + `/json/${client}/${type}/${name}.json`;

  if (!existsSync(path.dirname(dir))) {
    mkdirSync(path.dirname(dir), { recursive: true });
  }

  jsonfile.writeFile(dir, obj, { spaces: 2, EOL: "\r\n" }, (err) => {
    if (err) console.error(err);
  });
};

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
  const dir = readdirSync(process.cwd() + `/src/packets/`);

  const packet = dir.find((packet) => packet.includes(client));
  const packetFile = ini.parse(
    readFileSync(path.resolve(__dirname, `../packets/${packet}`), "utf-8")
  );

  const packetsClient = packetFile.client;
  const packetsServer = packetFile.server;
  return type === "Client" ? packetsClient : packetsServer;
};

const gernerateBytes = (bytes: ITypes[]) => {
  let pushJson: { [x: string]: { $type: string; $alias: string } }[] = [];
  bytes.forEach((byte) => {
    pushJson.push({
      [byte.name]: {
        $type: byte.type,
        $alias: byte.name,
      },
    });
  });

  return pushJson;
};

export const generate = (type: string, client = "HighFive") => {
  const data = packetClient(type, client);
  if (!type) return;
  if (!data) return;
  let pushItem: IOpcode[] = [];

  try {
    Object.entries(data).forEach(([key, value]) => {
      if (typeof value === "string") {
        const name = nameRegex(value);
        if(!name) return;
        const resultRegexType = typeRegex(value);
        const bytes = gernerateBytes(resultRegexType as ITypes[]);

        if (key.includes("//") || key.length > 2) return; // ignore comment and two ID packets

        let saveJson: any = {};
        saveJson = {
          prefix: {
            $type: "bytes",
            $length: 1,
            $default: [key],
          },
        };

        Object.entries(bytes).forEach(([key, value]) => {
          saveJson = { ...saveJson, ...value };
        });

        createJson(saveJson, client, type, name);
      }
    });
  } catch (error) {
    console.log(error);
  }

  console.log(`${type} packets generated`);
  return pushItem;
};
