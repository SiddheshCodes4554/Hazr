import React, { useState } from "react";
import { View, TextInput, Text, TextInputProps } from "react-native";

interface InputProps extends TextInputProps {
  label?: string;
  error?: string;
  containerClassName?: string;
  inputClassName?: string;
}

/**
 * Reusable, high-fidelity input component.
 * Features customizable label, focused states, and error validations.
 */
export const Input = React.forwardRef<TextInput, InputProps>(
  ({ label, error, containerClassName = "", inputClassName = "", ...props }, ref) => {
    const [isFocused, setIsFocused] = useState(false);

    return (
      <View className={`w-full mb-4.5 ${containerClassName}`}>
        {label && (
          <Text className="text-foreground/70 text-xs font-semibold mb-1.5 ml-1 select-none">
            {label}
          </Text>
        )}
        
        <View
          className={`w-full flex-row items-center border rounded-xl px-4 py-3.5 bg-card/50 ${
            error
              ? "border-destructive"
              : isFocused
              ? "border-primary"
              : "border-border"
          }`}
        >
          <TextInput
            ref={ref}
            className={`flex-1 text-foreground text-sm py-0.5 ${inputClassName}`}
            placeholderTextColor="hsl(var(--muted-foreground))"
            onFocus={() => setIsFocused(true)}
            onBlur={() => setIsFocused(false)}
            style={{ textAlignVertical: props.multiline ? "top" : "center" }}
            {...props}
          />
        </View>

        {error && (
          <Text className="text-destructive text-xs mt-1 ml-1 font-medium">
            {error}
          </Text>
        )}
      </View>
    );
  }
);

Input.displayName = "Input";

export default Input;
