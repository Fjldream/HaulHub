import cors from "@fastify/cors";
import multipart from "@fastify/multipart";
import { PrismaClient } from "@prisma/client";
import { createReadStream } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, extname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createHash, randomUUID } from "node:crypto";
import {
  assertTripStatusTransition,
  canDriverEditTrip,
  type TripStatus,
} from "@haulhub/shared";
import Fastify from "fastify";
import { z } from "zod";
import { getCurrentUser, requireRole } from "./auth";
import { calculateSettlement } from "./finance";
import { compressImageForStorage, maxCompressedImageBytes } from "./image-compression";
import { serializeTripForAdmin, serializeTripForDriver } from "./serializers";

const tripInclude = {
  vehicle: true,
  driver: true,
  expenses: {
    include: {
      receiptImages: true,
      expenseType: true,
    },
  },
  settlement: true,
} as const;

const apiRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const uploadRoot = process.env.UPLOAD_DIR ? resolve(process.env.UPLOAD_DIR) : resolve(apiRoot, "uploads");

function hashPassword(password: string) {
  return createHash("sha256").update(password).digest("hex");
}

function isPasswordHash(value: string) {
  return /^[a-f0-9]{64}$/i.test(value);
}

function extensionFromMimeType(mimeType: string) {
  if (mimeType === "image/png") return ".png";
  if (mimeType === "image/webp") return ".webp";
  if (mimeType === "image/gif") return ".gif";
  return ".jpg";
}

function contentTypeFromFilename(filename: string) {
  const ext = extname(filename).toLowerCase();
  if (ext === ".png") return "image/png";
  if (ext === ".webp") return "image/webp";
  if (ext === ".gif") return "image/gif";
  return "image/jpeg";
}

const tripStatuses = new Set<TripStatus>([
  "assigned",
  "in_progress",
  "submitted",
  "under_review",
  "completed",
  "returned",
  "cancelled",
]);

function toTripStatus(status: string): TripStatus {
  if (!tripStatuses.has(status as TripStatus)) {
    throw Object.assign(new Error(`Unknown trip status: ${status}`), { statusCode: 500 });
  }

  return status as TripStatus;
}

interface ExpenseWithReceiptRequirement {
  expenseTypeNameSnapshot: string;
  expenseType: {
    requiresReceipt: boolean;
  };
  receiptImages: unknown[];
}

interface ExpenseAmount {
  amount: {
    toString(): string;
  };
}

interface SettlementAmount {
  actualFreight: {
    toString(): string;
  };
  expenseTotal: {
    toString(): string;
  };
  profit: {
    toString(): string;
  };
}

interface ReportSettlement extends SettlementAmount {
  settledAt: Date;
  profit: {
    toString(): string;
  };
  trip: {
    vehicle: {
      id: string;
      plateNumber: string;
    };
    driver: {
      id: string;
      name: string;
    };
    expenses: Array<{
      expenseTypeId: string;
      expenseTypeNameSnapshot: string;
      amount: {
        toString(): string;
      };
    }>;
  };
}

interface ReportMaintenance {
  id: string;
  vehicleId: string;
  component: string;
  amount: {
    toString(): string;
  };
  occurredAt: Date;
  voucherStorageKey: string | null;
  note: string | null;
  vehicle: {
    id: string;
    plateNumber: string;
  };
}

interface VehicleMaintenanceRecord {
  id: string;
  vehicleId: string;
  component: string;
  amount: {
    toString(): string;
  };
  occurredAt: Date;
  voucherStorageKey: string | null;
  note: string | null;
  createdAt: Date;
  vehicle: {
    id: string;
    plateNumber: string;
  };
  creator: {
    id: string;
    name: string;
  };
}

interface VehicleWithBindings {
  id: string;
  plateNumber: string;
  status: string;
  vehicleType: string | null;
  brandModel?: string | null;
  loadCapacityTons?: {
    toString(): string;
  } | null;
  registeredAt?: Date | null;
  insuranceExpiresAt?: Date | null;
  inspectionExpiresAt?: Date | null;
  maintenanceDueAt?: Date | null;
  imageUrl?: string | null;
  note: string | null;
  driverBindings: Array<{
    driver: {
      id: string;
      name: string;
      phone: string;
      status: string;
    };
  }>;
  trips?: Array<{
    id: string;
    status: string;
  }>;
  maintenanceRecords?: Array<{
    occurredAt: Date;
  }>;
}

interface DriverWithBindings {
  id: string;
  teamId: string | null;
  team?: {
    name: string;
  } | null;
  name: string;
  phone: string;
  status: string;
  role: string;
  isFirstLogin: boolean;
  driverBindings: Array<{
    vehicle: {
      id: string;
      plateNumber: string;
      status: string;
      vehicleType: string | null;
    };
  }>;
}

interface AdminMember {
  id: string;
  teamId: string | null;
  name: string;
  phone: string;
  role: string;
  status: string;
  isFirstLogin: boolean;
  createdAt: Date;
  team?: {
    id: string;
    name: string;
  } | null;
}

interface TeamRecord {
  id: string;
  name: string;
  status: string;
  note: string | null;
  createdAt: Date;
  _count?: {
    users: number;
    vehicles: number;
    trips: number;
  };
}

interface AuditLogWithActor {
  id: string;
  actorId: string;
  targetType: string;
  targetId: string;
  action: string;
  before: string | null;
  after: string | null;
  createdAt: Date;
  actor: {
    id: string;
    name: string;
    role: string;
  };
}

type AppPrisma = Pick<
  PrismaClient,
  | "trip"
  | "expense"
  | "expenseType"
  | "receiptImage"
  | "auditLog"
  | "vehicle"
  | "user"
  | "driverVehicleBinding"
  | "settlementSnapshot"
  | "vehicleMaintenance"
  | "driverDocument"
  | "team"
>;

const driverDocumentTypes = [
  { type: "driver_license", name: "驾驶证" },
  { type: "qualification_certificate", name: "从业资格证" },
  { type: "transport_permit", name: "车辆通行备案" },
] as const;

const driverDocumentStatuses = new Set(["missing", "pending", "approved", "rejected", "expired"]);

