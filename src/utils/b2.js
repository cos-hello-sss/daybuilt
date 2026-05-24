import imageCompression from "browser-image-compression";

const B2_ACCOUNT_ID = "e87cd74ecb28";
const B2_APPLICATION_KEY = "K006ezxtowQ9qVP7HXr3dir+3W5DcFI";
const B2_BUCKET_ID = "ce88270c3df7445e9ceb0218";
const B2_BUCKET_NAME = "builtday-media";

let authToken = null;
let apiUrl = null;
let downloadUrl = null;

export async function authorizeB2() {
  if (authToken) return { authToken, apiUrl, downloadUrl };

  const credentials = btoa(`${B2_ACCOUNT_ID}:${B2_APPLICATION_KEY}`);
  const response = await fetch(
    "https://api.backblazeb2.com/b2api/v3/b2_authorize_account",
    {
      headers: { Authorization: `Basic ${credentials}` }
    }
  );

  if (!response.ok) throw new Error("B2 authorization failed");

  const data = await response.json();
  authToken = data.authorizationToken;
  apiUrl = data.apiInfo.storageApi.apiUrl;
  downloadUrl = data.downloadUrl;

  return { authToken, apiUrl, downloadUrl };
}

export async function getUploadUrl() {
  const { authToken: token, apiUrl: api } = await authorizeB2();

  const response = await fetch(`${api}/b2api/v3/b2_get_upload_url`, {
    method: "POST",
    headers: {
      Authorization: token,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ bucketId: B2_BUCKET_ID })
  });

  if (!response.ok) throw new Error("Failed to get upload URL");
  return response.json();
}

export async function compressAndUpload(file, userId, projectId, logId) {
  // Compress image before upload
  const options = {
    maxSizeMB: 1,
    maxWidthOrHeight: 1920,
    useWebWorker: true,
    onProgress: () => {}
  };

  let fileToUpload = file;
  if (file.type.startsWith("image/")) {
    fileToUpload = await imageCompression(file, options);
  }

  const { uploadUrl, authorizationToken } = await getUploadUrl();

  const timestamp = Date.now();
  const ext = file.name.split(".").pop();
  const fileName = `${userId}/${projectId}/${logId}/${timestamp}.${ext}`;

  const arrayBuffer = await fileToUpload.arrayBuffer();

  const response = await fetch(uploadUrl, {
    method: "POST",
    headers: {
      Authorization: authorizationToken,
      "X-Bz-File-Name": encodeURIComponent(fileName),
      "Content-Type": file.type || "b2/x-auto",
      "Content-Length": arrayBuffer.byteLength,
      "X-Bz-Content-Sha1": "do_not_verify"
    },
    body: arrayBuffer
  });

  if (!response.ok) throw new Error("Upload to B2 failed");

  const result = await response.json();
  const { downloadUrl: dlUrl } = await authorizeB2();

  return {
    fileId: result.fileId,
    fileName: result.fileName,
    url: `${dlUrl}/file/${B2_BUCKET_NAME}/${encodeURIComponent(fileName)}`
  };
}
