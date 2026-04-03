import CategoriesTabScreen from "@/app/(tabs)/categories";
import { useLocalSearchParams } from "expo-router";

export default function CategoriesManageScreen() {
  const params = useLocalSearchParams<{ type?: "expense" | "income" }>();

  return <CategoriesTabScreen initialType={params.type} />;
}
