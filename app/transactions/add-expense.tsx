import { useEffect } from "react";
import { useRouter } from "expo-router";

export default function AddExpenseScreen() {
  const router = useRouter();

  useEffect(() => {
    router.replace({ pathname: "/transactions/add", params: { tab: "expense" } });
  }, [router]);

  return null;
}
