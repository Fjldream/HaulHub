import { apiUploadFile } from "@/lib/api-client";
import { getAiBillIntakeIdentity } from "@/lib/ai-bill-intake-proxy";

/**
 * 上传 AI 账单识别要使用的图片。
 *
 * @param request 当前 HTTP 请求。
 * @returns 主后端文件服务返回的图片 URL。
 */
export async function POST(request: Request) {
  const identity = await getAiBillIntakeIdentity();
  if (!identity.ok) {
    return identity.response;
  }

  const formData = await request.formData();
  const file = formData.get("file");
  if (!(file instanceof File) || file.size <= 0) {
    return Response.json({ message: "请选择要识别的账单图片。" }, { status: 400 });
  }
  if (file.type && !file.type.startsWith("image/")) {
    return Response.json({ message: "仅支持上传图片文件。" }, { status: 400 });
  }

  try {
    const uploaded = await apiUploadFile(file);
    return Response.json({ file: uploaded });
  } catch (error) {
    const message = error instanceof Error ? error.message : "账单图片上传失败。";
    return Response.json({ message }, { status: 500 });
  }
}
