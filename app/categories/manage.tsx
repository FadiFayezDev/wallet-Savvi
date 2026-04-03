import { useLocalSearchParams } from "expo-router";
import CategoriesTabScreen from "@/app/(tabs)/categories";

export default function CategoriesManageScreen() {
  const params = useLocalSearchParams<{ type?: "expense" | "income" }>();
  
  return <CategoriesTabScreen initialType={params.type} />;
}
