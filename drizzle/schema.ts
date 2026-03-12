import { integer, pgEnum, pgTable, serial, text, timestamp, varchar, json, boolean } from "drizzle-orm/pg-core";

// ─── Enums ───
export const roleEnum = pgEnum("role", ["user", "admin"]);
export const genderEnum = pgEnum("gender", ["female", "male"]);
export const clientStatusEnum = pgEnum("client_status", ["consulting", "in_progress", "completed", "delivered"]);
export const photoTypeEnum = pgEnum("photo_type", ["front", "side", "additional", "face_reference"]);
export const projectCategoryEnum = pgEnum("project_category", ["wedding", "restoration", "kids", "profile", "video", "custom"]);
export const projectStatusEnum = pgEnum("project_status", ["draft", "generating", "review", "revision", "upscaling", "completed", "delivered"]);
export const priorityEnum = pgEnum("priority", ["low", "normal", "high", "urgent"]);
export const projectModeEnum = pgEnum("project_mode", ["single", "couple"]);
export const promptCategoryEnum = pgEnum("prompt_category", ["wedding", "restoration", "kids", "profile", "video", "custom"]);
export const generationStatusEnum = pgEnum("generation_status", ["pending", "generating", "completed", "failed", "reviewed", "approved", "rejected"]);
export const generationStageEnum = pgEnum("generation_stage", ["draft", "review", "upscaled", "final"]);
export const batchStatusEnum = pgEnum("batch_status", ["queued", "processing", "completed", "failed", "cancelled"]);
export const batchItemStatusEnum = pgEnum("batch_item_status", ["queued", "processing", "completed", "failed"]);
export const deliveryStatusEnum = pgEnum("delivery_status", ["preparing", "ready", "sent", "viewed"]);
export const videoStatusEnum = pgEnum("video_status", ["queued", "processing", "completed", "failed"]);
export const restorationTypeEnum = pgEnum("restoration_type", ["face_restore", "colorize", "denoise", "upscale", "full"]);
export const restorationStatusEnum = pgEnum("restoration_status", ["queued", "processing", "completed", "failed"]);
export const notificationTypeEnum = pgEnum("notification_type", ["generation_complete", "photo_uploaded", "urgent_revision", "batch_complete", "delivery_viewed", "system"]);

// ─── Users (Auth) ───
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: roleEnum("role").default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

