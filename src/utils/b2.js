import imageCompression from "browser-image-compression";
import { supabase } from "../supabase";

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

  // Create unique file name
  const timestamp = Date.now();
  const ext = file.name.split(".").pop();
  const fileName = `${userId}/${projectId}/${logId}/${timestamp}.${ext}`;
  const filePath = `projects/${projectId}/${fileName}`;

  try {
    // Upload to Supabase
    const { data, error } = await supabase.storage
      .from("project-logs")
      .upload(filePath, fileToUpload);

    if (error) {
      throw new Error(`Supabase upload failed: ${error.message}`);
    }

    // Get public URL
    const { data: publicData } = supabase.storage
      .from("project-logs")
      .getPublicUrl(filePath);

    return {
      fileId: data.id,
      fileName: data.name,
      url: publicData.publicUrl
    };
  } catch (err) {
    throw new Error(`Upload failed: ${err.message}`);
  }
}