interface DriverDocumentRecord {
  id: string;
  driverId: string;
  type: string;
  name: string;
  status: string;
  storageKey: string | null;
  expiresAt: Date | null;
  note: string | null;
  reviewedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

function generateTripNo(date = new Date()): string {
  const stamp = date
    .toISOString()
    .replace(/\D/g, "")
    .slice(0, 17);
  return `HH${stamp}`;
}

function serializeVehicleDetail(vehicle: VehicleWithBindings) {
  const unfinishedTripCount =
    vehicle.trips?.filter((trip) => !["completed", "cancelled"].includes(trip.status)).length ?? 0;
  const latestMaintenanceAt = vehicle.maintenanceRecords?.[0]?.occurredAt ?? null;

  return {
    id: vehicle.id,
    plateNumber: vehicle.plateNumber,
    status: vehicle.status,
    operationalStatus:
      vehicle.status === "maintenance"
        ? "maintenance"
        : vehicle.status === "disabled"
          ? "disabled"
          : unfinishedTripCount > 0
            ? "transporting"
            : "idle",
    vehicleType: vehicle.vehicleType,
    brandModel: vehicle.brandModel ?? null,
    loadCapacityTons: vehicle.loadCapacityTons?.toString() ?? null,
    registeredAt: vehicle.registeredAt?.toISOString() ?? null,
    insuranceExpiresAt: vehicle.insuranceExpiresAt?.toISOString() ?? null,
    inspectionExpiresAt: vehicle.inspectionExpiresAt?.toISOString() ?? null,
    maintenanceDueAt: vehicle.maintenanceDueAt?.toISOString() ?? null,
    latestMaintenanceAt: latestMaintenanceAt?.toISOString() ?? null,
    imageUrl: vehicle.imageUrl ?? null,
    note: vehicle.note,
    unfinishedTripCount,
    boundDrivers: vehicle.driverBindings.map((binding) => ({
      id: binding.driver.id,
      name: binding.driver.name,
      phone: binding.driver.phone,
      status: binding.driver.status,
    })),
  };
}

function serializeDriverDetail(driver: DriverWithBindings) {
  return {
    id: driver.id,
    teamId: driver.teamId,
    teamName: driver.team?.name ?? null,
    name: driver.name,
    phone: driver.phone,
    status: driver.status,
    role: driver.role,
    isFirstLogin: driver.isFirstLogin,
    boundVehicles: driver.driverBindings.map((binding) => binding.vehicle),
  };
}

function serializeDriverDocument(document: DriverDocumentRecord) {
  return {
    id: document.id,
    driverId: document.driverId,
    type: document.type,
    name: document.name,
    status: document.status,
    storageKey: document.storageKey,
    expiresAt: document.expiresAt?.toISOString() ?? null,
    note: document.note,
    reviewedAt: document.reviewedAt?.toISOString() ?? null,
    createdAt: document.createdAt.toISOString(),
    updatedAt: document.updatedAt.toISOString(),
  };
}

async function listDriverDocuments(prisma: AppPrisma, driverId: string) {
  const existing = (await prisma.driverDocument.findMany({
    where: { driverId },
    orderBy: { createdAt: "asc" },
  })) as DriverDocumentRecord[];
  const byType = new Map<string, DriverDocumentRecord>(existing.map((document) => [document.type, document]));
  return driverDocumentTypes.map((preset) => {
    const document = byType.get(preset.type);
    if (document) return serializeDriverDocument(document);

    return {
      id: "",
      driverId,
      type: preset.type,
      name: preset.name,
      status: "missing",
      storageKey: null,
      expiresAt: null,
      note: null,
      reviewedAt: null,
      createdAt: null,
      updatedAt: null,
    };
  });
}

function serializeAdminMember(member: AdminMember) {
  return {
    id: member.id,
    teamId: member.teamId,
    teamName: member.team?.name ?? null,
    name: member.name,
    phone: member.phone,
    role: member.role,
    status: member.status,
    isFirstLogin: member.isFirstLogin,
    createdAt: member.createdAt.toISOString(),
  };
}

function serializeTeam(team: TeamRecord) {
  return {
    id: team.id,
    name: team.name,
    status: team.status,
    note: team.note,
    createdAt: team.createdAt.toISOString(),
    userCount: team._count?.users ?? 0,
    vehicleCount: team._count?.vehicles ?? 0,
    tripCount: team._count?.trips ?? 0,
  };
}

function scopedTeamId(user: { role: string; teamId: string | null }): string | undefined {
  if (user.role === "administrator") {
    return user.teamId ?? undefined;
  }
  if (!user.teamId) {
    throw Object.assign(new Error("Team scope missing"), { statusCode: 403 });
  }
  return user.teamId;
}

function requiredTeamId(user: { role: string; teamId: string | null }, fallback?: string): string {
  if (user.role === "administrator") {
    return fallback ?? user.teamId ?? "team-default";
  }
  if (!user.teamId) {
    throw Object.assign(new Error("Team scope missing"), { statusCode: 403 });
  }
  return user.teamId;
}

function parseAuditPayload(value: string | null) {
  if (!value) return null;
  try {
    return JSON.parse(value) as unknown;
  } catch {
    return value;
  }
}

function serializeAuditLog(log: AuditLogWithActor) {
  return {
    id: log.id,
    actorId: log.actorId,
    actorName: log.actor.name,
    actorRole: log.actor.role,
    targetType: log.targetType,
    targetId: log.targetId,
    action: log.action,
    before: parseAuditPayload(log.before),
    after: parseAuditPayload(log.after),
    createdAt: log.createdAt.toISOString(),
  };
}

function createReportGroup(id: string, label: string) {
  return {
    id,
    label,
    tripCount: 0,
    actualFreightTotal: 0,
    expenseTotal: 0,
    profitTotal: 0,
  };
}

function serializeReportGroup(group: ReturnType<typeof createReportGroup>) {
  return {
    ...group,
    actualFreightTotal: group.actualFreightTotal.toFixed(2),
    expenseTotal: group.expenseTotal.toFixed(2),
    profitTotal: group.profitTotal.toFixed(2),
  };
}

function sortByProfitDesc<T extends { profitTotal: number }>(items: T[]) {
  return items.sort((left, right) => right.profitTotal - left.profitTotal);
}

function serializeVehicleMaintenance(record: VehicleMaintenanceRecord) {
  return {
    id: record.id,
    vehicleId: record.vehicleId,
    component: record.component,
    amount: record.amount.toString(),
    occurredAt: record.occurredAt.toISOString(),
    voucherStorageKey: record.voucherStorageKey,
    note: record.note,
    createdAt: record.createdAt.toISOString(),
    vehicle: {
      id: record.vehicle.id,
      plateNumber: record.vehicle.plateNumber,
    },
    creator: {
      id: record.creator.id,
      name: record.creator.name,
    },
  };
}

function periodKey(date: Date, period: "week" | "month" | "year") {
  if (period === "year") {
    return String(date.getUTCFullYear());
  }
  if (period === "month") {
    return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
  }
  const weekStart = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const day = weekStart.getUTCDay() || 7;
  weekStart.setUTCDate(weekStart.getUTCDate() - day + 1);
  return `${weekStart.getUTCFullYear()}-${String(weekStart.getUTCMonth() + 1).padStart(2, "0")}-${String(weekStart.getUTCDate()).padStart(2, "0")}`;
}

function localDateBoundary(value: string, boundary: "start" | "end") {
  const time = boundary === "start" ? "00:00:00.000" : "23:59:59.999";
  return new Date(`${value}T${time}+08:00`);
}

export function buildApp(prisma: AppPrisma = new PrismaClient()) {
  const app = Fastify({ logger: false });

  app.register(cors);
  app.register(multipart, {
    limits: {
      fileSize: 10 * 1024 * 1024,
      files: 1,
    },
  });

  app.get("/health", async () => ({ ok: true }));

  app.get("/files/:filename", async (request, reply) => {
    const { filename } = z.object({ filename: z.string().regex(/^[a-zA-Z0-9._-]+$/) }).parse(request.params);
    return reply
      .type(contentTypeFromFilename(filename))
      .send(createReadStream(join(uploadRoot, filename)));
  });

  app.post("/files", async (request, reply) => {
    getCurrentUser(request);
    const file = await request.file();
    if (!file) {
      return reply.code(400).send({ message: "请选择要上传的文件" });
    }
    if (!file.mimetype.startsWith("image/")) {
      return reply.code(400).send({ message: "仅支持上传图片文件" });
    }

    const buffer = await file.toBuffer();
    if (buffer.length > 10 * 1024 * 1024) {
      return reply.code(400).send({ message: "图片不能超过 10MB" });
    }

    let compressed: Buffer;
    try {
      compressed = await compressImageForStorage(buffer);
    } catch {
      return reply.code(400).send({ message: "图片文件无法解析，请重新选择图片" });
    }

    if (compressed.length > maxCompressedImageBytes) {
      return reply.code(400).send({ message: "图片压缩失败，请重新选择更清晰或更小的图片" });
    }

    await mkdir(uploadRoot, { recursive: true });
    const filename = `${randomUUID()}.jpg`;
    await writeFile(join(uploadRoot, filename), compressed);

    return {
      file: {
        storageKey: `uploads/${filename}`,
        url: `/files/${filename}`,
        mimeType: "image/jpeg",
        sizeBytes: compressed.length,
      },
    };
  });

  app.post("/auth/login", async (request, reply) => {
    const body = z
      .object({
        phone: z.string().min(1),
        password: z.string().min(1).optional(),
        passwordDigest: z.string().regex(/^[a-f0-9]{64}$/i).optional(),
      })
      .refine((value) => value.password || value.passwordDigest, {
        message: "请输入密码",
      })
      .parse(request.body);

    const user = await prisma.user.findFirst({
      where: { phone: body.phone, status: "active" },
      include: { team: true },
    });

    const incomingHash = body.passwordDigest ?? (body.password ? hashPassword(body.password) : "");
    const storedHash = isPasswordHash(user?.passwordHash ?? "")
      ? user?.passwordHash
      : hashPassword(user?.passwordHash ?? "");
    if (!user || storedHash !== incomingHash) {
      return reply.code(401).send({ message: "手机号或密码错误" });
    }

    if (!isPasswordHash(user.passwordHash)) {
      await prisma.user.update({
        where: { id: user.id },
        data: { passwordHash: incomingHash },
      });
    }

    return {
      session: {
        userId: user.id,
        role: user.role,
        name: user.name,
        teamId: user.teamId,
        teamName: user.team?.name ?? null,
      },
    };
  });

  app.get("/admin/me", async (request, reply) => {
    const user = getCurrentUser(request);
    requireRole(user, "accountant");

    const member = await prisma.user.findUnique({
      where: { id: user.id },
      include: { team: true },
    });

    if (!member || member.status !== "active" || !["accountant", "administrator"].includes(member.role)) {
      return reply.code(404).send({ message: "后台账号不存在或已停用" });
    }

    return { user: serializeAdminMember(member as AdminMember) };
  });

  app.get("/admin/members", async (request) => {
    const user = getCurrentUser(request);
    requireRole(user, "administrator");
    const query = z.object({ teamId: z.string().optional() }).parse(request.query);
    const teamId = user.role === "administrator" ? query.teamId : user.teamId ?? undefined;

    const members = await prisma.user.findMany({
      where: {
        role: { in: ["administrator", "accountant"] },
        ...(teamId ? { teamId } : {}),
      },
      include: { team: true },
      orderBy: [{ role: "asc" }, { createdAt: "asc" }],
    });

    return { members: (members as AdminMember[]).map(serializeAdminMember) };
  });

  app.post("/admin/members", async (request, reply) => {
    const user = getCurrentUser(request);
    requireRole(user, "administrator");
    const body = z
      .object({
        name: z.string().min(1),
        phone: z.string().min(1),
        password: z.string().min(6),
        role: z.enum(["administrator", "accountant"]),
        teamId: z.string().optional(),
      })
      .parse(request.body);
    const teamId = body.role === "administrator" ? null : requiredTeamId(user, body.teamId);
    const existingPhone = await prisma.user.findFirst({ where: { phone: body.phone } });
    if (existingPhone) {
      return reply.code(409).send({ message: "该手机号已存在，请换一个手机号" });
    }

    const member = await prisma.user.create({
      data: {
        teamId,
        name: body.name,
        phone: body.phone,
        passwordHash: hashPassword(body.password),
        role: body.role,
        status: "active",
        isFirstLogin: true,
      },
    });

    return { member: serializeAdminMember(member as AdminMember) };
  });

  app.get("/admin/members/:memberId", async (request, reply) => {
    const user = getCurrentUser(request);
    requireRole(user, "administrator");
    const params = z.object({ memberId: z.string() }).parse(request.params);

    const member = await prisma.user.findFirst({
      where: {
        id: params.memberId,
        role: { in: ["administrator", "accountant"] },
      },
      include: { team: true },
    });
    if (!member) {
      return reply.code(404).send({ message: "成员不存在或已被删除" });
    }

    return { member: serializeAdminMember(member as AdminMember) };
  });

  app.post("/admin/members/:memberId", async (request, reply) => {
    const user = getCurrentUser(request);
    requireRole(user, "administrator");
    const params = z.object({ memberId: z.string() }).parse(request.params);
    const body = z
      .object({
        name: z.string().min(1),
        phone: z.string().min(1),
        role: z.enum(["administrator", "accountant"]),
        status: z.enum(["active", "disabled"]),
        teamId: z.string().optional(),
      })
      .parse(request.body);
    const existing = await prisma.user.findFirst({
      where: {
        id: params.memberId,
        role: { in: ["administrator", "accountant"] },
      },
    });
    if (!existing) {
      return reply.code(404).send({ message: "成员不存在或已被删除" });
    }
    const teamId = body.role === "administrator" ? null : requiredTeamId(user, body.teamId);
    const existingPhone = await prisma.user.findFirst({ where: { phone: body.phone } });
    if (existingPhone && existingPhone.id !== params.memberId) {
      return reply.code(409).send({ message: "该手机号已存在，请换一个手机号" });
    }

    const member = await prisma.user.update({
      where: { id: params.memberId },
      data: {
        teamId,
        name: body.name,
        phone: body.phone,
        role: body.role,
        status: body.status,
      },
      include: { team: true },
    });

    return { member: serializeAdminMember(member as AdminMember) };
  });

  app.post("/admin/members/:memberId/status", async (request) => {
    const user = getCurrentUser(request);
    requireRole(user, "administrator");
    const params = z.object({ memberId: z.string() }).parse(request.params);
    const body = z
      .object({
        status: z.enum(["active", "disabled"]),
      })
      .parse(request.body);

    const member = await prisma.user.update({
      where: { id: params.memberId },
      data: { status: body.status },
      include: { team: true },
    });

    return { member: serializeAdminMember(member as AdminMember) };
  });

  app.get("/admin/teams", async (request) => {
    const user = getCurrentUser(request);
    requireRole(user, "administrator");
    const teams = await prisma.team.findMany({
      orderBy: { createdAt: "asc" },
      include: {
        _count: {
          select: {
            users: true,
            vehicles: true,
            trips: true,
          },
        },
      },
    });

    return { teams: (teams as TeamRecord[]).map(serializeTeam) };
  });

  app.post("/admin/teams", async (request) => {
    const user = getCurrentUser(request);
    requireRole(user, "administrator");
    const body = z
      .object({
        name: z.string().min(1),
        note: z.string().optional(),
        status: z.enum(["active", "disabled"]).optional(),
      })
      .parse(request.body);

    const team = await prisma.team.create({
      data: {
        name: body.name,
        note: body.note || null,
        status: body.status ?? "active",
      },
    });

    return { team: serializeTeam(team as TeamRecord) };
  });

  app.get("/admin/audit-logs", async (request) => {
    const user = getCurrentUser(request);
    requireRole(user, "accountant");
    const query = z
      .object({
        targetType: z.string().optional(),
        action: z.string().optional(),
        actorId: z.string().optional(),
      })
      .parse(request.query);
    const where: {
      targetType?: string;
      action?: string;
      actorId?: string;
      teamId?: string;
    } = {};
    const auditTeamId = scopedTeamId(user);
    if (auditTeamId) where.teamId = auditTeamId;
    if (query.targetType && query.targetType !== "all") {
      where.targetType = query.targetType;
    }
    if (query.action && query.action !== "all") {
      where.action = query.action;
    }
    if (query.actorId) {
      where.actorId = query.actorId;
    }

    const logs = await prisma.auditLog.findMany({
      where,
      include: {
        actor: true,
      },
      orderBy: { createdAt: "desc" },
      take: 100,
    });

    return { logs: (logs as AuditLogWithActor[]).map(serializeAuditLog) };
  });

  app.get("/driver/me", async (request, reply) => {
    const user = getCurrentUser(request);
    requireRole(user, "driver");

    const driver = await prisma.user.findUnique({
      where: { id: user.id },
      include: {
        team: true,
        driverBindings: {
          include: {
            vehicle: true,
          },
        },
      },
    });

    if (!driver || driver.role !== "driver" || driver.teamId !== user.teamId) {
      return reply.code(404).send({ message: "司机不存在或已被删除" });
    }

    return { driver: serializeDriverDetail(driver) };
  });

  app.get("/driver/documents", async (request) => {
    const user = getCurrentUser(request);
    requireRole(user, "driver");
    return { documents: await listDriverDocuments(prisma, user.id) };
  });

  app.post("/driver/documents/:type", async (request, reply) => {
    const user = getCurrentUser(request);
    requireRole(user, "driver");
    const { type } = z.object({ type: z.string() }).parse(request.params);
    const preset = driverDocumentTypes.find((item) => item.type === type);
    if (!preset) {
      return reply.code(404).send({ message: "证件类型不存在" });
    }
    const body = z
      .object({
        storageKey: z.string().min(1),
        expiresAt: z.string().optional(),
        note: z.string().optional(),
      })
      .parse(request.body);

    const driver = await prisma.user.findFirst({
      where: { id: user.id, role: "driver", ...(user.teamId ? { teamId: user.teamId } : {}) },
    });
    if (!driver) {
      return reply.code(404).send({ message: "司机不存在或已被删除" });
    }

    const document = await prisma.driverDocument.upsert({
      where: { driverId_type: { driverId: user.id, type } },
      create: {
        driverId: user.id,
        type,
        name: preset.name,
        status: "pending",
        storageKey: body.storageKey,
        expiresAt: body.expiresAt ? new Date(`${body.expiresAt}T00:00:00.000Z`) : null,
        note: body.note || null,
      },
      update: {
        name: preset.name,
        status: "pending",
        storageKey: body.storageKey,
        expiresAt: body.expiresAt ? new Date(`${body.expiresAt}T00:00:00.000Z`) : null,
        note: body.note || null,
        reviewedAt: null,
      },
    });

    return { document: serializeDriverDocument(document as DriverDocumentRecord) };
  });

  app.get("/driver/trips", async (request) => {
    const user = getCurrentUser(request);
    requireRole(user, "driver");
    const query = z
      .object({
        status: z.string().optional(),
        page: z.coerce.number().int().min(1).optional(),
        pageSize: z.coerce.number().int().min(1).max(100).optional(),
      })
      .parse(request.query);
    const pageSize = query.pageSize;
    const page = query.page ?? 1;

    const trips = await prisma.trip.findMany({
      where: {
        driverId: user.id,
        ...(query.status && tripStatuses.has(query.status as TripStatus)
          ? { status: query.status as TripStatus }
          : { status: { not: "cancelled" } }),
        ...(user.teamId ? { teamId: user.teamId } : {}),
      },
      include: tripInclude,
      orderBy: { createdAt: "desc" },
      ...(pageSize ? { skip: (page - 1) * pageSize, take: pageSize + 1 } : {}),
    });
    const hasMore = pageSize ? trips.length > pageSize : false;
    const pageRows = pageSize ? trips.slice(0, pageSize) : trips;

    return {
      trips: pageRows.map(serializeTripForDriver),
      pagination: pageSize ? { page, pageSize, hasMore } : undefined,
    };
  });

  app.get("/driver/trips/:tripId", async (request, reply) => {
    const user = getCurrentUser(request);
    requireRole(user, "driver");
    const { tripId } = z.object({ tripId: z.string() }).parse(request.params);

    const trip = await prisma.trip.findFirst({
      where: { id: tripId, driverId: user.id, status: { not: "cancelled" }, ...(user.teamId ? { teamId: user.teamId } : {}) },
      include: tripInclude,
    });

    if (!trip) {
      return reply.code(404).send({ message: "趟次不存在或已被删除" });
    }

    return { trip: serializeTripForDriver(trip) };
  });

  app.post("/driver/trips/:tripId/start", async (request, reply) => {
    const user = getCurrentUser(request);
    requireRole(user, "driver");
    const { tripId } = z.object({ tripId: z.string() }).parse(request.params);

    const trip = await prisma.trip.findFirst({
      where: { id: tripId, driverId: user.id, ...(user.teamId ? { teamId: user.teamId } : {}) },
    });

    if (!trip) {
      return reply.code(404).send({ message: "趟次不存在或已被删除" });
    }

    assertTripStatusTransition(toTripStatus(trip.status), "in_progress");

    const updated = await prisma.trip.update({
      where: { id: trip.id },
      data: { status: "in_progress", startedAt: new Date() },
      include: tripInclude,
    });

    return { trip: serializeTripForDriver(updated) };
  });

  app.post("/driver/trips/:tripId/submit", async (request, reply) => {
    const user = getCurrentUser(request);
    requireRole(user, "driver");
    const { tripId } = z.object({ tripId: z.string() }).parse(request.params);

    const trip = await prisma.trip.findFirst({
      where: { id: tripId, driverId: user.id, ...(user.teamId ? { teamId: user.teamId } : {}) },
      include: { expenses: { include: { expenseType: true, receiptImages: true } } },
    });

    if (!trip) {
      return reply.code(404).send({ message: "趟次不存在或已被删除" });
    }
    if (!canDriverEditTrip(toTripStatus(trip.status))) {
      return reply.code(409).send({ message: "当前状态不能提交账单" });
    }

    const missingReceipt = trip.expenses.find(
      (expense: ExpenseWithReceiptRequirement) =>
        expense.expenseType.requiresReceipt && expense.receiptImages.length === 0,
    );
    if (missingReceipt) {
      return reply.code(400).send({
        message: `请上传${missingReceipt.expenseTypeNameSnapshot}票据照片`,
      });
    }

    assertTripStatusTransition(toTripStatus(trip.status), "submitted");

    const updated = await prisma.trip.update({
      where: { id: trip.id },
      data: { status: "submitted", submittedAt: new Date() },
      include: tripInclude,
    });

    return { trip: serializeTripForDriver(updated) };
  });

  app.post("/driver/expenses", async (request, reply) => {
    const user = getCurrentUser(request);
    requireRole(user, "driver");
    const body = z
      .object({
        tripId: z.string(),
        expenseTypeId: z.string(),
        amount: z.string().regex(/^\d+(\.\d{1,2})?$/),
        occurredAt: z.string().datetime(),
        note: z.string().optional(),
      })
      .parse(request.body);

    const trip = await prisma.trip.findFirst({
      where: { id: body.tripId, driverId: user.id, ...(user.teamId ? { teamId: user.teamId } : {}) },
    });
    if (!trip) {
      return reply.code(404).send({ message: "趟次不存在或已被删除" });
    }
    if (!canDriverEditTrip(toTripStatus(trip.status))) {
      return reply.code(409).send({ message: "当前状态不能新增费用" });
    }

    const expenseType = await prisma.expenseType.findFirst({
      where: { id: body.expenseTypeId, enabled: true, ...(user.teamId ? { teamId: user.teamId } : {}) },
    });
    if (!expenseType) {
      return reply.code(400).send({ message: "费用类型不可用" });
    }

    const expense = await prisma.expense.create({
      data: {
        tripId: trip.id,
        expenseTypeId: expenseType.id,
        expenseTypeNameSnapshot: expenseType.name,
        amount: body.amount,
        occurredAt: new Date(body.occurredAt),
        note: body.note,
        createdBy: user.id,
      },
    });

    return { expense };
  });

  app.post("/driver/expenses/:expenseId", async (request, reply) => {
    const user = getCurrentUser(request);
    requireRole(user, "driver");
    const { expenseId } = z.object({ expenseId: z.string() }).parse(request.params);
    const body = z
      .object({
        amount: z.string().regex(/^\d+(\.\d{1,2})?$/),
        occurredAt: z.string().datetime(),
        note: z.string().optional(),
      })
      .parse(request.body);

    const expense = await prisma.expense.findFirst({
      where: { id: expenseId, trip: { driverId: user.id, ...(user.teamId ? { teamId: user.teamId } : {}) } },
      include: { trip: true },
    });
    if (!expense) {
      return reply.code(404).send({ message: "费用记录不存在或已被删除" });
    }
    if (!canDriverEditTrip(toTripStatus(expense.trip.status))) {
      return reply.code(409).send({ message: "当前状态不能修改费用" });
    }

    const updated = await prisma.expense.update({
      where: { id: expenseId },
      data: {
        amount: body.amount,
        occurredAt: new Date(body.occurredAt),
        note: body.note,
      },
    });

    return {
      expense: {
        ...updated,
        amount: updated.amount.toString(),
      },
    };
  });

  app.post("/driver/expenses/:expenseId/delete", async (request, reply) => {
    const user = getCurrentUser(request);
    requireRole(user, "driver");
    const { expenseId } = z.object({ expenseId: z.string() }).parse(request.params);

    const expense = await prisma.expense.findFirst({
      where: { id: expenseId, trip: { driverId: user.id, ...(user.teamId ? { teamId: user.teamId } : {}) } },
      include: { trip: true },
    });
    if (!expense) {
      return reply.code(404).send({ message: "费用记录不存在或已被删除" });
    }
    if (!canDriverEditTrip(toTripStatus(expense.trip.status))) {
      return reply.code(409).send({ message: "当前状态不能删除费用" });
    }

    await prisma.receiptImage.deleteMany({
      where: { expenseId },
    });
    const deleted = await prisma.expense.delete({
      where: { id: expenseId },
    });

    return { deleted };
  });

  app.get("/driver/expense-types", async (request) => {
    const user = getCurrentUser(request);
    requireRole(user, "driver");

    return {
      expenseTypes: await prisma.expenseType.findMany({
        where: { enabled: true, ...(user.teamId ? { teamId: user.teamId } : {}) },
        orderBy: { sortOrder: "asc" },
      }),
    };
  });

  app.post("/driver/expenses/:expenseId/receipt-images", async (request, reply) => {
    const user = getCurrentUser(request);
    requireRole(user, "driver");
    const { expenseId } = z.object({ expenseId: z.string() }).parse(request.params);
    const body = z
      .object({
        storageKey: z.string().min(1),
        mimeType: z.string().min(1).default("image/jpeg"),
        sizeBytes: z.number().int().positive().default(1),
      })
      .parse(request.body);

    const expense = await prisma.expense.findFirst({
      where: { id: expenseId, trip: { driverId: user.id, ...(user.teamId ? { teamId: user.teamId } : {}) } },
      include: { trip: true },
    });
    if (!expense) {
      return reply.code(404).send({ message: "费用记录不存在或已被删除" });
    }
    if (!canDriverEditTrip(toTripStatus(expense.trip.status))) {
      return reply.code(409).send({ message: "当前状态不能上传票据" });
    }

    const receiptImage = await prisma.receiptImage.create({
      data: {
        expenseId: expense.id,
        storageKey: body.storageKey,
        mimeType: body.mimeType,
        sizeBytes: body.sizeBytes,
      },
    });

    return { receiptImage };
  });

  app.post("/driver/receipt-images/:receiptImageId/delete", async (request, reply) => {
    const user = getCurrentUser(request);
    requireRole(user, "driver");
    const { receiptImageId } = z
      .object({ receiptImageId: z.string() })
      .parse(request.params);

    const receiptImage = await prisma.receiptImage.findFirst({
      where: { id: receiptImageId, expense: { trip: { driverId: user.id, ...(user.teamId ? { teamId: user.teamId } : {}) } } },
      include: { expense: { include: { trip: true } } },
    });
    if (!receiptImage) {
      return reply.code(404).send({ message: "票据图片不存在或已被删除" });
    }
    if (!canDriverEditTrip(toTripStatus(receiptImage.expense.trip.status))) {
      return reply.code(409).send({ message: "当前状态不能删除票据" });
    }

    const deleted = await prisma.receiptImage.delete({
      where: { id: receiptImage.id },
    });

    return { deleted };
  });

  app.get("/admin/trips", async (request) => {
    const user = getCurrentUser(request);
    requireRole(user, "accountant");
    const query = z
      .object({
        status: z.string().optional(),
        q: z.string().optional(),
        driverId: z.string().optional(),
        vehicleId: z.string().optional(),
        page: z.coerce.number().int().min(1).optional(),
        pageSize: z.coerce.number().int().min(1).max(100).optional(),
      })
      .parse(request.query);
    const where: {
      teamId?: string;
      status?: TripStatus;
      driverId?: string;
      vehicleId?: string;
      OR?: Array<Record<string, unknown>>;
    } = {};
    const teamId = scopedTeamId(user);
    if (teamId) where.teamId = teamId;
    if (query.status && tripStatuses.has(query.status as TripStatus)) {
      where.status = query.status as TripStatus;
    }
    if (query.driverId) {
      where.driverId = query.driverId;
    }
    if (query.vehicleId) {
      where.vehicleId = query.vehicleId;
    }
    const search = query.q?.trim();
    if (search) {
      where.OR = [
        { tripNo: { contains: search } },
        { customerName: { contains: search } },
        { loadLocation: { contains: search } },
        { unloadLocation: { contains: search } },
        { vehicle: { plateNumber: { contains: search } } },
        { driver: { name: { contains: search } } },
      ];
    }

    const pageSize = query.pageSize;
    const page = query.page ?? 1;
    const trips = await prisma.trip.findMany({
      where,
      include: tripInclude,
      orderBy: { createdAt: "desc" },
      ...(pageSize ? { skip: (page - 1) * pageSize, take: pageSize + 1 } : {}),
    });
    const hasMore = pageSize ? trips.length > pageSize : false;
    const pageRows = pageSize ? trips.slice(0, pageSize) : trips;

    return {
      trips: pageRows.map(serializeTripForAdmin),
      pagination: pageSize ? { page, pageSize, hasMore } : undefined,
    };
  });

  app.post("/admin/trips", async (request, reply) => {
    const user = getCurrentUser(request);
    requireRole(user, "accountant");
    const body = z
      .object({
        vehicleId: z.string().min(1),
        driverId: z.string().min(1),
        customerName: z.string().min(1),
        loadLocation: z.string().min(1),
        unloadLocation: z.string().min(1),
        estimatedFreight: z.string().regex(/^\d+(\.\d{1,2})?$/).optional(),
        driverNote: z.string().optional(),
        accountingNote: z.string().optional(),
      })
      .parse(request.body);

    const teamId = scopedTeamId(user);
    const vehicle = await prisma.vehicle.findFirst({
      where: { id: body.vehicleId, status: "available", ...(teamId ? { teamId } : {}) },
    });
    if (!vehicle) {
      return reply.code(400).send({ message: "车辆不可用，不能创建新趟次" });
    }

    const driver = await prisma.user.findFirst({
      where: { id: body.driverId, role: "driver", status: "active", teamId: vehicle.teamId },
    });
    if (!driver) {
      return reply.code(400).send({ message: "司机不可用，不能创建新趟次" });
    }

    const binding = await prisma.driverVehicleBinding.findFirst({
      where: { vehicleId: body.vehicleId, driverId: body.driverId, teamId: vehicle.teamId },
    });
    if (!binding) {
      return reply.code(400).send({ message: "司机未绑定该车辆，不能创建新趟次" });
    }

    const trip = await prisma.trip.create({
      data: {
        teamId: vehicle.teamId,
        tripNo: generateTripNo(),
        vehicleId: body.vehicleId,
        driverId: body.driverId,
        customerName: body.customerName,
        loadLocation: body.loadLocation,
        unloadLocation: body.unloadLocation,
        estimatedFreight: body.estimatedFreight,
        status: "assigned",
        driverNote: body.driverNote,
        accountingNote: body.accountingNote,
        createdBy: user.id,
      },
      include: tripInclude,
    });

    return { trip: serializeTripForAdmin(trip) };
  });

  app.get("/admin/trips/:tripId", async (request, reply) => {
    const user = getCurrentUser(request);
    requireRole(user, "accountant");
    const { tripId } = z.object({ tripId: z.string() }).parse(request.params);

    const teamId = scopedTeamId(user);
    const trip = await prisma.trip.findFirst({
      where: { id: tripId, ...(teamId ? { teamId } : {}) },
      include: tripInclude,
    });

    if (!trip) {
      return reply.code(404).send({ message: "趟次不存在或已被删除" });
    }

    return { trip: serializeTripForAdmin(trip) };
  });

  app.post("/admin/trips/:tripId", async (request, reply) => {
    const user = getCurrentUser(request);
    requireRole(user, "accountant");
    const { tripId } = z.object({ tripId: z.string() }).parse(request.params);
    const body = z
      .object({
        vehicleId: z.string().min(1),
        driverId: z.string().min(1),
        customerName: z.string().min(1),
        loadLocation: z.string().min(1),
        unloadLocation: z.string().min(1),
        estimatedFreight: z.string().regex(/^\d+(\.\d{1,2})?$/).optional(),
        driverNote: z.string().optional(),
        accountingNote: z.string().optional(),
      })
      .parse(request.body);

    const teamId = scopedTeamId(user);
    const trip = await prisma.trip.findFirst({
      where: { id: tripId, ...(teamId ? { teamId } : {}) },
    });
    if (!trip) {
      return reply.code(404).send({ message: "趟次不存在或已被删除" });
    }
    if (["completed", "cancelled"].includes(trip.status)) {
      return reply.code(409).send({ message: "已结束趟次不能直接修改" });
    }

    const vehicle = await prisma.vehicle.findFirst({
      where: { id: body.vehicleId, status: "available", teamId: trip.teamId },
    });
    if (!vehicle) {
      return reply.code(400).send({ message: "车辆不可用，不能更新趟次" });
    }

    const driver = await prisma.user.findFirst({
      where: { id: body.driverId, role: "driver", status: "active", teamId: trip.teamId },
    });
    if (!driver) {
      return reply.code(400).send({ message: "司机不可用，不能更新趟次" });
    }

    const binding = await prisma.driverVehicleBinding.findFirst({
      where: { vehicleId: body.vehicleId, driverId: body.driverId, teamId: trip.teamId },
    });
    if (!binding) {
      return reply.code(400).send({ message: "司机未绑定该车辆，不能更新趟次" });
    }

    const updated = await prisma.trip.update({
      where: { id: trip.id },
      data: {
        vehicleId: body.vehicleId,
        driverId: body.driverId,
        customerName: body.customerName,
        loadLocation: body.loadLocation,
        unloadLocation: body.unloadLocation,
        estimatedFreight: body.estimatedFreight,
        driverNote: body.driverNote,
        accountingNote: body.accountingNote,
      },
      include: tripInclude,
    });

    return { trip: serializeTripForAdmin(updated) };
  });

  app.post("/admin/trips/:tripId/cancel", async (request, reply) => {
    const user = getCurrentUser(request);
    requireRole(user, "accountant");
    const { tripId } = z.object({ tripId: z.string() }).parse(request.params);
    const { reason } = z.object({ reason: z.string().min(1) }).parse(request.body);

    const teamId = scopedTeamId(user);
    const trip = await prisma.trip.findFirst({
      where: { id: tripId, ...(teamId ? { teamId } : {}) },
    });
    if (!trip) {
      return reply.code(404).send({ message: "趟次不存在或已被删除" });
    }
    if (trip.status !== "assigned") {
      return reply.code(409).send({ message: "只有待出车趟次可以撤销" });
    }

    assertTripStatusTransition(toTripStatus(trip.status), "cancelled");

    const updated = await prisma.trip.update({
      where: { id: trip.id },
      data: { status: "cancelled", returnReason: reason },
      include: tripInclude,
    });

    await prisma.auditLog.create({
      data: {
        actorId: user.id,
        teamId: trip.teamId,
        targetType: "Trip",
        targetId: trip.id,
        action: "trip.cancelled",
        before: JSON.stringify({ status: trip.status }),
        after: JSON.stringify({ status: "cancelled", reason }),
      },
    });

    return { trip: serializeTripForAdmin(updated) };
  });

  app.post("/admin/trips/:tripId/review", async (request, reply) => {
    const user = getCurrentUser(request);
    requireRole(user, "accountant");
    const { tripId } = z.object({ tripId: z.string() }).parse(request.params);

    const teamId = scopedTeamId(user);
    const trip = await prisma.trip.findFirst({ where: { id: tripId, ...(teamId ? { teamId } : {}) } });
    if (!trip) {
      return reply.code(404).send({ message: "趟次不存在或已被删除" });
    }

    assertTripStatusTransition(toTripStatus(trip.status), "under_review");

    const updated = await prisma.trip.update({
      where: { id: trip.id },
      data: { status: "under_review", reviewStartedAt: new Date() },
      include: tripInclude,
    });

    await prisma.auditLog.create({
      data: {
        actorId: user.id,
        teamId: trip.teamId,
        targetType: "Trip",
        targetId: trip.id,
        action: "trip.review_started",
        before: JSON.stringify({ status: trip.status }),
        after: JSON.stringify({ status: "under_review" }),
      },
    });

    return { trip: serializeTripForAdmin(updated) };
  });

  app.post("/admin/trips/:tripId/return", async (request, reply) => {
    const user = getCurrentUser(request);
    requireRole(user, "accountant");
    const { tripId } = z.object({ tripId: z.string() }).parse(request.params);
    const { reason } = z.object({ reason: z.string().min(1) }).parse(request.body);

    const teamId = scopedTeamId(user);
    const trip = await prisma.trip.findFirst({ where: { id: tripId, ...(teamId ? { teamId } : {}) } });
    if (!trip) {
      return reply.code(404).send({ message: "趟次不存在或已被删除" });
    }

    assertTripStatusTransition(toTripStatus(trip.status), "returned");

    const updated = await prisma.trip.update({
      where: { id: trip.id },
      data: { status: "returned", returnReason: reason },
      include: tripInclude,
    });

    await prisma.auditLog.create({
      data: {
        actorId: user.id,
        teamId: trip.teamId,
        targetType: "Trip",
        targetId: trip.id,
        action: "trip.returned",
        before: JSON.stringify({ status: trip.status }),
        after: JSON.stringify({ status: "returned", reason }),
      },
    });

    return { trip: serializeTripForAdmin(updated) };
  });

  app.post("/admin/trips/:tripId/settle", async (request, reply) => {
    const user = getCurrentUser(request);
    requireRole(user, "accountant");
    const { tripId } = z.object({ tripId: z.string() }).parse(request.params);
    const { actualFreight } = z
      .object({ actualFreight: z.string().regex(/^\d+(\.\d{1,2})?$/) })
      .parse(request.body);

    const teamId = scopedTeamId(user);
    const trip = await prisma.trip.findFirst({
      where: { id: tripId, ...(teamId ? { teamId } : {}) },
      include: { expenses: true },
    });
    if (!trip) {
      return reply.code(404).send({ message: "趟次不存在或已被删除" });
    }

    assertTripStatusTransition(toTripStatus(trip.status), "completed");

    const settlement = calculateSettlement(
      actualFreight,
      trip.expenses.map((expense: ExpenseAmount) => expense.amount.toString()),
    );

    const updated = await prisma.trip.update({
      where: { id: trip.id },
      data: {
        status: "completed",
        actualFreight: settlement.actualFreight,
        completedAt: new Date(),
        settlement: {
          create: {
            actualFreight: settlement.actualFreight,
            expenseTotal: settlement.expenseTotal,
            profit: settlement.profit,
            profitRate: settlement.profitRate,
            settledBy: user.id,
          },
        },
      },
      include: tripInclude,
    });

    await prisma.auditLog.create({
      data: {
        actorId: user.id,
        teamId: trip.teamId,
        targetType: "Trip",
        targetId: trip.id,
        action: "trip.settled",
        before: JSON.stringify({ status: trip.status }),
        after: JSON.stringify({ status: "completed", ...settlement }),
      },
    });

    return { trip: serializeTripForAdmin(updated) };
  });

  app.post("/admin/expenses/:expenseId", async (request, reply) => {
    const user = getCurrentUser(request);
    requireRole(user, "accountant");
    const { expenseId } = z.object({ expenseId: z.string() }).parse(request.params);
    const body = z
      .object({
        amount: z.string().regex(/^\d+(\.\d{1,2})?$/),
        note: z.string().optional(),
      })
      .parse(request.body);

    const expense = await prisma.expense.findFirst({
      where: { id: expenseId, trip: { ...(scopedTeamId(user) ? { teamId: scopedTeamId(user) } : {}) } },
      include: { trip: true },
    });
    if (!expense) {
      return reply.code(404).send({ message: "费用记录不存在或已被删除" });
    }
    if (expense.trip.status !== "under_review") {
      return reply.code(409).send({ message: "只有审核中的趟次才能修改或删除费用" });
    }

    const updated = await prisma.expense.update({
      where: { id: expenseId },
      data: {
        amount: body.amount,
        note: body.note,
      },
    });

    await prisma.auditLog.create({
      data: {
        actorId: user.id,
        teamId: expense.trip.teamId,
        targetType: "Expense",
        targetId: expenseId,
        action: "expense.updated",
        before: JSON.stringify({
          amount: expense.amount.toString(),
          note: expense.note,
        }),
        after: JSON.stringify({
          amount: body.amount,
          note: body.note,
        }),
      },
    });

    return {
      expense: {
        ...updated,
        amount: updated.amount.toString(),
      },
    };
  });

  app.post("/admin/expenses/:expenseId/delete", async (request, reply) => {
    const user = getCurrentUser(request);
    requireRole(user, "accountant");
    const { expenseId } = z.object({ expenseId: z.string() }).parse(request.params);

    const expense = await prisma.expense.findFirst({
      where: { id: expenseId, trip: { ...(scopedTeamId(user) ? { teamId: scopedTeamId(user) } : {}) } },
      include: { trip: true },
    });
    if (!expense) {
      return reply.code(404).send({ message: "费用记录不存在或已被删除" });
    }
    if (expense.trip.status !== "under_review") {
      return reply.code(409).send({ message: "只有审核中的趟次才能修改或删除费用" });
    }

    const deleted = await prisma.expense.delete({
      where: { id: expenseId },
    });

    await prisma.auditLog.create({
      data: {
        actorId: user.id,
        teamId: expense.trip.teamId,
        targetType: "Expense",
        targetId: expenseId,
        action: "expense.deleted",
        before: JSON.stringify({
          amount: expense.amount.toString(),
          note: expense.note,
          expenseTypeNameSnapshot: expense.expenseTypeNameSnapshot,
        }),
        after: null,
      },
    });

    return { deleted };
  });

  app.get("/admin/vehicles", async (request) => {
    const user = getCurrentUser(request);
    requireRole(user, "accountant");
    const query = z
      .object({
        status: z.string().optional(),
        q: z.string().optional(),
      })
      .parse(request.query);
    const where: {
      teamId?: string;
      status?: string;
      OR?: Array<Record<string, unknown>>;
    } = {};
    const teamId = scopedTeamId(user);
    if (teamId) where.teamId = teamId;
    if (query.status && ["available", "maintenance", "disabled"].includes(query.status)) {
      where.status = query.status;
    }
    const search = query.q?.trim();
    if (search) {
      where.OR = [
        { plateNumber: { contains: search } },
        { vehicleType: { contains: search } },
        { brandModel: { contains: search } },
        { driverBindings: { some: { driver: { name: { contains: search } } } } },
      ];
    }
    const vehicles = await prisma.vehicle.findMany({
      where,
      include: {
        driverBindings: {
          include: {
            driver: true,
          },
        },
        trips: {
          where: {
            status: { notIn: ["completed", "cancelled"] },
          },
          select: {
            id: true,
            status: true,
          },
        },
        maintenanceRecords: {
          orderBy: { occurredAt: "desc" },
          take: 1,
          select: {
            occurredAt: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return { vehicles: vehicles.map(serializeVehicleDetail) };
  });

  app.post("/admin/vehicles", async (request) => {
    const user = getCurrentUser(request);
    requireRole(user, "accountant");
    const body = z
      .object({
        plateNumber: z.string().min(1),
        vehicleType: z.string().optional(),
        brandModel: z.string().optional(),
        loadCapacityTons: z.string().optional(),
        registeredAt: z.string().optional(),
        insuranceExpiresAt: z.string().optional(),
        inspectionExpiresAt: z.string().optional(),
        maintenanceDueAt: z.string().optional(),
        imageUrl: z.string().optional(),
        note: z.string().optional(),
        teamId: z.string().optional(),
      })
      .parse(request.body);
    const teamId = requiredTeamId(user, body.teamId);

    const vehicle = await prisma.vehicle.create({
      data: {
        teamId,
        plateNumber: body.plateNumber,
        vehicleType: body.vehicleType || null,
        brandModel: body.brandModel || null,
        loadCapacityTons: body.loadCapacityTons || null,
        registeredAt: body.registeredAt ? new Date(body.registeredAt) : null,
        insuranceExpiresAt: body.insuranceExpiresAt ? new Date(body.insuranceExpiresAt) : null,
        inspectionExpiresAt: body.inspectionExpiresAt ? new Date(body.inspectionExpiresAt) : null,
        maintenanceDueAt: body.maintenanceDueAt ? new Date(body.maintenanceDueAt) : null,
        imageUrl: body.imageUrl || null,
        note: body.note || null,
        status: "available",
      },
    });

    return { vehicle };
  });

  app.get("/admin/vehicles/:vehicleId", async (request, reply) => {
    const user = getCurrentUser(request);
    requireRole(user, "accountant");
    const { vehicleId } = z.object({ vehicleId: z.string() }).parse(request.params);

    const teamId = scopedTeamId(user);
    const vehicle = await prisma.vehicle.findFirst({
      where: { id: vehicleId, ...(teamId ? { teamId } : {}) },
      include: {
        driverBindings: {
          include: {
            driver: true,
          },
        },
        trips: {
          where: {
            status: { notIn: ["completed", "cancelled"] },
          },
          select: {
            id: true,
            status: true,
          },
        },
        maintenanceRecords: {
          orderBy: { occurredAt: "desc" },
          take: 1,
          select: {
            occurredAt: true,
          },
        },
      },
    });
    if (!vehicle) {
      return reply.code(404).send({ message: "车辆不存在或已被删除" });
    }

    return { vehicle: serializeVehicleDetail(vehicle) };
  });

  app.post("/admin/vehicles/:vehicleId", async (request, reply) => {
    const user = getCurrentUser(request);
    requireRole(user, "accountant");
    const { vehicleId } = z.object({ vehicleId: z.string() }).parse(request.params);
    const body = z
      .object({
        plateNumber: z.string().min(1),
        vehicleType: z.string().optional(),
        brandModel: z.string().optional(),
        loadCapacityTons: z.string().optional(),
        registeredAt: z.string().optional(),
        insuranceExpiresAt: z.string().optional(),
        inspectionExpiresAt: z.string().optional(),
        maintenanceDueAt: z.string().optional(),
        imageUrl: z.string().optional(),
        note: z.string().optional(),
        status: z.enum(["available", "maintenance", "disabled"]),
      })
      .parse(request.body);

    const teamId = scopedTeamId(user);
    const existingVehicle = await prisma.vehicle.findFirst({
      where: { id: vehicleId, ...(teamId ? { teamId } : {}) },
    });
    if (!existingVehicle) {
      return reply.code(404).send({ message: "车辆不存在或已被删除" });
    }

    const vehicle = await prisma.vehicle.update({
      where: { id: vehicleId },
      data: {
        plateNumber: body.plateNumber,
        vehicleType: body.vehicleType || null,
        brandModel: body.brandModel || null,
        loadCapacityTons: body.loadCapacityTons || null,
        registeredAt: body.registeredAt ? new Date(body.registeredAt) : null,
        insuranceExpiresAt: body.insuranceExpiresAt ? new Date(body.insuranceExpiresAt) : null,
        inspectionExpiresAt: body.inspectionExpiresAt ? new Date(body.inspectionExpiresAt) : null,
        maintenanceDueAt: body.maintenanceDueAt ? new Date(body.maintenanceDueAt) : null,
        imageUrl: body.imageUrl || null,
        note: body.note || null,
        status: body.status,
      },
      include: {
        driverBindings: {
          include: {
            driver: true,
          },
        },
        trips: {
          where: {
            status: { notIn: ["completed", "cancelled"] },
          },
          select: {
            id: true,
            status: true,
          },
        },
        maintenanceRecords: {
          orderBy: { occurredAt: "desc" },
          take: 1,
          select: {
            occurredAt: true,
          },
        },
      },
    });

    return { vehicle: serializeVehicleDetail(vehicle) };
  });

  app.post("/admin/vehicles/:vehicleId/drivers", async (request, reply) => {
    const user = getCurrentUser(request);
    requireRole(user, "accountant");
    const { vehicleId } = z.object({ vehicleId: z.string() }).parse(request.params);
    const { driverId } = z.object({ driverId: z.string().min(1) }).parse(request.body);

    const teamId = scopedTeamId(user);
    const vehicle = await prisma.vehicle.findFirst({
      where: { id: vehicleId, status: "available", ...(teamId ? { teamId } : {}) },
    });
    if (!vehicle) {
      return reply.code(400).send({ message: "车辆不可用，不能绑定司机" });
    }

    const driver = await prisma.user.findFirst({
      where: { id: driverId, role: "driver", status: "active", teamId: vehicle.teamId },
    });
    if (!driver) {
      return reply.code(400).send({ message: "司机不可用，不能绑定车辆" });
    }

    const existing = await prisma.driverVehicleBinding.findFirst({
      where: { vehicleId, driverId, teamId: vehicle.teamId },
    });
    if (existing) {
      return { binding: existing };
    }

    const binding = await prisma.driverVehicleBinding.create({
      data: { teamId: vehicle.teamId, vehicleId, driverId },
    });
    return { binding };
  });

  app.post("/admin/vehicles/:vehicleId/drivers/:driverId/unbind", async (request) => {
    const user = getCurrentUser(request);
    requireRole(user, "accountant");
    const { vehicleId, driverId } = z
      .object({ vehicleId: z.string(), driverId: z.string() })
      .parse(request.params);

    const teamId = scopedTeamId(user);
    const result = await prisma.driverVehicleBinding.deleteMany({
      where: { vehicleId, driverId, ...(teamId ? { teamId } : {}) },
    });

    return { removed: result.count };
  });

  app.get("/admin/vehicle-maintenance", async (request) => {
    const user = getCurrentUser(request);
    requireRole(user, "accountant");
    const query = z
      .object({
        vehicleId: z.string().optional(),
        from: z.string().optional(),
        to: z.string().optional(),
        q: z.string().optional(),
        page: z.coerce.number().int().positive().optional(),
        pageSize: z.coerce.number().int().positive().max(100).optional(),
      })
      .parse(request.query);
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const occurredAt: { gte?: Date; lte?: Date } = {};
    if (query.from) occurredAt.gte = new Date(`${query.from}T00:00:00.000Z`);
    if (query.to) occurredAt.lte = new Date(`${query.to}T23:59:59.999Z`);
    const where: {
      teamId?: string;
      vehicleId?: string;
      occurredAt?: { gte?: Date; lte?: Date };
      OR?: Array<
        | { component: { contains: string } }
        | { note: { contains: string } }
        | { voucherStorageKey: { contains: string } }
        | { vehicle: { plateNumber: { contains: string } } }
      >;
    } = {};
    const teamId = scopedTeamId(user);
    if (teamId) where.teamId = teamId;
    if (query.vehicleId) where.vehicleId = query.vehicleId;
    if (Object.keys(occurredAt).length > 0) where.occurredAt = occurredAt;
    if (query.q?.trim()) {
      const keyword = query.q.trim();
      where.OR = [
        { component: { contains: keyword } },
        { note: { contains: keyword } },
        { voucherStorageKey: { contains: keyword } },
        { vehicle: { plateNumber: { contains: keyword } } },
      ];
    }

    const [records, total] = await Promise.all([
      prisma.vehicleMaintenance.findMany({
        where,
        include: {
          vehicle: true,
          creator: true,
        },
        orderBy: { occurredAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.vehicleMaintenance.count({ where }),
    ]);

    return {
      records: (records as VehicleMaintenanceRecord[]).map(serializeVehicleMaintenance),
      page,
      pageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
    };
  });

  app.get("/admin/vehicle-maintenance/:recordId", async (request, reply) => {
    const user = getCurrentUser(request);
    requireRole(user, "accountant");
    const { recordId } = z.object({ recordId: z.string() }).parse(request.params);
    const teamId = scopedTeamId(user);
    const record = await prisma.vehicleMaintenance.findFirst({
      where: { id: recordId, ...(teamId ? { teamId } : {}) },
      include: {
        vehicle: true,
        creator: true,
      },
    });

    if (!record) {
      return reply.code(404).send({ message: "维修记录不存在或已被删除" });
    }

    return { record: serializeVehicleMaintenance(record as VehicleMaintenanceRecord) };
  });

  app.post("/admin/vehicle-maintenance", async (request, reply) => {
    const user = getCurrentUser(request);
    requireRole(user, "accountant");
    const body = z
      .object({
        vehicleId: z.string().min(1),
        component: z.string().min(1),
        amount: z.string().regex(/^\d+(\.\d{1,2})?$/),
        occurredAt: z.string().min(1),
        voucherStorageKey: z.string().optional(),
        note: z.string().optional(),
      })
      .parse(request.body);
    const teamId = scopedTeamId(user);
    const vehicle = await prisma.vehicle.findFirst({
      where: { id: body.vehicleId, ...(teamId ? { teamId } : {}) },
    });
    if (!vehicle) {
      return reply.code(404).send({ message: "车辆不存在或已被删除" });
    }

    const record = await prisma.vehicleMaintenance.create({
      data: {
        teamId: vehicle.teamId,
        vehicleId: body.vehicleId,
        component: body.component,
        amount: body.amount,
        occurredAt: new Date(body.occurredAt),
        voucherStorageKey: body.voucherStorageKey || null,
        note: body.note || null,
        createdBy: user.id,
      },
      include: {
        vehicle: true,
        creator: true,
      },
    });

    return { record: serializeVehicleMaintenance(record as VehicleMaintenanceRecord) };
  });

  app.post("/admin/vehicle-maintenance/:recordId", async (request, reply) => {
    const user = getCurrentUser(request);
    requireRole(user, "accountant");
    const { recordId } = z.object({ recordId: z.string() }).parse(request.params);
    const body = z
      .object({
        vehicleId: z.string().min(1),
        component: z.string().min(1),
        amount: z.string().regex(/^\d+(\.\d{1,2})?$/),
        occurredAt: z.string().min(1),
        voucherStorageKey: z.string().optional(),
        note: z.string().optional(),
      })
      .parse(request.body);

    const teamId = scopedTeamId(user);
    const existing = await prisma.vehicleMaintenance.findFirst({
      where: { id: recordId, ...(teamId ? { teamId } : {}) },
      include: { vehicle: true, creator: true },
    });
    if (!existing) {
      return reply.code(404).send({ message: "维修记录不存在或已被删除" });
    }

    const vehicle = await prisma.vehicle.findFirst({
      where: { id: body.vehicleId, ...(teamId ? { teamId } : {}) },
    });
    if (!vehicle) {
      return reply.code(404).send({ message: "车辆不存在或已被删除" });
    }

    const record = await prisma.vehicleMaintenance.update({
      where: { id: recordId },
      data: {
        teamId: vehicle.teamId,
        vehicleId: body.vehicleId,
        component: body.component,
        amount: body.amount,
        occurredAt: new Date(body.occurredAt),
        voucherStorageKey: body.voucherStorageKey || null,
        note: body.note || null,
      },
      include: {
        vehicle: true,
        creator: true,
      },
    });

    return { record: serializeVehicleMaintenance(record as VehicleMaintenanceRecord) };
  });

  app.delete("/admin/vehicle-maintenance/:recordId", async (request, reply) => {
    const user = getCurrentUser(request);
    requireRole(user, "accountant");
    const { recordId } = z.object({ recordId: z.string() }).parse(request.params);
    const teamId = scopedTeamId(user);
    const record = await prisma.vehicleMaintenance.findFirst({
      where: { id: recordId, ...(teamId ? { teamId } : {}) },
      include: { vehicle: true, creator: true },
    });
    if (!record) {
      return reply.code(404).send({ message: "维修记录不存在或已被删除" });
    }

    await prisma.vehicleMaintenance.delete({ where: { id: recordId } });

    return { deleted: true, record: serializeVehicleMaintenance(record as VehicleMaintenanceRecord) };
  });

  app.get("/admin/drivers", async (request) => {
    const user = getCurrentUser(request);
    requireRole(user, "accountant");
    const query = z
      .object({
        status: z.string().optional(),
        q: z.string().optional(),
      })
      .parse(request.query);
    const where: {
      teamId?: string;
      role: "driver";
      status?: string;
      OR?: Array<Record<string, unknown>>;
    } = { role: "driver" };
    const teamId = scopedTeamId(user);
    if (teamId) where.teamId = teamId;
    if (query.status && ["active", "disabled"].includes(query.status)) {
      where.status = query.status;
    }
    const search = query.q?.trim();
    if (search) {
      where.OR = [{ name: { contains: search } }, { phone: { contains: search } }];
    }
    return {
      drivers: (await prisma.user.findMany({
        where,
        include: {
          driverBindings: {
            include: {
              vehicle: true,
            },
          },
        },
        orderBy: { createdAt: "desc" },
      })).map(serializeDriverDetail),
    };
  });

  app.post("/admin/drivers", async (request, reply) => {
    const user = getCurrentUser(request);
    requireRole(user, "accountant");
    const body = z
      .object({
        name: z.string().min(1),
        phone: z.string().min(6),
        initialPassword: z.string().min(6),
        teamId: z.string().optional(),
      })
      .parse(request.body);
    const teamId = requiredTeamId(user, body.teamId);
    const existingPhone = await prisma.user.findFirst({ where: { phone: body.phone } });
    if (existingPhone) {
      return reply.code(409).send({ message: "该手机号已存在，请换一个手机号" });
    }

    const driver = await prisma.user.create({
      data: {
        teamId,
        name: body.name,
        phone: body.phone,
        passwordHash: hashPassword(body.initialPassword),
        role: "driver",
        status: "active",
        isFirstLogin: true,
      },
    });

    return { driver };
  });

  app.get("/admin/drivers/:driverId", async (request, reply) => {
    const user = getCurrentUser(request);
    requireRole(user, "accountant");
    const { driverId } = z.object({ driverId: z.string() }).parse(request.params);

    const teamId = scopedTeamId(user);
    const driver = await prisma.user.findFirst({
      where: { id: driverId, role: "driver", ...(teamId ? { teamId } : {}) },
      include: {
        driverBindings: {
          include: {
            vehicle: true,
          },
        },
      },
    });
    if (!driver || driver.role !== "driver") {
      return reply.code(404).send({ message: "司机不存在或已被删除" });
    }

    return { driver: serializeDriverDetail(driver) };
  });

  app.get("/admin/drivers/:driverId/documents", async (request, reply) => {
    const user = getCurrentUser(request);
    requireRole(user, "accountant");
    const { driverId } = z.object({ driverId: z.string() }).parse(request.params);
    const teamId = scopedTeamId(user);
    const driver = await prisma.user.findFirst({
      where: { id: driverId, role: "driver", ...(teamId ? { teamId } : {}) },
    });
    if (!driver) {
      return reply.code(404).send({ message: "司机不存在或已被删除" });
    }

    return { documents: await listDriverDocuments(prisma, driverId) };
  });

  app.post("/admin/drivers/:driverId/documents/:type", async (request, reply) => {
    const user = getCurrentUser(request);
    requireRole(user, "accountant");
    const { driverId, type } = z.object({ driverId: z.string(), type: z.string() }).parse(request.params);
    const preset = driverDocumentTypes.find((item) => item.type === type);
    if (!preset) {
      return reply.code(404).send({ message: "证件类型不存在" });
    }
    const body = z
      .object({
        status: z.string().refine((value) => driverDocumentStatuses.has(value)),
        expiresAt: z.string().optional(),
        storageKey: z.string().optional(),
        note: z.string().optional(),
      })
      .parse(request.body);

    const teamId = scopedTeamId(user);
    const driver = await prisma.user.findFirst({
      where: { id: driverId, role: "driver", ...(teamId ? { teamId } : {}) },
    });
    if (!driver) {
      return reply.code(404).send({ message: "司机不存在或已被删除" });
    }

    const document = await prisma.driverDocument.upsert({
      where: { driverId_type: { driverId, type } },
      create: {
        driverId,
        type,
        name: preset.name,
        status: body.status,
        storageKey: body.storageKey || null,
        expiresAt: body.expiresAt ? new Date(`${body.expiresAt}T00:00:00.000Z`) : null,
        note: body.note || null,
        reviewedAt: ["approved", "rejected"].includes(body.status) ? new Date() : null,
      },
      update: {
        name: preset.name,
        status: body.status,
        ...(body.storageKey !== undefined ? { storageKey: body.storageKey || null } : {}),
        expiresAt: body.expiresAt ? new Date(`${body.expiresAt}T00:00:00.000Z`) : null,
        note: body.note || null,
        reviewedAt: ["approved", "rejected"].includes(body.status) ? new Date() : null,
      },
    });

    return { document: serializeDriverDocument(document as DriverDocumentRecord) };
  });

  app.post("/admin/drivers/:driverId", async (request, reply) => {
    const user = getCurrentUser(request);
    requireRole(user, "accountant");
    const { driverId } = z.object({ driverId: z.string() }).parse(request.params);
    const body = z
      .object({
        name: z.string().min(1),
        phone: z.string().min(6),
        status: z.enum(["active", "disabled"]),
      })
      .parse(request.body);

    const teamId = scopedTeamId(user);
    const existing = await prisma.user.findFirst({ where: { id: driverId, ...(teamId ? { teamId } : {}) } });
    if (!existing || existing.role !== "driver") {
      return reply.code(404).send({ message: "司机不存在或已被删除" });
    }
    const existingPhone = await prisma.user.findFirst({ where: { phone: body.phone } });
    if (existingPhone && existingPhone.id !== driverId) {
      return reply.code(409).send({ message: "该手机号已存在，请换一个手机号" });
    }

    const driver = await prisma.user.update({
      where: { id: driverId },
      data: {
        name: body.name,
        phone: body.phone,
        status: body.status,
      },
      include: {
        driverBindings: {
          include: {
            vehicle: true,
          },
        },
      },
    });

    return { driver: serializeDriverDetail(driver) };
  });

  app.post("/admin/drivers/:driverId/password", async (request, reply) => {
    const user = getCurrentUser(request);
    requireRole(user, "accountant");
    const { driverId } = z.object({ driverId: z.string() }).parse(request.params);
    const body = z
      .object({
        password: z.string().min(6),
      })
      .parse(request.body);

    const teamId = scopedTeamId(user);
    const existing = await prisma.user.findFirst({ where: { id: driverId, ...(teamId ? { teamId } : {}) } });
    if (!existing || existing.role !== "driver") {
      return reply.code(404).send({ message: "司机不存在或已被删除" });
    }

    const driver = await prisma.user.update({
      where: { id: driverId },
      data: {
        passwordHash: hashPassword(body.password),
        isFirstLogin: true,
      },
      include: {
        driverBindings: {
          include: {
            vehicle: true,
          },
        },
      },
    });

    return { driver: serializeDriverDetail(driver) };
  });

  app.post("/admin/drivers/:driverId/vehicles", async (request, reply) => {
    const user = getCurrentUser(request);
    requireRole(user, "accountant");
    const { driverId } = z.object({ driverId: z.string() }).parse(request.params);
    const { vehicleId } = z.object({ vehicleId: z.string().min(1) }).parse(request.body);

    const teamId = scopedTeamId(user);
    const driver = await prisma.user.findFirst({
      where: { id: driverId, role: "driver", status: "active", ...(teamId ? { teamId } : {}) },
    });
    if (!driver) {
      return reply.code(400).send({ message: "司机不可用，不能绑定车辆" });
    }

    if (!driver.teamId) {
      return reply.code(400).send({ message: "司机未归属团队，不能绑定车辆" });
    }
    const driverTeamId = driver.teamId;

    const vehicle = await prisma.vehicle.findFirst({
      where: { id: vehicleId, status: "available", teamId: driverTeamId },
    });
    if (!vehicle) {
      return reply.code(400).send({ message: "车辆不可用，不能绑定司机" });
    }

    const existing = await prisma.driverVehicleBinding.findFirst({
      where: { vehicleId, driverId, teamId: driverTeamId },
    });
    if (existing) {
      return { binding: existing };
    }

    const binding = await prisma.driverVehicleBinding.create({
      data: { teamId: driverTeamId, vehicleId, driverId },
    });
    return { binding };
  });

  app.post("/admin/drivers/:driverId/vehicles/:vehicleId/unbind", async (request) => {
    const user = getCurrentUser(request);
    requireRole(user, "accountant");
    const { driverId, vehicleId } = z
      .object({ driverId: z.string(), vehicleId: z.string() })
      .parse(request.params);

    const teamId = scopedTeamId(user);
    const result = await prisma.driverVehicleBinding.deleteMany({
      where: { vehicleId, driverId, ...(teamId ? { teamId } : {}) },
    });

    return { removed: result.count };
  });

  app.get("/admin/expense-types", async (request) => {
    const user = getCurrentUser(request);
    requireRole(user, "accountant");
    const query = z
      .object({
        receiptRule: z.string().optional(),
        q: z.string().optional(),
      })
      .parse(request.query);
    const where: {
      teamId?: string;
      requiresReceipt?: boolean;
      name?: { contains: string };
    } = {};
    const teamId = scopedTeamId(user);
    if (teamId) where.teamId = teamId;
    if (query.receiptRule === "required") {
      where.requiresReceipt = true;
    }
    if (query.receiptRule === "optional") {
      where.requiresReceipt = false;
    }
    const search = query.q?.trim();
    if (search) {
      where.name = { contains: search };
    }
    return {
      expenseTypes: await prisma.expenseType.findMany({ where, orderBy: { sortOrder: "asc" } }),
    };
  });

  app.post("/admin/expense-types", async (request) => {
    const user = getCurrentUser(request);
    requireRole(user, "accountant");
    const body = z
      .object({
        name: z.string().min(1),
        requiresReceipt: z.boolean().default(false),
        sortOrder: z.number().int().min(0).default(0),
        teamId: z.string().optional(),
      })
      .parse(request.body);
    const teamId = requiredTeamId(user, body.teamId);

    const expenseType = await prisma.expenseType.create({
      data: {
        teamId,
        name: body.name,
        requiresReceipt: body.requiresReceipt,
        sortOrder: body.sortOrder,
        enabled: true,
      },
    });

    return { expenseType };
  });

  app.get("/admin/expense-types/:expenseTypeId", async (request, reply) => {
    const user = getCurrentUser(request);
    requireRole(user, "accountant");
    const { expenseTypeId } = z.object({ expenseTypeId: z.string() }).parse(request.params);

    const teamId = scopedTeamId(user);
    const expenseType = await prisma.expenseType.findFirst({
      where: { id: expenseTypeId, ...(teamId ? { teamId } : {}) },
    });
    if (!expenseType) {
      return reply.code(404).send({ message: "费用类型不存在或已被删除" });
    }

    return { expenseType };
  });

  app.post("/admin/expense-types/:expenseTypeId", async (request, reply) => {
    const user = getCurrentUser(request);
    requireRole(user, "accountant");
    const { expenseTypeId } = z.object({ expenseTypeId: z.string() }).parse(request.params);
    const body = z
      .object({
        name: z.string().min(1),
        requiresReceipt: z.boolean(),
        sortOrder: z.number().int().min(0),
        enabled: z.boolean(),
      })
      .parse(request.body);

    const teamId = scopedTeamId(user);
    const existing = await prisma.expenseType.findFirst({
      where: { id: expenseTypeId, ...(teamId ? { teamId } : {}) },
    });
    if (!existing) {
      return reply.code(404).send({ message: "费用类型不存在或已被删除" });
    }

    const expenseType = await prisma.expenseType.update({
      where: { id: expenseTypeId },
      data: {
        name: body.name,
        requiresReceipt: body.requiresReceipt,
        sortOrder: body.sortOrder,
        enabled: body.enabled,
      },
    });

    return { expenseType };
  });

  app.get("/admin/reports/profit", async (request) => {
    const user = getCurrentUser(request);
    requireRole(user, "accountant");
    const query = z
      .object({
        from: z.string().optional(),
        to: z.string().optional(),
        period: z.enum(["week", "month", "year"]).optional(),
      })
      .parse(request.query);
    const period = query.period ?? "month";

    const settledAt: { gte?: Date; lte?: Date } = {};
    if (query.from) {
      settledAt.gte = localDateBoundary(query.from, "start");
    }
    if (query.to) {
      settledAt.lte = localDateBoundary(query.to, "end");
    }
    const maintenanceOccurredAt = { ...settledAt };
    const teamId = scopedTeamId(user);

    const settlements = (await prisma.settlementSnapshot.findMany({
      ...((Object.keys(settledAt).length > 0 || teamId)
        ? { where: { ...(Object.keys(settledAt).length > 0 ? { settledAt } : {}), ...(teamId ? { trip: { teamId } } : {}) } }
        : {}),
      include: {
        trip: {
          include: {
            vehicle: true,
            driver: true,
            expenses: true,
          },
        },
      },
    })) as ReportSettlement[];
    const maintenanceRecords = (await prisma.vehicleMaintenance.findMany({
      ...((Object.keys(maintenanceOccurredAt).length > 0 || teamId)
        ? { where: { ...(Object.keys(maintenanceOccurredAt).length > 0 ? { occurredAt: maintenanceOccurredAt } : {}), ...(teamId ? { teamId } : {}) } }
        : {}),
      include: {
        vehicle: true,
      },
    })) as ReportMaintenance[];

    const byVehicle = new Map<string, ReturnType<typeof createReportGroup>>();
    const byDriver = new Map<string, ReturnType<typeof createReportGroup>>();
    const byExpenseType = new Map<string, { id: string; label: string; total: number }>();
    const byPeriod = new Map<
      string,
      {
        period: string;
        tripCount: number;
        actualFreightTotal: number;
        tripExpenseTotal: number;
        maintenanceExpenseTotal: number;
        totalExpense: number;
        profitTotal: number;
      }
    >();

    function getPeriodGroup(date: Date) {
      const key = periodKey(date, period);
      const group =
        byPeriod.get(key) ?? {
          period: key,
          tripCount: 0,
          actualFreightTotal: 0,
          tripExpenseTotal: 0,
          maintenanceExpenseTotal: 0,
          totalExpense: 0,
          profitTotal: 0,
        };
      byPeriod.set(key, group);
      return group;
    }

    for (const settlement of settlements) {
      const actualFreight = Number(settlement.actualFreight);
      const expenseTotal = Number(settlement.expenseTotal);
      const profit = Number(settlement.profit);
      const settledAtDate = settlement.settledAt;

      const vehicle = settlement.trip.vehicle;
      const vehicleGroup =
        byVehicle.get(vehicle.id) ?? createReportGroup(vehicle.id, vehicle.plateNumber);
      vehicleGroup.tripCount += 1;
      vehicleGroup.actualFreightTotal += actualFreight;
      vehicleGroup.expenseTotal += expenseTotal;
      vehicleGroup.profitTotal += profit;
      byVehicle.set(vehicle.id, vehicleGroup);

      const periodGroup = getPeriodGroup(settledAtDate);
      periodGroup.tripCount += 1;
      periodGroup.actualFreightTotal += actualFreight;
      periodGroup.tripExpenseTotal += expenseTotal;
      periodGroup.totalExpense += expenseTotal;
      periodGroup.profitTotal += profit;

      const driver = settlement.trip.driver;
      const driverGroup = byDriver.get(driver.id) ?? createReportGroup(driver.id, driver.name);
      driverGroup.tripCount += 1;
      driverGroup.actualFreightTotal += actualFreight;
      driverGroup.expenseTotal += expenseTotal;
      driverGroup.profitTotal += profit;
      byDriver.set(driver.id, driverGroup);

      for (const expense of settlement.trip.expenses) {
        const expenseGroup = byExpenseType.get(expense.expenseTypeId) ?? {
          id: expense.expenseTypeId,
          label: expense.expenseTypeNameSnapshot,
          total: 0,
        };
        expenseGroup.total += Number(expense.amount);
        byExpenseType.set(expense.expenseTypeId, expenseGroup);
      }
    }

    for (const maintenance of maintenanceRecords) {
      const amount = Number(maintenance.amount);
      const vehicleGroup =
        byVehicle.get(maintenance.vehicle.id) ??
        createReportGroup(maintenance.vehicle.id, maintenance.vehicle.plateNumber);
      vehicleGroup.expenseTotal += amount;
      vehicleGroup.profitTotal -= amount;
      byVehicle.set(maintenance.vehicle.id, vehicleGroup);

      const expenseGroup = byExpenseType.get("vehicle-maintenance") ?? {
        id: "vehicle-maintenance",
        label: "车辆维修",
        total: 0,
      };
      expenseGroup.total += amount;
      byExpenseType.set("vehicle-maintenance", expenseGroup);

      const periodGroup = getPeriodGroup(maintenance.occurredAt);
      periodGroup.maintenanceExpenseTotal += amount;
      periodGroup.totalExpense += amount;
      periodGroup.profitTotal -= amount;
    }

    const tripExpenseTotal = settlements.reduce(
      (total: number, item: SettlementAmount) => total + Number(item.expenseTotal),
      0,
    );
    const maintenanceExpenseTotal = maintenanceRecords.reduce(
      (total, item) => total + Number(item.amount),
      0,
    );
    const totalExpense = tripExpenseTotal + maintenanceExpenseTotal;
    const actualFreightTotal = settlements.reduce(
      (total: number, item: SettlementAmount) => total + Number(item.actualFreight),
      0,
    );

    return {
      summary: {
        tripCount: settlements.length,
        actualFreightTotal: actualFreightTotal.toFixed(2),
        tripExpenseTotal: tripExpenseTotal.toFixed(2),
        maintenanceExpenseTotal: maintenanceExpenseTotal.toFixed(2),
        expenseTotal: totalExpense.toFixed(2),
        profitTotal: (actualFreightTotal - totalExpense).toFixed(2),
      },
      byVehicle: sortByProfitDesc([...byVehicle.values()]).map(serializeReportGroup),
      byDriver: sortByProfitDesc([...byDriver.values()]).map(serializeReportGroup),
      byPeriod: [...byPeriod.values()]
        .sort((left, right) => left.period.localeCompare(right.period))
        .map((item) => ({
          ...item,
          actualFreightTotal: item.actualFreightTotal.toFixed(2),
          tripExpenseTotal: item.tripExpenseTotal.toFixed(2),
          maintenanceExpenseTotal: item.maintenanceExpenseTotal.toFixed(2),
          totalExpense: item.totalExpense.toFixed(2),
          profitTotal: item.profitTotal.toFixed(2),
        })),
      byExpenseType: [...byExpenseType.values()]
        .sort((left, right) => right.total - left.total)
        .map((item) => ({
          ...item,
          total: item.total.toFixed(2),
        })),
    };
  });

  return app;
}
