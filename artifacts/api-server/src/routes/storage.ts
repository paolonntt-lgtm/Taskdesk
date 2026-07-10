import { Router, type IRouter, type Request, type Response } from "express";
import { Readable } from "stream";
import { eq, and } from "drizzle-orm";
import {
  RequestUploadUrlBody,
  RequestUploadUrlResponse,
} from "@workspace/api-zod";
import { db, ticketAttachmentsTable, ticketsTable } from "@workspace/db";
import { ObjectStorageService, ObjectNotFoundError } from "../lib/objectStorage";
import { requireAuth } from "../middlewares/auth";
import { registerPendingUpload } from "../lib/pendingUploads";
import {
  ALLOWED_ATTACHMENT_MIME_TYPES,
  MAX_UPLOAD_SIZE_BYTES,
  ACTIVE_CONTENT_MIME_TYPES,
} from "../lib/allowedMimeTypes";
import { checkAndIncrementUploadRateLimit } from "../lib/uploadRateLimiter";

const router: IRouter = Router();
const objectStorageService = new ObjectStorageService();

/**
 * POST /storage/uploads/request-url
 *
 * Request a presigned URL for file upload.
 * The client sends JSON metadata (name, size, contentType) — NOT the file.
 * Then uploads the file directly to the returned presigned URL.
 */
router.post("/storage/uploads/request-url", requireAuth, async (req: Request, res: Response) => {
  const parsed = RequestUploadUrlBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Missing or invalid required fields" });
    return;
  }

  try {
    const { name, size, contentType } = parsed.data;

    const currentUser = (req as any).currentUser;
    const orgId: number | null = currentUser.organizationId ?? null;

    // Per-user rate limit: even though each signed URL can technically receive
    // an arbitrarily large upload (GCS PUT URLs carry no Content-Length
    // constraint), limiting how many URLs a single user can obtain per window
    // caps the total orphaned storage they can create per time period.
    if (!checkAndIncrementUploadRateLimit(currentUser.id)) {
      res.status(429).json({ error: "Too many upload requests. Please wait before uploading more files." });
      return;
    }

    // Enforce server-side content-type allowlist — the browser UI already
    // restricts file types, but callers can bypass the UI and call the API
    // directly with any contentType value.
    if (!ALLOWED_ATTACHMENT_MIME_TYPES.has(contentType)) {
      res.status(400).json({ error: "File type not allowed" });
      return;
    }

    // Enforce a server-side size cap. The signed URL is issued before the
    // file is uploaded, so this is the only place we can reject oversized
    // requests before storage is consumed.
    if (size > MAX_UPLOAD_SIZE_BYTES) {
      res.status(400).json({ error: `File too large. Maximum allowed size is ${MAX_UPLOAD_SIZE_BYTES / (1024 * 1024)} MB` });
      return;
    }

    const uploadURL = await objectStorageService.getObjectEntityUploadURL();
    const objectPath = objectStorageService.normalizeObjectEntityPath(uploadURL);

    // Bind the issued objectPath to the requesting user/org so the
    // attachment-creation handler can verify provenance server-side.
    registerPendingUpload(objectPath, currentUser.id, orgId);


    res.json(
      RequestUploadUrlResponse.parse({
        uploadURL,
        objectPath,
        metadata: { name, size, contentType },
      }),
    );
  } catch (error) {
    req.log.error({ err: error }, "Error generating upload URL");
    res.status(500).json({ error: "Failed to generate upload URL" });
  }
});

/**
 * GET /storage/public-objects/*
 *
 * Serve public assets from PUBLIC_OBJECT_SEARCH_PATHS.
 * These are unconditionally public — no authentication or ACL checks.
 * IMPORTANT: Always provide this endpoint when object storage is set up.
 */