// ─── Clients (고객 프로필) ───
export const clients = pgTable("clients", {
  id: serial("id").primaryKey(),
  userId: integer("userId").notNull(),
  name: varchar("name", { length: 100 }).notNull(),
  gender: genderEnum("gender").default("female").notNull(),
  phone: varchar("phone", { length: 30 }),
  email: varchar("email", { length: 320 }),
  consultationNotes: text("consultationNotes"),
  preferredConcept: varchar("preferredConcept", { length: 100 }),
  status: clientStatusEnum("status").default("consulting").notNull(),
  tags: json("tags").$type<string[]>(),
  partnerId: integer("partnerId"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});

export type Client = typeof clients.$inferSelect;
export type InsertClient = typeof clients.$inferInsert;

// ─── Client Photos (고객 원본 사진) ───
export const clientPhotos = pgTable("client_photos", {
  id: serial("id").primaryKey(),
  clientId: integer("clientId").notNull(),
  photoType: photoTypeEnum("photoType").notNull(),
  originalUrl: text("originalUrl").notNull(),
  fileKey: varchar("fileKey", { length: 512 }).notNull(),
  fileName: varchar("fileName", { length: 255 }),
  mimeType: varchar("mimeType", { length: 100 }),
  fileSize: integer("fileSize"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type ClientPhoto = typeof clientPhotos.$inferSelect;
export type InsertClientPhoto = typeof clientPhotos.$inferInsert;

// ─── Projects (작업 프로젝트) ───
export const projects = pgTable("projects", {
  id: serial("id").primaryKey(),
  clientId: integer("clientId").notNull(),
  userId: integer("userId").notNull(),
  title: varchar("title", { length: 255 }).notNull(),
  category: projectCategoryEnum("category").default("wedding").notNull(),
  concept: varchar("concept", { length: 255 }),
  status: projectStatusEnum("status").default("draft").notNull(),
  referenceImageUrl: text("referenceImageUrl"),
  referenceImageKey: varchar("referenceImageKey", { length: 512 }),
  pinterestUrl: text("pinterestUrl"),
  notes: text("notes"),
  priority: priorityEnum("priority").default("normal").notNull(),
  partnerClientId: integer("partnerClientId"),
  projectMode: projectModeEnum("projectMode").default("single").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});

export type Project = typeof projects.$inferSelect;
export type InsertProject = typeof projects.$inferInsert;

// ─── Prompt Library (프리미엄 프롬프트 라이브러리) ───
export const promptLibrary = pgTable("prompt_library", {
  id: serial("id").primaryKey(),
  userId: integer("userId").notNull(),
  category: promptCategoryEnum("category").default("wedding").notNull(),
  subcategory: varchar("subcategory", { length: 100 }),
  title: varchar("title", { length: 255 }).notNull(),
  prompt: text("prompt").notNull(),
  negativePrompt: text("negativePrompt"),
  parameters: json("parameters").$type<Record<string, unknown>>(),
  thumbnailUrl: text("thumbnailUrl"),
  usageCount: integer("usageCount").default(0).notNull(),
  rating: integer("rating").default(0),
  isDefault: boolean("isDefault").default(false).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});

export type PromptLibraryItem = typeof promptLibrary.$inferSelect;
export type InsertPromptLibraryItem = typeof promptLibrary.$inferInsert;

// ─── Generations (AI 생성 이력) ───
export const generations = pgTable("generations", {
  id: serial("id").primaryKey(),
  projectId: integer("projectId").notNull(),
  promptId: integer("promptId"),
  promptText: text("promptText").notNull(),
  negativePrompt: text("negativePrompt"),
  parameters: json("parameters").$type<Record<string, unknown>>(),
  resultImageUrl: text("resultImageUrl"),
  resultImageKey: varchar("resultImageKey", { length: 512 }),
  status: generationStatusEnum("status").default("pending").notNull(),
  qualityScore: integer("qualityScore"),
  faceConsistencyScore: integer("faceConsistencyScore"),
  reviewNotes: text("reviewNotes"),
  stage: generationStageEnum("stage").default("draft").notNull(),
  upscaledImageUrl: text("upscaledImageUrl"),
  upscaledImageKey: varchar("upscaledImageKey", { length: 512 }),
  generationTimeMs: integer("generationTimeMs"),
  merchandiseFormat: varchar("merchandiseFormat", { length: 100 }),
  outputWidth: integer("outputWidth"),
  outputHeight: integer("outputHeight"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});

export type Generation = typeof generations.$inferSelect;
export type InsertGeneration = typeof generations.$inferInsert;

// ─── Batch Jobs (배치 처리) ───
export const batchJobs = pgTable("batch_jobs", {
  id: serial("id").primaryKey(),
  userId: integer("userId").notNull(),
  projectId: integer("projectId"),
  title: varchar("title", { length: 255 }).notNull(),
  status: batchStatusEnum("status").default("queued").notNull(),
  totalItems: integer("totalItems").default(0).notNull(),
  completedItems: integer("completedItems").default(0).notNull(),
  failedItems: integer("failedItems").default(0).notNull(),
  batchConfig: json("batchConfig").$type<{
    faceFixMode?: boolean;
    glassesFixMode?: boolean;
    merchandiseFormat?: string;
    concepts?: string[];
  }>(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});

export type BatchJob = typeof batchJobs.$inferSelect;
export type InsertBatchJob = typeof batchJobs.$inferInsert;

// ─── Batch Job Items ───
export const batchJobItems = pgTable("batch_job_items", {
  id: serial("id").primaryKey(),
  batchJobId: integer("batchJobId").notNull(),
  projectId: integer("projectId"),
  generationId: integer("generationId"),
  promptText: text("promptText"),
  status: batchItemStatusEnum("status").default("queued").notNull(),
  errorMessage: text("errorMessage"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});

export type BatchJobItem = typeof batchJobItems.$inferSelect;
export type InsertBatchJobItem = typeof batchJobItems.$inferInsert;

// ─── Delivery Packages (고객 전달 패키지) ───
export const deliveryPackages = pgTable("delivery_packages", {
  id: serial("id").primaryKey(),
  projectId: integer("projectId").notNull(),
  clientId: integer("clientId").notNull(),
  title: varchar("title", { length: 255 }).notNull(),
  description: text("description"),
  watermarkEnabled: boolean("watermarkEnabled").default(false).notNull(),
  galleryUrl: text("galleryUrl"),
  downloadLinks: json("downloadLinks").$type<Array<{ resolution: string; url: string; key: string }>>(),
  status: deliveryStatusEnum("status").default("preparing").notNull(),
  expiresAt: timestamp("expiresAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});

export type DeliveryPackage = typeof deliveryPackages.$inferSelect;
export type InsertDeliveryPackage = typeof deliveryPackages.$inferInsert;

// ─── Video Conversions (영상 변환) ───
export const videoConversions = pgTable("video_conversions", {
  id: serial("id").primaryKey(),
  generationId: integer("generationId").notNull(),
  projectId: integer("projectId").notNull(),
  sourceImageUrl: text("sourceImageUrl").notNull(),
  videoUrl: text("videoUrl"),
  videoKey: varchar("videoKey", { length: 512 }),
  duration: integer("duration").default(5),
  motionType: varchar("motionType", { length: 50 }),
  customPrompt: text("customPrompt"),
  status: videoStatusEnum("status").default("queued").notNull(),
  errorMessage: text("errorMessage"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});

export type VideoConversion = typeof videoConversions.$inferSelect;
export type InsertVideoConversion = typeof videoConversions.$inferInsert;

// ─── Photo Restorations (사진 복원) ───
export const photoRestorations = pgTable("photo_restorations", {
  id: serial("id").primaryKey(),
  clientId: integer("clientId").notNull(),
  projectId: integer("projectId"),
  originalUrl: text("originalUrl").notNull(),
  originalKey: varchar("originalKey", { length: 512 }).notNull(),
  restoredUrl: text("restoredUrl"),
  restoredKey: varchar("restoredKey", { length: 512 }),
  restorationType: restorationTypeEnum("restorationType").default("full").notNull(),
  status: restorationStatusEnum("status").default("queued").notNull(),
  errorMessage: text("errorMessage"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});

export type PhotoRestoration = typeof photoRestorations.$inferSelect;
export type InsertPhotoRestoration = typeof photoRestorations.$inferInsert;

// ─── Notifications (알림) ───
export const notifications = pgTable("notifications", {
  id: serial("id").primaryKey(),
  userId: integer("userId").notNull(),
  type: notificationTypeEnum("type").notNull(),
  title: varchar("title", { length: 255 }).notNull(),
  message: text("message"),
  relatedProjectId: integer("relatedProjectId"),
  relatedClientId: integer("relatedClientId"),
  isRead: boolean("isRead").default(false).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type Notification = typeof notifications.$inferSelect;
export type InsertNotification = typeof notifications.$inferInsert;

// ─── 상품 포맷 프리셋 (상수) ───
export const MERCHANDISE_FORMATS = {
  acrylic_5x7: { name: "아크릴 액자 5x7", width: 1500, height: 2100, aspectRatio: "5:7", dpi: 300, category: "acrylic" },
  acrylic_8x10: { name: "아크릴 액자 8x10", width: 2400, height: 3000, aspectRatio: "4:5", dpi: 300, category: "acrylic" },
  acrylic_11x14: { name: "아크릴 액자 11x14", width: 3300, height: 4200, aspectRatio: "11:14", dpi: 300, category: "acrylic" },
  acrylic_16x20: { name: "아크릴 액자 16x20", width: 4800, height: 6000, aspectRatio: "4:5", dpi: 300, category: "acrylic" },
  tshirt_front: { name: "티셔츠 전면", width: 4500, height: 5400, aspectRatio: "5:6", dpi: 300, category: "tshirt" },
  tshirt_back: { name: "티셔츠 후면", width: 4500, height: 5400, aspectRatio: "5:6", dpi: 300, category: "tshirt" },
  mug_standard: { name: "머그컵 표준", width: 4200, height: 1800, aspectRatio: "7:3", dpi: 300, category: "mug" },
  mug_wrap: { name: "머그컵 풀랩", width: 5400, height: 2100, aspectRatio: "18:7", dpi: 300, category: "mug" },
  towel_face: { name: "페이스 타올", width: 3000, height: 4500, aspectRatio: "2:3", dpi: 200, category: "towel" },
  towel_bath: { name: "배스 타올", width: 4200, height: 8400, aspectRatio: "1:2", dpi: 200, category: "towel" },
  print_3d_figurine: { name: "3D 피규어 텍스처", width: 4096, height: 4096, aspectRatio: "1:1", dpi: 300, category: "3d" },
  print_3d_lithophane: { name: "3D 리소페인", width: 3000, height: 4000, aspectRatio: "3:4", dpi: 300, category: "3d" },
  canvas_square: { name: "캔버스 정사각", width: 4000, height: 4000, aspectRatio: "1:1", dpi: 300, category: "canvas" },
  canvas_landscape: { name: "캔버스 가로", width: 6000, height: 4000, aspectRatio: "3:2", dpi: 300, category: "canvas" },
  canvas_portrait: { name: "캔버스 세로", width: 4000, height: 6000, aspectRatio: "2:3", dpi: 300, category: "canvas" },
  mobile_invitation: { name: "모바일 청첩장", width: 1080, height: 1920, aspectRatio: "9:16", dpi: 72, category: "digital" },
  sns_instagram: { name: "인스타그램", width: 1080, height: 1080, aspectRatio: "1:1", dpi: 72, category: "digital" },
  sns_story: { name: "인스타 스토리", width: 1080, height: 1920, aspectRatio: "9:16", dpi: 72, category: "digital" },
} as const;

export type MerchandiseFormatKey = keyof typeof MERCHANDISE_FORMATS;
export type MerchandiseFormat = typeof MERCHANDISE_FORMATS[MerchandiseFormatKey];
