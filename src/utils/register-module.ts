import { SecureSocket } from "@ugursahinkaya/secure-socket";
import path from "path";
import { bundlesDir } from "../index.js";
import fs from "fs";
import JSZip from "jszip";
import { saveBundle } from "../auth/index.js";
import { registerBundle } from "./register-bundle.js";
import { Logger } from "@ugursahinkaya/logger";

export function registerModule(
  module: { name: string; file: string },
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  socket: SecureSocket<any>,
  logger: Logger
) {
  logger.debug(module, "registerModule");
  try {
    const fileBuffer = Buffer.from(module.file, "base64");
    const zipFilePath = path.join(bundlesDir, `${module.name}.zip`);
    if (!fs.existsSync(bundlesDir)) {
      fs.mkdirSync(bundlesDir, { recursive: true });
    }
    fs.writeFileSync(zipFilePath, fileBuffer);

    const outputDir = path.join(bundlesDir, module.name);
    const data = fs.readFileSync(zipFilePath);

    JSZip.loadAsync(data).then(async (zip) => {
      for (const [filename, file] of Object.entries(zip.files)) {
        if (!file.dir) {
          const content = await file.async("nodebuffer");
          const outputPath = path.join(outputDir, filename);
          fs.mkdirSync(outputDir, { recursive: true });
          fs.writeFileSync(outputPath, content);
        }
      }
      fs.unlink(zipFilePath, (error) => {
        if (error) {
          logger.error(error, ["registerModule", "Error deleting zip file:"]);
        }
        logger.error(zipFilePath, ["registerModule", "Zip file deleted:"]);
      });
      const modulePath = path.join("/", module.name, "index.js");
      void saveBundle({
        modulePath,
        name: module.name,
      }).then(() => {
        void registerBundle(modulePath, socket, logger);
      });
      return {
        modulePath,
        name: module.name,
      };
    });
  } catch (error) {
    logger.error(`Failed to load module at ${module.name}:`, "registerModule");
  }
}
