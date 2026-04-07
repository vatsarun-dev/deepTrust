import { createContext, useContext, useEffect, useMemo, useState } from "react";

const AppContext = createContext(null);
const USER_STORAGE_KEY = "deeptrust_user";

export function AppProvider({ children }) {
  const [analysisResult, setAnalysisResult] = useState(null);
  const [complaintDraft, setComplaintDraft] = useState(null);
  const [lastComplaint, setLastComplaint] = useState(null);
  const [user, setUserState] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    try {
      const storedUser = window.localStorage.getItem(USER_STORAGE_KEY);

      if (storedUser) {
        setUserState(JSON.parse(storedUser));
      }
    } catch (error) {
      console.warn(`Unable to restore saved user session: ${error.message}`);
    }
  }, []);

  const setUser = (nextUser) => {
    setUserState(nextUser);

    try {
      if (nextUser) {
        window.localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(nextUser));
      } else {
        window.localStorage.removeItem(USER_STORAGE_KEY);
      }
    } catch (error) {
      console.warn(`Unable to persist user session: ${error.message}`);
    }
  };

  const value = useMemo(
    () => ({
      analysisResult,
      setAnalysisResult,
      complaintDraft,
      setComplaintDraft,
      lastComplaint,
      setLastComplaint,
      user,
      setUser,
      loading,
      setLoading,
    }),
    [analysisResult, complaintDraft, lastComplaint, user, loading]
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useAppContext() {
  const context = useContext(AppContext);

  if (!context) {
    throw new Error("useAppContext must be used within an AppProvider");
  }

  return context;
}
