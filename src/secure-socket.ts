import { SecureSocket, sendMessage } from "@ugursahinkaya/secure-socket";
import {
  Context,
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
  logger,
  operationBundles,
}: {
  socketUrl?: string;
  authUrl?: string;
  operations: TOperations;
  logger?: {
    name: string;
    levels: string[];
  };
  operationBundles?: Record<string, string>;
}) {
  const secureSocket = new SecureSocket({
    socketUrl,
    authUrl,
    operations,
    logger,
  });
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
      void registerModule({ name, file }, secureSocket);
    },
    loginOrRegister: async () => {
      const refreshToken = await secureSocket.call("getRefreshToken");
      await secureSocket.refresh(refreshToken);
    },
  });
  secureSocket.use({
    socketConnected: () => {
      console.log("Bot Socket Connected", secureSocket.socket?.CONNECTING);
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
      console.log("eventHandlerOperations unsubscribe", args);
    },
    updateSubscribtion: (...args: any[]) => {
      console.log("eventHandlerOperations updateSubscribtion", args);
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
      secureSocket.logger.log("listBundle", res);
      res.map((bundle: { bundlePath: string; name: string }) => {
        registerBundle(bundle.bundlePath, secureSocket).catch(() => {
          secureSocket.logger.log(
            bundle.name,
            bundle.bundlePath,
            "register error"
          );
        });
      });
    })
    .catch((error) => {
      secureSocket.logger.error("register promises error", error);
    });

  secureSocket.logger.log("Bot starting");
  return secureSocket;
}
