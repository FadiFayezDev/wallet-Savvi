import { useEffect } from "react";
import { useRouter } from "expo-router";

export default function AddIncomeScreen() {
  const router = useRouter();

  useEffect(() => {
    router.replace({ pathname: "/transactions/add", params: { tab: "income" } });
  }, [router]);

  return null;
}
