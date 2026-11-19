import { handleOptions } from "../_shared/cors.ts";
import { fail, fromError, ok } from "../_shared/response.ts";

export interface ParentFeedbackSubmission {
  parent_name: string;
  student_name: string | null;
  class_name: string | null;
  feedback: string;
}

export interface ParentFeedbackStore {
  submit(input: ParentFeedbackSubmission, networkKeyHmac: string): Promise<boolean>;
}

export interface ParentFeedbackDependencies {
  getRateLimitKey(req: Request): Promise<string>;
  getStore(): ParentFeedbackStore;
}

const MAX_REQUEST_BYTES = 16_000;
const MAX_SUBMISSIONS_PER_WINDOW = 5;
const UUID_SAFE_RESPONSE = { accepted: true };

interface InputObject {
  [key: string]: unknown;
}

function isObject(value: unknown): value is InputObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function normalizedText(
  value: unknown,
  maximumLength: number,
  required: boolean,
): string | null | undefined {
  if (value === undefined || value === null) {
    return required ? undefined : null;
  }
  if (typeof value !== "string") return undefined;
  const normalized = value.trim();
  const length = Array.from(normalized).length;
  if (required && length === 0) return undefined;
  if (length > maximumLength) return undefined;
  return normalized || null;
}

function parseSubmission(value: unknown): ParentFeedbackSubmission | null {
  if (!isObject(value)) return null;

  const parentName = normalizedText(value.parent_name, 120, true);
  const studentName = normalizedText(value.student_name, 120, false);
  const className = normalizedText(value.class_name, 80, false);
  const feedback = normalizedText(value.feedback, 4000, true);
  if (
    parentName === undefined || parentName === null ||
    studentName === undefined ||
    className === undefined ||
    feedback === undefined || feedback === null
  ) return null;

  if (value.website !== undefined && typeof value.website !== "string") return null;
  return {
    parent_name: parentName,
    student_name: studentName,
    class_name: className,
    feedback,
  };
}

export async function createRateLimitKey(req: Request, secret: string): Promise<string> {
  const clientAddress = req.headers.get("cf-connecting-ip")?.trim();
  if (!clientAddress || clientAddress.length > 64 || /[\s,]/.test(clientAddress)) {
    throw new Error("RATE_LIMIT_SOURCE_UNAVAILABLE");
  }
  if (secret.length < 32) throw new Error("RATE_LIMIT_SECRET_INVALID");

  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const digest = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(clientAddress),
  );
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function successResponse(): Response {
  return ok(UUID_SAFE_RESPONSE);
}

async function readRequestBody(req: Request): Promise<string | null> {
  if (!req.body) return "";
  const reader = req.body.getReader();
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    totalBytes += value.byteLength;
    if (totalBytes > MAX_REQUEST_BYTES) {
      await reader.cancel();
      return null;
    }
    chunks.push(value);
  }

  const bytes = new Uint8Array(totalBytes);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
}

export function createParentFeedbackHandler(dependencies: ParentFeedbackDependencies) {
  return async (req: Request): Promise<Response> => {
    const options = handleOptions(req);
    if (options) return options;
    if (req.method !== "POST") {
      return fail("METHOD_NOT_ALLOWED", "Chỉ hỗ trợ gửi phản hồi bằng POST.", 405);
    }

    const contentLengthHeader = req.headers.get("content-length");
    if (
      contentLengthHeader &&
      (!/^\d+$/u.test(contentLengthHeader) || Number(contentLengthHeader) > MAX_REQUEST_BYTES)
    ) {
      return fail("INVALID_INPUT", "Nội dung gửi lên quá lớn.", 413);
    }

    let networkKeyHmac: string;
    try {
      networkKeyHmac = await dependencies.getRateLimitKey(req);
    } catch {
      return fail(
        "RATE_LIMIT_UNAVAILABLE",
        "Biểu mẫu đang tạm thời không nhận được phản hồi. Vui lòng thử lại sau.",
        503,
      );
    }

    let rawBody: string | null;
    try {
      rawBody = await readRequestBody(req);
    } catch {
      return fail("INVALID_INPUT", "Dữ liệu gửi lên không hợp lệ.", 400);
    }
    if (rawBody === null) {
      return fail("INVALID_INPUT", "Nội dung gửi lên quá lớn.", 413);
    }

    let body: unknown;
    try {
      body = JSON.parse(rawBody);
    } catch {
      return fail("INVALID_INPUT", "Dữ liệu gửi lên không hợp lệ.", 400);
    }
    if (!isObject(body)) {
      return fail("INVALID_INPUT", "Dữ liệu gửi lên không hợp lệ.", 400);
    }

    const honeypot = body.website;
    if (honeypot !== undefined && typeof honeypot !== "string") {
      return fail("INVALID_INPUT", "Dữ liệu gửi lên không hợp lệ.", 400);
    }
    if (typeof honeypot === "string" && honeypot.trim()) {
      return successResponse();
    }

    const input = parseSubmission(body);
    if (!input) {
      return fail("INVALID_INPUT", "Vui lòng nhập họ tên và nội dung phản hồi hợp lệ.", 400);
    }

    try {
      const saved = await dependencies.getStore().submit(input, networkKeyHmac);
      if (!saved) {
        return fail(
          "RATE_LIMITED",
          "Bạn đã gửi nhiều phản hồi trong thời gian ngắn. Vui lòng thử lại sau.",
          429,
        );
      }
      return successResponse();
    } catch (error) {
      return fromError(error, undefined, { stage: "parent-feedback-submit" });
    }
  };
}

export const parentFeedbackRateLimit = {
  submissions: MAX_SUBMISSIONS_PER_WINDOW,
  windowMinutes: 10,
};
