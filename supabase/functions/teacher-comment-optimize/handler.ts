import { handleOptions } from "../_shared/cors.ts";
import { fail, fromError, ok } from "../_shared/response.ts";

const GEMINI_MODEL = "gemini-3.8-flash";
const MAX_COMMENT_LENGTH = 2000;
const GEMINI_TIMEOUT_MS = 20_000;

const systemInstruction = [
  "Bạn là giáo viên nhận xét học sinh của Trung Tâm luyện thi Hùng Cường.",
  "Hãy viết lại nhận xét bằng tiếng Việt, chuyên nghiệp, ấm áp và dễ tiếp nhận với phụ huynh.",
  "Giữ nguyên ý nghĩa và mọi dữ kiện có trong nhận xét gốc; không tự thêm điểm số, sự kiện, chẩn đoán hoặc lời hứa.",
  "Dùng câu văn tự nhiên, rõ ràng, ngắn gọn. Chỉ trả về nhận xét đã viết lại, không thêm tiêu đề hay giải thích.",
].join(" ");

export interface OptimizeCaller {
  user: { id: string };
  profile: { role: string; status: string };
}

export interface OptimizeDependencies {
  getCaller: (request: Request) => Promise<OptimizeCaller>;
  isActiveTeacher: (userId: string) => Promise<boolean>;
  getApiKey: () => string | undefined;
  fetcher?: typeof fetch;
  timeoutMs?: number;
}

interface GeminiResponse {
  candidates?: Array<{
    content?: { parts?: Array<{ text?: string }> };
  }>;
}

export function createTeacherCommentOptimizeHandler(dependencies: OptimizeDependencies) {
  const fetcher = dependencies.fetcher || fetch;

  return async (request: Request): Promise<Response> => {
    const options = handleOptions(request);
    if (options) return options;
    if (request.method !== "POST") {
      return fail("METHOD_NOT_ALLOWED", "Phương thức không được hỗ trợ.", 405);
    }

    let caller: OptimizeCaller;
    try {
      caller = await dependencies.getCaller(request);
    } catch (error) {
      return fromError(error);
    }

    if (
      caller.profile.role !== "TEACHER" || caller.profile.status !== "ACTIVE" ||
      !await dependencies.isActiveTeacher(caller.user.id)
    ) {
      return fail("FORBIDDEN", "Chỉ giáo viên đang hoạt động mới dùng được tính năng này.", 403);
    }

    let body: { comment?: unknown };
    try {
      body = await request.json() as { comment?: unknown };
    } catch {
      return fail("INVALID_INPUT", "Nội dung nhận xét không hợp lệ.", 400);
    }

    if (typeof body.comment !== "string" || !body.comment.trim()) {
      return fail("COMMENT_REQUIRED", "Nhập nhận xét trước khi yêu cầu tối ưu.", 400);
    }
    const comment = body.comment.trim();
    if (comment.length > MAX_COMMENT_LENGTH) {
      return fail("COMMENT_TOO_LONG", "Nhận xét tối đa 2.000 ký tự.", 400);
    }

    const apiKey = dependencies.getApiKey()?.trim();
    if (!apiKey) {
      return fail("GEMINI_API_KEY_MISSING", "Tính năng AI chưa được cấu hình.", 503);
    }

    try {
      const optimizedComment = await requestGemini(comment, apiKey, fetcher, dependencies.timeoutMs ?? GEMINI_TIMEOUT_MS);
      return ok({ optimized_comment: optimizedComment });
    } catch (error) {
      const code = error instanceof GeminiRequestError ? error.code : "GEMINI_UNAVAILABLE";
      const message = code === "GEMINI_RATE_LIMIT"
        ? "Gemini đang giới hạn yêu cầu. Vui lòng thử lại sau."
        : code === "GEMINI_EMPTY_RESPONSE"
        ? "Gemini chưa tạo được nhận xét. Nội dung gốc vẫn được giữ nguyên."
        : "Không thể kết nối Gemini lúc này. Nội dung gốc vẫn được giữ nguyên.";
      const status = code === "GEMINI_RATE_LIMIT" ? 429 : 502;
      return fail(code, message, status);
    }
  };
}

class GeminiRequestError extends Error {
  constructor(readonly code: string) {
    super(code);
  }
}

async function requestGemini(comment: string, apiKey: string, fetcher: typeof fetch, timeoutMs: number): Promise<string> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetcher(
      `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": apiKey,
        },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: systemInstruction }] },
          contents: [{ role: "user", parts: [{ text: comment }] }],
          generationConfig: { temperature: 0.35, maxOutputTokens: 512 },
        }),
        signal: controller.signal,
      },
    );
    if (response.status === 429) throw new GeminiRequestError("GEMINI_RATE_LIMIT");
    if (!response.ok) throw new GeminiRequestError("GEMINI_REQUEST_FAILED");

    let payload: GeminiResponse;
    try {
      payload = await response.json() as GeminiResponse;
    } catch {
      throw new GeminiRequestError("GEMINI_EMPTY_RESPONSE");
    }

    const result = payload.candidates?.[0]?.content?.parts
      ?.map((part) => part.text || "")
      .join("")
      .trim();
    if (!result) throw new GeminiRequestError("GEMINI_EMPTY_RESPONSE");
    return result;
  } catch (error) {
    if (error instanceof GeminiRequestError) throw error;
    throw new GeminiRequestError("GEMINI_UNAVAILABLE");
  } finally {
    clearTimeout(timeout);
  }
}
