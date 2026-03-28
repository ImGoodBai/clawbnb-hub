import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";

import { getUploadUrl } from "../api/api.js";
import type { WeixinApiOptions } from "../api/api.js";
import { aesEcbPaddedSize } from "./aes-ecb.js";
import { uploadBufferToCdn } from "./cdn-upload.js";
import { logger } from "../util/logger.js";
import { getExtensionFromContentTypeOrUrl } from "../media/mime.js";
import { tempFileName } from "../util/random.js";
import { UploadMediaType } from "../api/types.js";

export type UploadedFileInfo = {
  filekey: string;
  /** 由 upload_param 上传后 CDN 返回的下载加密参数; fill into ImageItem.media.encrypt_query_param */
  downloadEncryptedQueryParam: string;
  /** 缩略图下载参数（图片/视频时可用） */
  thumbDownloadEncryptedQueryParam?: string;
  /** AES-128-ECB key, hex-encoded; convert to base64 for CDNMedia.aes_key */
  aeskey: string;
  /** Plaintext file size in bytes */
  fileSize: number;
  /** Ciphertext file size in bytes (AES-128-ECB with PKCS7 padding); use for ImageItem.hd_size / mid_size */
  fileSizeCiphertext: number;
  /** Thumbnail plaintext/ciphertext size, when available */
  thumbFileSize?: number;
  thumbFileSizeCiphertext?: number;
};

/**
 * Download a remote media URL (image, video, file) to a local temp file in destDir.
 * Returns the local file path; extension is inferred from Content-Type / URL.
 */
export async function downloadRemoteImageToTemp(url: string, destDir: string): Promise<string> {
  logger.debug(`downloadRemoteImageToTemp: fetching url=${url}`);
  const res = await fetch(url);
  if (!res.ok) {
    const msg = `remote media download failed: ${res.status} ${res.statusText} url=${url}`;
    logger.error(`downloadRemoteImageToTemp: ${msg}`);
    throw new Error(msg);
  }
  const buf = Buffer.from(await res.arrayBuffer());
  logger.debug(`downloadRemoteImageToTemp: downloaded ${buf.length} bytes`);
  await fs.mkdir(destDir, { recursive: true });
  const ext = getExtensionFromContentTypeOrUrl(res.headers.get("content-type"), url);
  const name = tempFileName("weixin-remote", ext);
  const filePath = path.join(destDir, name);
  await fs.writeFile(filePath, buf);
  logger.debug(`downloadRemoteImageToTemp: saved to ${filePath} ext=${ext}`);
  return filePath;
}

/**
 * Common upload pipeline: read file → hash → gen aeskey → getUploadUrl → uploadBufferToCdn → return info.
 */
