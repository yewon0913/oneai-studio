import { eq, desc, and, like, sql, isNull } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import {
  InsertUser, users,
  clients, InsertClient, Client,
  clientPhotos, InsertClientPhoto,
  projects, InsertProject,
  promptLibrary, InsertPromptLibraryItem,
  generations, InsertGeneration,
  batchJobs, InsertBatchJob,
  batchJobItems, InsertBatchJobItem,
  deliveryPackages, InsertDeliveryPackage,
  videoConversions, InsertVideoConversion,
  photoRestorations, InsertPhotoRestoration,
  notifications, InsertNotification,
} from "../drizzle/schema";
import { ENV } from './_core/env';

let _db: ReturnType<typeof drizzle> | null = null;

export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

// ─── Users ───
export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) throw new Error("User openId is required for upsert");
  const db = await getDb();
  if (!db) { console.warn("[Database] Cannot upsert user: database not available"); return; }
  try {
    const values: InsertUser = { openId: user.openId };
    const updateSet: Record<string, unknown> = {};
    const textFields = ["name", "email", "loginMethod"] as const;
    type TextField = (typeof textFields)[number];
    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };
    textFields.forEach(assignNullable);
    if (user.lastSignedIn !== undefined) { values.lastSignedIn = user.lastSignedIn; updateSet.lastSignedIn = user.lastSignedIn; }
    if (user.role !== undefined) { values.role = user.role; updateSet.role = user.role; }
    else if (user.openId === ENV.ownerOpenId) { values.role = 'admin'; updateSet.role = 'admin'; }
    if (!values.lastSignedIn) values.lastSignedIn = new Date();
    if (Object.keys(updateSet).length === 0) updateSet.lastSignedIn = new Date();
    await db.insert(users).values(values).onDuplicateKeyUpdate({ set: updateSet });
  } catch (error) { console.error("[Database] Failed to upsert user:", error); throw error; }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

// ─── Clients ───
export async function createClient(data: InsertClient) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const result = await db.insert(clients).values(data);
  return { id: result[0].insertId };
}

export async function getClientsByUser(userId: number, search?: string) {
  const db = await getDb();
  if (!db) return [];
  const conditions = [eq(clients.userId, userId)];
  if (search) conditions.push(like(clients.name, `%${search}%`));
  return db.select().from(clients).where(and(...conditions)).orderBy(desc(clients.updatedAt));
}

export async function getClientById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(clients).where(eq(clients.id, id)).limit(1);
  return result[0];
}

export async function updateClient(id: number, data: Partial<InsertClient>) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.update(clients).set(data).where(eq(clients.id, id));
}

export async function deleteClient(id: number) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.delete(clients).where(eq(clients.id, id));
}

// ─── Client Photos ───
export async function createClientPhoto(data: InsertClientPhoto) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const result = await db.insert(clientPhotos).values(data);
  return { id: result[0].insertId };
}

export async function getClientPhotos(clientId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(clientPhotos).where(eq(clientPhotos.clientId, clientId)).orderBy(desc(clientPhotos.createdAt));
}

export async function deleteClientPhoto(id: number) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.delete(clientPhotos).where(eq(clientPhotos.id, id));
}

// ─── Projects ───
export async function createProject(data: InsertProject) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const result = await db.insert(projects).values(data);
  return { id: result[0].insertId };
}

export async function getProjectsByUser(userId: number, clientId?: number) {
  const db = await getDb();
  if (!db) return [];
  const conditions = [eq(projects.userId, userId)];
  if (clientId) conditions.push(eq(projects.clientId, clientId));
  return db.select().from(projects).where(and(...conditions)).orderBy(desc(projects.updatedAt));
}

export async function getProjectById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(projects).where(eq(projects.id, id)).limit(1);
  return result[0];
}

export async function updateProject(id: number, data: Partial<InsertProject>) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.update(projects).set(data).where(eq(projects.id, id));
}

export async function deleteProject(id: number) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.delete(projects).where(eq(projects.id, id));
}

// ─── Prompt Library ───
export async function createPrompt(data: InsertPromptLibraryItem) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const result = await db.insert(promptLibrary).values(data);
  return { id: result[0].insertId };
}

export async function getPrompts(userId: number, category?: string) {
  const db = await getDb();
  if (!db) return [];
  const conditions = [eq(promptLibrary.userId, userId)];
  if (category) conditions.push(eq(promptLibrary.category, category as any));
  return db.select().from(promptLibrary).where(and(...conditions)).orderBy(desc(promptLibrary.usageCount));
}

export async function getDefaultPrompts() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(promptLibrary).where(eq(promptLibrary.isDefault, true)).orderBy(desc(promptLibrary.usageCount));
}

export async function updatePrompt(id: number, data: Partial<InsertPromptLibraryItem>) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.update(promptLibrary).set(data).where(eq(promptLibrary.id, id));
}

export async function incrementPromptUsage(id: number) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.update(promptLibrary).set({ usageCount: sql`${promptLibrary.usageCount} + 1` }).where(eq(promptLibrary.id, id));
}

export async function deletePrompt(id: number) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.delete(promptLibrary).where(eq(promptLibrary.id, id));
}