router.get("/storage/public-objects/*filePath", async (req: Request, res: Response) => {
  try {
    const raw = req.params.filePath;
    const filePath = Array.isArray(raw) ? raw.join("/") : raw;
    const file = await objectStorageService.searchPublicObject(filePath);
    if (!file) {
      res.status(404).json({ error: "File not found" });
      return;
    }

    const response = await objectStorageService.downloadObject(file);

    res.status(response.status);
    response.headers.forEach((value, key) => res.setHeader(key, value));

    if (response.body) {
      const nodeStream = Readable.fromWeb(response.body as ReadableStream<Uint8Array>);
      nodeStream.pipe(res);
    } else {
      res.end();
    }
  } catch (error) {
    req.log.error({ err: error }, "Error serving public object");
    res.status(500).json({ error: "Failed to serve public object" });
  }
});

/**
 * GET /storage/objects/*
 *
 * Serve object entities from PRIVATE_OBJECT_DIR.
 * Requires authentication and validates that the requested path corresponds
 * to a recorded attachment in the database (prevents unauthenticated access
 * and path traversal to arbitrary private objects).
 */
router.get("/storage/objects/*path", requireAuth, async (req: Request, res: Response) => {
  try {
    const raw = req.params.path;
    const wildcardPath = Array.isArray(raw) ? raw.join("/") : raw;
    const objectPath = `/objects/${wildcardPath}`;

    const currentUser = (req as any).currentUser;
    const orgId: number | null = currentUser.organizationId ?? null;

    // Non-superadmin users without an org cannot access any attachment.
    if (!currentUser.isSuperAdmin && orgId === null) {
      res.status(403).json({ error: "Forbidden" });
      return;
    }

    const attachmentQuery = db
      .select({
        id: ticketAttachmentsTable.id,
        fileName: ticketAttachmentsTable.fileName,
        mimeType: ticketAttachmentsTable.mimeType,
      })
      .from(ticketAttachmentsTable)
      .innerJoin(ticketsTable, eq(ticketsTable.id, ticketAttachmentsTable.ticketId));

    const orgCondition = eq(ticketAttachmentsTable.objectPath, objectPath);

    // Superadmins can access attachments across all organizations.
    // Regular users must belong to the same organization as the ticket.
    const whereClause = currentUser.isSuperAdmin
      ? orgCondition
      : and(orgCondition, eq(ticketsTable.organizationId, orgId!));

    const [attachment] = await attachmentQuery.where(whereClause).limit(1);

    if (!attachment) {
      res.status(403).json({ error: "Forbidden" });
      return;
    }

    const objectFile = await objectStorageService.getObjectEntityFile(objectPath);

    const response = await objectStorageService.downloadObject(objectFile);

    res.status(response.status);
    response.headers.forEach((value, key) => res.setHeader(key, value));

    // Always force download to prevent the browser from rendering the file
    // inline under the TaskDesk origin, which would enable stored-XSS via
    // malicious attachments (e.g. HTML or SVG files).
    const safeFileName = (attachment.fileName ?? "attachment").replace(/[^\w.\-]/g, "_");
    res.setHeader("Content-Disposition", `attachment; filename="${safeFileName}"`);

    // Derive the active-content check from the authoritative GCS Content-Type
    // header (set via downloadObject which calls file.getMetadata()), NOT from
    // the DB attachment.mimeType, which is caller-supplied at save time and
    // could differ from what was actually stored in GCS.
    const gcsContentType = response.headers.get("content-type") ?? "application/octet-stream";
    if (ACTIVE_CONTENT_MIME_TYPES.has(gcsContentType)) {
      res.setHeader("Content-Type", "application/octet-stream");
    }

    // Prevent content-sniffing that could bypass the Content-Type override.
    res.setHeader("X-Content-Type-Options", "nosniff");

    if (response.body) {
      const nodeStream = Readable.fromWeb(response.body as ReadableStream<Uint8Array>);
      nodeStream.pipe(res);
    } else {
      res.end();
    }
  } catch (error) {
    if (error instanceof ObjectNotFoundError) {
      req.log.warn({ err: error }, "Object not found");
      res.status(404).json({ error: "Object not found" });
      return;
    }
    req.log.error({ err: error }, "Error serving object");
    res.status(500).json({ error: "Failed to serve object" });
  }
});

export default router;
