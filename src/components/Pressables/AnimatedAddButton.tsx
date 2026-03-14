import React from "react";
import { Pressable, Text } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router"; // شيلنا الـ Href import عشان مش محتاجينه خلاص
import Animated, { 
  useSharedValue, 
  useAnimatedStyle, 
  withTiming,
  withSpring
} from "react-native-reanimated";

// ١. غير الـ Interface لـ any في الـ pathname
interface AnimatedAddButtonProps {
  title: string;
  pathname: any; // استخدمنا any عشان نقفل صياح الـ TS بخصوص الـ Routes
  backgroundColor: string;
  textColor: string;
  className?: string;
}

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export default function AnimatedAddButton({ 
  title, 
  pathname, 
  backgroundColor, 
  textColor,
  className
}: AnimatedAddButtonProps) {
  const router = useRouter();
  const opacity = useSharedValue(1);
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ scale: scale.value }],
  }));

  const handlePressIn = () => {
    opacity.value = withTiming(0.7, { duration: 400 });
    scale.value = withTiming(0.95, { duration: 200 });
  };

  const handlePressOut = () => {
    opacity.value = withTiming(1, { duration: 400 });
    scale.value = withSpring(1);
  };

  return (
    <AnimatedPressable
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      // ٢. ابعتها مباشرة، الـ any فوق حلت المشكلة
      onPress={() => router.push(pathname)} 
      style={[
        { backgroundColor, borderRadius: 28 },
        animatedStyle
      ]}
      className={`h-[48px] min-h-[48px] px-4 items-center justify-center elevation-6 flex flex-row ${className ?? ""}`}
    >
      <Ionicons name="add" size={24} color={textColor} />
      <Text style={{ color: textColor }} className="text-xs font-bold ml-1">
        {title}
      </Text>
    </AnimatedPressable>
  );
}