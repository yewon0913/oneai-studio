import { int, mysqlEnum, mysqlTable, text, timestamp, varchar, json, boolean } from "drizzle-orm/mysql-core";

// ─── Users (Auth) ───
export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

// ─── Clients (고객 프로필) ───
export const clients = mysqlTable("clients", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(), // owner (admin)
  name: varchar("name", { length: 100 }).notNull(),
  phone: varchar("phone", { length: 30 }),
  email: varchar("email", { length: 320 }),
  consultationNotes: text("consultationNotes"),
  preferredConcept: varchar("preferredConcept", { length: 100 }),
  status: mysqlEnum("status", ["consulting", "in_progress", "completed", "delivered"]).default("consulting").notNull(),
  tags: json("tags").$type<string[]>(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Client = typeof clients.$inferSelect;
export type InsertClient = typeof clients.$inferInsert;

// ─── Client Photos (고객 원본 사진) ───
export const clientPhotos = mysqlTable("client_photos", {
  id: int("id").autoincrement().primaryKey(),
  clientId: int("clientId").notNull(),
  photoType: mysqlEnum("photoType", ["front", "side", "additional"]).notNull(),
  originalUrl: text("originalUrl").notNull(),
  fileKey: varchar("fileKey", { length: 512 }).notNull(),
  fileName: varchar("fileName", { length: 255 }),
  mimeType: varchar("mimeType", { length: 100 }),
  fileSize: int("fileSize"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type ClientPhoto = typeof clientPhotos.$inferSelect;
export type InsertClientPhoto = typeof clientPhotos.$inferInsert;

// ─── Projects (작업 프로젝트) ───
export const projects = mysqlTable("projects", {
  id: int("id").autoincrement().primaryKey(),
  clientId: int("clientId").notNull(),
  userId: int("userId").notNull(),
  title: varchar("title", { length: 255 }).notNull(),
  category: mysqlEnum("category", ["wedding", "restoration", "kids", "profile", "video", "custom"]).default("wedding").notNull(),
  concept: varchar("concept", { length: 255 }),
  status: mysqlEnum("status", ["draft", "generating", "review", "revision", "upscaling", "completed", "delivered"]).default("draft").notNull(),
  referenceImageUrl: text("referenceImageUrl"),
  referenceImageKey: varchar("referenceImageKey", { length: 512 }),
  pinterestUrl: text("pinterestUrl"),
  notes: text("notes"),
  priority: mysqlEnum("priority", ["low", "normal", "high", "urgent"]).default("normal").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Project = typeof projects.$inferSelect;
export type InsertProject = typeof projects.$inferInsert;

// ─── Prompt Library (프리미엄 프롬프트 라이브러리) ───
export const promptLibrary = mysqlTable("prompt_library", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  category: mysqlEnum("category", ["wedding", "restoration", "kids", "profile", "video", "custom"]).default("wedding").notNull(),
  subcategory: varchar("subcategory", { length: 100 }),
  title: varchar("title", { length: 255 }).notNull(),
  prompt: text("prompt").notNull(),
  negativePrompt: text("negativePrompt"),
  parameters: json("parameters").$type<Record<string, unknown>>(),
  thumbnailUrl: text("thumbnailUrl"),
  usageCount: int("usageCount").default(0).notNull(),
  rating: int("rating").default(0),
  isDefault: boolean("isDefault").default(false).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type PromptLibraryItem = typeof promptLibrary.$inferSelect;
export type InsertPromptLibraryItem = typeof promptLibrary.$inferInsert;

// ─── Generations (AI 생성 이력) ───
export const generations = mysqlTable("generations", {
  id: int("id").autoincrement().primaryKey(),
  projectId: int("projectId").notNull(),
  promptId: int("promptId"),
  promptText: text("promptText").notNull(),
  negativePrompt: text("negativePrompt"),
  parameters: json("parameters").$type<Record<string, unknown>>(),
  resultImageUrl: text("resultImageUrl"),
  resultImageKey: varchar("resultImageKey", { length: 512 }),
  status: mysqlEnum("status", ["pending", "generating", "completed", "failed", "reviewed", "approved", "rejected"]).default("pending").notNull(),
  qualityScore: int("qualityScore"),
  faceConsistencyScore: int("faceConsistencyScore"),
  reviewNotes: text("reviewNotes"),
  stage: mysqlEnum("stage", ["draft", "review", "upscaled", "final"]).default("draft").notNull(),
  upscaledImageUrl: text("upscaledImageUrl"),
  upscaledImageKey: varchar("upscaledImageKey", { length: 512 }),
  generationTimeMs: int("generationTimeMs"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Generation = typeof generations.$inferSelect;
export type InsertGeneration = typeof generations.$inferInsert;

// ─── Batch Jobs (배치 처리) ───
export const batchJobs = mysqlTable("batch_jobs", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  title: varchar("title", { length: 255 }).notNull(),
  status: mysqlEnum("status", ["queued", "processing", "completed", "failed", "cancelled"]).default("queued").notNull(),
  totalItems: int("totalItems").default(0).notNull(),
  completedItems: int("completedItems").default(0).notNull(),
  failedItems: int("failedItems").default(0).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type BatchJob = typeof batchJobs.$inferSelect;
export type InsertBatchJob = typeof batchJobs.$inferInsert;

// ─── Batch Job Items ───
export const batchJobItems = mysqlTable("batch_job_items", {
  id: int("id").autoincrement().primaryKey(),
  batchJobId: int("batchJobId").notNull(),
  projectId: int("projectId"),
  generationId: int("generationId"),
  status: mysqlEnum("status", ["queued", "processing", "completed", "failed"]).default("queued").notNull(),
  errorMessage: text("errorMessage"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type BatchJobItem = typeof batchJobItems.$inferSelect;
export type InsertBatchJobItem = typeof batchJobItems.$inferInsert;

// ─── Delivery Packages (고객 전달 패키지) ───
export const deliveryPackages = mysqlTable("delivery_packages", {
  id: int("id").autoincrement().primaryKey(),
  projectId: int("projectId").notNull(),
  clientId: int("clientId").notNull(),
  title: varchar("title", { length: 255 }).notNull(),
  description: text("description"),
  watermarkEnabled: boolean("watermarkEnabled").default(false).notNull(),
  galleryUrl: text("galleryUrl"),
  downloadLinks: json("downloadLinks").$type<Array<{ resolution: string; url: string; key: string }>>(),
  status: mysqlEnum("status", ["preparing", "ready", "sent", "viewed"]).default("preparing").notNull(),
  expiresAt: timestamp("expiresAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type DeliveryPackage = typeof deliveryPackages.$inferSelect;
export type InsertDeliveryPackage = typeof deliveryPackages.$inferInsert;

// ─── Video Conversions (영상 변환) ───
export const videoConversions = mysqlTable("video_conversions", {
  id: int("id").autoincrement().primaryKey(),
  generationId: int("generationId").notNull(),
  projectId: int("projectId").notNull(),
  sourceImageUrl: text("sourceImageUrl").notNull(),
  videoUrl: text("videoUrl"),
  videoKey: varchar("videoKey", { length: 512 }),
  duration: int("duration").default(5),
  status: mysqlEnum("status", ["queued", "processing", "completed", "failed"]).default("queued").notNull(),
  errorMessage: text("errorMessage"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type VideoConversion = typeof videoConversions.$inferSelect;
export type InsertVideoConversion = typeof videoConversions.$inferInsert;

// ─── Photo Restorations (사진 복원) ───
export const photoRestorations = mysqlTable("photo_restorations", {
  id: int("id").autoincrement().primaryKey(),
  clientId: int("clientId").notNull(),
  projectId: int("projectId"),
  originalUrl: text("originalUrl").notNull(),
  originalKey: varchar("originalKey", { length: 512 }).notNull(),
  restoredUrl: text("restoredUrl"),
  restoredKey: varchar("restoredKey", { length: 512 }),
  restorationType: mysqlEnum("restorationType", ["face_restore", "colorize", "denoise", "upscale", "full"]).default("full").notNull(),
  status: mysqlEnum("status", ["queued", "processing", "completed", "failed"]).default("queued").notNull(),
  errorMessage: text("errorMessage"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type PhotoRestoration = typeof photoRestorations.$inferSelect;
export type InsertPhotoRestoration = typeof photoRestorations.$inferInsert;

// ─── Notifications (알림) ───
export const notifications = mysqlTable("notifications", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  type: mysqlEnum("type", ["generation_complete", "photo_uploaded", "urgent_revision", "batch_complete", "delivery_viewed", "system"]).notNull(),
  title: varchar("title", { length: 255 }).notNull(),
  message: text("message"),
  relatedProjectId: int("relatedProjectId"),
  relatedClientId: int("relatedClientId"),
  isRead: boolean("isRead").default(false).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type Notification = typeof notifications.$inferSelect;
export type InsertNotification = typeof notifications.$inferInsert;