async function uploadMediaToCdn(params: {
  filePath: string;
  toUserId: string;
  opts: WeixinApiOptions;
  cdnBaseUrl: string;
  mediaType: (typeof UploadMediaType)[keyof typeof UploadMediaType];
  label: string;
  noNeedThumb?: boolean;
}): Promise<UploadedFileInfo> {
  const { filePath, toUserId, opts, cdnBaseUrl, mediaType, label, noNeedThumb } = params;

  const plaintext = await fs.readFile(filePath);
  const rawsize = plaintext.length;
  const rawfilemd5 = crypto.createHash("md5").update(plaintext).digest("hex");
  const filesize = aesEcbPaddedSize(rawsize);
  const filekey = crypto.randomBytes(16).toString("hex");
  const aeskey = crypto.randomBytes(16);

  logger.debug(
    `${label}: file=${filePath} rawsize=${rawsize} filesize=${filesize} md5=${rawfilemd5} filekey=${filekey}`,
  );

  const needThumb = mediaType === UploadMediaType.IMAGE || mediaType === UploadMediaType.VIDEO;
  const thumbPlaintext = needThumb ? plaintext : undefined;
  const thumbRawsize = thumbPlaintext?.length;
  const thumbRawfilemd5 = thumbPlaintext
    ? crypto.createHash("md5").update(thumbPlaintext).digest("hex")
    : undefined;
  const thumbFilesize = thumbRawsize ? aesEcbPaddedSize(thumbRawsize) : undefined;

  const uploadReq = {
    ...opts,
    filekey,
    media_type: mediaType,
    to_user_id: toUserId,
    rawsize,
    rawfilemd5,
    filesize,
    ...(needThumb
      ? {
          thumb_rawsize: thumbRawsize,
          thumb_rawfilemd5: thumbRawfilemd5,
          thumb_filesize: thumbFilesize,
        }
      : {}),
    aeskey: aeskey.toString("hex"),
    ...(noNeedThumb === undefined ? {} : { no_need_thumb: noNeedThumb }),
  };

  logger.debug(`${label}: getUploadUrl request=${JSON.stringify({ ...uploadReq, aeskey: '***' })}`);
  const uploadUrlResp = await getUploadUrl(uploadReq);

  const uploadParam = uploadUrlResp.upload_param;
  if (!uploadParam) {
    logger.error(
      `${label}: getUploadUrl returned no upload_param, resp=${JSON.stringify(uploadUrlResp)}`,
    );
    throw new Error(`${label}: getUploadUrl returned no upload_param`);
  }

  const { downloadParam: downloadEncryptedQueryParam } = await uploadBufferToCdn({
    buf: plaintext,
    uploadParam,
    filekey,
    cdnBaseUrl,
    aeskey,
    label: `${label}[orig filekey=${filekey}]`,
  });

  let thumbDownloadEncryptedQueryParam: string | undefined;
  if (needThumb && thumbPlaintext && uploadUrlResp.thumb_upload_param) {
    const thumbUploaded = await uploadBufferToCdn({
      buf: thumbPlaintext,
      uploadParam: uploadUrlResp.thumb_upload_param,
      filekey,
      cdnBaseUrl,
      aeskey,
      label: `${label}[thumb filekey=${filekey}]`,
    });
    thumbDownloadEncryptedQueryParam = thumbUploaded.downloadParam;
  }

  return {
    filekey,
    downloadEncryptedQueryParam,
    thumbDownloadEncryptedQueryParam,
    aeskey: aeskey.toString("hex"),
    fileSize: rawsize,
    fileSizeCiphertext: filesize,
    thumbFileSize: thumbRawsize,
    thumbFileSizeCiphertext: thumbFilesize,
  };
}

/** Upload a local image file to the Weixin CDN with AES-128-ECB encryption. */
export async function uploadFileToWeixin(params: {
  filePath: string;
  toUserId: string;
  opts: WeixinApiOptions;
  cdnBaseUrl: string;
}): Promise<UploadedFileInfo> {
  return uploadMediaToCdn({
    ...params,
    mediaType: UploadMediaType.IMAGE,
    label: "uploadFileToWeixin",
  });
}

/** Upload a local video file to the Weixin CDN. */
export async function uploadVideoToWeixin(params: {
  filePath: string;
  toUserId: string;
  opts: WeixinApiOptions;
  cdnBaseUrl: string;
}): Promise<UploadedFileInfo> {
  return uploadMediaToCdn({
    ...params,
    mediaType: UploadMediaType.VIDEO,
    label: "uploadVideoToWeixin",
  });
}

/**
 * Upload a local file attachment (non-image, non-video) to the Weixin CDN.
 * Uses media_type=FILE; no thumbnail required.
 */
export async function uploadFileAttachmentToWeixin(params: {
  filePath: string;
  fileName: string;
  toUserId: string;
  opts: WeixinApiOptions;
  cdnBaseUrl: string;
}): Promise<UploadedFileInfo> {
  return uploadMediaToCdn({
    ...params,
    mediaType: UploadMediaType.FILE,
    label: "uploadFileAttachmentToWeixin",
    noNeedThumb: true,
  });
}
