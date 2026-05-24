import { useState, useEffect } from "react";
import { doc, getDoc } from "firebase/firestore";
import { db } from "../firebase";
import { useAuth } from "../context/AuthContext";

export function useUploadLimit(projectId) {
  const { user } = useAuth();
  const [uploadCount, setUploadCount] = useState(0);
  const [canUpload, setCanUpload] = useState(true);
  const [loading, setLoading] = useState(true);

  const today = new Date().toISOString().split("T")[0];

  useEffect(() => {
    if (!user || !projectId) return;
    const ref = doc(db, "users", user.uid, "uploadLimits", projectId);
    getDoc(ref).then(snap => {
      if (snap.exists()) {
        const data = snap.data();
        if (data.date === today) {
          setUploadCount(data.count || 0);
          setCanUpload((data.count || 0) < 2);
        } else {
          setUploadCount(0);
          setCanUpload(true);
        }
      }
      setLoading(false);
    });
  }, [user, projectId, today]);

  return { uploadCount, canUpload, loading, remaining: Math.max(0, 2 - uploadCount) };
}
