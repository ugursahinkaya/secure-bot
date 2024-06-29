import {
  AnyRecord,
  BotOptions,
  Context,
  Middleware,
  OperationsMap,
  OperationsRecord,
} from "@ugursahinkaya/shared-types/index";
import path from "path";

import { authOperations, saveBundle } from "./auth/index.js";
import { useSecureSocket } from "./secure-socket.js";
import { rulesMiddleware } from "./auth/rules-middleware.js";
import { registerBundle } from "./utils/register-bundle.js";
export const bundlesDir = path.join("./dist", "bundles");
export function useBot<TOperations extends OperationsRecord>(
  options: BotOptions<TOperations>,
  initialize?: (args?: any) => Promise<any> | void
) {
  let { authUrl } = options;
  const { socketUrl, operations, operationBundles, name } = options;

  if (!name && !process.env.BOT_NAME) {
    throw new Error("name or env.BOT_NAME must be provided");
  }

  let { logLevels } = options;

  process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
  void initialize?.();
  const secureSocket = useSecureSocket({
    socketUrl,
    authUrl,
    operations: {
      ...operations,
      ...authOperations,
    } as TOperations,
    logger: { name: options.name, levels: logLevels ?? [] },
    operationBundles,
  });

  secureSocket.setMiddleware(rulesMiddleware, { operations });
  options.middleware?.forEach((middleware) =>
    secureSocket.setMiddleware(
      middleware as Middleware<OperationsMap<TOperations>>,
      {}
    )
  );

  const call = async <TOperationName extends keyof TOperations>(
    operationName: TOperationName,
    input: OperationsMap<TOperations>[TOperationName][0],
    context?: Context
  ) => {
    return (await secureSocket.call(
      operationName,
      {
        ...context,
        payload: {
          body: input,
        },
      },
      input
    )) as Promise<OperationsMap<TOperations>[TOperationName][1]>;
  };

  return {
    auth: authOperations,
    call,
    use: (name: string, modulePath: string) => {
      void saveBundle({
        modulePath,
        name,
      }).then(() => {
        void registerBundle(modulePath, secureSocket);
      });
    },
    sendMessage: (
      receiver: string,
      message: string | AnyRecord,
      context?: AnyRecord
    ) => secureSocket.sendMessage(receiver, message, context),
  };
}
