import { Context, Operation } from "@ugursahinkaya/shared-types";
import {
  getRulesByOperation,
  getUser,
  checkUserGroupMembership,
  getUserIdsByRule,
  getUserGroupIdsByRule,
  Rule,
  User,
} from "./index.js";

export async function rulesMiddleware(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  context: Context<Operation<any, any>>,
  middlewareContext: {
    operations?: Record<string, (args: Record<string, unknown>) => unknown>;
  },
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
): Promise<Context<Operation<any, any>>> {
  const { operations } = middlewareContext;
  if (!operations) {
    throw new Error("operations not provided");
  }
  if (!context.payload) {
    // TODO empty payload rule management must be here
    return context;
  }

  const phone = context.payload.sender;
  if (!phone) {
    context.payload.error = ""; // sender not found
    return context;
  }
  const operation = context.payload.process;
  const protocol =
    context.channel === "rest" ? (context.encrypt ? "e2eRest" : "rest") : "wss";
  if (!operation) {
    context.payload.error = ""; // operation not found
    return context;
  }

  const user = await getUser({ phone });

  const rules = await getRulesByOperation({ operation });
  if (!rules.every((rule: Rule) => checkRule(protocol, rule, user))) {
    context.payload.error = "permission denied";
    return context;
  }
  return context;
}

async function parseCondition(
  rule: Rule,
): Promise<[string, string | number[] | null | undefined] | [string]> {
  switch (rule.kind) {
    case "user":
      return [rule.kind, await getUserIdsByRule({ ruleId: rule.id })];
    case "userGroup":
      return [rule.kind, await getUserGroupIdsByRule({ ruleId: rule.id })];
    case "requestProtocol":
      return [rule.kind, rule.protocol];
    case "userRole":
      return [rule.kind, rule.role];
    case "domain":
      return [rule.kind, rule.domain];
    default:
      return [rule.kind];
  }
}

type RuleOperation = (payload: {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  param: any;
  protocol?: string;
  user?: User | null;
}) => boolean | Promise<boolean>;
const ruleOperations: Record<string, RuleOperation> = {
  any: () => true,
  user: (payload: { param: string[]; protocol?: string; user?: User | null }) =>
    payload.param.some((userPhone) =>
      !payload.user ? false : payload.user.phone === userPhone,
    ),

  userRole: (payload: {
    param: string;
    protocol?: string;
    user?: User | null;
  }) => (!payload.user ? false : payload.user.role === payload.param),

  requestProtocol: (payload: { param: string; protocol?: string }) =>
    payload.param === "any"
      ? true
      : payload.param === "anyRest" &&
          (payload.protocol === "rest" || payload.protocol === "e2eRest")
        ? true
        : payload.param === payload.protocol,

  domain: (payload: { param: string; protocol?: string }) =>
    payload.param === payload.protocol,
  userGroup: async (payload: {
    param: number[];
    protocol?: string;
    user?: User | null;
  }) =>
    !payload.user
      ? false
      : await checkUserGroupMembership({
          userId: payload.user.id,
          groupIds: payload.param,
        }),
};
async function checkRule(
  protocol: string,
  rule: Rule,
  user: User | undefined | null,
) {
  if (rule.type === "deny") {
    if (rule.kind === "any") {
      return false;
    }
  }
  const [operation, param] = await parseCondition(rule);
  const ruleOp = ruleOperations[operation];
  if (ruleOp) {
    return await ruleOp({ param, protocol, user });
  }
  return false;
}