// ─── Generations ───
export async function createGeneration(data: InsertGeneration) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const result = await db.insert(generations).values(data);
  return { id: result[0].insertId };
}

export async function getGenerationsByProject(projectId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(generations).where(eq(generations.projectId, projectId)).orderBy(desc(generations.createdAt));
}

export async function getGenerationById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(generations).where(eq(generations.id, id)).limit(1);
  return result[0];
}

export async function updateGeneration(id: number, data: Partial<InsertGeneration>) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.update(generations).set(data).where(eq(generations.id, id));
}

export async function deleteGeneration(id: number) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.delete(generations).where(eq(generations.id, id));
}

// ─── Batch Jobs ───
export async function createBatchJob(data: InsertBatchJob) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const result = await db.insert(batchJobs).values(data);
  return { id: result[0].insertId };
}

export async function getBatchJobs(userId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(batchJobs).where(eq(batchJobs.userId, userId)).orderBy(desc(batchJobs.createdAt));
}

export async function getBatchJobById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(batchJobs).where(eq(batchJobs.id, id)).limit(1);
  return result[0];
}

export async function updateBatchJob(id: number, data: Partial<InsertBatchJob>) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.update(batchJobs).set(data).where(eq(batchJobs.id, id));
}

export async function createBatchJobItem(data: InsertBatchJobItem) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const result = await db.insert(batchJobItems).values(data);
  return { id: result[0].insertId };
}

export async function getBatchJobItems(batchJobId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(batchJobItems).where(eq(batchJobItems.batchJobId, batchJobId));
}

export async function updateBatchJobItem(id: number, data: Partial<InsertBatchJobItem>) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.update(batchJobItems).set(data).where(eq(batchJobItems.id, id));
}

// ─── Delivery Packages ───
export async function createDeliveryPackage(data: InsertDeliveryPackage) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const result = await db.insert(deliveryPackages).values(data);
  return { id: result[0].insertId };
}

export async function getDeliveryPackagesByProject(projectId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(deliveryPackages).where(eq(deliveryPackages.projectId, projectId));
}

export async function updateDeliveryPackage(id: number, data: Partial<InsertDeliveryPackage>) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.update(deliveryPackages).set(data).where(eq(deliveryPackages.id, id));
}

// ─── Video Conversions ───
export async function createVideoConversion(data: InsertVideoConversion) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const result = await db.insert(videoConversions).values(data);
  return { id: result[0].insertId };
}

export async function getVideoConversionsByProject(projectId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(videoConversions).where(eq(videoConversions.projectId, projectId));
}

export async function updateVideoConversion(id: number, data: Partial<InsertVideoConversion>) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.update(videoConversions).set(data).where(eq(videoConversions.id, id));
}

// ─── Photo Restorations ───
export async function createPhotoRestoration(data: InsertPhotoRestoration) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const result = await db.insert(photoRestorations).values(data);
  return { id: result[0].insertId };
}

export async function getPhotoRestorationsByClient(clientId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(photoRestorations).where(eq(photoRestorations.clientId, clientId));
}

export async function updatePhotoRestoration(id: number, data: Partial<InsertPhotoRestoration>) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.update(photoRestorations).set(data).where(eq(photoRestorations.id, id));
}

// ─── Notifications ───
export async function createNotification(data: InsertNotification) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const result = await db.insert(notifications).values(data);
  return { id: result[0].insertId };
}

export async function getNotifications(userId: number, unreadOnly?: boolean) {
  const db = await getDb();
  if (!db) return [];
  const conditions = [eq(notifications.userId, userId)];
  if (unreadOnly) conditions.push(eq(notifications.isRead, false));
  return db.select().from(notifications).where(and(...conditions)).orderBy(desc(notifications.createdAt)).limit(50);
}

export async function markNotificationRead(id: number) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.update(notifications).set({ isRead: true }).where(eq(notifications.id, id));
}

export async function markAllNotificationsRead(userId: number) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.update(notifications).set({ isRead: true }).where(eq(notifications.userId, userId));
}

// ─── Dashboard Stats ───
export async function getDashboardStats(userId: number) {
  const db = await getDb();
  if (!db) return { totalClients: 0, activeProjects: 0, completedProjects: 0, totalGenerations: 0, pendingBatches: 0 };

  const [clientCount] = await db.select({ count: sql<number>`count(*)` }).from(clients).where(eq(clients.userId, userId));
  const [activeProjectCount] = await db.select({ count: sql<number>`count(*)` }).from(projects).where(and(eq(projects.userId, userId), sql`${projects.status} NOT IN ('completed', 'delivered')`));
  const [completedProjectCount] = await db.select({ count: sql<number>`count(*)` }).from(projects).where(and(eq(projects.userId, userId), sql`${projects.status} IN ('completed', 'delivered')`));
  const [pendingBatchCount] = await db.select({ count: sql<number>`count(*)` }).from(batchJobs).where(and(eq(batchJobs.userId, userId), sql`${batchJobs.status} IN ('queued', 'processing')`));

  return {
    totalClients: clientCount?.count ?? 0,
    activeProjects: activeProjectCount?.count ?? 0,
    completedProjects: completedProjectCount?.count ?? 0,
    totalGenerations: 0,
    pendingBatches: pendingBatchCount?.count ?? 0,
  };
}
