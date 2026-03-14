import { useMemo } from "react";
import { Alert, Pressable, Text, View } from "react-native";
import { useTheme } from "react-native-paper";

const isOperator = (value: string) => ["+", "-", "*", "/"].includes(value);

const tokenize = (expr: string) => {
  const tokens: string[] = [];
  let i = 0;
  while (i < expr.length) {
    const ch = expr[i];
    if (ch === " ") {
      i += 1;
      continue;
    }
    if (/[0-9.]/.test(ch)) {
      let num = ch;
      i += 1;
      while (i < expr.length && /[0-9.]/.test(expr[i])) {
        num += expr[i];
        i += 1;
      }
      tokens.push(num);
      continue;
    }
    if (isOperator(ch) || ch === "(" || ch === ")") {
      tokens.push(ch);
      i += 1;
      continue;
    }
    i += 1;
  }

  // Handle unary minus
  const normalized: string[] = [];
  for (let j = 0; j < tokens.length; j += 1) {
    const token = tokens[j];
    const prev = normalized[normalized.length - 1];
    if (token === "-" && (j === 0 || (prev && (isOperator(prev) || prev === "(")))) {
      const next = tokens[j + 1];
      if (next && /^[0-9.]+$/.test(next)) {
        normalized.push(`-${next}`);
        j += 1;
        continue;
      }
    }
    normalized.push(token);
  }
  return normalized;
};

export const evaluateExpression = (expr: string) => {
  const tokens = tokenize(expr);
  if (tokens.length === 0) return null;
  const output: string[] = [];
  const ops: string[] = [];
  const prec: Record<string, number> = { "+": 1, "-": 1, "*": 2, "/": 2 };

  for (const token of tokens) {
    if (/^-?[0-9.]+$/.test(token)) {
      output.push(token);
      continue;
    }
    if (isOperator(token)) {
      while (ops.length) {
        const top = ops[ops.length - 1];
        if (isOperator(top) && prec[top] >= prec[token]) {
          output.push(ops.pop() as string);
        } else {
          break;
        }
      }
      ops.push(token);
      continue;
    }
    if (token === "(") {
      ops.push(token);
      continue;
    }
    if (token === ")") {
      while (ops.length && ops[ops.length - 1] !== "(") {
        output.push(ops.pop() as string);
      }
      ops.pop();
    }
  }

  while (ops.length) {
    output.push(ops.pop() as string);
  }

  const stack: number[] = [];
  for (const token of output) {
    if (/^-?[0-9.]+$/.test(token)) {
      const value = Number(token);
      if (!Number.isFinite(value)) return null;
      stack.push(value);
      continue;
    }
    const b = stack.pop();
    const a = stack.pop();
    if (a == null || b == null) return null;
    switch (token) {
      case "+":
        stack.push(a + b);
        break;
      case "-":
        stack.push(a - b);
        break;
      case "*":
        stack.push(a * b);
        break;
      case "/":
        stack.push(b === 0 ? NaN : a / b);
        break;
    }
  }
  const result = stack.pop();
  if (result == null || !Number.isFinite(result)) return null;
  return Math.round(result * 100) / 100;
};

type CalculatorKeyboardProps = {
  expression: string;
  onChange: (value: string) => void;
  onSubmit: (value: number) => void;
  locale?: "ar" | "en";
};

export function CalculatorKeyboard({
  expression,
  onChange,
  onSubmit,
  locale = "ar",
}: CalculatorKeyboardProps) {
  const theme = useTheme();
  const preview = useMemo(() => evaluateExpression(expression), [expression]);

  const append = (value: string) => {
    if (!expression && isOperator(value) && value !== "-") return;
    const last = expression.slice(-1);
    if (isOperator(last) && isOperator(value)) {
      onChange(`${expression.slice(0, -1)}${value}`);
      return;
    }
    onChange(`${expression}${value}`);
  };

  const onEquals = () => {
    if (preview == null) {
      Alert.alert(locale === "ar" ? "عملية غير صحيحة" : "Invalid expression");
      return;
    }
    onSubmit(preview);
  };

  return (
    <View>
      <View
        style={{
          borderRadius: 12,
          padding: 12,
          backgroundColor: theme.colors.surfaceVariant,
          marginBottom: 12,
        }}
      >
        <Text style={{ color: theme.colors.onSurface, fontSize: 18, fontWeight: "700" }}>
          {expression || "0"}
        </Text>
        <Text style={{ color: theme.colors.onSurfaceVariant, marginTop: 4 }}>
          {preview == null ? "-" : preview}
        </Text>
      </View>

      {[
        ["7", "8", "9", "/"],
        ["4", "5", "6", "*"],
        ["1", "2", "3", "-"],
        ["0", ".", "DEL", "+"],
      ].map((row) => (
        <View key={row.join("-")} style={{ flexDirection: "row", gap: 8, marginBottom: 8 }}>
          {row.map((key) => (
            <Pressable
              key={key}
              onPress={() => {
                if (key === "DEL") {
                  onChange(expression.slice(0, -1));
                  return;
                }
                append(key);
              }}
              style={{
                flex: 1,
                borderRadius: 10,
                paddingVertical: 14,
                backgroundColor: isOperator(key) ? theme.colors.secondaryContainer : theme.colors.surfaceVariant,
                alignItems: "center",
              }}
            >
              <Text style={{ color: theme.colors.onSurface, fontSize: 16, fontWeight: "700" }}>{key}</Text>
            </Pressable>
          ))}
        </View>
      ))}

      <View style={{ flexDirection: "row", gap: 8 }}>
        <Pressable
          onPress={() => onChange("")}
          style={{
            flex: 1,
            borderRadius: 10,
            paddingVertical: 14,
            backgroundColor: theme.colors.surfaceVariant,
            alignItems: "center",
          }}
        >
          <Text style={{ color: theme.colors.onSurface, fontSize: 16, fontWeight: "700" }}>
            {locale === "ar" ? "مسح" : "Clear"}
          </Text>
        </Pressable>
        <Pressable
          onPress={onEquals}
          style={{
            flex: 1,
            borderRadius: 10,
            paddingVertical: 14,
            backgroundColor: theme.colors.primary,
            alignItems: "center",
          }}
        >
          <Text style={{ color: theme.colors.onPrimary, fontSize: 16, fontWeight: "800" }}>
            =
          </Text>
        </Pressable>
      </View>
    </View>
  );
}
