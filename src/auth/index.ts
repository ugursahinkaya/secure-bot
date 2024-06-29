import {
  PrismaClient,
  Rule,
  User,
  UserGroup,
  Prisma,
  OperationBundle,
} from "../auth-client/index.js";

export type { Rule, User, UserGroup };
const prisma = new PrismaClient();

export async function getRulesByOperation({
  operation,
}: {
  operation: string;
}) {
  return await prisma.rule.findMany({ where: { operation } });
}

export async function getUserIdsByRule({ ruleId }: { ruleId: number }) {
  const relations = await prisma.userRuleRelation.findMany({
    where: { ruleId },
  });
  const userIds = relations.map((relation) => relation.userId);
  return userIds;
}

export async function getUserGroupIdsByRule({ ruleId }: { ruleId: number }) {
  const relations = await prisma.groupRuleRelation.findMany({
    where: { ruleId },
  });
  const userGroupIds = relations.map((relation) => relation.userGroupId);
  return userGroupIds;
}

export async function checkUserGroupMembership({
  userId,
  groupIds,
}: {
  userId: number;
  groupIds: number[];
}) {
  for (const userGroupId of groupIds) {
    const relation = await prisma.userGroupRelation.findFirst({
      where: {
        userId,
        userGroupId,
      },
    });
    if (relation) {
      return true;
    }
  }
  return false;
}

export async function saveBundle(data: {
  name: string;
  modulePath: string;
  passIfExist?: boolean;
}) {
  const { modulePath, passIfExist, name } = data;
  const bundle = await prisma.operationBundle.findFirst({
    where: { bundlePath: modulePath },
  });
  if (bundle) {
    if (passIfExist) {
      return;
    }
    return updateBundle({ ...bundle, status: true });
  }
  return await prisma.operationBundle.create({
    data: { bundlePath: modulePath, name, status: true },
  });
}
async function removeBundle({ id }: { id: number }) {
  return await prisma.operationBundle.delete({
    where: { id },
  });
}
export async function updateBundle(bundle: OperationBundle) {
  const { id, ...data } = bundle;
  return await prisma.operationBundle.update({
    where: { id },
    data,
  });
}
export async function listBundle(where: Prisma.OperationBundleWhereInput) {
  return await prisma.operationBundle.findMany({
    where,
  });
}

async function addUser(data: User) {
  return await prisma.user.create({ data });
}

async function updateUser(user: User) {
  const { id, ...data } = user;
  return await prisma.user.update({
    where: { id },
    data,
  });
}

async function removeUser({ id }: { id: number }) {
  return await prisma.user.delete({
    where: { id },
  });
}

export async function getUser({ phone }: { phone: string }) {
  return await prisma.user.findFirst({
    where: { phone },
    include: {
      UserGroupRelation: {
        include: {
          userGroup: true,
        },
      },
      UserRuleRelation: {
        include: {
          rule: true,
        },
      },
    },
  });
}

async function listUser(where: Prisma.UserWhereInput) {
  return await prisma.user.findMany({
    where,
    include: {
      UserGroupRelation: {
        include: {
          userGroup: true,
        },
      },
      UserRuleRelation: {
        include: {
          rule: true,
        },
      },
    },
  });
}

async function addUserGroup(data: UserGroup) {
  return await prisma.userGroup.create({ data });
}

async function updateUserGroup(group: UserGroup) {
  const { id, ...data } = group;
  return await prisma.userGroup.update({
    where: { id },
    data,
  });
}

async function removeUserGroup({ id }: { id: number }) {
  return await prisma.userGroup.delete({
    where: { id },
  });
}

async function getUserGroup({ id }: { id: number }) {
  return await prisma.userGroup.findFirst({
    where: { id },
    include: {
      GroupRuleRelation: {
        include: {
          rule: true,
        },
      },
      UserGroupRelation: {
        include: {
          user: true,
        },
      },
    },
  });
}

async function listUserGroup(where: Prisma.UserGroupWhereInput) {
  return await prisma.userGroup.findMany({
    where,
    include: {
      GroupRuleRelation: {
        include: {
          rule: true,
        },
      },
      UserGroupRelation: {
        include: {
          user: true,
        },
      },
    },
  });
}

async function addRule(data: Rule) {
  return await prisma.rule.create({ data });
}

async function updateRule(rule: Rule) {
  const { id, ...data } = rule;
  return await prisma.rule.update({
    where: { id },
    data,
  });
}

async function removeRule({ id }: { id: number }) {
  return await prisma.rule.delete({
    where: { id },
  });
}

async function getRule({ id }: { id: number }) {
  return await prisma.rule.findFirst({
    where: { id },
    include: {
      GroupRuleRelation: {
        include: {
          userGroup: true,
        },
      },
      UserRuleRelation: {
        include: {
          user: true,
        },
      },
    },
  });
}

async function listRule(where: Prisma.RuleWhereInput) {
  return await prisma.rule.findMany({
    where,
    include: {
      GroupRuleRelation: {
        include: {
          userGroup: true,
        },
      },
      UserRuleRelation: {
        include: {
          user: true,
        },
      },
    },
  });
}

async function connectUserToGroup({
  userId,
  userGroupId,
}: {
  userId: number;
  userGroupId: number;
}) {
  return await prisma.userGroupRelation.create({
    data: { userId, userGroupId },
  });
}

async function connectUserToRule({
  userId,
  ruleId,
}: {
  userId: number;
  ruleId: number;
}) {
  return await prisma.userRuleRelation.create({
    data: { userId, ruleId },
  });
}

async function connectUserGroupToRule({
  userGroupId,
  ruleId,
}: {
  userGroupId: number;
  ruleId: number;
}) {
  return await prisma.groupRuleRelation.create({
    data: { userGroupId, ruleId },
  });
}

async function disconnectUserToGroup({
  userId,
  userGroupId,
}: {
  userId: number;
  userGroupId: number;
}) {
  const relation = await prisma.userGroupRelation.findFirst({
    where: { userId, userGroupId },
  });
  if (relation) {
    await prisma.userGroupRelation.delete({ where: { id: relation.id } });
  }
}

async function disconnectUserToRule({
  userId,
  ruleId,
}: {
  userId: number;
  ruleId: number;
}) {
  const relation = await prisma.userRuleRelation.findFirst({
    where: { userId, ruleId },
  });
  if (relation) {
    await prisma.userRuleRelation.delete({ where: { id: relation.id } });
  }
}

async function disconnectUserGroupToRule({
  userGroupId,
  ruleId,
}: {
  userGroupId: number;
  ruleId: number;
}) {
  const relation = await prisma.groupRuleRelation.findFirst({
    where: { userGroupId, ruleId },
  });
  if (relation) {
    await prisma.groupRuleRelation.delete({ where: { id: relation.id } });
  }
}

export const authOperations = {
  saveBundle,
  listBundle,
  removeBundle,
  updateBundle,
  addRule,
  addUser,
  addUserGroup,
  updateRule,
  updateUser,
  updateUserGroup,
  removeRule,
  removeUser,
  removeUserGroup,
  getRule,
  getUser,
  getUserGroup,
  listRule,
  listUser,
  listUserGroup,
  connectUserGroupToRule,
  connectUserToGroup,
  connectUserToRule,
  disconnectUserGroupToRule,
  disconnectUserToGroup,
  disconnectUserToRule,
};
