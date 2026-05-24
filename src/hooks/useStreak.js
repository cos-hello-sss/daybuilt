import { useState, useEffect } from "react";
import { doc, getDoc } from "firebase/firestore";
import { db } from "../firebase";

export function useStreak(projectId) {
  const [streak, setStreak] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!projectId) return;
    const ref = doc(db, "projects", projectId);
    getDoc(ref).then(snap => {
      if (snap.exists()) {
        setStreak(snap.data().currentStreak || 0);
      }
      setLoading(false);
    });
  }, [projectId]);

  return { streak, loading };
}

export function computeStreakUpdate(lastLogDate, currentStreak) {
  if (!lastLogDate) return { currentStreak: 1, lastLogDate: new Date().toISOString().split("T")[0] };

  const today = new Date().toISOString().split("T")[0];
  const yesterday = new Date(Date.now() - 86400000).toISOString().split("T")[0];
  const last = lastLogDate.split("T")[0];

  if (last === today) {
    // Already logged today, no streak change
    return { currentStreak, lastLogDate };
  } else if (last === yesterday) {
    // Consecutive day — extend streak
    return { currentStreak: currentStreak + 1, lastLogDate: today };
  } else {
    // Streak broken
    return { currentStreak: 1, lastLogDate: today };
  }
}
