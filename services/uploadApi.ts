import { apiFetch } from "@/services/apiClient";

export type UploadKind = "avatar" | "chat-image" | "sticker" | "profile-background";
const MAX_IMAGE_BYTES = 8 * 1024 * 1024;

type OssUploadSignResponse = {
  upload?: {
    uploadUrl: string;
    publicUrl: string;
    method: "PUT";
    headers: Record<string, string>;
    objectKey: string;
    expires: number;
  };
};

type UploadOptions = {
  onProgress?: (progress: number | null) => void;
  retries?: number;
};

function mimeTypeFromUri(uri: string): string {
  const clean = uri.split("?")[0].toLowerCase();
  if (clean.endsWith(".png")) return "image/png";
  if (clean.endsWith(".webp")) return "image/webp";
  if (clean.endsWith(".gif")) return "image/gif";
  return "image/jpeg";
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isRetryableUploadError(error: unknown): boolean {
  if (!(error instanceof Error)) return true;
  const match = error.message.match(/图片上传失败：(\d+)/);
  if (!match) return true;
  return Number(match[1]) >= 500;
}

async function requestUploadSign(kind: UploadKind, mimeType: string) {
  const res = await apiFetch("/uploads/sign", {
    method: "POST",
    body: JSON.stringify({ kind, mimeType })
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({})) as { message?: string };
    throw new Error(data.message || `获取上传凭证失败：${res.status}`);
  }
  const data = (await res.json()) as OssUploadSignResponse;
  if (!data.upload?.uploadUrl || !data.upload.publicUrl) {
    throw new Error("上传凭证无效。");
  }
  return data.upload;
}

function putBlobWithProgress(uploadUrl: string, method: string, headers: Record<string, string>, body: Blob, options: UploadOptions): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open(method, uploadUrl);
    Object.entries(headers).forEach(([key, value]) => xhr.setRequestHeader(key, value));

    xhr.upload.onprogress = (event) => {
      options.onProgress?.(event.lengthComputable ? event.loaded / event.total : null);
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        options.onProgress?.(1);
        resolve();
        return;
      }
      reject(new Error(`图片上传失败：${xhr.status}`));
    };
    xhr.onerror = () => reject(new Error("网络不稳定，图片上传失败。"));
    xhr.ontimeout = () => reject(new Error("图片上传超时，请重试。"));
    xhr.timeout = 45000;
    xhr.send(body);
  });
}

export async function uploadImageToOss(uri: string, kind: UploadKind, options: UploadOptions = {}): Promise<string> {
  if (/^https?:/.test(uri)) return uri;

  const mimeType = mimeTypeFromUri(uri);
  const upload = await requestUploadSign(kind, mimeType);
  const fileResponse = await fetch(uri);
  const body = await fileResponse.blob();
  if (body.size > MAX_IMAGE_BYTES) {
    throw new Error("图片不能超过 8MB。");
  }

  const maxRetries = options.retries ?? 2;
  let lastError: unknown;
  for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
    try {
      options.onProgress?.(0);
      await putBlobWithProgress(upload.uploadUrl, upload.method, upload.headers, body, options);
      return upload.publicUrl;
    } catch (error) {
      lastError = error;
      if (attempt >= maxRetries || !isRetryableUploadError(error)) break;
      await delay(600 * (attempt + 1));
    }
  }

  throw lastError instanceof Error ? lastError : new Error("图片上传失败，请重试。");
}
