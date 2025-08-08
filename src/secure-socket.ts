import { SecureSocket, sendMessage } from "@ugursahinkaya/secure-socket";
import { Logger } from "@ugursahinkaya/logger";
import {
  Context,
  LogLevel,
  Operation,
  SecureSocketOperations,
} from "@ugursahinkaya/shared-types";
import { saveBundle, listBundle } from "./auth/index.js";
import { registerModule } from "./utils/register-module.js";
import { registerBundle } from "./utils/register-bundle.js";

export function useSecureSocket<TOperations extends SecureSocketOperations>({
  socketUrl,
  authUrl,
  operations,
  logLevel,
  operationBundles,
}: {
  socketUrl?: string;
  authUrl?: string;
  operations: TOperations;
  logLevel?: LogLevel;
  operationBundles?: Record<string, string>;
}) {
  const secureSocket = new SecureSocket({
    socketUrl,
    authUrl,
    operations,
    logLevel,
  });
  const logger = new Logger("secure-socket", "57FA35", logLevel);
  const registerPromises: Promise<unknown>[] = [];
  secureSocket.use({
    useBundle: async ({
      name,
      modulePath,
    }: {
      name: string;
      modulePath: string;
    }) => {
      return await saveBundle({ name, modulePath });
    },
    registerModule: ({ name, file }: { name: string; file: string }) => {
      void registerModule({ name, file }, secureSocket, logger);
    },
    loginOrRegister: async () => {
      logger.debug("loginOrRegister", "useSecureSocket");
      const refreshToken = await secureSocket.call("getRefreshToken");
      await secureSocket.refresh(refreshToken);
    },
  });
  secureSocket.use({
    socketConnected: () => {
      logger.debug("Bot socket connected", "useSecureSocket");
      //@ts-expect-error only node env
      secureSocket.socket?.addEventListener("ping", () => {
        secureSocket.socket?.pong();
      });
    },
  });
  const eventHandlerOperations = {
    subscribe: async (
      params: Context<Operation<any, any>>,
      message: { payload: { sender: string } }
    ) => {
      const { sender: user } = message.payload;
      const { call, after, payload } = params;

      secureSocket.eventRouter.setAfter(after, () =>
        secureSocket.call(call, {}, payload)
      );
      const res = await secureSocket.call(call, {}, payload);
      sendMessage(secureSocket, {
        payload: {
          receiver: user,
          body: { subscribtionName: name, res },
          process: "next",
        },
      });

      return;
    },
    unsubscribe: (...args: any[]) => {
      logger.debug(args, ["eventHandlerOperations", "unsubscribe"]);
    },
    updateSubscribtion: (...args: any[]) => {
      logger.debug(args, ["eventHandlerOperations", "updateSubscribtion"]);
    },
  };
  secureSocket.use(eventHandlerOperations);
  if (operationBundles) {
    Object.entries(operationBundles).map(([name, modulePath]) => {
      const promise = saveBundle({ name, modulePath, passIfExist: true });
      registerPromises.push(promise);
    });
  } else if (process.env.OPERATION_BUNDLES) {
    const bundles = JSON.parse(process.env.OPERATION_BUNDLES) as Record<
      string,
      string
    >;
    Object.entries(bundles).map(([name, modulePath]) => {
      const promise = saveBundle({ name, modulePath, passIfExist: true });
      registerPromises.push(promise);
    });
  }
  Promise.all(registerPromises)
    .then(async () => {
      const res = await listBundle({ status: true });
      logger.debug(res, ["useSecureSocket", "listBundle result"]);
      res.map((bundle: { bundlePath: string; name: string }) => {
        registerBundle(bundle.bundlePath, secureSocket, logger).catch(() => {
          logger.debug(
            { name: bundle.name, bundlePath: bundle.bundlePath },
            "registerBundle"
          );
        });
      });
    })
    .catch((error) => {
      logger.error(error, ["useSecureSocket", "register promises"]);
    });

  logger.info("Bot starting", "useSecureSocket");
  return { secureSocket, logger };
}
