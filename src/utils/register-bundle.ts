import { SecureSocket } from "@ugursahinkaya/secure-socket";
import { Operation } from "@ugursahinkaya/shared-types";
import { bundlesDir } from "../index";
import path from "path";

export async function registerBundle(
  modulePath: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  socket: SecureSocket<any>,
): Promise<void> {
  socket.logger.log("registerBundle", modulePath);

  return new Promise((resolve, reject) => {
    const moduleFullPath = path.resolve(path.join(bundlesDir, modulePath));
    try {
      import(moduleFullPath)
        .then(
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (module: { [key: string]: Operation<any, any> }) => {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const operations: Record<string, (...args: any[]) => any> = {};
            for (const operationName in module) {
              if (
                Object.prototype.hasOwnProperty.call(module, operationName) &&
                typeof module[operationName] === "function"
              ) {
                operations[operationName] = module[
                  operationName
                ] as unknown as (...args: unknown[]) => unknown;

                socket.logger.log(
                  `Operation ${operationName} has been registered from ${modulePath}`,
                );
              }
            }
            socket.use(operations);
            resolve();
          },
        )
        .catch(reject);
    } catch {
      reject();
    }
  });
}
