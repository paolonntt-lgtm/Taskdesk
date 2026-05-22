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
      .select({ id: ticketAttachmentsTable.id })
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
